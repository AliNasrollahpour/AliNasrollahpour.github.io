// ابزارهای کوچک DOM: سازنده عنصر، پنل کناری، toast، و markdown سبک.
import { t } from '../data/i18n';

type Child = Node | string | number | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'html') el.innerHTML = String(v);
    else if (k === 'style') el.setAttribute('style', String(v));
    else if (k in el && typeof v !== 'string') (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

/** مثل append ولی null/false را نادیده می‌گیرد. */
export function put(el: HTMLElement, ...children: Child[]) {
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

export const esc =(s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** markdown خیلی سبک برای متن‌های AGENTS.md: پاراگراف، **پررنگ**، `کد`، نقل‌قول. */
export function mdLite(src: string): string {
  return src
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      const quote = /^>\s?/.test(block);
      let html = esc(block.replace(/^>\s?/gm, ''))
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
      if (quote) html = `<blockquote>${html}</blockquote>`;
      return `<p>${html}</p>`;
    })
    .join('');
}

// ───────── پنل ─────────
let panelEl: HTMLElement | null = null;
let panelClose: (() => void) | undefined;

export function openPanel(title: string, body: Node, opts: { wide?: boolean; onClose?: () => void; kicker?: string } = {}) {
  closePanel();
  const root = document.getElementById('panel-root')!;
  panelClose = opts.onClose;
  panelEl = h('section', { class: `panel${opts.wide ? ' wide' : ''}`, role: 'dialog', 'aria-label': title },
    h('header', { class: 'panel-head' },
      h('div', {},
        opts.kicker ? h('div', { class: 'kicker' }, opts.kicker) : null,
        h('h2', {}, title)),
      h('button', { class: 'icon-btn', 'aria-label': t('close'), onclick: () => closePanel() }, '✕')),
    h('div', { class: 'panel-body' }, body));
  root.append(panelEl);
  return panelEl;
}

export function closePanel() {
  if (!panelEl) return;
  panelEl.remove();
  panelEl = null;
  const cb = panelClose;
  panelClose = undefined;
  cb?.();
}

export const panelOpen = () => !!panelEl;

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && panelEl && !(e.target instanceof HTMLInputElement && e.target.value)) closePanel();
});

// ───────── toast ─────────
export function toast(text: string, kind: 'ok' | 'err' | 'info' | 'key' = 'info', ms = 3200) {
  const root = document.getElementById('toasts')!;
  const el = h('div', { class: `toast ${kind}` }, text);
  root.append(el);
  while (root.children.length > 3) root.firstElementChild!.remove();
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }, ms);
}

/** صفحه گفت‌وگوی مستقل هر ایجنت، کنار خود بازی: /fightforknowledge/<slug>/ */
export const chatPageUrl = (slug: string) => `${import.meta.env.BASE_URL}${slug}/`;
