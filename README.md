# 🌍 Get Around

**A journey through the history of the world.** Pick a route, fly to a nation, choose a subject (History, Technology, Art & Culture, Politics, Current Affairs or General Knowledge), and score **90%** to earn that nation's passport stamp and unlock your next flight.

The UI is the main draw. A stylised 3D globe shows animated flight paths and a plane that flies each leg. Each of the 26 nations is a floating low-poly island with its own landmark, from the Pyramids, the Parthenon and the Taj Mahal to Petra, Lalibela, a Norwegian stave church and the Sydney Opera House.

## Quick start

```bash
npm install
npm run dev        # game on http://localhost:5173, API on :8787 (proxied as /api)
npm test           # content validation + game and server unit tests
npm run build      # typecheck, build the game (dist/) and the server (dist-server/)
npm start          # run the production server locally on http://localhost:8787
```

The game runs without a database. To develop against Postgres, run `docker compose up db`, then `cp .env.example .env`.

## Deploying to Railway

The app deploys as one Railway service (Fastify serves the game and `/api`) plus Railway Postgres. Railway builds the `Dockerfile`. The pre-deploy migration command, `/health` check and other service settings live in the Railway dashboard; the checklist in [`docs/ROADMAP.md`](docs/ROADMAP.md) lists them, along with what comes next.

## How the game plays

1. **Check in.** Enter a traveler name and pick the subjects you like. The departures board then recommends routes that match.
2. **Departures board.** Choose a curated route, or pick **Open Skies** to start in any country and choose every next stop yourself.
3. **Fly.** A boarding pass appears, the plane flies a great-circle arc across the globe, and the screen opens on the country's diorama.
4. **Pick a level.** Every subject has three levels: **Explorer** (mostly easy), **Voyager** (mixed) and **Legend** (mostly hard). Each level unlocks after you pass the one before it.
5. **Quiz.** Ten items, ordered easy to hard. Besides multiple choice there are:
   - **Timelines** (History): put events in order, oldest first.
   - **Map pins** (General Knowledge): tap where a city or landmark is.
   - **Quick calls**: true or false, at Explorer and Voyager.
   - **Spot the landmark**: pick the country's island out of four.

   You may miss **one**; the 🎟️ counter shows how many misses you have left. A postcard fact appears after every answer.
6. **Stamp.** Score 9/10 or better to earn a **bronze, silver or gold** stamp, depending on the level, and unlock the next flight. With 26 countries × 6 subjects, the **passport** (🛂) holds 156 stamps, plus 14 achievement badges.
7. **Air miles.** Correct answers, streaks, new stamps, achievements and every flight earn miles (✈). Spend them on lifelines (50:50, *Ask a local*) or in **the Hangar** on plane liveries and passport covers.

Retries favour questions you haven't seen recently. Progress is saved in `localStorage`.

| Route | Stops | Built around |
| --- | --- | --- |
| Cradles of Civilization | 🇪🇬 🇬🇷 🇮🇹 🇮🇳 🇨🇳 | History, Politics |
| Renaissance & Revolution | 🇮🇹 🇫🇷 🇬🇧 🇺🇸 | Art, Politics, History |
| The Inventors’ Trail | 🇬🇧 🇺🇸 🇯🇵 🇨🇳 🇮🇳 | Technology, Current Affairs |
| The Silk Road | 🇨🇳 🇮🇳 🇪🇬 🇬🇷 🇮🇹 | History, General, Art |
| New World Odyssey | 🇲🇽 🇺🇸 🇧🇷 | General, Art, Current Affairs |
| The Grand Tour | the original 11, eastbound | everything |
| Out of Africa | 🇲🇦 🇳🇬 🇪🇹 🇰🇪 🇿🇦 | History, General, Art |
| Crossroads of Empires | 🇹🇷 🇯🇴 🇮🇷 🇦🇪 | History, Art, Politics |
| Northern Lights | 🇩🇰 🇸🇪 🇳🇴 🇮🇸 | Technology, Art, General |
| Under the Southern Cross | 🇿🇦 🇦🇺 🇳🇿 🇧🇷 | General, Current Affairs, History |
| Open Skies | any of the 26, any order | your choice |

## Project layout

```
src/                    # the game (Vite + Three.js)
  data/
    countries.ts        # nation metadata: coordinates, colours, sky palette, landmark
    routes.ts           # curated routes + interest-based recommendations
    topics.ts           # the six subjects
    questions/*.json    # question banks (11 countries × 6 topics × 10 = 660), loaded per country
  game/
    quiz.ts             # quiz building, shuffling, the 90% rule (unit tested)
    progress.ts         # journeys, unlocks, stamps, save/load (unit tested)
  three/
    stage.ts            # one WebGL renderer, switches globe ↔ diorama
    globe.ts            # globe, markers, flight arcs, plane, camera moves
    atlasPaint.ts       # map painting shared by the build-time baker and the browser
    worldTexture.ts     # baked atlas + route highlighting
    generated/          # output of `npm run bake:globe` (committed)
    diorama.ts          # floating-island scene, clouds, confetti
    landmarks.ts        # procedural low-poly landmark per nation
    kit.ts              # tiny modelling helpers (box, cone, trees, palms…)
  ui/
    app.ts              # screens: title, check-in, departures, map, boarding pass, quiz, results, passport
    sfx.ts              # synthesized sound effects (no audio files)
server/                 # Fastify API + static hosting
  app.ts                # routes, caching, security headers, /health
  config.ts             # environment variables, validated at startup
  db/                   # Drizzle client and schema
  migrate.ts            # applies drizzle/ migrations (Railway pre-deploy)
drizzle/                # generated SQL migrations
scripts/
  validate-content.mjs  # schema checks for every question bank
  bake-globe.ts         # pre-renders the world map texture
docs/ROADMAP.md         # phased plan and Railway checklist
```

