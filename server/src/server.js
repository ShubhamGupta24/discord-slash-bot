require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { initDb, pool } = require('./db');
const { verifyDiscordRequest } = require('./verifyDiscord');
const { handleSlashCommand } = require('./handleCommand');
const { login, requireAuth } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CORS: only the React frontend's origin(s) may call this API ---
const allowedOrigins = (process.env.CLIENT_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
  })
);

// --- Capture raw body for Discord's Ed25519 signature verification. ---
// This MUST run before any other body-parsing for the /api/interactions route,
// since Discord signs the exact raw bytes it sent.
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// ---------- Discord Interactions Endpoint (public, signature-verified) ----------
app.post(
  '/api/interactions',
  verifyDiscordRequest(process.env.DISCORD_PUBLIC_KEY),
  async (req, res) => {
    const interaction = req.body;
    console.log('[server] interaction received', {
      type: interaction.type,
      commandName: interaction.data?.name,
      userId: interaction.member?.user?.id || interaction.user?.id,
      rawInput: interaction.data?.options?.[0]?.value,
    });

    if (interaction.type === 1) {
      return res.json({ type: 1 }); // PONG
    }

    if (interaction.type === 2) {
      try {
        const response = await handleSlashCommand(interaction);
        console.log('[server] interaction response', response);
        return res.json(response);
      } catch (err) {
        console.error('Error handling command:', err);
        return res.json({
          type: 4,
          data: { content: 'Something went wrong processing that command.' },
        });
      }
    }

    return res.status(400).send('Unhandled interaction type');
  }
);

// ---------- Auth ----------
app.post('/api/auth/login', (req, res) => {
  console.log('[server] auth login request', { username: req.body?.username });
  login(req, res);
});

// ---------- Dashboard data API (all protected by JWT) ----------
app.get('/api/logs', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM interactions ORDER BY created_at DESC LIMIT 100');
  console.log('[server] /api/logs response', { count: result.rows.length });
  res.json(result.rows);
});

app.get('/api/config', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM command_config');
  console.log('[server] /api/config response', result.rows);
  res.json(result.rows);
});

app.post('/api/config', requireAuth, async (req, res) => {
  const { commandName, flaggedKeywords } = req.body;
  console.log('[server] saving config', { commandName, flaggedKeywords });
  await pool.query(
    `INSERT INTO command_config (command_name, flagged_keywords)
     VALUES ($1, $2)
     ON CONFLICT (command_name) DO UPDATE SET flagged_keywords = $2`,
    [commandName, flaggedKeywords]
  );
  const result = await pool.query('SELECT * FROM command_config');
  res.json(result.rows);
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---------- Boot ----------
initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`API server listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
