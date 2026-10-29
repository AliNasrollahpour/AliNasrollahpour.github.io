// نوارِ مسیرها: دو مسیرِ نمونهٔ برد روی یک نقشهٔ کوچک + گام‌ها؛ و گرافِ کاملِ درها.
import { h, openPanel } from './dom';
import { t } from '../data/i18n';
import { gameData, roomById, type RoomId } from '../data/game-data';
import type { GameState } from '../game/GameState';

const POS: Record<RoomId, [number, number]> = { room1: [50, 40], room3: [250, 40], room2: [250, 200], room4: [50, 200], room5: [150, 120] };
const SHORT: Record<RoomId, string> = { room1: '۱', room2: '۲', room3: '۳', room4: '۴', room5: 'اصلی' };

function miniMap(highlight: string[], state: GameState) {
  let s = '<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10z" fill="currentColor"/></marker></defs>';
  for (const e of gameData.doors) {
    const [a, b] = e.between;
    const [x1, y1] = POS[a], [x2, y2] = POS[b];
    const hi = highlight.includes(e.id);
    const open = state.openEdges.has(e.id);
    const stroke = hi ? 'var(--accent)' : open ? '#3ddc84' : 'var(--line)';
    if (e.id === 'VENT') {
      s += `<path d="M${POS.room2[0] + 20},${POS.room2[1] - 10} C 330,120 330,0 ${POS.room1[0] + 20},${POS.room1[1] - 14}" fill="none" stroke="${stroke}" stroke-width="${hi ? 3 : 1.5}" stroke-dasharray="5 4" style="color:${stroke}" marker-end="url(#arr)"/>`;
      continue;
    }
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${hi ? 3.5 : 1.5}"/>`;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    s += `<text x="${mx}" y="${my - 5}" font-size="10" text-anchor="middle" fill="var(--muted)">${e.id}</text>`;
  }
  for (const [id, [x, y]] of Object.entries(POS) as [RoomId, [number, number]][]) {
    const col = roomById(id).palette.accent;
    s += id === 'room5'
      ? `<polygon points="${[0, 1, 2, 3, 4, 5, 6, 7].map((k) => { const a = Math.PI / 8 + (k * Math.PI) / 4; return `${x + 24 * Math.cos(a)},${y + 24 * Math.sin(a)}`; }).join(' ')}" fill="var(--panel)" stroke="${col}" stroke-width="2"/>`
      : `<rect x="${x - 22}" y="${y - 22}" width="44" height="44" rx="6" fill="var(--panel)" stroke="${col}" stroke-width="2"/>`;
    s += `<text x="${x}" y="${y + 5}" font-size="13" text-anchor="middle" fill="var(--text)" font-weight="bold">${SHORT[id]}</text>`;
  }
  return h('div', { class: 'minimap', html: `<svg viewBox="0 0 300 240" xmlns="http://www.w3.org/2000/svg">${s}</svg>` });
}

export function openRoutes(state: GameState) {
  const body = h('div', { class: 'routes' },
    h('p', { class: 'muted' }, 'کلیدها در چهار اتاقِ متفاوت‌اند و هر اتاق فقط بعضی درها را از سمتِ خودش باز می‌کند؛ پس برد فقط با همکاری ممکن است. خط سبز = درِ باز در همین دور.'),
    ...gameData.routes.map((r) => h('section', { class: 'route' },
      h('h3', {}, r.title),
      miniMap(r.edges, state),
      h('ol', {}, ...r.steps.map((s) => h('li', {}, h('span', { class: 'room-dot', style: `background:${roomById(s.room).palette.accent}` }), s.text))))),
    h('section', { class: 'route' },
      h('h3', {}, 'گرافِ کاملِ درها (جدولِ ۶.۲)'),
      h('table', { class: 'doors-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'یال'), h('th', {}, 'اتاق‌ها'), h('th', {}, 'باز از'), h('th', {}, 'مکانیک'))),
        h('tbody', {}, ...gameData.doors.map((d) => h('tr', { class: state.openEdges.has(d.id) ? 'open' : '' },
          h('td', {}, h('code', {}, d.id)),
          h('td', {}, d.between.map((x) => SHORT[x]).join(d.oneWay ? ' → ' : ' ↔ ')),
          h('td', {}, d.openableFrom.map((x) => SHORT[x]).join('، ')),
          h('td', {}, d.mechanic)))))));
  openPanel(t('routes'), body, { wide: true });
}
