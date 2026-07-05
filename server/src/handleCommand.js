const fetch = require('node-fetch');
const { pool } = require('./db');

const DISCORD_API = 'https://discord.com/api/v10';

// --- Dedup: has this interaction_id already been processed? ---
async function alreadyProcessed(interactionId) {
  const result = await pool.query(
    'SELECT 1 FROM interactions WHERE interaction_id = $1',
    [interactionId]
  );
  return result.rowCount > 0;
}

// --- Simple rule engine: flag input if it contains configured keywords ---
async function applyRule(commandName, text) {
  const configResult = await pool.query(
    'SELECT flagged_keywords FROM command_config WHERE command_name = $1',
    [commandName]
  );
  const keywords = (configResult.rows[0]?.flagged_keywords || '')
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);

  const lowerText = (text || '').toLowerCase();
  const hit = keywords.find((k) => k && lowerText.includes(k));
  return hit ? `flagged: matched "${hit}"` : 'ok: no rule matched';
}

// --- Log the interaction (insert once; dedup guards against re-insert races) ---
async function logInteraction({ interactionId, commandName, userTag, rawInput, ruleResult, status }) {
  await pool.query(
    `INSERT INTO interactions (interaction_id, command_name, user_tag, raw_input, rule_result, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (interaction_id) DO NOTHING`,
    [interactionId, commandName, userTag, rawInput, ruleResult, status]
  );
}

async function updateStatus(interactionId, status) {
  await pool.query('UPDATE interactions SET status = $1 WHERE interaction_id = $2', [status, interactionId]);
}

// --- Mirror a notification to Slack webhook or Discord channel webhook ---
async function mirrorNotification(text) {
  const url = process.env.MIRROR_WEBHOOK_URL;
  if (!url) return { ok: false, error: 'MIRROR_WEBHOOK_URL not set' };

  // Slack webhooks expect { text }. Discord channel webhooks expect { content }.
  // Sending both keys is harmless — each platform ignores the field it doesn't use.
  const body = { text, content: text };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// --- Post a follow-up message to the deferred interaction (used when we need >3s) ---
async function sendFollowup(applicationId, interactionToken, content) {
  const url = `${DISCORD_API}/webhooks/${applicationId}/${interactionToken}`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
}

/**
 * Main entry point: process a slash-command interaction.
 * Returns the immediate response body to send back to Discord (type 4 = respond now).
 */
async function handleSlashCommand(interaction) {
  const interactionId = interaction.id;
  const commandName = interaction.data?.name;
  const userTag = interaction.member?.user?.username || interaction.user?.username || 'unknown';
  const rawInput = interaction.data?.options?.[0]?.value || '';

  console.log('[handleCommand] incoming interaction', { interactionId, commandName, userTag, rawInput });

  // Dedup guard — this one check we still need before replying, to avoid
  // double-processing. Keep it fast — it's a single indexed lookup.
  const alreadyProcessedResult = await alreadyProcessed(interactionId);
  if (alreadyProcessedResult) {
    return {
      type: 4,
      data: { content: 'Already processed this one — no action taken twice.' },
    };
  }

  const ruleResult = await applyRule(commandName, rawInput);

  const response = {
    type: 4,
    data: {
      content: `Got it. Command: /${commandName} -> ${ruleResult}`,
      // Only show a "Mark Resolved" button on commands where that makes sense.
      ...(['report', 'escalate'].includes(commandName)
        ? {
          components: [
            {
              type: 1, // ACTION_ROW
              components: [
                {
                  type: 2, // BUTTON
                  style: 3, // success (green)
                  label: 'Mark Resolved',
                  custom_id: `resolve:${interactionId}`,
                },
              ],
            },
          ],
        }
        : {}),
    },
  };

  // Fire off logging + mirroring WITHOUT awaiting them here — Discord only
  // waits ~3s for the reply above. Anything slower (webhook calls, extra
  // queries) happens in the background after we've already answered.
  (async () => {
    try {
      await logInteraction({
        interactionId,
        commandName,
        userTag,
        rawInput,
        ruleResult,
        status: 'processed',
      });

      const mirrorText = `[${commandName}] from ${userTag}: "${rawInput}" -> ${ruleResult}`;
      const mirrorResult = await mirrorNotification(mirrorText);

      if (!mirrorResult.ok) {
        await updateStatus(interactionId, 'processed_mirror_failed');
      }

      console.log('[handleCommand] background work complete', { interactionId, mirrorResult });
    } catch (err) {
      console.error('[handleCommand] background work FAILED', { interactionId, error: err.message });
    }
  })();

  console.log('[handleCommand] outgoing response (immediate)', { interactionId, response });
  return response;
}

// --- Handle a button click (interaction type 3) ---
async function handleButtonClick(interaction) {
  const customId = interaction.data?.custom_id || '';
  const [action, interactionId] = customId.split(':');

  console.log('[handleCommand] button clicked', { action, interactionId });

  if (action === 'resolve') {
    await updateStatus(interactionId, 'resolved');

    // type 7 = UPDATE_MESSAGE — edits the original message in place
    // instead of sending a new one.
    return {
      type: 7,
      data: {
        content: `✅ Marked as resolved by ${interaction.member?.user?.username || 'someone'}.`,
        components: [], // remove the button after it's been used
      },
    };
  }

  return {
    type: 7,
    data: { content: 'Unrecognized action.', components: [] },
  };
}

// --- Show a modal form (used when a command wants richer input than one option) ---
function buildFeedbackModal() {
  return {
    type: 9, // MODAL
    data: {
      custom_id: 'feedback_modal',
      title: 'Submit Feedback',
      components: [
        {
          type: 1, // ACTION_ROW
          components: [
            {
              type: 4, // TEXT_INPUT
              custom_id: 'feedback_text',
              style: 2, // paragraph (multi-line)
              label: 'What would you like to share?',
              required: true,
              max_length: 500,
            },
          ],
        },
      ],
    },
  };
}

// --- Handle a modal submission (interaction type 5) ---
async function handleModalSubmit(interaction) {
  const interactionId = interaction.id;
  const userTag = interaction.member?.user?.username || interaction.user?.username || 'unknown';

  // Modal submissions nest the input value differently than slash command options.
  const rawInput = interaction.data?.components?.[0]?.components?.[0]?.value || '';
  const commandName = 'feedback'; // reuse the existing "feedback" rule config

  console.log('[handleCommand] modal submitted', { interactionId, userTag, rawInput });

  if (await alreadyProcessed(interactionId)) {
    return { type: 4, data: { content: 'Already processed this one.' } };
  }

  const ruleResult = await applyRule(commandName, rawInput);
  const response = {
    type: 4,
    data: { content: `Thanks! Feedback logged -> ${ruleResult}` },
  };

  (async () => {
    try {
      await logInteraction({ interactionId, commandName, userTag, rawInput, ruleResult, status: 'processed' });
      const mirrorText = `[feedback-form] from ${userTag}: "${rawInput}" -> ${ruleResult}`;
      const mirrorResult = await mirrorNotification(mirrorText);
      if (!mirrorResult.ok) await updateStatus(interactionId, 'processed_mirror_failed');
    } catch (err) {
      console.error('[handleCommand] modal background work FAILED', err.message);
    }
  })();

  return response;
}

module.exports = { handleSlashCommand, sendFollowup, handleButtonClick, buildFeedbackModal, handleModalSubmit };
