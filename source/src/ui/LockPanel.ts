// یک کامپوننت ورودی برای هر نوع قفل (BUILD_SPEC بخش ۸). جواب‌ها فقط از gameData می‌آیند.
import { h, openPanel, closePanel } from './dom';
import { puzzleImage } from './PuzzleImage';
import { t } from '../data/i18n';
import { gameData, type Dir, type Puzzle } from '../data/game-data';
import type { GameState } from '../game/GameState';
import { submit, skip, devanAttemptsLeft, type SubmitResult } from '../game/PuzzleController';
import { sound } from '../game/Sound';

export interface LockCtx {
  state: GameState;
  onResult: (p: Puzzle, r: SubmitResult) => void;
  onClose?: () => void;
}

const LOCK_LABEL: Record<Puzzle['lockType'], string> = {
  combo: 'رمز', directional: 'قفل جهتی', 'keypad-labeled': 'پد عددی', dial: 'قفل چرخشی گاوصندوقی',
  'pattern-nn': 'قفل الگویی ۸ پین', 'binary-switches': 'قفل چرخشی باینری', 'name-buttons': 'دکمه‌های اسم', maglock: 'مگ‌لاک', clue: 'سرنخ',
};
export const lockLabel = (p: Puzzle) => LOCK_LABEL[p.lockType];

export function formatSolution(p: Puzzle) {
  if (Array.isArray(p.solution)) return p.solution.join(' ');
  if (p.lockType === 'pattern-nn') return p.solution.split('').join(' ');
  return p.solution;
}

const ARROW: Record<Dir, string> = { U: '↑', D: '↓', L: '←', R: '→' };

export function openLock(p: Puzzle, ctx: LockCtx) {
  const msg = h('div', { class: 'lock-msg', role: 'status' });
  const wrap = h('div', { class: 'lock' });

  const attempt = (input: string | Dir[]) => {
    const r = submit(ctx.state, p.id, input);
    ctx.onResult(p, r);
    if (r.ok) {
      sound.ok();
      msg.className = 'lock-msg ok';
      msg.textContent = r.fake ? 'باز شد… ولی داخلش خالی است.' : t('solved');
      wrap.classList.add('solved');
      setTimeout(() => closePanel(), 900);
      return true;
    }
    sound.error();
    msg.className = 'lock-msg err';
    msg.textContent =
      r.reason === 'no-attempts' ? 'مگ‌لاک دیگر ورودی نمی‌پذیرد. دوان حوصله‌اش سر رفته — سکه‌ای پیدا کن و عددش را به او بده.'
      : r.reason === 'exhausted' ? 'ایستگاه قفل شد. دیگر حدسی پذیرفته نمی‌شود.'
      : r.attemptsLeft !== undefined ? `${t('wrong')} (${t('devanAttempts')}: ${r.attemptsLeft})`
      : t('wrong');
    wrap.classList.remove('shake');
    void wrap.offsetWidth;
    wrap.classList.add('shake');
    return false;
  };

  if (p.prompt) wrap.append(h('p', { class: 'lock-prompt', dir: 'auto' }, p.prompt));
  if (p.clue) wrap.append(h('div', { class: 'lock-clue' }, p.clue));
  // کاغذ زیر میز (سرنخ قفل چرخشی) جای دیگری از اتاق است؛ روی خود قفل نشانش نده.
  if (p.asset && p.lockType !== 'binary-switches' && p.lockType !== 'dial') wrap.append(puzzleImage(p.asset, p.title));

  wrap.append(control(p, ctx, attempt), msg);

  if (ctx.state.mode === 'guide') {
    wrap.append(h('div', { class: 'guide-box' },
      h('div', {}, h('b', {}, `${t('answer')}: `), h('code', { dir: 'ltr' }, formatSolution(p))),
      p.why ? h('div', {}, h('b', {}, `${t('why')}: `), h('span', { dir: 'auto' }, p.why)) : null,
      !ctx.state.solved.has(p.id) && p.lockType !== 'clue'
        ? h('button', { class: 'btn ghost', onclick: () => { ctx.onResult(p, skip(ctx.state, p.id)); sound.ok(); closePanel(); } }, t('revealSkip'))
        : null));
  }

  openPanel(p.title, wrap, { kicker: `${p.id} · ${lockLabel(p)}`, onClose: ctx.onClose });
}

