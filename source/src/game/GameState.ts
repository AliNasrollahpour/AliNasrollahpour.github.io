import { gameData, type RoomId } from '../data/game-data';

export type Mode = 'play' | 'guide';
export type Outcome = null | 'win' | 'lose-protocol' | 'lose-timer';

export interface Operative {
  id: string;
  name: string;
  room: RoomId;
}

export interface ChatMsg {
  role: 'user' | 'assistant' | 'system-note';
  content: string;
}

const START_ROOMS: RoomId[] = ['room1', 'room2', 'room3', 'room4'];

/** وضعیت کامل یک دور بازی. منطق در DoorLogic و PuzzleController است. */
export class GameState {
  mode: Mode = 'play';
  ops: Operative[] = [];
  activeOp = 0;
  /** اتاقی که دوربین نشان می‌دهد؛ null یعنی نمای نقشه. */
  view: RoomId | null = null;

  solved = new Set<string>();
  openEdges = new Set<string>();
  /** درهای هل‌دادنی/کشفی که باز شده‌اند (E51، VENT). */
  pushed = new Set<string>();
  keysFound = new Set<string>();
  keysInserted = new Set<string>();
  coinsFound = new Set<string>();
  coinsGiven = new Set<string>();
  cards = new Set<string>();
  /** پازل‌هایی که سقف حدسشان تمام شده (D53). */
  exhausted = new Set<string>();
  devanFailed = 0;
  hatchOpen = false;
  protocolPressed = false;
  flashlight = false;
  outcome: Outcome = null;

  timerMs = gameData.lose.timerMinutes * 60_000;
  timerRunning = true;

  chats: Partial<Record<RoomId, ChatMsg[]>> = {};

  private listeners = new Set<() => void>();

  constructor() {
    this.reset();
  }

  reset(mode: Mode = this.mode) {
    this.mode = mode;
    this.ops = START_ROOMS.map((room, i) => ({ id: `op${i + 1}`, name: `${i + 1}`, room }));
    this.activeOp = 0;
    this.view = null;
    for (const s of [this.solved, this.openEdges, this.pushed, this.keysFound, this.keysInserted,
      this.coinsFound, this.coinsGiven, this.cards, this.exhausted]) s.clear();
    this.devanFailed = 0;
    this.hatchOpen = false;
    this.protocolPressed = false;
    this.flashlight = false;
    this.outcome = null;
    this.timerMs = gameData.lose.timerMinutes * 60_000;
    this.timerRunning = mode === 'play';
    this.chats = {};
    this.emit();
  }

  get active(): Operative {
    return this.ops[this.activeOp];
  }

  get room(): RoomId {
    return this.active.room;
  }

  opsIn(room: RoomId) {
    return this.ops.filter((o) => o.room === room);
  }

  /** فعال‌کردن یک هم‌تیمی که در این اتاق است (حالت بازی). */
  selectOpIn(room: RoomId): boolean {
    const idx = this.ops.findIndex((o) => o.room === room);
    if (idx < 0) return false;
    this.activeOp = idx;
    this.emit();
    return true;
  }

  selectOp(idx: number) {
    this.activeOp = idx;
    this.emit();
  }

  moveActive(to: RoomId) {
    this.active.room = to;
    this.emit();
  }

  chat(room: RoomId): ChatMsg[] {
    return (this.chats[room] ??= []);
  }

  tick(dtMs: number) {
    if (!this.timerRunning || this.outcome || this.mode !== 'play') return;
    this.timerMs = Math.max(0, this.timerMs - dtMs);
    if (this.timerMs === 0) {
      this.outcome = 'lose-timer';
      this.emit();
    }
  }

  on(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    for (const fn of this.listeners) fn();
  }
}
