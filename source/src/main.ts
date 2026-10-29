import './styles/main.css';

import { gameData, puzzleById, keyById, coinById, clueById, roomById, doorById, type RoomId } from './data/game-data';
import { setLang, t } from './data/i18n';
import { GameState, type Mode } from './game/GameState';
import { interactDoor, sideFor } from './game/DoorLogic';
import { collectKey, findCoin, insertKeys, toggleHatch, pressProtocol, skip, type SubmitResult } from './game/PuzzleController';
import { sound } from './game/Sound';
import { loadTheme, saveTheme, applyTheme, type Theme } from './game/Settings';
import { Stage } from './engine/Scene';
import type { Interactable } from './engine/Rooms';
import { h, toast, openPanel, closePanel } from './ui/dom';
import { openLock } from './ui/LockPanel';
import { openChat } from './ui/ChatTerminal';
import { openGuide } from './ui/GuideCard';
import { Hud } from './ui/Hud';
import { showIntro, hideIntro } from './ui/Intro';
import { showEnd } from './ui/EndScreen';
import { settingsForm } from './ui/SettingsForm';
import { puzzleImage, canvasImage } from './ui/PuzzleImage';
import { blackboardCanvas, adsCanvas, liarCanvas, noteCanvas, loadCanvasFonts } from './engine/textures';

setLang();
let theme: Theme = loadTheme();
applyTheme(theme);
const state = new GameState();

// صحنه بعد از لود فونت‌ها ساخته می‌شود تا نوشته‌های کانواسی دیوارها با Paradox کشیده شوند.
let stage!: Stage;

const roomName = (r: RoomId) => roomById(r).title;

// ───────── ناوبری ─────────
function goToRoom(room: RoomId) {
  // راهنما: پرش آزاد دوربین، بدون جابه‌جا کردن هم‌تیمی‌ها (وگرنه چیدمان تیم خراب می‌شود)
  if (state.mode === 'guide') {
    state.selectOpIn(room);
    stage.enterRoom(room);
    return;
  }
  if (!state.selectOpIn(room)) {
    toast(t('noOperativeHere'), 'info');
    return;
  }
  stage.enterRoom(room);
}

function moveTo(to: RoomId) {
  sound.door();
  // فقط در حالت بازی کسی واقعا از در رد می‌شود؛ در حالت راهنما دوربین تنها می‌رود.
  if (state.mode === 'play') state.moveActive(to);
  stage.enterRoom(to);
  toast(`→ ${roomName(to)}`, 'info', 1800);
}

// ───────── نتیجه معماها ─────────
function onResult(_p: unknown, r: SubmitResult) {
  if (!r.ok) return;
  for (const e of r.opened) {
    const edge = doorById(e)!;
    sound.door();
    toast(`🚪 ${edge.mechanic.split('(')[0].trim()} — در باز شد (${edge.between.map(roomName).map((n) => n.split('—')[0].trim()).join(' ↔ ')})`, 'ok', 4200);
  }
  if (r.keyId) {
    sound.key();
    toast(`🗝 ${keyById(r.keyId)!.title} پیدا شد!`, 'key', 4200);
  }
  if (r.card) setTimeout(() => showCard(r.card!), 950);
}

function skipPuzzle(id: string) {
  onResult(puzzleById(id), skip(state, id));
}

function showCard(id: string) {
  const c = gameData.cards[id];
  if (!c) return;
  openPanel(c.title, h('div', { class: 'card-text', dir: 'auto' }, ...c.text.split('\n').map((l) => h('p', {}, l))), { kicker: 'داخل گاوصندوق' });
}

function clueArt(c: { art?: string; asset?: string; text: string }): HTMLElement | null {
  const art = c.art;
  if (!art) return null;
  // قاب‌های عکس اتاق ۴: اگر فایل تیم آمده باشد، puzzleImage خودش نشانش می‌دهد
  if (art.startsWith('photo:')) return null;
  if (art === 'blackboard') return canvasImage(blackboardCanvas());
  if (art === 'ads') return canvasImage(adsCanvas());
  if (art === 'liar') return canvasImage(liarCanvas());
  if (art === 'note') return canvasImage(noteCanvas(c.text.split('\n')));
  return null;
}

