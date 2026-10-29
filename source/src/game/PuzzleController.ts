// ارزیابیِ جواب‌ها و قواعدِ ویژه (سقفِ Devan، یک‌حدسیِ D53، پاداش‌ها، برد/باخت).
import { gameData, puzzleById, coinById, type Dir, type Puzzle } from '../data/game-data';
import type { GameState } from './GameState';
import { refreshEdges } from './DoorLogic';

export type SubmitResult =
  | { ok: true; fake: boolean; opened: string[]; keyId?: string; card?: string }
  | { ok: false; reason: 'wrong' | 'exhausted' | 'no-attempts'; attemptsLeft?: number };

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** نرمال‌سازی: ارقام فارسی/عربی → لاتین، ی/ک عربی → فارسی، حذفِ فاصله و نیم‌فاصله، حروف بزرگ. */
export function normalize(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\s‌‍‎‏]/g, '')
    .toUpperCase();
}

export function solutionString(p: Puzzle): string {
  return Array.isArray(p.solution) ? p.solution.join('') : normalize(p.solution);
}

export function isCorrect(p: Puzzle, input: string | Dir[]): boolean {
  // قفل‌های جهتی ترتیب‌محورند؛ مقایسهٔ رشتهٔ جهت‌ها دقیق است.
  const given = Array.isArray(input) ? input.join('') : normalize(input);
  if (given === solutionString(p)) return true;
  return (p.accept ?? []).some((a) => normalize(a) === given);
}

export function devanAttemptsLeft(state: GameState) {
  return gameData.devan.baseAttempts + state.coinsGiven.size - state.devanFailed;
}

function markSolved(state: GameState, p: Puzzle): SubmitResult {
  state.solved.add(p.id);
  let keyId: string | undefined;
  let card: string | undefined;
  if (p.reward?.keyId) {
    keyId = p.reward.keyId;
    state.keysFound.add(keyId);
  }
  if (p.reward?.card) {
    card = p.reward.card;
    state.cards.add(card);
  }
  const opened = refreshEdges(state);
  state.emit();
  return { ok: true, fake: !!p.isFake, opened, keyId, card };
}

export function submit(state: GameState, puzzleId: string, input: string | Dir[]): SubmitResult {
  const p = puzzleById(puzzleId);
  if (!p) throw new Error(`unknown puzzle ${puzzleId}`);
  if (state.solved.has(p.id)) return markSolved(state, p);
  if (state.exhausted.has(p.id)) return { ok: false, reason: 'exhausted' };

  // قاعدهٔ توکنِ Devan: مگ‌لاکِ D35 فقط به‌اندازهٔ سقفِ تلاش حدس می‌پذیرد.
  const devanGated = p.id === 'D35';
  if (devanGated && devanAttemptsLeft(state) <= 0) return { ok: false, reason: 'no-attempts', attemptsLeft: 0 };

  if (isCorrect(p, input)) return markSolved(state, p);

  if (devanGated) {
    state.devanFailed++;
    state.emit();
    return { ok: false, reason: 'wrong', attemptsLeft: devanAttemptsLeft(state) };
  }
  if (p.attempts !== undefined) {
    state.exhausted.add(p.id);
    state.emit();
    return { ok: false, reason: 'exhausted' };
  }
  return { ok: false, reason: 'wrong' };
}

/** «باز کن» در حالت راهنما: معما را بدون حل رد می‌کند. */
export function skip(state: GameState, puzzleId: string): SubmitResult {
  const p = puzzleById(puzzleId);
  if (!p) throw new Error(`unknown puzzle ${puzzleId}`);
  state.exhausted.delete(p.id);
  return markSolved(state, p);
}

export function findCoin(state: GameState, coinId: string) {
  state.coinsFound.add(coinId);
  state.emit();
}

/** دادنِ عددِ سکه به Devan: یک تلاشِ اضافه. فقط سکه‌ای که پیدا شده و هنوز داده نشده. */
export function giveCoin(state: GameState, coinId: string): boolean {
  if (!state.coinsFound.has(coinId) || state.coinsGiven.has(coinId)) return false;
  state.coinsGiven.add(coinId);
  state.emit();
  return true;
}

/** اگر پیامِ بازیکن به Devan عددِ سکه‌ای پیداشده را داشت، آن سکه را می‌دهد. */
export function coinsMentioned(state: GameState, text: string): string[] {
  const norm = normalize(text);
  const given: string[] = [];
  for (const c of gameData.coins) {
    const re = new RegExp(`(^|\\D)${coinById(c.id)!.value}(\\D|$)`);
    if (re.test(norm) && giveCoin(state, c.id)) given.push(c.id);
  }
  return given;
}

export function collectKey(state: GameState, keyId: string) {
  state.keysFound.add(keyId);
  state.emit();
}

export type InsertResult = { kind: 'dead' } | { kind: 'inserted'; count: number; total: number } | { kind: 'win' };

export function insertKeys(state: GameState): InsertResult {
  if (state.protocolPressed) return { kind: 'dead' };
  for (const k of state.keysFound) state.keysInserted.add(k);
  const total = gameData.win.needs.length;
  const count = gameData.win.needs.filter((k) => state.keysInserted.has(k)).length;
  if (count === total) {
    state.outcome = 'win';
    state.emit();
    return { kind: 'win' };
  }
  state.emit();
  return { kind: 'inserted', count, total };
}

export function openHatch(state: GameState) {
  state.hatchOpen = true;
  state.emit();
}

export function pressProtocol(state: GameState) {
  state.protocolPressed = true;
  if (state.outcome !== 'win') state.outcome = 'lose-protocol';
  state.emit();
}
