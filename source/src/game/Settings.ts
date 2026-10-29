// پیکربندیِ چت و زبان در localStorage — همیشه با try/catch (حالت خصوصی، Pages، پیش‌نمایش).

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