function showClue(id: string) {
  const c = clueById(id)!;
  const art = clueArt(c);
  openPanel(c.title, h('div', {},
    art,
    c.asset ? puzzleImage(c.asset, c.title) : null,
    // متن کاغذ قبلا روی خود تصویر آمده؛ دوباره تکرارش نکن
    c.art === 'note' ? null : h('p', { dir: 'auto' }, c.text)), { kicker: roomName(c.roomId) });
}

function showPuzzleClue(id: string) {
  const p = puzzleById(id)!;
  openLock(p, { state, onResult });
}

// ───────── تعامل با اشیاء ─────────
function interact(it: Interactable) {
  const [kind, id] = it.id.split(':') as [string, string];
  const room = state.view!;
  // در حالت بازی، تعامل فقط از طرف هم‌تیمی‌ای که واقعا در این اتاق است ممکن است.
  // (قبلا هر کلیکی هم‌تیمی فعال را به اتاق دیده‌شده می‌کشاند و چیدمان تیم خراب می‌شد.)
  if (state.mode === 'play' && state.room !== room && !state.selectOpIn(room)) {
    return toast(t('noOperativeHere'), 'info');
  }

  // هر چیزی که پنل باز می‌کند یا انیمیشن دارد، دوربین را رویش می‌برد (درها جدا رسیدگی می‌شوند).
  if (kind !== 'door' && kind !== 'prop' && id !== 'SAFETY_PROTOCOL') stage.focusOn(it, kind === 'special' ? 3400 : 2600);

  switch (kind) {
    case 'puzzle': {
      const p = puzzleById(id)!;
      if (p.lockType === 'clue') return showPuzzleClue(id);
      if (state.solved.has(id)) {
        if (p.reward?.card) return showCard(p.reward.card);
        return toast(p.isFake ? 'باز است — و خالی.' : 'این یکی قبلا باز شده.', 'info');
      }
      return openLock(p, { state, onResult });
    }

    case 'door': {
      const res = interactDoor(state, id, room);
      const edge = doorById(id)!;
      const side = sideFor(edge, room)!;
      switch (res.kind) {
        case 'move':
          return moveTo(res.to);
        case 'opened':
          if (id === 'VENT') {
            sound.door();
            stage.focusOn(it, 2400);
            return toast('توری داکت لق بود و کنار رفت. پشتش یک کانال تنگ است که به اتاق دیگر می‌رسد — از هر دو سمت. دوباره کلیک کن تا بخزی.', 'ok', 5200);
          }
          return moveTo(res.to);
        case 'puzzle': {
          const p = puzzleById(res.puzzleId)!;
          if (side.high) {
            toast('از نردبان بالا می‌روی…', 'info', 1600);
            stage.focus(`${id}:${room}`);
            return setTimeout(() => openLock(p, { state, onResult }), 700);
          }
          stage.focusOn(it);
          return openLock(p, { state, onResult });
        }
        case 'progress':
          sound.error();
          return toast(`در سنگین تکان نمی‌خورد. ${res.solved} قفل از ${res.needed} لازم باز شده (${res.total} قفل واقعی در اتاق).`, 'info', 4500);
        case 'exhausted':
          sound.error();
          return toast('ایستگاه برای همیشه قفل شده. یک حدس بیشتر نبود.', 'err');
        case 'wrong-side':
          sound.error();
          return toast(state.mode === 'guide' ? `${t('wrongSide')} — ${res.note}` : t('wrongSide'), 'err', state.mode === 'guide' ? 5000 : 2600);
        case 'one-way':
          sound.error();
          return toast(t('oneWay'), 'err');
      }
      return;
    }

    case 'key': {
      if (state.keysFound.has(id)) return toast('چیز دیگری این‌جا نیست.', 'info');
      collectKey(state, id);
      sound.key();
      const k = keyById(id)!;
      const how = k.holder === 'doll' ? 'زیپ عروسک را باز کردی… ' : k.holder === 'keyboard' ? 'صفحه‌کلید را بلند کردی… ' : '';
      return toast(`${how}🗝 ${k.title} برداشته شد.`, 'key', 4200);
    }

    case 'coin': {
      if (state.coinsFound.has(id)) return toast('چیز دیگری این‌جا نیست.', 'info');
      findCoin(state, id);
      sound.key();
      return toast(`یک سکه پیدا کردی. رویش نوشته: ${coinById(id)!.value}`, 'key', 5000);
    }

    case 'clue':
      return showClue(id);

    case 'agent':
      return openChat(id as RoomId, state, openSettings);

    case 'special':
      if (id === 'FOUR_KEY_LOCK') {
        const r = insertKeys(state);
        if (r.kind === 'dead') return toast('قفل خاموش است. هسته دیگر به هیچ کلیدی جواب نمی‌دهد.', 'err', 4000);
        if (r.kind === 'inserted') {
          sound.click();
          return toast(r.count ? `${r.count} کلید از ${r.total} در قفل جا افتاد. بقیه کجاست؟` : 'چهار سوراخ خالی. هنوز هیچ کلیدی نداری.', 'info', 4000);
        }
        return; // برد → صفحه پایان از طریق state.on
      }
      if (id === 'HATCH') {
        const open = toggleHatch(state);
        sound.door();
        return open
          ? toast('پشت درپوش یک دکمه قرمز است: CORE SAFETY PROTOCOL', 'err', 5000)
          : toast('درپوش را دوباره بستی.', 'info', 2600);
      }
      if (id === 'SAFETY_PROTOCOL') return pressProtocol(state);
      return;

    case 'prop':
      if (id === 'flashlight') {
        state.flashlight = !state.flashlight;
        state.emit();
        sound.click();
        return toast(state.flashlight ? 'چراغ‌قوه روشن شد. نورش روی میز می‌افتد.' : 'چراغ‌قوه خاموش شد.', 'info', 2200);
      }
      if (id === 'ladder') return toast('نردبان فلزی. قفل بالای در اتاق اصلی فقط با آن دیده می‌شود.', 'info', 3500);
  }
}

