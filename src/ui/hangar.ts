import { buy, COSMETICS, equip, type Cosmetic } from '../game/rewards';
import type { SaveData } from '../game/progress';
import { sfx } from './sfx';

/** The Hangar: spend air miles on plane liveries and passport covers. */

const fmt = (n: number) => n.toLocaleString();

function swatch(item: Cosmetic): string {
  if (item.kind === 'livery') {
    const [body, accent, trail] = item.colors;
    return `<span class="hg-plane" style="--body:${body};--accent:${accent};--trail:${trail}"><i class="hg-trail"></i><b>✈</b></span>`;
  }
  return `<span class="hg-cover" style="background:linear-gradient(135deg, ${item.colors[0]}, ${item.colors[1]})"><b>PASSPORT</b></span>`;
}

export function openHangar(getSave: () => SaveData, setSave: (s: SaveData) => void): void {
  const dlg = document.createElement('dialog');
  dlg.className = 'hangar';
  const render = () => {
    const save = getSave();
    const r = save.rewards;
    const section = (kind: Cosmetic['kind'], title: string) =>
      `<h3>${title}</h3><div class="hg-grid">${COSMETICS.filter((c) => c.kind === kind)
        .map((c) => {
          const owned = r.owned.includes(c.id);
          const equipped = (kind === 'livery' ? r.livery : r.cover) === c.id;
          const action = equipped
            ? `<span class="hg-tag">Equipped</span>`
            : owned
              ? `<button class="btn small" data-equip="${c.id}">Equip</button>`
              : `<button class="btn small primary" data-buy="${c.id}" ${r.miles < c.price ? 'disabled' : ''}>✈ ${fmt(c.price)}</button>`;
          return `<div class="hg-item ${equipped ? 'on' : ''}">${swatch(c)}<strong>${c.name}</strong>${action}</div>`;
        })
        .join('')}</div>`;
    dlg.innerHTML = `
      <div class="hg-head">
        <div><p class="eyebrow">Spend your air miles</p><h2>🛩️ The Hangar</h2></div>
        <div class="hg-miles"><strong>✈ ${fmt(r.miles)}</strong><small>air miles</small></div>
        <button class="btn ghost small" data-act="close" aria-label="Close hangar">✕</button>
      </div>
      <p class="hg-how">Earn miles for correct answers (more at Voyager and Legend), streaks of 3+, new stamps, achievements and every flight you take.</p>
      ${section('livery', 'Plane liveries')}
      ${section('cover', 'Passport covers')}`;
  };
  render();
  document.body.appendChild(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (e.target === dlg || t.closest('[data-act="close"]')) return dlg.close();
    const buyId = t.closest<HTMLElement>('[data-buy]')?.dataset.buy;
    const equipId = t.closest<HTMLElement>('[data-equip]')?.dataset.equip;
    if (buyId) {
      const res = buy(getSave(), buyId);
      if (res.ok) {
        setSave(res.save);
        sfx.stamp();
      }
    } else if (equipId) {
      setSave(equip(getSave(), equipId));
      sfx.click();
    }
    render();
  });
  dlg.showModal();
}