function control(p: Puzzle, ctx: LockCtx, attempt: (input: string | Dir[]) => boolean): HTMLElement {
  switch (p.lockType) {
    case 'combo':
    case 'maglock': {
      const isText = p.lockType === 'maglock' || /[A-Za-z؀-ۿ]/.test(String(p.solution));
      const input = h('input', {
        class: 'code-input', dir: p.lockType === 'maglock' ? 'rtl' : 'ltr', inputmode: isText ? 'text' : 'numeric',
        maxlength: p.length ?? 40, placeholder: p.lockType === 'maglock' ? 'نام را وارد کن…' : '•'.repeat(p.length ?? 4), autocomplete: 'off',
      });
      const go = () => input.value.trim() && attempt(input.value) === false && input.select();
      input.addEventListener('keydown', (e) => e.key === 'Enter' && go());
      setTimeout(() => input.focus(), 50);
      const extra = p.lockType === 'maglock'
        ? h('div', { class: 'attempts' }, `${t('devanAttempts')}: ${devanAttemptsLeft(ctx.state)} · سکه‌های داده‌شده: ${ctx.state.coinsGiven.size}/${gameData.coins.length}`)
        : null;
      return h('div', { class: 'row-ctl' }, input, h('button', { class: 'btn', onclick: go }, t('submit')), extra);
    }

    case 'directional': {
      const n = (p.solution as Dir[]).length;
      const seq: Dir[] = [];
      const slots = h('div', { class: 'dir-slots', dir: 'ltr' });
      const render = () => {
        slots.innerHTML = '';
        for (let i = 0; i < n; i++) slots.append(h('span', { class: `slot${seq[i] ? ' on' : ''}` }, seq[i] ? ARROW[seq[i]] : '·'));
      };
      const push = (d: Dir) => {
        sound.click();
        seq.push(d);
        render();
        if (seq.length === n) {
          const ok = attempt([...seq]);
          if (!ok) setTimeout(() => { seq.length = 0; render(); }, 650); // ریست خودکار بعد از خطا
        }
      };
      render();
      const pad = h('div', { class: 'dir-pad', dir: 'ltr' },
        h('span'), h('button', { class: 'btn sq', onclick: () => push('U') }, '↑'), h('span'),
        h('button', { class: 'btn sq', onclick: () => push('L') }, '←'),
        h('button', { class: 'btn sq ghost', onclick: () => { seq.length = 0; render(); } }, '⟲'),
        h('button', { class: 'btn sq', onclick: () => push('R') }, '→'),
        h('span'), h('button', { class: 'btn sq', onclick: () => push('D') }, '↓'), h('span'));
      return h('div', { class: 'dir-wrap' }, slots, pad);
    }

    case 'keypad-labeled': {
      let val = '';
      const screen = h('div', { class: 'keypad-screen', dir: 'ltr' }, '_');
      const upd = () => (screen.textContent = val || '_');
      const labels: Record<string, string> = { '7': 'Home', '8': '↑', '9': 'PgUp', '4': '←', '5': '', '6': '→', '1': 'End', '2': '↓', '3': 'PgDn', '0': 'Ins', '.': 'Del' };
      const key = (k: string) => h('button', { class: `btn key${k === '0' ? ' wide' : ''}`, onclick: () => { sound.click(); if (val.length < 6) val += k === '.' ? '' : k; if (k === '.') val = val.slice(0, -1); upd(); } },
        h('span', { class: 'big' }, k), h('small', {}, labels[k]));
      const enter = h('button', { class: 'btn key enter', onclick: () => { if (!attempt(val)) { val = ''; upd(); } } }, h('span', { class: 'big' }, '⏎'), h('small', {}, 'Enter'));
      const grid = h('div', { class: 'keypad', dir: 'ltr' }, ...['7', '8', '9', '4', '5', '6', '1', '2', '3'].map(key), key('0'), key('.'), enter);
      const clueTip = h('p', { class: 'muted' }, 'برچسب‌های کم‌رنگ زیر ارقام، نام کلیدهای پد عددی‌اند.');
      return h('div', {}, screen, grid, clueTip);
    }

    case 'dial': {
      const steps = h('div', { class: 'dial-steps', dir: 'ltr' });
      const rows = [0, 1, 2].map(() => {
        const num = h('select', {}, ...Array.from({ length: 10 }, (_, i) => h('option', { value: String(i) }, String(i))));
        const dir = h('select', {}, h('option', { value: 'L' }, '⟲ L'), h('option', { value: 'R' }, '⟳ R'));
        steps.append(h('div', { class: 'dial-row' }, num, dir));
        return { num, dir };
      });
      const knob = h('div', { class: 'dial-knob', 'aria-hidden': 'true' }, h('span'));
      return h('div', { class: 'dial-wrap' }, knob, steps,
        h('button', { class: 'btn', onclick: () => attempt(rows.map((r) => `${r.num.value}${r.dir.value}`).join(' ')) }, t('submit')));
    }

    case 'pattern-nn': {
      const pins = Array.from({ length: 8 }, () => false);
      const grid = h('div', { class: 'pins', dir: 'ltr' });
      const render = () => {
        grid.innerHTML = '';
        pins.forEach((on, i) => grid.append(h('button', {
          class: `pin${on ? ' on' : ''}`, 'aria-pressed': String(on), title: `${i % 2 ? 'output' : 'input'} · row ${Math.floor(i / 2) + 1}`,
          onclick: () => { pins[i] = !pins[i]; sound.click(); render(); },
        })));
      };
      render();
      return h('div', { class: 'pins-wrap' },
        h('div', { class: 'pins-legend', dir: 'ltr' }, h('span', {}, 'input'), h('span', {}, 'output')), grid,
        h('p', { class: 'muted' }, 'پین روشن = فرورفته (X).'),
        h('button', { class: 'btn', onclick: () => attempt(pins.map((x) => (x ? 'X' : 'O')).join('')) }, t('submit')));
    }

    case 'binary-switches': {
      const bits = Array.from({ length: String(p.solution).length }, () => 0);
      const row = h('div', { class: 'switches', dir: 'ltr' });
      const render = () => {
        row.innerHTML = '';
        bits.forEach((b, i) => row.append(h('button', {
          class: `switch${b ? ' on' : ''}`, 'aria-label': `bit ${i + 1}: ${b}`,
          onclick: () => { bits[i] = bits[i] ? 0 : 1; sound.click(); render(); },
        }, h('span', { class: 'lever' }), h('b', {}, String(b)))));
      };
      render();
      return h('div', {}, row, h('button', { class: 'btn', onclick: () => attempt(bits.join('')) }, t('submit')));
    }

    case 'name-buttons': {
      const used = ctx.state.exhausted.has(p.id);
      return h('div', { class: 'names' }, ...(p.options ?? []).map((name) =>
        h('button', {
          class: 'btn name', disabled: used,
          onclick: (e: Event) => {
            const ok = attempt(name);
            (e.currentTarget as HTMLElement).parentElement!.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = true));
            (e.currentTarget as HTMLElement).classList.add(ok ? 'ok' : 'bad');
          },
        }, name)),
        h('p', { class: 'muted' }, used ? 'این ایستگاه قبلا یک حدس گرفته و قفل شده است.' : 'فقط یک بار.'));
    }

    case 'clue':
      return h('div');
  }
}
