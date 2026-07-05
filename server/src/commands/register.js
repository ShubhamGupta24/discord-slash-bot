// Run once (locally) with: npm run register-commands
// Registers commands to a specific guild (server) for instant visibility
// while testing. Switch to the global endpoint (see comment below) once
// you're ready to make commands available across every server.
require('dotenv').config();
const fetch = require('node-fetch');

const APP_ID = process.env.DISCORD_APP_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

const commands = [
  {
    name: 'report',
    description: 'Submit a short report or issue',
    options: [
      {
        name: 'text',
        description: 'What are you reporting?',
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: 'status',
    description: 'Check the bot status',
  },
  {
    name: 'note',
    description: 'Log a quick note for the team',
    options: [
      {
        name: 'text',
        description: 'What do you want to note?',
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: 'feedback',
    description: 'Share feedback or a suggestion',
    options: [
      {
        name: 'text',
        description: 'Your feedback',
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: 'escalate',
    description: 'Flag something as urgent — always mirrors to the alert channel',
    options: [
      {
        name: 'text',
        description: 'What needs urgent attention?',
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: 'ping',
    description: 'Check if the bot is responsive',
  },
];

async function registerCommands() {
  // Guild-specific endpoint — commands appear instantly in this one server.
  // Global endpoint (commands appear in every server, but can take up to an
  // hour to propagate) would instead be:
  // `https://discord.com/api/v10/applications/${APP_ID}/commands`
  const url = `https://discord.com/api/v10/applications/${APP_ID}/guilds/${GUILD_ID}/commands`;

  const res = await fetch(url, {
    method: 'PUT', // PUT replaces all commands in this guild with this list
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to register commands: ${res.status} ${text}`);
  }

  const data = await res.json();
  console.log('[registerCommands] registered commands', data.map((c) => c.name));
}

registerCommands().catch((err) => {
  console.error(err);
  process.exit(1);
});