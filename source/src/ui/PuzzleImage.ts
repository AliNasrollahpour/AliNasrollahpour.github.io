// تصویر معما از public/assets/puzzles؛ اگر فایل تیم نبود یا placeholder بود، نسخه SVG بازسازی‌شده نشان داده می‌شود.
import { h } from './dom';
import { puzzleById } from '../data/game-data';
import { nnCanvas, mazeCanvas, peopleFallbackCanvas, PLACEHOLDER_MAX } from '../engine/textures';

/** بازسازی‌هایی که روی کانواس کشیده می‌شوند (همان‌هایی که در صحنه سه‌بعدی هم استفاده می‌شوند). */
const canvasArt = (make: () => HTMLCanvasElement) => () => {
  const c = make();
  return `<img src="${c.toDataURL()}" alt="" style="width:100%;display:block">`;
};

const BASE = `${import.meta.env.BASE_URL}assets/puzzles/`;

const RAINBOW: [string, string][] = [
  ['#e53935', '→'], ['#fb8c00', '→'], ['#fdd835', '↑'], ['#43a047', '↓'], ['#1e88e5', '→'], ['#3949ab', '↓'], ['#8e24aa', '←'],
];
const LEGO_SHUFFLE = [4, 0, 6, 2, 3, 1, 5];

function svg(inner: string, w = 360, h = 220) {
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img">${inner}</svg>`;
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

const nnArt = canvasArt(() => {
  const nn = puzzleById('P40a')!.nn!;
  return nnCanvas(nn.input, nn.output);
});

const FALLBACK: Record<string, () => string> = {
  'fig-nn.jpg': nnArt,
  'fig-pattern.png': nnArt,
  'fig-lego.jpeg': legoSvg,
  'fig-scrabble.jpg': () => tilesSvg(['TRESNI', 'EMOH', 'DNE', 'RETNE']),
  'fig-safe2.jpeg': paperSvg,
  'fig-maze.jpeg': canvasArt(() => mazeCanvas(512)),
  'fig-people-1.jpg': canvasArt(() => peopleFallbackCanvas(2, 85, 16 / 9)),
  'fig-people-2.jpg': canvasArt(() => peopleFallbackCanvas(6, 233, 1.5)),
  'fig-people-3.jpg': canvasArt(() => peopleFallbackCanvas(14, 529, 1.5)),
  'fig-chess.jpg': () => textSvg(['fig-chess.jpg — تصویر تیم', 'نوبت سیاه؛ سیاه در یک حرکت مات می‌کند.', 'چیدمان همین وضعیت روی میز وسط اتاق ۴ بازسازی شده است.']),
  'fig-switches.jpeg': () => textSvg(['fig-switches.jpeg', 'هفت کلید ۰/۱']),
  'fig-map.jpg': () => textSvg(['fig-map.jpg']),
};

export function puzzleImage(asset: string, caption?: string): HTMLElement {
  const fig = h('figure', { class: 'puzzle-img' });
  const showFallback = () => {
    fig.innerHTML = '';
    const art = FALLBACK[asset]?.() ?? textSvg([asset]);
    fig.append(h('div', { class: 'fallback', html: art }), h('figcaption', {}, `${caption ?? ''} · بازسازی موقت تا وقتی ${asset} در ریپو قرار بگیرد`));
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
