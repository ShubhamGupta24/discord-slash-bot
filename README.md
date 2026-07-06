# Discord Slash-Command Bot — API + React Dashboard

## Requirement checklist (for reviewers)

- ✅ **Deployed, publicly reachable web app** — Server: https://discord-slash-bot-vxnl.onrender.com (Render). Dashboard: https://discord-slash-bot-drab.vercel.app/dashboard (Vercel).
- ✅ **Discord application/bot with 2+ slash commands** — 7 commands registered: `/report`, `/status`, `/note`, `/feedback-form`, `/escalate`, `/ping`.
- ✅ **Working interactions endpoint** — `POST /api/interactions`, Ed25519-signature-verified, handles PING (type 1), slash commands (type 2), button clicks (type 3), and modal submissions (type 5).
- ✅ **Bot writes back** — every command gets an immediate reply in Discord; `/report` and `/escalate` also attach a "Mark Resolved" button.
- ✅ **Mirrors to a second channel** — every processed command posts a notification to a Discord channel webhook (configurable to a Slack Incoming Webhook instead, via `MIRROR_WEBHOOK_URL`).
- ✅ **Dashboard behind login** — React app at `/login`, JWT-authenticated, shows the live command log and a dropdown to edit each command's keyword rules.
- ✅ **This README** — local run instructions and deployment notes below.

## Two separate apps in this repo

- **`server/`** — Express JSON API: handles Discord's Interactions endpoint
  (signature-verified) and serves dashboard data over `/api/*` routes,
  protected by JWT.
- **`client/`** — React (Vite) single-page app: login screen + dashboard
  (command log, rule configuration, light/dark theme toggle). Talks to the
  server purely over HTTP/JSON.

## Architecture

```
Discord ──POST──▶ server (/api/interactions)  ──▶ Postgres
                          │
                          ├──▶ reply back to Discord
                          └──▶ mirror webhook (2nd channel)

React app ──fetch──▶ server (/api/logs, /api/config, /api/auth/login)
```

The two apps are deployed and run independently. The client only needs the
server's public URL (`VITE_API_URL`); the server only needs the client's
public URL (`CLIENT_ORIGIN`) for CORS.

## Commands

| Command | Input | Purpose |
|---|---|---|
| `/report` | text | Submit an issue; flags on `urgent,bug,down` |
| `/status` | none | Health check |
| `/note` | text | Quick team note; flags on `todo,blocked,reminder,follow up` |
| `/feedback` | text | Inline feedback; flags on `broken,doesn't work,confusing,slow,crash` |
| `/feedback-form` | modal | Same as `/feedback`, via a popup form instead of inline text |
| `/escalate` | text | Urgent flag; flags on `urgent,critical,down,broken,now` |
| `/ping` | none | Bot responsiveness check |

Keywords for each command are stored in Postgres (`command_config` table) and
editable live from the dashboard — not hardcoded.

## Running locally

### 1. Server
```bash
cd server
npm install
cp .env.example .env   # fill in real values
npm run register-commands   # one-time: registers all commands to your test guild
npm start
```
Server runs on whichever `PORT` is set in `.env` (defaults to 3000).

### 2. Client
```bash
cd client
npm install
cp .env.example .env   # VITE_API_URL=http://localhost:<server port>
npm run dev
```
Client runs on `http://localhost:5173`.

Log in with the `ADMIN_USERNAME` / `ADMIN_PASSWORD` you set in `server/.env`.

### 3. Exposing the server to Discord (local testing only)
Discord cannot call `localhost`. Use ngrok:
```bash
ngrok http <server port>
```
Paste the ngrok HTTPS URL + `/api/interactions` into the Discord Developer
Portal's **Interactions Endpoint URL** field. Re-do this every time ngrok
restarts (free tier issues a new URL each time).

## Environment variables

**`server/.env`**
| Variable | Purpose |
|---|---|
| `DISCORD_APP_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN` | From Discord Developer Portal |
| `DISCORD_GUILD_ID` | Test server ID — commands register instantly to this guild |
| `DISCORD_TARGET_CHANNEL_ID` | Reserved for future use (not currently read by the code) |
| `MIRROR_WEBHOOK_URL` | Discord channel webhook or Slack Incoming Webhook URL |
| `DATABASE_URL` | Postgres connection string (Neon/Supabase) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Dashboard login |
| `JWT_SECRET` | Random string signing login tokens |
| `CLIENT_ORIGIN` | Public URL of the deployed React app (for CORS) |
| `PORT` | Set automatically by most hosts; defaults to 3000 locally |

**`client/.env`**
| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Public URL of the deployed Express server |

## How this was deployed

- **Server** deployed to **Render** as a Node web service. Root directory
  `server`, build command `npm install`, start command `npm start`. All
  env vars above set directly in Render's dashboard (never committed to the
  repo).
- **Client** deployed to **Vercel**. Root directory `client`, build command
  `npm run build`, output directory `dist`. `VITE_API_URL` set to the
  server's Render URL.
- After both were live, `CLIENT_ORIGIN` on the server was updated to the
  client's real Vercel URL (not `localhost`), and the server was redeployed
  so CORS allows requests from it.
- Discord's Interactions Endpoint URL was updated to the Render server's
  real URL + `/api/interactions` (permanent, unlike the ngrok URL used
  during local development).

**Note on Render's free tier:** the service spins down after ~15 minutes of
inactivity and takes 30–60 seconds to wake on the next request. The first
interaction after a quiet period may appear slow or briefly fail in Discord
for that reason — a known free-tier limitation, not an application bug.

## Auth model
Login posts credentials to `/api/auth/login`; the server returns a signed
JWT (12h expiry). The client stores it and sends it as
`Authorization: Bearer <token>` on every dashboard API call. Stateless by
design — no server-side sessions — which is why CORS + explicit origin
allow-listing (`CLIENT_ORIGIN`) matters here.

## Testing it
- Invite the bot to a test server via the OAuth2 URL Generator (scopes:
  `bot`, `applications.commands`; permissions: `View Channels`,
  `Send Messages`).
- Run any command listed above in that server.
- Log in to the deployed dashboard URL with the admin credentials to see the
  command appear in the live log, with its rule result and status.
- Try `/report` or `/escalate`, then click the "Mark Resolved" button that
  appears on the reply, to test the button/component interaction path.
- Run `/feedback-form` to test the modal interaction path.

## Known limitations / not yet implemented
- No multi-server isolation — `command_config` and `interactions` are shared
  across every server the bot is in.
- No AI triage/summarization step.
- Deferred-response pattern (Discord's official "thinking..." + follow-up)
  isn't used — the current handler replies immediately after a fast
  dedup+rule check and does logging/mirroring in the background instead. See
  `AI_NOTES.md` for the reasoning and the bug this was built to fix.
