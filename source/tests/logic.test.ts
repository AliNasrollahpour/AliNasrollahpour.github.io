// تست‌های پذیرشِ منطقی (BUILD_SPEC بخش ۱۳).
import { describe, it, expect, beforeEach } from 'vitest';
import { gameData, puzzleById, type Dir } from '../src/data/game-data';
import { GameState } from '../src/game/GameState';
import { interactDoor } from '../src/game/DoorLogic';
import {
  submit, skip, insertKeys, pressProtocol, findCoin, giveCoin, coinsMentioned, devanAttemptsLeft, collectKey, normalize,
} from '../src/game/PuzzleController';
import { agentsDoc } from '../src/data/agents';
import { buildSystemPrompt, devanIsBored } from '../src/game/AgentChat';

let s: GameState;
beforeEach(() => {
  s = new GameState();
});

const lockPuzzles = gameData.puzzles.filter((p) => p.lockType !== 'clue');

describe('puzzles', () => {
  it.each(lockPuzzles.map((p) => [p.id]))('%s accepts its table answer', (id) => {
    const p = puzzleById(id)!;
    expect(submit(s, id, p.solution as string | Dir[]).ok).toBe(true);
  });

  it.each(lockPuzzles.filter((p) => p.id !== 'D53').map((p) => [p.id]))('%s rejects a wrong answer', (id) => {
    const p = puzzleById(id)!;
    const wrong: string | Dir[] = Array.isArray(p.solution) ? p.solution.map(() => 'U' as Dir).reverse().concat('R') : 'zz9';
    expect(submit(s, id, wrong).ok).toBe(false);
  });

  it('normalizes case, spaces and Persian digits', () => {
    expect(submit(s, 'P23a', ' l i a r ').ok).toBe(true);
    expect(submit(s, 'D13', '۸۵۶۹۶۴').ok).toBe(true);
    expect(submit(s, 'P25a', '7l 2r 4l').ok).toBe(true);
    expect(submit(s, 'P45b', '022').ok).toBe(true);
  });

  it('directional order matters', () => {
    expect(submit(s, 'P14g', ['U', 'R', 'L', 'D']).ok).toBe(false);
    expect(submit(s, 'P14g', ['R', 'U', 'L', 'D']).ok).toBe(true);
  });

  it('P40a solution is derived from the >0.5 rule', () => {
    expect(puzzleById('P40a')!.solution).toBe('XXOOXXOO');
  });
});

describe('D14: 5 of 7 real locks', () => {
  const real = ['P14a', 'P14b', 'P14c', 'P14d', 'P14e', 'P14g', 'P14h'];
  const fakes = ['Pf14a', 'Pf14b', 'Pf14c', 'Pf14d', 'Pf14e'];

  it('fakes alone never open it', () => {
    fakes.forEach((id) => skip(s, id));
    real.slice(0, 4).forEach((id) => skip(s, id));
    expect(s.openEdges.has('E14')).toBe(false);
    expect(interactDoor(s, 'E14', 'room1')).toMatchObject({ kind: 'progress', solved: 4, needed: 5 });
  });

  it('opens on the 5th real lock', () => {
    real.slice(0, 5).forEach((id) => skip(s, id));
    expect(s.openEdges.has('E14')).toBe(true);
    expect(interactDoor(s, 'E14', 'room1')).toEqual({ kind: 'move', to: 'room4' });
  });

  it('D41 (U D D L) from room 4 bypasses D14', () => {
    expect(submit(s, 'P41', ['U', 'D', 'D', 'L']).ok).toBe(true);
    expect(s.openEdges.has('E14')).toBe(true);
    expect(interactDoor(s, 'E14', 'room1')).toEqual({ kind: 'move', to: 'room4' });
  });
});

