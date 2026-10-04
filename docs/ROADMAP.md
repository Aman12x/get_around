# Get Around: roadmap

Hosting target: **Railway**, as one web service (Fastify serves both the game and `/api`) plus a Railway Postgres database.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Backend | **TypeScript: Fastify on Node 22**, Drizzle ORM, Postgres | The server reuses the game's own rules (`src/game/*`) and types, so client and server can't disagree on a score or a save. Requests are I/O-bound, so a faster language would buy nothing measurable. |
| Topology | One service on one origin | No cross-origin requests and no API URL compiled into the build. Login cookies work without extra setup. Split into separate services only if traffic ever demands it. |
| Sign-in | **Guest first**, with optional **Google** and **email magic link** (Better Auth, emails via Resend) | Nobody hits a signup wall. Signing in later merges the guest's progress into the account. |
| Leaderboards | **Later** (Phase 4) | Anti-cheat (server-checked answers) is only needed once scores are public, so the two ship together. |

How it stays fast:
- App and database run in the same Railway region and talk over the private network.
- Progress saves locally first and syncs in the background.
- Static files are fingerprinted and cached forever.
- Optionally, Cloudflare in front of the custom domain.

How it scales: the server keeps no state between requests, so you can add Railway replicas, then a connection pooler, then Postgres read replicas. Redis is only worth adding if leaderboard queries become hot.

---

## Phase 1: Railway-ready ✅ (this branch)

- [x] Fastify server (`server/`) with:
  - [x] `/health`: reports the version and database status, and returns 503 if a configured database is unreachable.
  - [x] `/api/version`.
  - [x] Static hosting with cache rules: fingerprinted assets are cached forever, HTML is always revalidated.
  - [x] Brotli and gzip compression.
  - [x] Security headers (CSP, helmet).
  - [x] Unknown pages fall back to the game; unknown `/api` paths return a JSON 404.
  - [x] Graceful SIGTERM shutdown.
- [x] Postgres connection (Drizzle and postgres.js), with configuration checked by zod at startup.
- [x] Migrations pipeline: `npm run db:generate` creates them and `node dist-server/migrate.js` applies them (Railway's pre-deploy command).
- [x] Multi-stage `Dockerfile` (the runtime image contains production dependencies only and runs as the non-root `node` user), `docker-compose.yml` and `.env.example`.
- [x] `npm run dev` runs the game and the API together; Vite forwards `/api` to the API.
- [x] Speed:
  - [x] The world map is drawn at build time (`npm run bake:globe`) instead of in every browser.
  - [x] Three.js is split into its own long-cached chunk.
  - [x] The game shows a loading screen while the 3D engine downloads.
  - [x] Each country's questions load only when you fly there.
- [x] CI: content checks, unit and server tests, a stale-map check, the build, and a Docker image that must boot and pass `/health`.

## Phase 2: Accounts and cloud save

- [ ] Better Auth: guest sessions, Google OAuth and email magic links (Resend). Sessions use httpOnly, SameSite=Lax cookies.
- [ ] Linking a guest account: progress merges by keeping the best score per topic and combining visited countries.
- [ ] Tables: `users`, plus Better Auth's `session`, `account` and `verification`, plus:
  - [ ] `journeys` (user, route, path, completed, updated_at).
  - [ ] `scores` (user, country, topic, best, updated_at), unique on (user, country, topic).
- [ ] `GET` and `PUT /api/save`, with validation that reuses `src/game/progress.ts` types.
- [ ] Client storage: a `SaveStore` interface (local-first `LocalStore` plus `ApiStore` sync), debounced background sync and offline tolerance.
- [ ] Rate limiting on the auth and save routes (`@fastify/rate-limit`).
- [ ] New Railway variables: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`.

## Phase 3: Levels and content

- [ ] Levels per country: Explorer (easy), Voyager (mixed) and Legend (hard), using the `difficulty` field. They earn bronze, silver and gold stamps, and scores become keyed by (user, country, topic, level).
- [ ] Grow each topic to 25 or more questions, and avoid questions the player saw recently.
- [ ] New routes:
  - [ ] Africa: Morocco, Nigeria, Ethiopia, Kenya and South Africa.
  - [ ] The Middle East, the Nordics and Oceania.
  - [ ] Each new country needs a landmark builder, a question bank and a place on a route.
- [ ] A "Report question" button that writes to a `question_reports` table, plus an admin review page.
- [ ] Review dates for Current Affairs questions so stale ones show up.
- [ ] Per-question answer stats (an `events` table) to find confusing or too-hard questions.

## Phase 4: Server-checked quizzes and leaderboards (together)

- [ ] Questions move into Postgres. The JSON files stay the source in git, loaded by an idempotent seed with a stable ID per question.
- [ ] `POST /api/quiz/start`: the server picks, shuffles and stores the answer key, and returns questions without answers.
- [ ] `POST /api/quiz/:id/answer`: returns correct or not, the right choice and the fact. The server records the final score.
- [ ] Answers are removed from the client bundle.
- [ ] Leaderboards: most stamps, fastest route completion and weekly accuracy. Display names go through a profanity filter.
- [ ] Friend challenges: a `/c/:code` link plays the same seeded quiz.

## Phase 5: Polish

- [ ] Professionally made glTF landmarks (Draco or meshopt compressed, loaded per country), each replacing a procedural builder.
- [ ] Ambient music per region and sound settings.
- [ ] Accessibility: screen readers and keyboard-only play.
- [ ] Recovery from WebGL context loss, and a lower-quality mode for low-end phones.

---

## Railway setup

Railway builds the `Dockerfile` automatically. Railway's Config as Code (`railway.json`) is deprecated and can't be enabled on new services, so the settings below live in the dashboard.

**Service → Settings**

| Section | Setting | Value |
| --- | --- | --- |
| Source | Branch connected to production | `main` |
| Source | Wait for CI | On |
| Networking | Public domain → target port | `8080` |
| Deploy | Pre-deploy Command | `node dist-server/migrate.js` |
| Deploy | Custom Start Command | *(empty: the Dockerfile's `CMD` starts the server)* |
| Deploy | Healthcheck Path | `/health` |
| Deploy | Serverless | Off (avoids cold starts on a player's first visit) |
| Deploy | Restart Policy | On Failure, max 5 retries |
| Edge | CDN Caching | Static assets only (fingerprinted files are cached for a year; HTML must stay uncached) |

**Service → Variables**

| Variable | Value |
| --- | --- |
| `PORT` | `8080` (must match the domain's target port) |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference variable, private network) |

**Check:** `https://<your-domain>/health` should return `"status":"ok"`, `"db":"ok"` and the deployed commit as `version`.
