// صفحهٔ ورود: پیامِ مأموریت، پیکربندیِ چت، زبان، و دو ورودی (تورِ داور / بازی).
import { h } from './dom';
import { settingsForm } from './SettingsForm';
import { t } from '../data/i18n';
import { gameData } from '../data/game-data';
import type { Mode } from '../game/GameState';

export function showIntro(onStart: (mode: Mode) => void) {
  const root = document.getElementById('intro')!;
  root.innerHTML = '';
  root.hidden = false;
  const paras = gameData.briefing.split('\n\n').map((p) => h('p', {}, p));
  root.append(
    h('div', { class: 'intro-card' },
      h('div', { class: 'intro-top' },
        h('div', {},
          h('div', { class: 'kicker' }, t('appSubtitle')),
          h('h1', {}, t('appTitle')))),
      h('div', { class: 'intro-grid' },
        h('article', { class: 'briefing', dir: 'rtl', lang: 'fa' },
          h('h3', {}, t('briefingTitle')),
          ...paras),
        h('aside', {},
          h('h3', {}, t('chatConfig')),
          settingsForm())),
      h('div', { class: 'intro-actions' },
        h('button', { class: 'btn big', onclick: () => onStart('play') }, h('b', {}, t('start')), h('small', {}, t('startHint'))))),
  );
  root.dir = 'rtl';
}

export function hideIntro() {
  document.getElementById('intro')!.hidden = true;
}