describe('per-side gating (table 6.2)', () => {
  it('room 1 alone cannot reach the main room', () => {
    expect(interactDoor(s, 'E51', 'room1').kind).toBe('wrong-side');
  });

  it('room 2 doors only open from room 2', () => {
    expect(interactDoor(s, 'E23', 'room3').kind).toBe('wrong-side');
    expect(interactDoor(s, 'E24', 'room4').kind).toBe('wrong-side');
    expect(interactDoor(s, 'E25', 'room5').kind).toBe('wrong-side');
    expect(interactDoor(s, 'E23', 'room2')).toEqual({ kind: 'puzzle', puzzleId: 'P23a' });
  });

  it('room 3 can only open D35', () => {
    expect(interactDoor(s, 'E13', 'room3').kind).toBe('wrong-side');
    expect(interactDoor(s, 'E23', 'room3').kind).toBe('wrong-side');
    expect(interactDoor(s, 'E35', 'room3')).toEqual({ kind: 'puzzle', puzzleId: 'D35' });
  });

  it('main room opens everything except room 2', () => {
    expect(interactDoor(s, 'E35', 'room5').kind).toBe('puzzle');
    expect(interactDoor(s, 'E45', 'room5').kind).toBe('puzzle');
    expect(interactDoor(s, 'E51', 'room5')).toEqual({ kind: 'opened', to: 'room1', push: true });
    expect(interactDoor(s, 'E25', 'room5').kind).toBe('wrong-side');
  });

  it('once open, a door is passable from both sides', () => {
    submit(s, 'P23a', 'LIAR');
    expect(interactDoor(s, 'E23', 'room3')).toEqual({ kind: 'move', to: 'room2' });
  });

  it('D35/D53 both open with کامران; D45/D54 with 0010110', () => {
    expect(submit(s, 'D53', 'كامران').ok).toBe(true); // ك عربی هم پذیرفته می‌شود
    expect(s.openEdges.has('E35')).toBe(true);
    const s2 = new GameState();
    expect(submit(s2, 'D35', 'کامران').ok).toBe(true);
    expect(s2.openEdges.has('E35')).toBe(true);
    const s3 = new GameState();
    expect(submit(s3, 'D54', '0010110').ok).toBe(true);
    expect(s3.openEdges.has('E45')).toBe(true);
    const s4 = new GameState();
    expect(submit(s4, 'P45a', '0010110').ok).toBe(true);
    expect(s4.openEdges.has('E45')).toBe(true);
  });

  it('D53 allows only one guess', () => {
    expect(submit(s, 'D53', 'آرش')).toEqual({ ok: false, reason: 'exhausted' });
    expect(submit(s, 'D53', 'کامران').ok).toBe(false);
    expect(interactDoor(s, 'E35', 'room5').kind).toBe('exhausted');
  });
});

describe('داکتِ کولر بینِ اتاق ۲ و اتاق ۱', () => {
  it('باز شدن از اتاق ۲ سمتِ اتاق ۱ را هم باز می‌کند', () => {
    expect(interactDoor(s, 'VENT', 'room2')).toEqual({ kind: 'opened', to: 'room1', push: true });
    expect(interactDoor(s, 'VENT', 'room2')).toEqual({ kind: 'move', to: 'room1' });
    expect(interactDoor(s, 'VENT', 'room1')).toEqual({ kind: 'move', to: 'room2' });
  });

  it('از سمتِ اتاق ۱ هم می‌شود کشفش کرد و بعد دوطرفه است', () => {
    expect(interactDoor(s, 'VENT', 'room1')).toEqual({ kind: 'opened', to: 'room2', push: true });
    expect(interactDoor(s, 'VENT', 'room2')).toEqual({ kind: 'move', to: 'room1' });
  });
});

describe('Devan attempts and coins', () => {
  it('starts with 1 attempt; a wrong guess makes him bored', () => {
    expect(devanAttemptsLeft(s)).toBe(1);
    expect(submit(s, 'D35', 'آرش')).toMatchObject({ ok: false, attemptsLeft: 0 });
    expect(devanIsBored('room3', s)).toBe(true);
    expect(submit(s, 'D35', 'کامران')).toMatchObject({ ok: false, reason: 'no-attempts' });
  });

  it('each found coin given to Devan adds an attempt', () => {
    submit(s, 'D35', 'آرش');
    expect(giveCoin(s, 'coin64')).toBe(false); // هنوز پیدا نشده
    findCoin(s, 'coin64');
    findCoin(s, 'coin101');
    expect(coinsMentioned(s, 'این سکه رو ببین: ۶۴')).toEqual(['coin64']);
    expect(devanAttemptsLeft(s)).toBe(1);
    expect(devanIsBored('room3', s)).toBe(false);
    expect(giveCoin(s, 'coin101')).toBe(true);
    expect(giveCoin(s, 'coin101')).toBe(false);
    expect(devanAttemptsLeft(s)).toBe(2);
    expect(submit(s, 'D35', 'کامران').ok).toBe(true);
  });
});

