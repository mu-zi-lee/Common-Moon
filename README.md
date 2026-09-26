# Common Moon / 共月

Real teammates work on one project from different places. Each reviewable task becomes a sector of a complete low-poly 3D Moon. A focus session lights a temporary scanning signal. Submitting work leaves the sector under fog until another teammate reviews the evidence and approves it. Only then does the Moon reveal that piece. When the team finishes every task, the full Moon appears.

Inspired by “千里共婵娟” (sharing the same moon across a thousand miles) and HackWashU's **Fly Me to the Moon** prompt. The optional Lunar Relay rescue game remains available at `/?tutorial=1`; the real project is the main experience.

The Moon uses textures from [NASA Scientific Visualization Studio's Moon Kit](https://svs.gsfc.nasa.gov/4720/). Hexasphere generates the hex/pentagon globe; Three.js / React Three Fiber map lunar texture across its tiles. Photon Spectrum connects the project agent to Telegram. The tile-world and growing-settlement direction is inspired by [Before We Leave](https://www.team17.com/games/before-we-leave/), without using its art.

## Run locally

Node 24 is recommended.

```sh
npm ci
npm run dev
```

Open the Vite URL. **Explore interactive sample** is a local two-seat simulation stored only in your browser. It does not contact Telegram or Supabase. Use it to demonstrate focus, submission, cross-teammate review, and lunar reveal.

```sh
npm test
npm run typecheck
npm run build
npm run build:docker
npm run build:bot
```

## Real crew

1. Apply `supabase/migrations/20260926000100_lunar_relay.sql` and `supabase/migrations/20260926000200_moon_projects.sql` in order. Existing CosLog data is untouched. Both new table sets have RLS enabled without public policies.
2. Provide `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the **private web server** environment. Never expose a service key with a `VITE_*` prefix or in browser code.
3. Create a project, invite 1-3 teammates with its link, add tasks with concrete acceptance criteria, and assign every task before launching. Launch fixes the task count and Moon sectors. Members authenticate through long random tokens in HTTP-only cookies, not Supabase user accounts.
4. Configure a Photon Spectrum project and a Telegram bot. Provide `PHOTON_PROJECT_ID`, `PHOTON_PROJECT_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` to the Bot container. In a group, copy `/pair CODE` from the web project. Each teammate sends their own `/bind CODE`. Group privacy mode can remain on: commands and direct mentions are explicit.
5. Use `/status` to see numbered sectors; `/plan` or `@Bot ...` asks the agent for a suggestion. `/add`, `/assign`, `/launch`, `/focus`, `/pause`, `/submit`, `/approve`, `/reject`, and `/block` work through the same server-side rules as the website. The agent may suggest but cannot create or approve tasks by itself.

The optional `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` enable an OpenAI-compatible planning model. Without them `/plan` gives fixed guidance. The bot only sees the project's task state, not private chats or a teammate's unstated work. **Web actions appear in the project via polling, but do not currently push unsolicited Telegram notifications.**

## Deployment

Keep the website published through Lovable, or self-host web and bot. Never rewrite pushed history on the connected branch:

```sh
cp .env.example .env.production
# Fill in private credentials in .env.production
docker compose --env-file .env.production up -d --build bot
```

For the full self-hosted web app with Caddy HTTPS, point `DOMAIN` at your server and run:

```sh
docker compose --env-file .env.production --profile selfhost up -d --build
```

The website builds a Nitro Node server in Docker; the default Lovable build retains its Cloudflare preset. The Photon Telegram provider streams inbound messages to the bot, so it does not need a public HTTP port. Live Photon/Supabase integration must be verified with credentials on your deployment; local simulation does not validate the network path.

## Hackathon

The provided HackWashU Fall 2026 deck describes **September 25-27, 2026** and the theme **Fly Me to the Moon**. It lists team formation/registration for Sunday **10:00 AM**, while the project submission hard deadline is Sunday **12:00 PM** (local St. Louis time). The Photon bonus track requires Spectrum integration and a messaging agent. Main rubric: impact, creativity, user experience. It also says submissions must be newly built this weekend, and teams are limited to four.
