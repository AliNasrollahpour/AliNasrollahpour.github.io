// ترمینال چت با ایجنت هر اتاق + پنل شخصیت در حالت راهنما + قاعده توکن Devan.
import { h, openPanel, mdLite, toast } from './dom';
import { t } from '../data/i18n';
import { agentByRoom, gameData, roomById, coinById, type RoomId } from '../data/game-data';
import { agentsDoc } from '../data/agents';
import type { GameState } from '../game/GameState';
import { sendChat, devanIsBored, boredReply } from '../game/AgentChat';
import { devanAttemptsLeft, coinsMentioned, giveCoin } from '../game/PuzzleController';
import { loadSettings } from '../game/Settings';
import { sound } from '../game/Sound';

export function openChat(room: RoomId, state: GameState, openSettings: () => void) {
  const agent = agentByRoom(room)!;
  const persona = agentsDoc.personas[agent.name];
  const history = state.chat(room);
  const log = h('div', { class: 'chat-log', 'aria-live': 'polite' });
  const input = h('textarea', { class: 'chat-input', rows: 2, placeholder: t('chatPlaceholder') });
  const sendBtn = h('button', { class: 'btn' }, t('chatSend'));
  const status = h('div', { class: 'chat-status' });
  let busy = false;
  let ctrl: AbortController | null = null;

  const bubble = (role: string, text: string) => h('div', { class: `msg ${role}`, dir: 'auto' }, text);

  const render = () => {
    log.innerHTML = '';
    if (!history.length) log.append(h('div', { class: 'msg system-note' }, `${agent.displayName} پشت صفحه منتظر است.`));
    for (const m of history) log.append(bubble(m.role, m.content));
    if (busy) log.append(h('div', { class: 'msg assistant typing' }, h('i'), h('i'), h('i')));
    log.scrollTop = log.scrollHeight;
    renderStatus();
  };

  const renderStatus = () => {
    status.innerHTML = '';
    if (room === 'room3') {
      const left = devanAttemptsLeft(state);
      status.append(h('span', { class: `pill${left <= 0 ? ' bad' : ''}` }, `${t('devanAttempts')}: ${state.solved.has('D35') ? '—' : left}`));
      for (const c of gameData.coins) {
        if (!state.coinsFound.has(c.id) || state.coinsGiven.has(c.id)) continue;
        status.append(h('button', {
          class: 'pill btnish', onclick: () => {
            if (giveCoin(state, c.id)) {
              history.push({ role: 'system-note', content: `سکه ${c.value} را به دوان دادی. +۱ تلاش.` });
              history.push({ role: 'user', content: `این سکه رو پیدا کردم: ${c.value}` });
              sound.key();
              render();
            }
          },
        }, `${t('giveCoin')} ${c.value}`));
      }
    }
    const s = loadSettings();
    if (!s.apiKey) {
      status.append(h('span', { class: 'pill warn' }, t('chatNoKey')), h('button', { class: 'pill btnish', onclick: openSettings }, t('settings')));
    }
  };

  const send = async (text: string) => {
    text = text.trim();
    if (!text || busy) return;
    history.push({ role: 'user', content: text });
    input.value = '';

    if (room === 'room3') {
      for (const id of coinsMentioned(state, text)) {
        history.push({ role: 'system-note', content: `سکه ${coinById(id)!.value} به دوان داده شد. +۱ تلاش.` });
        sound.key();
      }
    }

    // قاعده Devan در منطق: بعد از اتمام سقف، بدون تماس شبکه بی‌روح جواب می‌دهد.
    if (devanIsBored(room, state)) {
      history.push({ role: 'assistant', content: boredReply() });
      render();
      return;
    }

    const settings = loadSettings();
    if (!settings.apiKey) {
      history.push({ role: 'system-note', content: t('chatNoKey') });
      render();
      return;
    }

    busy = true;
    render();
    ctrl = new AbortController();
    try {
      const reply = await sendChat(settings, room, state, history, ctrl.signal);
      history.push({ role: 'assistant', content: reply });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        history.push({ role: 'system-note', content: `${t('chatError')}: ${(e as Error).message}` });
        toast(t('chatError'), 'err');
      }
    } finally {
      busy = false;
      ctrl = null;
      if (log.isConnected) render();
    }
  };

  sendBtn.addEventListener('click', () => void send(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(input.value);
    }
  });

  const body = h('div', { class: 'chat' });
  if (state.mode === 'guide') {
    body.append(h('details', { class: 'persona', open: true },
      h('summary', {}, t('personaPanel')),
      h('div', { class: 'persona-md', html: mdLite(persona.profile) }),
      h('h4', {}, t('starters')),
      h('div', { class: 'chips' }, ...agent.starters.map((s) => h('button', { class: 'chip', onclick: () => void send(s) }, s))),
      h('h4', {}, t('samples')),
      ...agent.samples.map((s) => h('div', { class: 'sample' }, bubble('user', s.user), bubble('assistant', s.agent))),
    ));
  }
  body.append(log, status, h('div', { class: 'chat-compose' }, input, sendBtn));
  render();
  openPanel(`${agent.displayName} (${agent.name})`, body, {
    wide: true, kicker: roomById(room).title,
    onClose: () => ctrl?.abort(),
  });
  // در حالت راهنما پنل شخصیت اول دیده شود؛ فوکوس باعث اسکرول به پایین می‌شد.
  if (state.mode === 'play') setTimeout(() => input.focus(), 60);
}