describe('win / lose', () => {
  it('P40a rewards key 4; four keys win', () => {
    submit(s, 'P40a', 'XXOOXXOO');
    expect(s.keysFound.has('key4')).toBe(true);
    ['key1', 'key2', 'key3'].forEach((k) => collectKey(s, k));
    expect(insertKeys(s)).toEqual({ kind: 'win' });
    expect(s.outcome).toBe('win');
  });

  it('three keys are not enough', () => {
    ['key1', 'key2', 'key3'].forEach((k) => collectKey(s, k));
    expect(insertKeys(s)).toEqual({ kind: 'inserted', count: 3, total: 4 });
    expect(s.outcome).toBe(null);
  });

  it('the safety protocol loses instantly and kills the four-key lock', () => {
    pressProtocol(s);
    expect(s.outcome).toBe('lose-protocol');
    ['key1', 'key2', 'key3', 'key4'].forEach((k) => collectKey(s, k));
    expect(insertKeys(s)).toEqual({ kind: 'dead' });
    expect(s.outcome).toBe('lose-protocol');
  });

  it('timer runs out → lose', () => {
    s.tick(gameData.lose.timerMinutes * 60_000);
    expect(s.outcome).toBe('lose-timer');
  });
});

describe('چیدمانِ نسخهٔ جدید', () => {
  it('در اتاق مگی فقط P14d و P14e جعبه‌اند؛ بقیهٔ سریِ P روی خودِ در', () => {
    const r1 = gameData.puzzles.filter((p) => p.roomId === 'room1' && p.mount);
    expect(r1.filter((p) => p.mount === 'box').map((p) => p.id).sort()).toEqual(['P14d', 'P14e']);
    expect(r1.filter((p) => p.mount === 'door').length).toBe(10);
    // قاعدهٔ «۵ از ۷» دست‌نخورده می‌ماند
    const side = gameData.doors.find((d) => d.id === 'E14')!.sides.find((x) => x.room === 'room1')!;
    expect(side.minSolved).toBe(5);
    expect(side.puzzles).toHaveLength(7);
  });

  it('مقادیرِ شبکهٔ عصبی همان تصویرِ تیم است و جواب عوض نشده', () => {
    const nn = puzzleById('P40a')!.nn!;
    expect(nn.input).toEqual([0.73, 0.21, 0.68, 0.34]);
    expect(nn.output).toEqual([0.81, 0.26, 0.74, 0.33]);
    expect(puzzleById('P40a')!.solution).toBe('XXOOXXOO');
  });

  it('آدم‌های سه قابِ اتاق ۴ روی هم ۲۲ نفرند (جوابِ P45b)', () => {
    const counts = gameData.clues
      .filter((c) => c.art?.startsWith('photo:'))
      .map((c) => Number(c.art!.split(':')[1]));
    expect(counts).toEqual([2, 6, 14]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(Number(puzzleById('P45b')!.solution));
  });

  it('کاغذِ اتاق ۳ متناقض است ولی اسمِ مگ‌لاک در آن آمده', () => {
    const note = gameData.clues.find((c) => c.id === 'C3note')!;
    expect(note.roomId).toBe('room3');
    expect(note.text).toContain('کامران');
    expect(normalize(note.text)).toContain(normalize(String(puzzleById('D35')!.solution)));
  });

  it('هیچ‌جای محتوا به میکروفون یا بلند گفتن اشاره نمی‌کند', () => {
    const blob = JSON.stringify(gameData);
    expect(blob).not.toMatch(/میکروفون/);
    expect(blob).not.toMatch(/اسم را بگو/);
  });
});

describe('agents', () => {
  it('parses all four system prompts from AGENTS.md', () => {
    for (const n of ['Maggie', 'Evy', 'Devan', 'Echo'] as const) {
      expect(agentsDoc.personas[n].systemPrompt.length).toBeGreaterThan(200);
      expect(agentsDoc.personas[n].systemPrompt).not.toMatch(/^###/m);
    }
    expect(agentsDoc.sharedRules).toContain('همیشه در نقش بمان');
  });

  it('system prompt includes persona, shared rules and room knowledge', () => {
    const p = buildSystemPrompt('room1', s);
    expect(p).toContain('مگی');
    expect(p).toContain('856964');
    expect(p).toContain('دیوار چهارم');
  });

  it('no API key is hardcoded in source data', () => {
    const blob = JSON.stringify(gameData);
    expect(blob).not.toMatch(/sk-[A-Za-z0-9]{10,}/);
    expect(blob).not.toMatch(/aa-[A-Za-z0-9]{10,}/);
  });
});