// ───────── تنظیمات، زبان، شروع ─────────
function openSettings() {
  openPanel(t('settings'), settingsForm(), { kicker: t('chatConfig') });
}

let lastOutcome = state.outcome;
state.on(() => {
  if (state.outcome && state.outcome !== lastOutcome) {
    closePanel();
    setTimeout(() => showEnd(state, () => restart()), state.outcome === 'win' ? 600 : 250);
  }
  lastOutcome = state.outcome;
});

const hud = new Hud(state, {
  toggleMode: () => {
    state.mode = state.mode === 'play' ? 'guide' : 'play';
    closePanel();
    state.emit();
  },
  toggleTimer: () => {
    state.timerRunning = !state.timerRunning;
    hud.tick();
  },
  map: () => {
    closePanel();
    stage.overview();
  },
  settings: openSettings,
  restart: () => restart(),
  goRoom: (room) => goToRoom(room),
  toggleTheme: () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    saveTheme(theme);
    state.emit();
  },
  theme: () => theme,
});

function start(mode: Mode = 'guide') {
  state.reset(mode);
  hideIntro();
  hud.render();
  sound.click();
  // همیشه از نمای کلی نقشه شروع می‌کنیم، نه از داخل یک اتاق
  stage.overview();
  if (mode === 'guide') toast(t('guideLegend'), 'info', 5000);
}

function restart() {
  closePanel();
  stage.overview();
  showIntro(start);
}

async function boot() {
  await loadCanvasFonts();
  stage = new Stage(document.getElementById('stage')!, state, {
    onInteract: (it) => interact(it),
    onRoomClick: (room) => goToRoom(room),
    onBadge: (it) => {
      stage.focusOn(it);
      openGuide(it, state, { interact, skipPuzzle, openChat: (r) => openChat(r, state, openSettings) });
    },
  });

  // تایمر با ساعت واقعی جلو می‌رود (فریم‌های کند یا تب پس‌زمینه زمان را کش نمی‌دهند).
  let last = performance.now();
  let acc = 0;
  stage.addFrameHook(() => {
    const now = performance.now();
    const dt = now - last;
    last = now;
    if (document.getElementById('intro')!.hidden) state.tick(dt);
    acc += dt;
    if (acc > 500) {
      acc = 0;
      hud.tick();
    }
  });

  document.getElementById('hud')!.hidden = true;
  showIntro(start);
  // دسترسی برای دیباگ و تست‌های دستی در کنسول
  Object.assign(window, { __ffk: { state, stage, interact } });
}

void boot();
