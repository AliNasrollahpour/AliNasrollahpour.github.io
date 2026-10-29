// فرم پیکربندی چت. کلید فقط در localStorage ذخیره می‌شود و هیچ مقدار پیش‌فرضی ندارد.
import { h, toast } from './dom';
import { t } from '../data/i18n';
import { PROVIDERS, loadSettings, saveSettings } from '../game/Settings';

export function settingsForm(onSaved?: () => void) {
  const s = loadSettings();
  const provider = h('select', { id: 'f-provider' }, ...PROVIDERS.map((p) => h('option', { value: p.id, selected: p.id === s.provider }, p.label)));
  const baseUrl = h('input', { id: 'f-base', value: s.baseUrl, dir: 'ltr', spellcheck: false });
  const model = h('input', { id: 'f-model', value: s.model, dir: 'ltr', spellcheck: false });
  const apiKey = h('input', { id: 'f-key', type: 'password', value: s.apiKey, dir: 'ltr', placeholder: t('apiKeyPlaceholder'), autocomplete: 'off', spellcheck: false });

  provider.addEventListener('change', () => {
    const p = PROVIDERS.find((x) => x.id === provider.value)!;
    baseUrl.value = p.baseUrl;
    model.value = p.model;
  });

  const save = () => {
    saveSettings({ provider: provider.value, baseUrl: baseUrl.value.trim(), model: model.value.trim(), apiKey: apiKey.value.trim() });
    toast(t('saved'), 'ok', 1600);
    onSaved?.();
  };
  for (const el of [provider, baseUrl, model, apiKey]) el.addEventListener('change', save);

  const field = (label: string, el: HTMLElement) => h('label', { class: 'field' }, h('span', {}, label), el);
  return h('div', { class: 'settings-form' },
    field(t('provider'), provider), field(t('baseUrl'), baseUrl), field(t('model'), model), field(t('apiKey'), apiKey),
    h('p', { class: 'muted small' }, t('chatConfigHint')));
}