## Adding content

**More questions.** Append to `src/data/questions/<country>.json`; the format is in [`SCHEMA.md`](src/data/questions/SCHEMA.md). Each subject needs at least 25 questions (9 easy, 9 medium, 7 hard) so every level has enough to draw from; more means more variety on retries. Every current-affairs question must have an `asOf` year, which the quiz shows to the player.

**Timelines and map places** live in `src/data/extras/<country>.json` (format in [`SCHEMA.md`](src/data/extras/SCHEMA.md)). The validator checks that every place lies inside the country's borders.

Run `npm run validate:content` after any content change; `npm test` runs it too.

**A new country:**
1. Add it to `COUNTRIES` in `src/data/countries.ts`. The `iso` field is the ISO 3166-1 numeric code, which is the id world-atlas uses; `mapView` frames the map round.
2. Run `npm run bake:globe` to repaint the globe with it, and commit the result.
3. Add a landmark builder in `src/three/landmarks.ts` or `landmarksWorld.ts`.
4. Add `src/data/questions/<id>.json` and `src/data/extras/<id>.json`.
5. Add it to one or more routes in `src/data/routes.ts`. Don't reorder the stops of an existing route; that would scramble players' saved journeys.

**Swapping in hand-made 3D models.** Each landmark builder returns a `THREE.Group` that sits on the island top (y = 0) and fits within a radius of about 4.5. To use a real model, load a glTF with `GLTFLoader` and return the loaded scene from that builder; the rest of the game won't need to change.

## Fact-checking

The `npm run factcheck*` tools call the Claude API (`claude-opus-5-5`, with web search) and need `ANTHROPIC_API_KEY`; the scheduled refresh below runs on a Claude subscription instead. Each call opts into Anthropic's server-side refusal fallback (`fallbacks: "default"`). Add `--dry-run` to see how many calls a command would make.

| Command | What it does |
| --- | --- |
| `npm run factcheck -- japan` | Checks every Japan question; add `--extras` for timelines and map places, or `--topic current-affairs` to check one subject in every country. Writes `factcheck-report.md` (flagged items) and `.json`. |
| `npm run factcheck:refresh -- kenya` | Runs the Current Affairs refresh through the API. |
| `npm run factcheck:eval` | Measures the checker itself (see below). |

**Current Affairs refresh (GitHub Action, on your Claude subscription).** On the 1st and 15th of each month, [`current-affairs-subscription.yml`](.github/workflows/current-affairs-subscription.yml) has Claude Code (Sonnet 5.5) rewrite questions that are no longer true and propose up to two new ones per country about recent news. [`subscription.mjs`](scripts/factcheck/subscription.mjs) then:
- checks every proposal against the content schema, keeps the replaced question's difficulty and rejects duplicates;
- hands the survivors to a second, separate Claude Code session for fact-checking, and drops anything it doesn't pass.

The changes arrive as a pull request listing every before and after with its sources. Read them before merging. You can also start a run by hand from the Actions tab and pick the countries. Runs count against your subscription's usage limits. It needs:
- the repository secret `CLAUDE_CODE_OAUTH_TOKEN` (run `claude setup-token` to create it);
- the Claude GitHub App on the repository (`/install-github-app` in Claude Code);
- Settings → Actions → General → **Allow GitHub Actions to create and approve pull requests**.

[`current-affairs.yml`](.github/workflows/current-affairs.yml) is the same refresh through the API (`npm run factcheck:refresh`, needs `ANTHROPIC_API_KEY`), started by hand.

**The fact-check eval.** `scripts/factcheck/eval/cases.json` holds 45 packets (451 items), checked the same way `npm run factcheck` checks a bank. The items are:
- 26 real errors found in the October 2026 review (`known-errors.json`);
- 132 planted errors: an answer key moved to a wrong choice, a year shifted, a number in the fact changed, or a timeline date moved;
- 293 correct items.

Grading needs no model: an item counts as flagged when its verdict isn't `ok`. `npm run factcheck:eval` (or the manual [`factcheck-eval.yml`](.github/workflows/factcheck-eval.yml) Action) writes `.claude/hillclimb/factcheck/baseline/summary.md` with:
- recall (errors caught), precision and specificity, with 95% confidence intervals;
- recall for each kind of error;
- every miss and false alarm.

Re-run it as `--variant v1`, `v2` and so on after changing the checker, and compare. To rebuild the cases after content changes, run `node scripts/factcheck/eval/build-cases.mjs`. To test the harness for free, set `FACTCHECK_MOCK=oracle`, `null` or `flag-all`.

## Roadmap

See [`docs/ROADMAP.md`](docs/ROADMAP.md). In short:

1. **Railway-ready** (done): Fastify server, Postgres plumbing, Docker, health checks, faster loading.
2. **Accounts and cloud save**: guest play, with optional Google or email-link sign-in.
3. **Levels and content** (mostly done): three levels, 25+ questions per subject, new round types, rewards, 26 countries. Question reporting and stats are next.
4. **Server-checked quizzes and leaderboards**, plus friend challenges.
5. **Polish**: hand-made 3D landmarks, music, accessibility.

Map data: [Natural Earth](https://www.naturalearthdata.com/) via [world-atlas](https://github.com/topojson/world-atlas).
