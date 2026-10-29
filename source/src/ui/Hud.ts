// HUD بالا (حالت، زمان، کلیدها، درها، تیم، دکمه‌ها) و سرتیترِ اتاقِ فعلی.
import { h, put } from './dom';
import { t } from '../data/i18n';
import { gameData, roomById } from '../data/game-data';
import type { GameState } from '../game/GameState';

export interface HudActions {
  toggleMode: () => void;
  toggleTimer: () => void;
  map: () => void;
  routes: () => void;
  settings: () => void;
  lang: () => void;
  restart: () => void;
  selectOp: (idx: number) => void;
}

const fmt = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(3, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export class Hud {
  private root = document.getElementById('hud')!;
  private roomBar = document.getElementById('roombar')!;
  private timerEl = h('button', { class: 'hud-timer', dir: 'ltr' });

  constructor(private state: GameState, private act: HudActions) {
    this.timerEl.addEventListener('click', () => act.toggleTimer());
    state.on(() => this.render());
  }

  tick() {
    this.timerEl.textContent = `${this.state.timerRunning && this.state.mode === 'play' ? '⏱' : '⏸'} ${fmt(this.state.timerMs)}`;
    this.timerEl.title = this.state.timerRunning ? t('timerPause') : t('timerResume');
    this.timerEl.classList.toggle('low', this.state.timerMs < 10 * 60_000);
  }

  render() {
    const s = this.state;
    const a = this.act;
    this.root.innerHTML = '';
    this.root.hidden = false;
    const keys = h('div', { class: 'hud-keys', title: t('keys') },
      ...gameData.win.needs.map((k) => h('span', { class: `k${s.keysInserted.has(k) ? ' in' : s.keysFound.has(k) ? ' found' : ''}` }, '🗝')),
      h('b', {}, `${s.keysFound.size}/${gameData.win.needs.length}`));
    const doors = h('div', { class: 'hud-doors', title: 'درهای باز' }, '🚪 ', h('b', {}, `${s.openEdges.size}/${gameData.doors.length}`));
    const team = h('div', { class: 'hud-team', role: 'group', 'aria-label': t('team') },
      ...s.ops.map((op, i) => h('button', {
        class: `op${i === s.activeOp ? ' on' : ''}`,
        style: `--c:${roomById(op.room).palette.accent}`,
        title: `${t('operative')} ${op.name} — ${roomById(op.room).title}`,
        onclick: () => a.selectOp(i),
      }, h('b', {}, op.name), h('small', {}, roomById(op.room).title.split('—')[0].trim()))));
    this.tick();
    this.root.append(
      h('div', { class: 'hud-left' },
        h('div', { class: 'brand' }, 'FFK'),
        h('div', { class: 'seg', role: 'group' },
          h('button', { class: s.mode === 'play' ? 'on' : '', onclick: () => s.mode !== 'play' && a.toggleMode() }, t('modePlay')),
          h('button', { class: s.mode === 'guide' ? 'on' : '', onclick: () => s.mode !== 'guide' && a.toggleMode() }, t('modeGuide'))),
        s.mode === 'play' ? this.timerEl : null,
        keys, doors),
      team,
      h('div', { class: 'hud-right' },
        h('button', { class: 'icon-btn', title: t('map'), onclick: a.map }, '🗺'),
        h('button', { class: 'icon-btn', title: t('routes'), onclick: a.routes }, '🧭'),
        h('button', { class: 'icon-btn', title: t('settings'), onclick: a.settings }, '⚙'),
        h('button', { class: 'icon-btn txt', title: 'Language', onclick: a.lang }, t('language')),
        h('button', { class: 'icon-btn', title: t('restart'), onclick: a.restart }, '↺')),
    );

    // سرتیترِ اتاق
    this.roomBar.innerHTML = '';
    if (s.view) {
      const r = roomById(s.view);
      this.roomBar.hidden = false;
      this.roomBar.style.setProperty('--c', r.palette.accent);
      put(this.roomBar, 
        h('button', { class: 'btn ghost small', onclick: a.map }, `← ${t('backToMap')}`),
        h('div', {}, h('b', {}, r.title), h('p', {}, r.mood)),
        s.mode === 'guide' ? h('p', { class: 'legend' }, t('guideLegend')) : null);
    } else {
      this.roomBar.hidden = false;
      this.roomBar.style.setProperty('--c', '#7c8aa0');
      put(this.roomBar, h('div', {}, h('b', {}, t('map')),
        h('p', {}, s.mode === 'guide'
          ? 'روی هر اتاق کلیک کن تا آزادانه به آن بروی. 🟢 درِ باز · 🟠 قابل‌بازشدن از این سمت · 🔴 از این سمت بسته.'
          : `هم‌تیمیِ فعال: ${s.active.name} — ${roomById(s.room).title}. روی اتاقی کلیک کن که یکی از هم‌تیمی‌ها در آن است.`)));
    }
  }
}
