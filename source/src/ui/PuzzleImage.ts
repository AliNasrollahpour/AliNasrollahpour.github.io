// تصویرِ معما از public/assets/puzzles؛ اگر فایلِ تیم نبود یا placeholder بود، نسخهٔ SVGِ بازسازی‌شده نشان داده می‌شود.
import { h } from './dom';
import { gameData } from '../data/game-data';

const BASE = `${import.meta.env.BASE_URL}assets/puzzles/`;

const RAINBOW: [string, string][] = [
  ['#e53935', '→'], ['#fb8c00', '→'], ['#fdd835', '↑'], ['#43a047', '↓'], ['#1e88e5', '→'], ['#3949ab', '↓'], ['#8e24aa', '←'],
];
const LEGO_SHUFFLE = [4, 0, 6, 2, 3, 1, 5];

function svg(inner: string, w = 360, h = 220) {
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img">${inner}</svg>`;
}

function nnSvg() {
  const p = gameData.puzzles.find((x) => x.id === 'P40a')!.nn!;
  const yy = (i: number) => 35 + i * 50;
  let lines = '';
  const hidden = [60, 110, 160];
  for (let i = 0; i < 4; i++) for (const hy of hidden) lines += `<line x1="70" y1="${yy(i)}" x2="180" y2="${hy}" stroke="#9aa5b1" stroke-width="1"/><line x1="180" y1="${hy}" x2="290" y2="${yy(i)}" stroke="#9aa5b1" stroke-width="1"/>`;
  const node = (x: number, y: number, v?: number) => {
    const fill = v === undefined ? '#cfd8e3' : `rgba(47,128,237,${0.15 + v * 0.85})`;
    return `<circle cx="${x}" cy="${y}" r="17" fill="${fill}" stroke="#1e3a5f" stroke-width="1.5"/>` +
      (v === undefined ? '' : `<text x="${x}" y="${y + 4}" font-size="11" text-anchor="middle" fill="${v > 0.5 ? '#fff' : '#1e3a5f'}" font-family="monospace">${v.toFixed(2)}</text>`);
  };
  let nodes = '';
  p.input.forEach((v, i) => (nodes += node(70, yy(i), v)));
  hidden.forEach((y) => (nodes += node(180, y)));
  p.output.forEach((v, i) => (nodes += node(290, yy(i), v)));
  return svg(`<rect width="360" height="220" fill="#f8fafc"/>${lines}${nodes}<text x="70" y="214" font-size="11" text-anchor="middle" fill="#555">input</text><text x="290" y="214" font-size="11" text-anchor="middle" fill="#555">output</text>`);
}

function legoSvg() {
  let s = '<rect width="360" height="220" fill="#eef2f6"/>';
  LEGO_SHUFFLE.forEach((idx, i) => {
    const [c, arrow] = RAINBOW[idx];
    const x = 14 + i * 49, y = 70 + (i % 2) * 30;
    s += `<rect x="${x}" y="${y}" width="42" height="34" rx="4" fill="${c}"/>`;
    s += `<circle cx="${x + 11}" cy="${y - 4}" r="6" fill="${c}"/><circle cx="${x + 31}" cy="${y - 4}" r="6" fill="${c}"/>`;
    s += `<text x="${x + 21}" y="${y + 24}" font-size="20" text-anchor="middle" fill="#fff" font-weight="bold">${arrow}</text>`;
  });
  return svg(s);
}

function tilesSvg(words: string[]) {
  let s = '<rect width="360" height="220" fill="#3b2f2a"/>';
  words.forEach((w, row) => {
    w.split('').forEach((ch, i) => {
      const x = 20 + i * 38 + (row % 2) * 12, y = 18 + row * 50;
      s += `<rect x="${x}" y="${y}" width="34" height="38" rx="4" fill="#f3e2b3" transform="rotate(${((i * 7 + row * 3) % 9) - 4} ${x + 17} ${y + 19})"/>`;
      s += `<text x="${x + 17}" y="${y + 27}" font-size="20" text-anchor="middle" font-family="Georgia" fill="#222">${ch}</text>`;
    });
  });
  return svg(s);
}

function paperSvg() {
  return svg(`<rect width="360" height="220" fill="#2b3440"/><rect x="60" y="30" width="240" height="160" fill="#fff7a8" transform="rotate(-3 180 110)"/>
<g font-family="'Comic Sans MS',cursive" font-size="40" fill="#333" text-anchor="middle"><text x="120" y="125">7 ⟲</text><text x="200" y="100">2 ⟳</text><text x="260" y="140">4 ⟲</text></g>`);
}

function textSvg(lines: string[]) {
  const t = lines.map((l, i) => `<text x="180" y="${100 + (i - (lines.length - 1) / 2) * 26}" font-size="16" text-anchor="middle" fill="#cbd5e1">${l}</text>`).join('');
  return svg(`<rect width="360" height="220" fill="#1e293b" stroke="#475569" stroke-dasharray="6 4"/>${t}`);
}

const FALLBACK: Record<string, () => string> = {
  'fig-nn.jpg': nnSvg,
  'fig-pattern.png': nnSvg,
  'fig-lego.jpeg': legoSvg,
  'fig-scrabble.jpg': () => tilesSvg(['TRESNI', 'EMOH', 'DNE', 'RETNE']),
  'fig-safe2.jpeg': paperSvg,
  'fig-chess.jpg': () => textSvg(['fig-chess.jpg — تصویرِ تیم', 'سفید حرکت می‌کند و در یک حرکت مات می‌کند.']),
  'fig-maze.jpeg': () => textSvg(['fig-maze.jpeg — تصویرِ تیم', 'هزارتوی دایره‌ای با چهار علامت']),
  'fig-switches.jpeg': () => textSvg(['fig-switches.jpeg', 'هفت کلیدِ ۰/۱']),
  'fig-map.jpg': () => textSvg(['fig-map.jpg']),
};

/** placeholderهای ریپو ۲×۲ پیکسل‌اند؛ هر تصویرِ کوچک‌تر از این آستانه یعنی «هنوز تصویرِ واقعی نیامده». */
const PLACEHOLDER_MAX = 8;

export function puzzleImage(asset: string, caption?: string): HTMLElement {
  const fig = h('figure', { class: 'puzzle-img' });
  const showFallback = () => {
    fig.innerHTML = '';
    const art = FALLBACK[asset]?.() ?? textSvg([asset]);
    fig.append(h('div', { class: 'fallback', html: art }), h('figcaption', {}, `${caption ?? ''} · بازسازیِ موقت تا وقتی ${asset} در ریپو قرار بگیرد`));
  };
  const img = h('img', { src: BASE + asset, alt: caption ?? asset, loading: 'lazy' });
  img.addEventListener('load', () => {
    if (img.naturalWidth <= PLACEHOLDER_MAX) showFallback();
  });
  img.addEventListener('error', showFallback);
  fig.append(img);
  if (caption) fig.append(h('figcaption', {}, caption));
  return fig;
}

export function canvasImage(c: HTMLCanvasElement, caption?: string) {
  return h('figure', { class: 'puzzle-img' }, h('img', { src: c.toDataURL(), alt: caption ?? '' }), caption ? h('figcaption', {}, caption) : null);
}
