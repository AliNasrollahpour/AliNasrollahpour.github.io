// پیکربندی چت و زبان در localStorage — همیشه با try/catch (حالت خصوصی، Pages، پیش‌نمایش).

export interface ChatSettings {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export const PROVIDERS: { id: string; label: string; baseUrl: string; model: string }[] = [
  { id: 'custom', label: 'Custom (OpenAI-compatible)', baseUrl: 'https://api.avalai.ir/v1', model: 'deepseek-v4.1-flash' },
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'deepseek/deepseek-chat' },
];

// کلید هرگز پیش‌فرض ندارد (BUILD_SPEC بخش ۱۵).
export const DEFAULT_SETTINGS: ChatSettings = {
  provider: PROVIDERS[0].id,
  baseUrl: PROVIDERS[0].baseUrl,
  model: PROVIDERS[0].model,
  apiKey: '',
};

const KEY = 'ffk3d.chat';
const THEME_KEY = 'ffk3d.theme';

export function loadSettings(): ChatSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* بدون storage هم کار می‌کند */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: ChatSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* نادیده */
  }
}

export type Theme = 'dark' | 'light';

/** تم فقط لایه DOM را عوض می‌کند؛ صحنه سه‌بعدی ثابت می‌ماند. */
export function loadTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'dark' || v === 'light') return v;
  } catch {
    /* نادیده */
  }
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* نادیده */
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

// ── تم به‌عنوان یک حالت مشترک: صفحه ورود، نوار بالا و صحنه سه‌بعدی همه به آن گوش می‌دهند ──
let current: Theme | null = null;
const themeListeners = new Set<(t: Theme) => void>();

export function getTheme(): Theme {
  return (current ??= loadTheme());
}

export function setTheme(theme: Theme) {
  current = theme;
  applyTheme(theme);
  saveTheme(theme);
  for (const fn of themeListeners) fn(theme);
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

export function onTheme(fn: (t: Theme) => void) {
  themeListeners.add(fn);
  return () => themeListeners.delete(fn);
}
