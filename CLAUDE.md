# AI Notes

## Tools and models used
Built with Claude (Sonnet) via the Claude.ai chat interface, used conversationally
throughout — no autonomous agent mode. Roughly: I described the requirement or
pasted an error/log, Claude proposed a diagnosis and a specific file change, I
applied it and reported back what happened. All architecture decisions, bug
fixes, and the split into a separate React client + Express API were done this
way, iteration by iteration, rather than one large generated dump.

## How work was split
- **AI**: generated the initial project scaffold (Express routes, Ed25519
  verification middleware, Postgres schema, React components), and every
  subsequent fix was AI-diagnosed from pasted terminal logs and error output.
- **Me**: ran every command, deployed services (Neon, Discord Developer
  Portal, ngrok, Render), tested against the real Discord server, and decided
  which stretch goals to pursue (buttons, modal) and which command set to
  build (report/status/note/feedback/escalate/ping).

## 2–3 key decisions and why

1. **Split into a separate Express API + React (Vite) client, rather than a
   single server-rendered app.** Started with an EJS server-rendered
   dashboard, then rebuilt as two independent apps once I wanted a nicer
   frontend. The tradeoff: this requires CORS configuration and a JWT-based
   stateless auth model instead of server sessions, which added real
   complexity (see hardest bug, below) — but it more clearly separates "the
   thing Discord talks to" from "the thing the admin looks at," which matches
   how the assignment frames the two roles.

2. **Guild-specific command registration instead of global.** Global slash
   commands can take up to an hour to propagate; registering against a single
   guild ID (`/applications/{id}/guilds/{guild_id}/commands`) makes commands
   appear instantly, which was essential for fast iteration while debugging.
   Documented in `register.js` as a deliberate choice, with the global
   endpoint left in a comment for whenever this needs to work across servers.

3. **Config-driven rule engine instead of hardcoded keyword checks.** Keywords
   for each command live in a `command_config` Postgres table, editable from
   the dashboard, rather than as constants in code. This was a direct response
   to the assignment's stretch goal ("configurable command behavior in the UI
   rather than hard-coded"), and meant that adding a new command (`note`,
   `feedback`, `escalate`, `ping`) only ever required a backend seed-row change
   — the React dropdown picks up new commands automatically with no frontend
   code changes.

## The hardest bug (or wrong turn)

The most misleading failure was Discord returning **"The application did not
respond"** on real commands, even though the database and mirror webhook were
both succeeding — confirmed by checking Postgres directly and seeing correct
rows land seconds after Discord had already given up and shown the error to
the user.

What was actually happening: my interaction handler `await`ed every step in
sequence before replying — dedup check, rule lookup, the Postgres insert,
*and* the mirror webhook call — all before sending anything back to Discord.
Individually each step was fast, but chained together and routed through an
ngrok tunnel, the total sometimes crossed Discord's ~3 second reply window.
Discord doesn't wait past that; it shows a client-facing error and moves on,
even though my server kept working and completed everything a moment later.
This was confusing precisely because every downstream system (DB, webhook)
looked completely healthy — the bug was purely about response *timing*, not
correctness.

I noticed it by adding structured `console.log` statements at each stage
(dedup, rule match, insert, mirror, reply) and comparing timestamps against
when Discord's error appeared — the log for the insert/mirror always showed
up *after* the Discord error had already been shown, which pointed at the
3-second window rather than a logic bug.

The fix: restructure the handler so only the fast pre-checks (dedup lookup,
keyword lookup) happen before the reply, and the slow work (the Postgres
insert and the mirror webhook call) runs in the background, unawaited, after
the reply has already been sent. This is a close cousin of Discord's official
"deferred response" pattern, but reduces to a simpler shape once the reply
itself doesn't depend on the slow steps at all.

A related, less severe issue: an AI-suggested `command_config` value got
corrupted early on because I pasted a full example command into a keyword
input field meant for comma-separated words, which silently produced garbage
rule matches (e.g. matching the literal string `/report text: payment gateway
is down for all users` as a single "keyword"). Caught by comparing expected
vs. actual `rule_result` values in the logged rows, not by any error — a
reminder that this kind of app can fail silently through bad data just as
easily as through bad code.

## What I'd improve or add with more time
- Move the deferred-response pattern from ad-hoc (background `async` IIFE) to
  Discord's official type-5 deferred acknowledgment + follow-up webhook, for
  any command that might do genuinely slow work (e.g. an AI triage step).
- Add the AI summarization/triage stretch goal (Gemini or Groq) on top of the
  existing rule engine.
- Multi-server support — `command_config` and `interactions` currently assume
  a single Discord guild; adding a `guild_id` column would isolate config and
  logs per server.
- Reduce verbose `console.log` output behind a `DEBUG` env flag before
  calling this fully "production-ready" — current logging was invaluable for
  debugging but is noisier than I'd want in a real deployment's log stream.
- Automated tests for the rule engine and dedup logic, rather than manual
  Discord-based testing for every change.