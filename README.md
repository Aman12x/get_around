# 🌍 Get Around

**A journey through the history of the world.** Pick a route, fly to a nation, choose a subject (History, Technology, Art & Culture, Politics, Current Affairs or General Knowledge), and score **90%** to earn that nation's passport stamp and unlock your next flight.

The UI is the main draw. A stylised 3D globe shows animated flight paths and a plane that flies each leg. Every nation is a floating low-poly island with its own landmark: the Pyramids, the Parthenon, the Colosseum, the Eiffel Tower, Big Ben, the Taj Mahal, a pagoda and the Great Wall, Mount Fuji, the Statue of Liberty, Chichén Itzá, and Christ the Redeemer.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # content validation + unit tests
npm run build      # production build in dist/
```

The build is a static site, so `dist/` can be hosted anywhere (GitHub Pages, Netlify, Vercel, S3).

## How the game plays

1. **Check in.** Enter a traveler name and pick the subjects you like. The departures board then recommends routes that match.
2. **Departures board.** Choose a curated route, or pick **Open Skies** to start in any country and choose every next stop yourself.
3. **Fly.** A boarding pass appears, the plane flies a great-circle arc across the globe, and the screen opens on the country's diorama.
4. **Quiz.** Each quiz is 10 questions, ordered from easy to hard. You may miss **one**; the 🎟️ counter shows how many misses you have left. A postcard fact appears after every answer.
5. **Stamp.** Score 9/10 or better to earn the stamp and unlock the next flight. Every country has six stamps, one per subject, and they all collect in your **passport** (🛂).

Progress is saved in `localStorage`.

| Route | Stops | Built around |
| --- | --- | --- |
| Cradles of Civilization | 🇪🇬 🇬🇷 🇮🇹 🇮🇳 🇨🇳 | History, Politics |
| Renaissance & Revolution | 🇮🇹 🇫🇷 🇬🇧 🇺🇸 | Art, Politics, History |
| The Inventors’ Trail | 🇬🇧 🇺🇸 🇯🇵 🇨🇳 🇮🇳 | Technology, Current Affairs |
| The Silk Road | 🇨🇳 🇮🇳 🇪🇬 🇬🇷 🇮🇹 | History, General, Art |
| New World Odyssey | 🇲🇽 🇺🇸 🇧🇷 | General, Art, Current Affairs |
| The Grand Tour | all 11 | everything |
| Open Skies | any order | your choice |

## Project layout

```
src/
  data/
    countries.ts        # nation metadata: coordinates, colours, sky palette, landmark
    routes.ts           # curated routes + interest-based recommendations
    topics.ts           # the six subjects
    questions/*.json    # question banks (11 countries × 6 topics × 10 = 660 questions)
  game/
    quiz.ts             # quiz building, shuffling, the 90% rule (unit tested)
    progress.ts         # journeys, unlocks, stamps, save/load (unit tested)
  three/
    stage.ts            # one WebGL renderer, switches globe ↔ diorama
    globe.ts            # globe, markers, flight arcs, plane, camera moves
    worldTexture.ts     # paints the colourful atlas from Natural Earth data
    diorama.ts          # floating-island scene, clouds, confetti
    landmarks.ts        # procedural low-poly landmark per nation
    kit.ts              # tiny modelling helpers (box, cone, trees, palms…)
  ui/
    app.ts              # screens: title, check-in, departures, map, boarding pass, quiz, results, passport
    sfx.ts              # synthesized sound effects (no audio files)
  style.css
scripts/validate-content.mjs   # schema checks for every question bank
```

## Adding content

**More questions.** Append to `src/data/questions/<country>.json`; the format is in [`SCHEMA.md`](src/data/questions/SCHEMA.md). A quiz draws 10 questions at random from a topic's pool, so a bigger pool means more variety on retries. Every current-affairs question must have an `asOf` year, which the quiz shows to the player. Run `npm run validate:content`.

**A new country:**
1. Add it to `COUNTRIES` in `src/data/countries.ts`. The `iso` field is the ISO 3166-1 numeric code, which is the id world-atlas uses.
2. Add a landmark builder in `src/three/landmarks.ts`.
3. Add `src/data/questions/<id>.json`.
4. Add it to one or more routes in `src/data/routes.ts`.

**Swapping in hand-made 3D models.** Each landmark builder returns a `THREE.Group` that sits on the island top (y = 0) and fits within a radius of about 4.5. To use a real model, load a glTF with `GLTFLoader` and return the loaded scene from that builder; the rest of the game won't need to change.

## Roadmap ideas

- **Levels per country** (Explorer → Voyager → Legend) using the `difficulty` field, plus larger question pools.
- **A current-affairs pipeline.** Those questions go stale, so they need a dated review process or a CMS/API feed.
- **Accounts and cloud sync**, leaderboards, and friend challenges along the same route.
- **Hand-modelled glTF landmarks**, ambient music per region, and narrated "postcards".
- **More nations and themed routes**, such as Africa, the Middle East, the Nordics and Oceania.

Map data: [Natural Earth](https://www.naturalearthdata.com/) via [world-atlas](https://github.com/topojson/world-atlas).
