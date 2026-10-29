// صفحهٔ پایان (برد / باخت با پروتکل / باخت با زمان).
import { h } from './dom';
import { t } from '../data/i18n';
import { gameData } from '../data/game-data';
import type { GameState } from '../game/GameState';
import { sound } from '../game/Sound';

export function showEnd(state: GameState, onRestart: () => void) {
  const root = document.getElementById('end')!;
  const o = state.outcome;
  if (!o) return;
  const [title, text, cls] =
    o === 'win' ? [t('winTitle'), t('winText'), 'win']
    : o === 'lose-protocol' ? [t('loseProtocolTitle'), t('loseProtocolText'), 'lose']
    : [t('loseTimerTitle'), t('loseTimerText'), 'lose'];
  (o === 'win' ? sound.win : sound.lose)();
  const used = gameData.lose.timerMinutes * 60_000 - state.timerMs;
  const mm = Math.floor(used / 60000);
  const real = gameData.puzzles.filter((p) => p.lockType !== 'clue' && !p.isFake);
  root.innerHTML = '';
  root.className = `end ${cls}`;
  root.hidden = false;
  root.append(h('div', { class: 'end-card' },
    h('div', { class: 'end-glyph' }, o === 'win' ? '◯' : '⚠'),
    h('h1', {}, title),
    h('p', {}, text),
    h('div', { class: 'end-stats' },
      h('div', {}, h('b', {}, `${state.keysInserted.size}/${gameData.win.needs.length}`), h('small', {}, t('keys'))),
      h('div', {}, h('b', {}, `${real.filter((p) => state.solved.has(p.id)).length}/${real.length}`), h('small', {}, 'معما')),
      h('div', {}, h('b', {}, `${state.openEdges.size}/${gameData.doors.length}`), h('small', {}, 'در')),
      state.mode === 'play' ? h('div', {}, h('b', {}, `${mm}′`), h('small', {}, t('timer'))) : null),
    o === 'lose-protocol' ? h('p', { class: 'muted' }, 'این دکمه طعمهٔ اصلیِ بازی است: بریفینگ هشدار داده بود، و ایجنت‌ها هر کدام به زبانِ خودشان به سمتش هل می‌دهند.') : null,
    h('div', { class: 'end-actions' },
      h('button', { class: 'btn', onclick: () => { hideEnd(); onRestart(); } }, t('restart')),
      h('button', { class: 'btn ghost', onclick: hideEnd }, t('keepExploring')))));
}

export function hideEnd() {
  document.getElementById('end')!.hidden = true;
}
