import { COUNTRIES, COUNTRY_BY_ID, type CountryId } from '../data/countries';
import { loadBank, questionsFor } from '../data/questions';
import { recommendedRouteIds, ROUTE_BY_ID, ROUTES, type Route } from '../data/routes';
import { TOPIC_BY_ID, TOPICS, type TopicId } from '../data/topics';
import { describeMix, LEVEL_BY_ID, LEVELS, nextLevel, type Level, type LevelId } from '../game/levels';
import {
  arrive,
  bestScore,
  currentCountry,
  destinations,
  hasCleared,
  levelUnlocked,
  loadSave,
  markSeen,
  newJourney,
  passport,
  recordScore,
  seenSet,
  stampCounts,
  stopStatus,
  topicTier,
  writeSave,
  type Journey,
  type SaveData,
} from '../game/progress';
import { buildQuiz, isPass, requiredCorrect, sparesLeft, type QuizQuestion } from '../game/quiz';
import { Stage } from '../three/stage';
import { setMuted, sfx } from './sfx';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const $ = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T;

interface QuizState {
  country: CountryId;
  topic: TopicId;
  level: LevelId;
  questions: QuizQuestion[];
  index: number;
  correct: number;
  wrong: number;
  answered: number | null;
}

export class App {
  private save: SaveData = loadSave();
  private stage: Stage;
  private screen: HTMLElement;
  private hud: HTMLElement;
  private curtain: HTMLElement;
  private quiz: QuizState | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <canvas id="scene" aria-hidden="true"></canvas>
      <div id="labels"></div>
      <header id="hud"></header>
      <main id="screen"></main>
      <div id="curtain" aria-hidden="true"><div class="curtain-inner"></div></div>
      <div id="toast" role="status" aria-live="polite"></div>`;
    this.screen = $(root, '#screen');
    this.hud = $(root, '#hud');
    this.curtain = $(root, '#curtain');
    this.stage = new Stage($<HTMLCanvasElement>(root, '#scene'), $(root, '#labels'));
    this.stage.globe.onSelect = (id) => this.onGlobeSelect(id);
    setMuted(this.save.muted);
    this.renderHud();
    this.showTitle();
  }

  // ---------- helpers ----------

  private get route(): Route | null {
    return this.save.activeRouteId ? ROUTE_BY_ID[this.save.activeRouteId] ?? null : null;
  }

  private get journey(): Journey | null {
    const r = this.route;
    return r ? this.save.journeys[r.id] ?? null : null;
  }

  private persist(): void {
    writeSave(this.save);
  }

  private setJourney(j: Journey): void {
    this.save.journeys[j.routeId] = j;
    this.persist();
  }

  private mount(html: string, cls = ''): HTMLElement {
    this.setKeys(null);
    this.screen.className = cls;
    this.screen.innerHTML = html;
    this.screen.scrollTop = 0;
    return this.screen;
  }

  private setKeys(fn: ((e: KeyboardEvent) => void) | null): void {
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = fn;
    if (fn) window.addEventListener('keydown', fn);
  }

  private toast(msg: string): void {
    const t = document.getElementById('toast')!;
    t.textContent = msg;
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
  }

  /** Colourful iris wipe; `swap` runs while the screen is covered. */
  private async curtainWipe(color: string, html: string, swap: () => void | Promise<void>, hold = 900): Promise<void> {
    const inner = $(this.curtain, '.curtain-inner');
    inner.innerHTML = html;
    this.curtain.style.setProperty('--c', color);
    this.curtain.classList.remove('out');
    this.curtain.classList.add('in');
    await wait(650);
    await swap();
    await wait(hold);
    this.curtain.classList.replace('in', 'out');
    await wait(650);
    this.curtain.classList.remove('out');
  }

  private renderHud(): void {
    const r = this.route;
    const j = this.journey;
    const { stamps } = stampCounts(this.save);
    this.hud.innerHTML = `
      <button class="brand" data-act="home" aria-label="Get Around home"><span class="logo-globe">🌍</span><span>Get&nbsp;Around</span></button>
      <div class="hud-route">${r && j ? `<span class="chip" style="--c:${r.color}">${esc(r.code)} · ${esc(r.name)}</span>` : ''}</div>
      <div class="hud-actions">
        <button class="hud-btn" data-act="passport" aria-label="Open passport">🛂 <span>${stamps}</span></button>
        <button class="hud-btn" data-act="mute" aria-label="${this.save.muted ? 'Unmute' : 'Mute'}">${this.save.muted ? '🔇' : '🔊'}</button>
      </div>`;
    this.hud.onclick = (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'home') this.showTitle();
      if (act === 'passport') this.showPassport();
      if (act === 'mute') {
        this.save.muted = !this.save.muted;
        setMuted(this.save.muted);
        this.persist();
        this.renderHud();
      }
    };
  }

  // ---------- title ----------

  showTitle(): void {
    this.stage.setView('globe');
    this.stage.globe.setJourney(null, null);
    this.stage.globe.setIdle(true);
    this.stage.globe.setFraming(0.2);
    const name = this.save.traveler?.name;
    const active = this.journey;
    const el = this.mount(
      `<section class="title-card">
        <p class="eyebrow">A journey through the history of the world</p>
        <h1 class="logo">Get <span>Around</span></h1>
        <p class="lead">Land in a nation, pick a subject, and score <strong>90%</strong> to earn your passport stamp and fly on to the next.</p>
        <div class="title-actions">
          ${active ? `<button class="btn primary" data-act="continue">✈️ Continue ${esc(this.route!.name)}</button>` : ''}
          <button class="btn ${active ? 'ghost' : 'primary'}" data-act="start">${name ? '🧭 Departures board' : '🎫 Start your journey'}</button>
        </div>
        ${name ? `<p class="welcome">Welcome back, <strong>${esc(name)}</strong>.</p>` : ''}
      </section>`,
      'screen-title',
    );
    el.onclick = (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (!act) return;
      sfx.click();
      if (act === 'continue') this.showMap();
      if (act === 'start') (this.save.traveler ? this.showDepartures() : this.showOnboarding());
    };
  }

  // ---------- onboarding ----------

  private showOnboarding(): void {
    this.stage.globe.setFraming(0);
    const picked = new Set<TopicId>(this.save.traveler?.interests ?? []);
    const el = this.mount(
      `<form class="panel boarding" autocomplete="off">
        <div class="ticket-head"><span>BOARDING PASS</span><span>GET AROUND AIRWAYS</span></div>
        <label class="field"><span>Traveler name</span>
          <input name="name" maxlength="24" placeholder="e.g. Ibn Battuta" value="${esc(this.save.traveler?.name ?? '')}" required />
        </label>
        <fieldset class="interests">
          <legend>What fascinates you? <small>We’ll recommend routes</small></legend>
          <div class="chip-grid">
            ${TOPICS.map(
              (t) => `<button type="button" class="topic-chip ${picked.has(t.id) ? 'on' : ''}" data-topic="${t.id}" style="--c:${t.color}" aria-pressed="${picked.has(t.id)}">
                <span class="ico">${t.icon}</span>${t.label}</button>`,
            ).join('')}
          </div>
        </fieldset>
        <button class="btn primary wide" type="submit">Check in →</button>
      </form>`,
      'screen-center',
    );
    el.querySelectorAll<HTMLButtonElement>('.topic-chip').forEach((b) =>
      b.addEventListener('click', () => {
        const id = b.dataset.topic as TopicId;
        if (picked.has(id)) picked.delete(id);
        else picked.add(id);
        b.classList.toggle('on', picked.has(id));
        b.setAttribute('aria-pressed', String(picked.has(id)));
        sfx.click();
      }),
    );
    $<HTMLFormElement>(el, 'form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = (new FormData(e.target as HTMLFormElement).get('name') as string).trim() || 'Traveler';
      this.save.traveler = { name, interests: [...picked] };
      this.persist();
      this.showDepartures();
    });
    $<HTMLInputElement>(el, 'input').focus();
  }

  // ---------- departures board ----------

  private showDepartures(): void {
    this.stage.setView('globe');
    this.stage.globe.setIdle(true);
    this.stage.globe.setFraming(0);
    const recs = recommendedRouteIds(this.save.traveler?.interests ?? []);
    const rows = ROUTES.map((r) => {
      const j = this.save.journeys[r.id];
      const cleared = j ? r.stops.filter((c) => hasCleared(j, c)).length : 0;
      let status = '<span class="st boarding">BOARDING</span>';
      if (j?.completed) status = '<span class="st done">COMPLETED ⭐</span>';
      else if (j && j.path.length) status = `<span class="st prog">${cleared}/${r.stops.length} STAMPS</span>`;
      else if (recs.includes(r.id)) status = '<span class="st rec">RECOMMENDED</span>';
      const flags = r.openWorld ? '🌐 Any country' : r.stops.map((c) => COUNTRY_BY_ID[c].flag).join(' ');
      return `<button class="board-row ${recs.includes(r.id) ? 'is-rec' : ''}" data-route="${r.id}" style="--c:${r.color}">
        <span class="code flap">${esc(r.code)}</span>
        <span class="dest"><strong class="flap">${esc(r.name)}</strong><small>${esc(r.tagline)}</small></span>
        <span class="stops">${flags}</span>
        ${status}
      </button>`;
    }).join('');
    const el = this.mount(
      `<section class="panel board">
        <div class="board-head">
          <h2>🛫 Departures</h2>
          <button class="btn ghost small" data-act="interests">Edit interests</button>
        </div>
        <div class="board-cols"><span>Flight</span><span>Route</span><span>Stops</span><span>Status</span></div>
        <div class="board-rows">${rows}</div>
      </section>`,
      'screen-center',
    );
    el.querySelectorAll<HTMLElement>('.flap').forEach((f, i) => flap(f, i * 40));
    el.onclick = (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-act="interests"]')) return this.showOnboarding();
      const id = t.closest<HTMLElement>('[data-route]')?.dataset.route;
      if (!id) return;
      sfx.click();
      this.save.activeRouteId = id;
      if (!this.save.journeys[id]) this.save.journeys[id] = newJourney(id);
      this.persist();
      this.renderHud();
      this.showMap();
    };
  }

  // ---------- globe / route map ----------

  private showMap(): void {
    const r = this.route;
    const j = this.journey;
    if (!r || !j) return this.showDepartures();
    this.stage.setView('globe');
    this.stage.globe.setJourney(r, j);
    this.stage.globe.setIdle(false);
    this.stage.globe.setFraming(0);
    const here = currentCountry(j);
    const dests = destinations(j, r);
    if (here) void this.stage.globe.focusOn(dests.length === 1 ? dests[0] : here, 2.8);
    else if (!r.openWorld) void this.stage.globe.focusOn(r.stops[0], 2.8);

    let hint: string;
    if (j.completed) hint = '🏆 Route complete! Every stamp collected.';
    else if (!here) hint = r.openWorld ? 'Tap any country on the globe to start your journey.' : `Your journey begins in ${COUNTRY_BY_ID[r.stops[0]].flag} ${COUNTRY_BY_ID[r.stops[0]].name}. Tap it to board.`;
    else if (!hasCleared(j, here)) hint = `Score 90% in ${COUNTRY_BY_ID[here].name} to unlock your next flight.`;
    else if (dests.length === 1) hint = `Next stop: ${COUNTRY_BY_ID[dests[0]].flag} ${COUNTRY_BY_ID[dests[0]].name}. Tap ✈️ to board.`;
    else if (dests.length) hint = 'Choose your next destination — tap any ✈️ country.';
    else hint = 'Route complete!';

    const trail = (r.openWorld ? j.path : r.stops)
      .map((c) => {
        const s = stopStatus(j, r, c);
        return `<button class="trail-stop s-${s}" data-country="${c}" title="${esc(COUNTRY_BY_ID[c].name)}">${COUNTRY_BY_ID[c].flag}</button>`;
      })
      .join('<span class="trail-dash"></span>');

    const el = this.mount(
      `<section class="map-panel panel">
        <div class="map-top">
          <div>
            <p class="eyebrow" style="color:${r.color}">${esc(r.code)}</p>
            <h2>${esc(r.name)}</h2>
          </div>
          <div class="map-actions">
            ${here ? `<button class="btn small" data-act="visit">📍 ${esc(COUNTRY_BY_ID[here].name)}</button>` : ''}
            <button class="btn ghost small" data-act="board">Departures</button>
          </div>
        </div>
        ${trail ? `<div class="trail">${trail}</div>` : ''}
        <p class="hint">${esc(hint)}</p>
      </section>`,
      'screen-map',
    );
    el.onclick = (e) => {
      const t = e.target as HTMLElement;
      const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'board') return this.showDepartures();
      if (act === 'visit' && here) return this.enterCountry(here);
      const c = t.closest<HTMLElement>('[data-country]')?.dataset.country as CountryId | undefined;
      if (c) this.onGlobeSelect(c);
    };
  }

  private onGlobeSelect(id: CountryId): void {
    const r = this.route;
    const j = this.journey;
    if (!r || !j) {
      // Title screen: clicking a country is a shortcut into the game.
      return this.save.traveler ? this.showDepartures() : this.showOnboarding();
    }
    if (this.stage.current !== 'globe' || !this.screen.classList.contains('screen-map')) return;
    const status = stopStatus(j, r, id);
    if (status === 'locked') {
      const here = currentCountry(j);
      this.toast(here && !hasCleared(j, here) ? `Earn a stamp in ${COUNTRY_BY_ID[here].name} first (90%+).` : `${COUNTRY_BY_ID[id].name} is further along the route.`);
      return;
    }
    sfx.click();
    if (status === 'next') this.showBoardingPass(id);
    else this.enterCountry(id);
  }

  private showBoardingPass(to: CountryId): void {
    const j = this.journey!;
    const from = currentCountry(j);
    const dest = COUNTRY_BY_ID[to];
    const origin = from ? COUNTRY_BY_ID[from] : null;
    const seat = `${1 + (to.length * 7) % 30}${'ABCDEF'[to.charCodeAt(0) % 6]}`;
    const el = this.mount(
      `<section class="pass" style="--c:${dest.color}">
        <div class="pass-main">
          <div class="pass-head"><span>BOARDING PASS</span><span>${esc(this.route!.code)}</span></div>
          <div class="pass-route">
            <div><small>FROM</small><strong>${origin ? origin.flag : '🏠'}</strong><span>${origin ? esc(origin.name) : 'Home'}</span></div>
            <div class="pass-plane">✈</div>
            <div><small>TO</small><strong>${dest.flag}</strong><span>${esc(dest.name)}</span></div>
          </div>
          <div class="pass-meta">
            <div><small>PASSENGER</small><span>${esc(this.save.traveler?.name ?? 'Traveler')}</span></div>
            <div><small>SEAT</small><span>${seat}</span></div>
            <div><small>LANDMARK</small><span>${esc(dest.landmark)}</span></div>
          </div>
        </div>
        <div class="pass-stub">
          <p>${esc(dest.nickname)}</p>
          <button class="btn primary" data-act="fly">Board flight ✈️</button>
          <button class="btn ghost small" data-act="cancel">Not yet</button>
        </div>
      </section>`,
      'screen-center',
    );
    el.onclick = async (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'cancel') return this.showMap();
      if (act !== 'fly') return;
      this.mount('', 'screen-flying');
      this.screen.innerHTML = `<div class="flight-banner" style="--c:${dest.color}">In flight to ${dest.flag} ${esc(dest.name)}…</div>`;
      sfx.takeoff();
      // Fetch the destination's questions while the plane is in the air.
      void loadBank(to).catch(() => {});
      await this.stage.globe.fly(from, to);
      this.setJourney(arrive(j, to));
      this.enterCountry(to, true);
    };
  }

  // ---------- country ----------

  private async enterCountry(id: CountryId, landing = false): Promise<void> {
    const c = COUNTRY_BY_ID[id];
    await this.curtainWipe(
      c.color,
      `<div class="arrive"><span class="flag-big">${c.flag}</span><small>${landing ? 'Now arriving in' : 'Visiting'}</small><strong>${esc(c.name)}</strong><em>${esc(c.nickname)}</em></div>`,
      async () => {
        this.stage.diorama.show(id);
        this.stage.setView('diorama');
        try {
          await loadBank(id);
        } catch {
          this.toast('Couldn’t load the questions. Check your connection and visit again.');
        }
        this.showCountry(id);
      },
      landing ? 1100 : 500,
    );
    if (landing) sfx.chime();
  }

  private showCountry(id: CountryId): void {
    const c = COUNTRY_BY_ID[id];
    const r = this.route!;
    const j = this.journey!;
    const cleared = hasCleared(j, id);
    const isHere = currentCountry(j) === id;
    const dests = destinations(j, r);
    const cards = TOPICS.map((t) => {
      const tier = topicTier(j, id, t.id);
      const count = questionsFor(id, t.id).length;
      return `<button class="topic-card ${tier ? 'passed' : ''}" data-topic="${t.id}" style="--c:${t.color}" ${count ? '' : 'disabled'}>
        <span class="ico">${t.icon}</span>
        <strong>${t.label}</strong>
        <small>${count ? esc(t.blurb) : 'Coming soon'}</small>
        <span class="medals" aria-label="${tier ? `${LEVEL_BY_ID[tier].medal} stamp earned` : 'No stamp yet'}">${medalRow(j, id, t.id)}</span>
        ${tier ? `<span class="mini-stamp" style="--c:${LEVEL_BY_ID[tier].color}">${c.flag}</span>` : ''}
      </button>`;
    }).join('');
    const el = this.mount(
      `<section class="country-panel panel" style="--c:${c.color}">
        <div class="country-head">
          <span class="flag-big">${c.flag}</span>
          <div>
            <p class="eyebrow">${esc(c.landmark)}</p>
            <h2>${esc(c.name)}</h2>
            <p class="sub">${esc(c.nickname)}</p>
          </div>
        </div>
        <p class="goal">${
          cleared
            ? '🛂 Stamp earned! Climb to <strong>Silver</strong> and <strong>Gold</strong>, or continue your journey.'
            : 'Pick a subject. Answer <strong>9 of 10</strong> correctly to earn this nation’s stamp.'
        }</p>
        <div class="topic-grid">${cards}</div>
        <div class="country-actions">
          <button class="btn ghost" data-act="map">🗺️ Back to map</button>
          ${cleared && isHere && dests.length ? `<button class="btn primary" data-act="onward">Continue journey ✈️</button>` : ''}
        </div>
      </section>`,
      'screen-country',
    );
    el.onclick = (e) => {
      const t = e.target as HTMLElement;
      const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'map' || act === 'onward') return this.backToMap();
      const topic = t.closest<HTMLElement>('[data-topic]')?.dataset.topic as TopicId | undefined;
      if (topic) {
        sfx.click();
        this.showLevels(id, topic);
      }
    };
  }

  /** Level picker for one subject: Explorer → Voyager → Legend. */
  private showLevels(id: CountryId, topic: TopicId): void {
    const c = COUNTRY_BY_ID[id];
    const t = TOPIC_BY_ID[topic];
    const j = this.journey!;
    const cards = LEVELS.map((l, i) => {
      const open = levelUnlocked(j, id, topic, l.id);
      const best = bestScore(j, id, topic, l.id);
      const won = best !== undefined && isPass(best, 10);
      const prev = LEVELS[i - 1];
      const status = won
        ? `<span class="lv-status won">${l.medal} stamp · best ${best}/10</span>`
        : !open
          ? `<span class="lv-status locked">🔒 Earn ${prev.medal} first</span>`
          : best !== undefined
            ? `<span class="lv-status">Best ${best}/10 · need 9</span>`
            : `<span class="lv-status">Not tried yet</span>`;
      return `<button class="level-card ${won ? 'won' : ''} ${open ? '' : 'locked'}" data-level="${l.id}" style="--m:${l.color}" ${open ? '' : 'disabled'}>
        <span class="lv-medal">${l.icon}</span>
        <span class="lv-body">
          <strong>${l.label} <em>${l.medal}</em></strong>
          <small>${esc(l.blurb)} · ${describeMix(l)}</small>
          ${status}
        </span>
        <span class="lv-go">${open ? (won ? '↻' : '▶') : ''}</span>
      </button>`;
    }).join('');
    const el = this.mount(
      `<section class="country-panel panel levels-panel" style="--c:${t.color}">
        <div class="country-head">
          <span class="flag-big">${t.icon}</span>
          <div>
            <p class="eyebrow">${c.flag} ${esc(c.name)}</p>
            <h2>${esc(t.label)}</h2>
            <p class="sub">Choose your level. Each one earns a better stamp.</p>
          </div>
        </div>
        <div class="level-list">${cards}</div>
        <div class="country-actions">
          <button class="btn ghost" data-act="back">← All subjects</button>
        </div>
      </section>`,
      'screen-country',
    );
    el.onclick = (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-act="back"]')) return this.showCountry(id);
      const level = target.closest<HTMLElement>('[data-level]')?.dataset.level as LevelId | undefined;
      if (level && levelUnlocked(j, id, topic, level)) {
        sfx.click();
        this.startQuiz(id, topic, level);
      }
    };
  }

  private async backToMap(): Promise<void> {
    await this.curtainWipe('#4f46e5', `<div class="arrive"><span class="flag-big">🗺️</span><strong>Back to the map</strong></div>`, () => this.showMap(), 200);
  }

  // ---------- quiz ----------

  private startQuiz(country: CountryId, topic: TopicId, level: LevelId): void {
    const questions = buildQuiz(questionsFor(country, topic), Math.random, {
      mix: LEVEL_BY_ID[level].mix,
      seen: seenSet(this.save, country, topic),
    });
    // Remember these so the next attempt leads with questions the player hasn't met.
    this.save = markSeen(this.save, country, topic, questions.map((q) => q.id));
    this.persist();
    this.quiz = { country, topic, level, questions, index: 0, correct: 0, wrong: 0, answered: null };
    this.renderQuestion();
  }

  private renderQuestion(): void {
    const qz = this.quiz!;
    const q = qz.questions[qz.index];
    const t = TOPIC_BY_ID[qz.topic];
    const c = COUNTRY_BY_ID[qz.country];
    const total = qz.questions.length;
    const spare = sparesLeft(qz.wrong, total);
    const pips = qz.questions.map(() => '<span class="pip"></span>').join('');
    const el = this.mount(
      `<section class="quiz panel" style="--c:${t.color}">
        <div class="quiz-top">
          <span class="chip" style="--c:${t.color}">${t.icon} ${t.label} · ${c.flag} ${esc(c.name)}</span>
          <span class="chip level-chip" style="--c:${LEVEL_BY_ID[qz.level].color}">${LEVEL_BY_ID[qz.level].icon} ${LEVEL_BY_ID[qz.level].label}</span>
          <span class="spares" title="Misses you can still afford">${spare > 0 ? '🎟️'.repeat(spare) + ` ${spare} spare` : spare === 0 ? '⚠️ No misses left' : '❌'}</span>
        </div>
        <div class="pips">${pips}</div>
        <p class="q-count">Question ${qz.index + 1} of ${total}${q.asOf ? ` <span class="asof">as of ${esc(q.asOf)}</span>` : ''}</p>
        <h3 class="question">${esc(q.q)}</h3>
        <div class="answers">
          ${q.choices.map((ch, i) => `<button class="answer" data-i="${i}"><kbd>${i + 1}</kbd><span>${esc(ch)}</span></button>`).join('')}
        </div>
        <div class="postcard" hidden></div>
        <div class="quiz-foot">
          <button class="btn ghost small" data-act="quit">Leave quiz</button>
          <span class="target">Goal: ${requiredCorrect(total)}/${total}</span>
        </div>
      </section>`,
      'screen-quiz',
    );
    this.paintPips();
    el.onclick = (e) => {
      const tgt = e.target as HTMLElement;
      if (tgt.closest('[data-act="quit"]')) return this.showLevels(qz.country, qz.topic);
      if (tgt.closest('[data-act="next"]')) return this.nextQuestion();
      const a = tgt.closest<HTMLElement>('.answer');
      if (a) this.answer(Number(a.dataset.i));
    };
    this.setKeys((e) => {
      if (qz.answered === null && /^[1-4]$/.test(e.key)) this.answer(Number(e.key) - 1);
      else if (qz.answered !== null && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        this.nextQuestion();
      }
    });
  }

  private paintPips(): void {
    const qz = this.quiz!;
    this.screen.querySelectorAll<HTMLElement>('.pip').forEach((p, i) => {
      const res = qz.questions[i] as QuizQuestion & { result?: boolean };
      p.className = 'pip' + (res.result === true ? ' ok' : res.result === false ? ' bad' : '') + (i === qz.index ? ' now' : '');
    });
  }

  private answer(i: number): void {
    const qz = this.quiz!;
    if (qz.answered !== null) return;
    qz.answered = i;
    const q = qz.questions[qz.index] as QuizQuestion & { result?: boolean };
    const right = i === q.correctIndex;
    q.result = right;
    if (right) qz.correct++;
    else qz.wrong++;
    right ? sfx.correct() : sfx.wrong();
    if (right) this.stage.diorama.celebrate([TOPIC_BY_ID[qz.topic].color, COUNTRY_BY_ID[qz.country].color, '#ffffff'], 30);

    this.screen.querySelectorAll<HTMLButtonElement>('.answer').forEach((b, k) => {
      b.disabled = true;
      if (k === q.correctIndex) b.classList.add('correct');
      else if (k === i) b.classList.add('wrong');
    });
    this.paintPips();
    const total = qz.questions.length;
    const spare = sparesLeft(qz.wrong, total);
    const last = qz.index === total - 1 || spare < 0;
    const pc = $(this.screen, '.postcard');
    pc.hidden = false;
    pc.innerHTML = `
      <div class="pc-stamp">${right ? '✔' : '✘'}</div>
      <div class="pc-body">
        <strong>${right ? pick(['Brilliant!', 'Spot on!', 'Correct!', 'Nailed it!']) : 'Not quite.'}</strong>
        <p>${esc(q.fact)}</p>
      </div>
      <button class="btn primary" data-act="next">${last ? (spare < 0 ? 'See result' : 'Finish') : 'Next →'}</button>`;
    $(this.screen, '.spares').innerHTML = spare > 0 ? '🎟️'.repeat(spare) + ` ${spare} spare` : spare === 0 ? '⚠️ No misses left' : '❌ Target missed';
    $<HTMLButtonElement>(pc, 'button').focus({ preventScroll: true });
    pc.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  private nextQuestion(): void {
    const qz = this.quiz!;
    const total = qz.questions.length;
    if (qz.index === total - 1 || sparesLeft(qz.wrong, total) < 0) return this.finishQuiz();
    qz.index++;
    qz.answered = null;
    this.renderQuestion();
  }

  private finishQuiz(): void {
    const qz = this.quiz!;
    const r = this.route!;
    const total = qz.questions.length;
    const answered = qz.correct + qz.wrong;
    const passed = isPass(qz.correct, total);
    const before = this.journey!;
    const wasCleared = hasCleared(before, qz.country);
    const hadLevel = isPass(bestScore(before, qz.country, qz.topic, qz.level) ?? 0, 10);
    const j = recordScore(before, r, qz.country, qz.topic, qz.level, qz.correct);
    this.setJourney(j);
    this.renderHud();
    const c = COUNTRY_BY_ID[qz.country];
    const t = TOPIC_BY_ID[qz.topic];
    const level = LEVEL_BY_ID[qz.level];
    const up: Level | null = passed ? nextLevel(qz.level) : null;
    const dests = destinations(j, r);
    const routeDone = j.completed && !before.completed;

    if (passed) {
      sfx.stamp();
      this.stage.diorama.celebrate([level.color, c.color, t.color, '#ffffff'], qz.level === 'legend' ? 220 : 140);
    }
    const lines: string[] = [];
    if (routeDone) lines.push(`🏆 You completed <strong>${esc(r.name)}</strong>!`);
    else if (passed && !wasCleared && dests.length === 1) {
      lines.push(`Next stop unlocked: <strong>${COUNTRY_BY_ID[dests[0]].flag} ${esc(COUNTRY_BY_ID[dests[0]].name)}</strong>`);
    } else if (passed && !wasCleared && dests.length > 1) lines.push('The skies are open — choose any destination next.');
    if (up && !hadLevel) lines.push(`${up.icon} <strong>${up.label}</strong> level unlocked for ${esc(t.label)}.`);

    const onward = passed && dests.length && currentCountry(j) === qz.country;
    const el = this.mount(
      `<section class="result panel ${passed ? 'win' : 'lose'}" style="--c:${c.color}">
        ${
          passed
            ? `<div class="big-stamp tier-${qz.level}" style="--c:${level.color}"><span>${c.flag}</span><strong>${esc(c.name.toUpperCase())}</strong><small>${t.icon} ${esc(t.label.toUpperCase())}</small><b>${level.medal.toUpperCase()} · ${level.label.toUpperCase()}</b><em>${new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</em></div>`
            : `<div class="miss">🧳</div>`
        }
        <h2>${passed ? `${level.medal} stamp earned!` : 'So close — the gate is closed.'}</h2>
        <p class="score"><strong>${qz.correct}</strong> / ${total} correct${answered < total ? ` <small>(stopped after ${answered} — 90% was out of reach)</small>` : ''}</p>
        ${lines.map((l) => `<p class="next-line">${l}</p>`).join('')}
        ${!passed ? `<p class="sub">You need ${requiredCorrect(total)} of ${total}. Next time you’ll mostly get questions you haven’t seen.</p>` : ''}
        <div class="result-actions">
          ${!passed ? `<button class="btn primary" data-act="retry">↻ Try again</button>` : ''}
          ${up ? `<button class="btn ${onward ? '' : 'primary'}" data-act="up">${up.icon} Try ${up.label}</button>` : ''}
          ${passed ? (onward ? `<button class="btn primary" data-act="onward">Continue journey ✈️</button>` : `<button class="btn" data-act="map">🗺️ Back to map</button>`) : ''}
          <button class="btn ghost" data-act="topics">${passed ? 'Other subjects' : 'Pick another subject'}</button>
        </div>
      </section>`,
      'screen-center',
    );
    el.onclick = (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'retry') this.startQuiz(qz.country, qz.topic, qz.level);
      if (act === 'up' && up) this.startQuiz(qz.country, qz.topic, up.id);
      if (act === 'topics') this.showCountry(qz.country);
      if (act === 'onward' || act === 'map') void this.backToMap();
    };
  }

  // ---------- passport ----------

  private showPassport(): void {
    const pp = passport(this.save);
    const counts = stampCounts(this.save);
    const dlg = document.createElement('dialog');
    dlg.className = 'passport';
    const total = COUNTRIES.length * TOPICS.length;
    dlg.innerHTML = `
      <div class="pp-head">
        <div><p class="eyebrow">Passport of</p><h2>${esc(this.save.traveler?.name ?? 'Traveler')}</h2></div>
        <div class="pp-count">
          <strong>${counts.stamps}</strong><small>/ ${total} stamps</small>
          <span class="pp-medals"><i style="--m:${LEVEL_BY_ID.legend.color}">${counts.gold}</i><i style="--m:${LEVEL_BY_ID.voyager.color}">${counts.silver}</i><i style="--m:${LEVEL_BY_ID.explorer.color}">${counts.bronze}</i></span>
        </div>
        <button class="btn ghost small" data-act="close" aria-label="Close passport">✕</button>
      </div>
      <div class="pp-grid">
        ${COUNTRIES.map((c) => {
          const got = pp[c.id] ?? {};
          const any = Object.keys(got).length > 0;
          return `<div class="pp-page ${any ? 'visited' : ''}" style="--c:${c.color}">
            <div class="pp-country"><span>${c.flag}</span><strong>${esc(c.name)}</strong></div>
            <div class="pp-stamps">${TOPICS.map((t) => {
              const tier = got[t.id];
              const title = tier ? `${t.label}: ${LEVEL_BY_ID[tier].medal}` : t.label;
              return `<span class="pp-stamp ${tier ? 'on' : ''}" style="--t:${t.color};--m:${tier ? LEVEL_BY_ID[tier].color : 'transparent'}" title="${title}">${t.icon}</span>`;
            }).join('')}</div>
          </div>`;
        }).join('')}
      </div>
      <p class="pp-legend">Stamp rims show your best level: <i style="--m:${LEVEL_BY_ID.explorer.color}"></i> Bronze <i style="--m:${LEVEL_BY_ID.voyager.color}"></i> Silver <i style="--m:${LEVEL_BY_ID.legend.color}"></i> Gold</p>`;
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg || (e.target as HTMLElement).closest('[data-act="close"]')) dlg.close();
    });
    dlg.showModal();
  }
}

// ---------- small utilities ----------

/** Three medal pips (bronze, silver, gold) for one subject, filled when earned. */
function medalRow(j: Journey, country: CountryId, topic: TopicId): string {
  return LEVELS.map((l) => {
    const won = isPass(bestScore(j, country, topic, l.id) ?? 0, 10);
    return `<i class="${won ? 'on' : ''}" style="--m:${l.color}" title="${l.medal}"></i>`;
  }).join('');
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function pick<T>(xs: T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
}

/** Split-flap departure-board reveal. */
function flap(el: HTMLElement, delay: number): void {
  const final = el.textContent ?? '';
  const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let frame = 0;
  const frames = 10;
  setTimeout(function tick() {
    frame++;
    el.textContent = final
      .split('')
      .map((ch, i) => (ch === ' ' || i < (frame / frames) * final.length ? ch : glyphs[Math.floor(Math.random() * glyphs.length)]))
      .join('');
    if (frame < frames) setTimeout(tick, 45);
    else el.textContent = final;
  }, delay);
}
