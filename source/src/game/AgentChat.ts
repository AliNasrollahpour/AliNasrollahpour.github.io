// تماس مستقیم از مرورگر به endpoint سازگار با OpenAI (POST {BASE_URL}/chat/completions).
import { agentsDoc } from '../data/agents';
import { agentByRoom, type RoomId } from '../data/game-data';
import type { ChatMsg, GameState } from './GameState';
import type { ChatSettings } from './Settings';
import { devanAttemptsLeft } from './PuzzleController';

/** حد زمینه: فقط N پیام اخیر فرستاده می‌شود. */
export const HISTORY_LIMIT = 16;

const BORED_DEVAN = ['هوم.', 'اوهوم.', '…', 'باشه.', 'خسته‌م.', 'نه.', 'شاید.', 'بی‌خیال.'];

export function buildSystemPrompt(room: RoomId, state: GameState): string {
  const agent = agentByRoom(room);
  if (!agent) throw new Error(`no agent in ${room}`);
  const persona = agentsDoc.personas[agent.name];
  const live: string[] = [];
  if (agent.name === 'Devan') {
    live.push(`تلاش‌های باقی‌مانده بازیکن برای مگ‌لاک: ${devanAttemptsLeft(state)}.`);
    if (state.solved.has('D35')) live.push('بازیکن مگ‌لاک را باز کرده است؛ دیگر لازم نیست چیزی پنهان کنی درباره اسم، ولی همچنان در نقش بمان.');
  }
  if (state.solved.size) live.push(`معماهایی که تیم تا الان حل کرده (شناسه‌ها برای تو، هرگز به زبان نیاور): ${[...state.solved].join(', ')}.`);
  if (state.protocolPressed) live.push('پروتکل ایمنی هسته فعال شده است. هسته در امان است.');

  return [
    '# جهان',
    agentsDoc.context,
    '# قوانین مشترک',
    agentsDoc.sharedRules,
    `# شخصیت تو`,
    persona.systemPrompt,
    '# آنچه تو از اتاقت می‌دانی (فقط برای خودت)',
    agent.knowledge,
    live.length ? `# وضعیت فعلی\n${live.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildMessages(room: RoomId, state: GameState, history: ChatMsg[]) {
  const recent = history.filter((m) => m.role !== 'system-note').slice(-HISTORY_LIMIT);
  return [
    { role: 'system' as const, content: buildSystemPrompt(room, state) },
    ...recent.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];
}

/** Devan پس از اتمام سقف تلاش، بدون تماس شبکه پاسخ بی‌روح می‌دهد (قاعده در منطق، نه فقط پرامپت). */
export function devanIsBored(room: RoomId, state: GameState) {
  return room === 'room3' && !state.solved.has('D35') && devanAttemptsLeft(state) <= 0;
}

export function boredReply() {
  return BORED_DEVAN[Math.floor(Math.random() * BORED_DEVAN.length)];
}

/**
 * یک پاسخ می‌گیرد و هر تکه را همان لحظه به `onDelta` می‌دهد (SSE استاندارد OpenAI).
 * اگر ارائه‌دهنده استریم را پشتیبانی نکند و JSON معمولی برگرداند، همان متن یک‌جا
 * تحویل می‌شود؛ نمایشِ تایپی سمت UI در هر دو حالت یکسان کار می‌کند.
 */
export async function sendChat(
  settings: ChatSettings,
  room: RoomId,
  state: GameState,
  history: ChatMsg[],
  signal?: AbortSignal,
  onDelta?: (chunk: string) => void,
): Promise<string> {
  const url = `${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const stream = !!onDelta;
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages: buildMessages(room, state, history),
      temperature: 0.85,
      max_tokens: 600,
      ...(stream ? { stream: true } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText} ${body.slice(0, 200)}`);
  }

  const isSse = (res.headers.get('content-type') ?? '').includes('text/event-stream');
  if (!stream || !isSse || !res.body) {
    const json = await res.json();
    const text: string | undefined = json?.choices?.[0]?.message?.content;
    if (!text) throw new Error('empty response');
    const trimmed = text.trim();
    onDelta?.(trimmed);
    return trimmed;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';              // آخرین خط ممکن است نیمه باشد
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const chunk = JSON.parse(payload);
        const delta: string | undefined = chunk?.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onDelta?.(delta);
        }
      } catch {
        /* قطعه ناقص یا خط غیرJSON — رد شو */
      }
    }
  }
  if (!full.trim()) throw new Error('empty response');
  return full.trim();
}
