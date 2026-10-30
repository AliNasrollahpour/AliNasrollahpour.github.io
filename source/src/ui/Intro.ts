// صفحه ورود: عنوان، پیکربندی چت ایجنت‌ها، دکمه شروع، و پیام مأموریت به‌عنوان راهنما.
import { h, chatPageUrl } from './dom';
import { settingsForm } from './SettingsForm';
import { t } from '../data/i18n';
import { gameData, roomById } from '../data/game-data';
import type { Mode } from '../game/GameState';
import { getTheme, toggleTheme } from '../game/Settings';

export function showIntro(onStart: (mode: Mode) => void) {
  const root = document.getElementById('intro')!;
  root.innerHTML = '';
  root.hidden = false;
  const paras = gameData.briefing.split('\n\n').map((p) => h('p', {}, p));
  // ترتیب در DOM = ترتیب روی موبایل: عنوان → پیکربندی → شروع → راهنما.
  // روی دسکتاپ، CSS با grid همین‌ها را دو ستونه می‌چیند.
  root.append(
    h('div', { class: 'intro-card' },
      h('div', { class: 'intro-head' },
        h('h1', { class: 'intro-title' }, t('appTitle')),
        h('button', {
          class: 'icon-btn txt theme-btn', title: t('theme'),
          onclick: () => { toggleTheme(); showIntro(onStart); },
        }, getTheme() === 'dark' ? t('themeLight') : t('themeDark'))),
      // ستون کناری: اول پیکربندی، بعد دکمه شروع، بعد توضیح — در دسکتاپ و موبایل یکسان
      h('div', { class: 'intro-side' },
        h('section', { class: 'intro-config' },
          h('h3', {}, t('chatConfig')),
          settingsForm()),
        h('div', { class: 'intro-actions' },
          h('button', { class: 'btn big', onclick: () => onStart('guide') }, t('start')),
          h('p', { class: 'start-hint' }, t('startHint'))),
        // بدون وارد شدن به بازی: مستقیم با هر شخصیت چت کن
        h('section', { class: 'intro-direct' },
          h('h3', {}, t('directChat')),
          h('p', { class: 'muted small' }, t('directChatHint')),
          h('div', { class: 'direct-grid' },
            ...gameData.agents.map((a) => h('a', {
              class: 'direct-link', href: chatPageUrl(a.slug), style: `--c:${roomById(a.roomId).palette.accent}`,
            }, h('b', {}, a.displayName), h('small', {}, a.name)))))),
      h('section', { class: 'briefing', dir: 'rtl', lang: 'fa' },
        h('h3', {}, t('briefingTitle')),
        ...paras)),
  );
  root.dir = 'rtl';
}

export function hideIntro() {
  document.getElementById('intro')!.hidden = true;
}
