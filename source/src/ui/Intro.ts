// صفحه ورود: عنوان، پیکربندی چت ایجنت‌ها، دکمه شروع، و پیام مأموریت به‌عنوان راهنما.
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
  // ترتیب در DOM = ترتیب روی موبایل: عنوان → پیکربندی → شروع → راهنما.
  // روی دسکتاپ، CSS با grid همین‌ها را دو ستونه می‌چیند.
  root.append(
    h('div', { class: 'intro-card' },
      h('h1', { class: 'intro-title' }, t('appTitle')),
      h('section', { class: 'intro-config' },
        h('h3', {}, t('chatConfig')),
        settingsForm()),
      h('div', { class: 'intro-actions' },
        h('button', { class: 'btn big', onclick: () => onStart('guide') }, t('start')),
        h('p', { class: 'start-hint' }, t('startHint'))),
      h('section', { class: 'briefing', dir: 'rtl', lang: 'fa' },
        h('h3', {}, t('briefingTitle')),
        ...paras)),
  );
  root.dir = 'rtl';
}

export function hideIntro() {
  document.getElementById('intro')!.hidden = true;
}
