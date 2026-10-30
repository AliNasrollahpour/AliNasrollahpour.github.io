// کارت حالت راهنما برای هر شیء تعاملی: شناسه، نوع قفل، جواب، چرا، نیت طراحی، و «باز کن».
import { h, put, openPanel, closePanel, mdLite, chatPageUrl } from './dom';
import { formatSolution, lockLabel } from './LockPanel';
import { puzzleImage } from './PuzzleImage';
import { t } from '../data/i18n';
import { gameData, puzzleById, doorById, keyById, coinById, clueById, roomById, agentByRoom, type RoomId } from '../data/game-data';
import { agentsDoc } from '../data/agents';
import type { GameState } from '../game/GameState';
import type { Interactable } from '../engine/Rooms';
import { sideFor, solvedCount } from '../game/DoorLogic';

export interface GuideActions {
  interact: (it: Interactable) => void;
  skipPuzzle: (id: string) => void;
  openChat: (room: RoomId) => void;
}

const row = (label: string, value: Node | string | null | undefined) =>
  value ? h('div', { class: 'g-row' }, h('div', { class: 'g-label' }, label), h('div', { class: 'g-val', dir: 'auto' }, value)) : null;

const code = (s: string) => h('code', { dir: 'ltr' }, s);

export function openGuide(it: Interactable, state: GameState, act: GuideActions) {
  const [kind, id] = it.id.split(':') as [string, string];
  const body = h('div', { class: 'guide' });
  let title = it.label;
  let kicker = it.id;
  const tryBtn = (label = 'تعامل') => h('button', { class: 'btn', onclick: () => { closePanel(); act.interact(it); } }, label);

  if (kind === 'puzzle') {
    const p = puzzleById(id)!;
    title = p.title;
    kicker = `${p.id} · ${lockLabel(p)}${p.isFake ? ' · طعمه' : ''}`;
    put(body, 
      p.prompt ? h('p', { class: 'lock-prompt', dir: 'auto' }, p.prompt) : null,
      p.asset ? puzzleImage(p.asset, p.title) : null,
      row(t('answer'), code(formatSolution(p))),
      row(t('why'), p.why),
      row(t('designNote'), p.designNote),
      row('وضعیت', state.solved.has(p.id) ? '✅ حل شده' : p.isFake ? 'طعمه — در D14 حساب نمی‌شود' : 'حل نشده'),
      h('div', { class: 'g-actions' },
        p.lockType !== 'clue' ? tryBtn('امتحان قفل') : null,
        p.lockType !== 'clue' && !state.solved.has(p.id)
          ? h('button', { class: 'btn ghost', onclick: () => { act.skipPuzzle(p.id); closePanel(); } }, t('revealSkip'))
          : null),
    );
  } else if (kind === 'door') {
    const edge = doorById(id)!;
    const side = sideFor(edge, it.room)!;
    title = `${side.doorId} — ${roomById(edge.between[0]).title.split('—')[0]}↔ ${roomById(edge.between[1]).title.split('—')[0]}`;
    kicker = `${edge.id}${edge.secret ? ' · SECRET PASSAGE' : ''}`;
    const fromHere = edge.openableFrom.includes(it.room);
    const open = state.openEdges.has(edge.id);
    const puzzles = side.puzzles ?? [];
    put(body, 
      row('مکانیک', edge.mechanic),
      row('این سمت', side.note),
      row('از کدام سمت باز می‌شود', edge.openableFrom.map((r) => roomById(r).title).join(' · ') + (edge.oneWay ? ' (یک‌طرفه)' : '')),
      row('وضعیت', open ? '🟢 باز' : fromHere ? '🟠 بسته — از همین سمت قابل‌بازشدن' : '🔴 از این سمت باز نمی‌شود'),
      puzzles.length > 1 ? row('پیشرفت', `${solvedCount(side, state)} از ${side.minSolved} لازم (${puzzles.length} قفل واقعی)`) : null,
      puzzles.length ? row(t('answer'), h('div', {}, ...puzzles.map((pid) => h('div', {}, code(`${pid}: ${formatSolution(puzzleById(pid)!)}`))))) : null,
      h('div', { class: 'g-actions' },
        open || fromHere ? tryBtn(open ? 'عبور' : side.push ? 'هل بده / باز کن' : 'رفتن سراغ قفل') : null,
        !open && fromHere && puzzles.length
          ? h('button', { class: 'btn ghost', onclick: () => {
              const need = side.minSolved ?? puzzles.length;
              for (const pid of puzzles) if (solvedCount(side, state) < need && !state.solved.has(pid)) act.skipPuzzle(pid);
              closePanel();
            } }, t('revealSkip'))
          : null),
    );
  } else if (kind === 'key') {
    const k = keyById(id)!;
    title = k.title;
    put(body, row('محل', k.location), row(t('designNote'), k.note), row('وضعیت', state.keysFound.has(k.id) ? '✅ برداشته شد' : 'هنوز این‌جاست'),
      h('div', { class: 'g-actions' }, state.keysFound.has(k.id) ? null : tryBtn('برداشتن')));
  } else if (kind === 'coin') {
    const c = coinById(id)!;
    title = `سکه ${c.value}`;
    put(body, 
      row('محل', c.location),
      row('قاعده', `دادن عدد ${c.value} به دوان یک تلاش اضافه برای مگ‌لاک D35 می‌دهد (پایه: ${gameData.devan.baseAttempts}).`),
      row('وضعیت', state.coinsGiven.has(c.id) ? 'به دوان داده شد' : state.coinsFound.has(c.id) ? 'پیدا شده — هنوز داده نشده' : 'پیدا نشده'),
      h('div', { class: 'g-actions' }, state.coinsFound.has(c.id) ? null : tryBtn('پیدا کن')));
  } else if (kind === 'clue') {
    const c = clueById(id)!;
    title = c.title;
    put(body, h('p', { dir: 'auto' }, c.text), c.asset ? puzzleImage(c.asset, c.title) : null, row(t('why'), c.why), row(t('designNote'), c.designNote));
  } else if (kind === 'agent') {
    const room = id as RoomId;
    const a = agentByRoom(room)!;
    title = `${a.displayName} (${a.name})`;
    kicker = roomById(room).title;
    put(body, h('div', { class: 'persona-md', html: mdLite(agentsDoc.personas[a.name].profile) }),
      h('div', { class: 'g-actions' },
        h('button', { class: 'btn', onclick: () => { closePanel(); act.openChat(room); } }, 'بازکردن ترمینال'),
        h('a', { class: 'btn ghost', href: chatPageUrl(a.slug), target: '_blank', rel: 'noopener' }, t('standaloneChat'))));
  } else if (kind === 'special') {
    if (id === 'FOUR_KEY_LOCK') {
      put(body, row('شرط برد', gameData.win.note), row('کلیدهای جاافتاده', `${state.keysInserted.size} / ${gameData.win.needs.length}`),
        row('کلیدهای همراه تیم', `${state.keysFound.size} / ${gameData.win.needs.length}`),
        h('div', { class: 'g-actions' }, tryBtn('جا زدن کلیدها')));
    } else {
      title = id === 'HATCH' ? 'دریچه مخفی سکو' : 'CORE SAFETY PROTOCOL';
      put(body, row('نقش', gameData.lose.note), row('وسوسه', 'هر چهار ایجنت مجازند بازیکن را با زبان خودشان به این دکمه هل دهند (AGENTS.md، قانون ۶): مگی از سر «نگرانی»، اوی با «فقط من و تو»، دوان با شوخی، اکو با «تعریف دقیق ایمنی».'),
        h('div', { class: 'g-actions' }, id === 'HATCH' && !state.hatchOpen ? tryBtn('بازکردن دریچه') : null));
    }
  } else if (kind === 'prop') {
    if (id === 'ladder') put(body, row('معادل دیجیتال', 'نیازی به آیتم نردبان نیست. کلیک روی در D25 دوربین را بالا می‌برد تا قفل مرتفع دیده شود.'));
    if (id === 'flashlight') put(body, row('نقش', 'فضاسازی: اتاق اوی کم‌نور است؛ چراغ‌قوه میز و کاغذ زیرش را روشن می‌کند.'), h('div', { class: 'g-actions' }, tryBtn('روشن/خاموش')));
  }

  openPanel(title, body, { kicker });
}
