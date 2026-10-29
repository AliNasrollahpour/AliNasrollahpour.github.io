// تکسچرهای کانواسی برای پوسترها، برچسب‌ها و نمایشگرها (بدون فایلِ تصویر).
// نوشته‌های روی دیوار با Paradox؛ Paradox حروفِ لاتین ندارد، پس لاتین به‌طور خودکار با Peyda کشیده می‌شود.
import * as THREE from 'three';

export const WALL_FONT = 'Paradox, Peyda, sans-serif';
export const UI_FONT = 'Peyda, Tahoma, sans-serif';

/** کانواس باید بعد از لودِ فونت‌ها کشیده شود؛ main قبل از ساختِ صحنه این را صبر می‌کند. */
export function loadCanvasFonts() {
  return Promise.all([
    document.fonts.load(`48px Paradox`, 'سلام'),
    document.fonts.load(`700 48px Peyda`, 'سلام Aa'),
    document.fonts.load(`400 48px Peyda`, 'سلام Aa'),
  ]).catch(() => undefined);
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function tex(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** فایل‌های placeholderِ ریپو ۲×۲ پیکسل‌اند؛ هر تصویرِ بزرگ‌تر یعنی فایلِ واقعیِ تیم آمده است. */
export const PLACEHOLDER_MAX = 8;
export const ASSET_BASE = `${import.meta.env.BASE_URL}assets/puzzles/`;

/**
 * تکسچرِ یک فایلِ تصویرِ تیم. تا وقتی فایلِ واقعی در public/assets/puzzles نیست،
 * نسخهٔ بازسازی‌شده نشان داده می‌شود؛ به‌محضِ آمدنِ فایل، همان تکسچر جایش را می‌گیرد.
 */
export function assetTexture(file: string, fallback: () => HTMLCanvasElement, fit: 'cover' | 'contain' = 'cover', pad = '#ffffff') {
  const c = fallback();
  const t = tex(c);
  const img = new Image();
  img.onload = () => {
    if (img.naturalWidth <= PLACEHOLDER_MAX) return;
    const g = c.getContext('2d')!;
    const sc = fit === 'cover'
      ? Math.max(c.width / img.naturalWidth, c.height / img.naturalHeight)
      : Math.min(c.width / img.naturalWidth, c.height / img.naturalHeight);
    const w = img.naturalWidth * sc, h = img.naturalHeight * sc;
    g.fillStyle = pad;
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
    t.needsUpdate = true;
  };
  img.src = ASSET_BASE + file;
  return t;
}

/** وزنِ bold فقط برای Peyda؛ Paradox یک وزن دارد و bold مصنوعی زشتش می‌کند. */
const fontOf = (wall: boolean, size: number, weight = 700) => (wall ? `${size}px ${WALL_FONT}` : `${weight} ${size}px ${UI_FONT}`);

export function textTexture(lines: string[], opts: { w?: number; h?: number; bg?: string; fg?: string; size?: number; dir?: 'rtl' | 'ltr'; wall?: boolean } = {}) {
  const { w = 512, h = 256, bg = '#222', fg = '#fff', size = 48, dir = 'rtl', wall = false } = opts;
  const [c, g] = canvas(w, h);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.direction = dir;
  g.font = fontOf(wall, size);
  const lh = size * 1.3;
  lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * lh));
  return tex(c);
}

export function canvasTexture(c: HTMLCanvasElement) {
  return tex(c);
}

export function adsCanvas() {
  const [c, g] = canvas(512, 700);
  const grd = g.createLinearGradient(0, 0, 512, 700);
  grd.addColorStop(0, '#ff3fd2');
  grd.addColorStop(1, '#3f6bff');
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 700);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.direction = 'rtl';
  g.font = fontOf(true, 64);
  g.fillText('هوش مصنوعی', 256, 120);
  g.font = fontOf(true, 44);
  g.fillText('هرگز دروغ نمی‌گوید', 256, 200);
  g.font = fontOf(true, 140);
  g.fillText('۱۰۰٪', 256, 390);
  g.font = fontOf(true, 38);
  g.fillText('صادق. همیشه. احتمالاً.', 256, 480);
  g.font = fontOf(true, 28);
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.fillText('* شرایط و ضوابط اعمال می‌شود', 256, 640);
  return c;
}

export function blackboardCanvas() {
  const [c, g] = canvas(768, 400);
  g.fillStyle = '#1f3a2c';
  g.fillRect(0, 0, 768, 400);
  // ردِ گچِ پاک‌شده
  g.fillStyle = 'rgba(255,255,255,0.04)';
  for (let i = 0; i < 6; i++) g.fillRect(60 + i * 110, 40 + (i % 3) * 90, 160, 50);
  g.strokeStyle = '#6b4a2b';
  g.lineWidth = 20;
  g.strokeRect(0, 0, 768, 400);
  // فقط نمادگذاریِ ریاضی؛ بدونِ هیچ متنِ فارسی (درخواستِ کاربر).
  g.fillStyle = '#e8f0e8';
  g.textAlign = 'center';
  g.direction = 'ltr';
  g.font = `italic 50px Georgia, serif`;
  g.fillText('σ(x) = 1 / (1 + e^−x)', 384, 128);
  g.font = `34px Georgia, serif`;
  g.fillText('x > 0  ⇔  σ(x) > 0.5', 384, 212);
  g.font = `italic 34px Georgia, serif`;
  g.fillText('active  ⇔  σ(x) > 0.5', 384, 292);
  // منحنیِ سیگموید، کشیده با گچ
  g.strokeStyle = 'rgba(232,240,232,0.75)';
  g.lineWidth = 3;
  g.beginPath();
  for (let i = 0; i <= 120; i++) {
    const x = -6 + (i / 120) * 12;
    const px = 250 + (i / 120) * 268;
    const py = 360 - (1 / (1 + Math.exp(-x))) * 60;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.stroke();
  g.strokeStyle = 'rgba(232,240,232,0.3)';
  g.lineWidth = 2;
  g.setLineDash([7, 7]);
  g.beginPath();
  g.moveTo(250, 330);
  g.lineTo(518, 330);
  g.stroke();
  g.setLineDash([]);
  return c;
}

/** قابِ عکسِ آدم‌ها تا وقتی فایلِ واقعیِ تیم نیامده: n پرترهٔ انتزاعی. */
export function peopleFallbackCanvas(n: number, seed: number, aspect = 1.5) {
  const W = 640, H = Math.round(640 / aspect);
  const [c, g] = canvas(W, H);
  let r = seed;
  const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  const grd = g.createLinearGradient(0, 0, W, H);
  grd.addColorStop(0, '#6d28d9');
  grd.addColorStop(1, '#0891b2');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  const cols = Math.ceil(Math.sqrt(n * (W / H)));
  const rows = Math.ceil(n / cols);
  const cw = W / cols, chh = H / rows;
  for (let i = 0; i < n; i++) {
    const cx = (i % cols + 0.5) * cw;
    const cy = (Math.floor(i / cols) + 0.5) * chh;
    const s = Math.min(cw, chh) * (0.62 + rand() * 0.12);
    g.fillStyle = `rgba(255,255,255,${0.18 + rand() * 0.2})`;
    g.beginPath();
    g.arc(cx, cy - s * 0.17, s * 0.24, 0, Math.PI * 2);   // سر
    g.fill();
    g.beginPath();
    g.ellipse(cx, cy + s * 0.37, s * 0.36, s * 0.3, 0, Math.PI, 0);  // شانه‌ها
    g.fill();
  }
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.fillRect(0, H - 40, W, 40);
  g.fillStyle = '#e6e9ef';
  g.textAlign = 'center';
  g.direction = 'rtl';
  g.font = fontOf(false, 22, 700);
  g.fillText(`${n} نفر — جایگزینِ موقتِ عکسِ تیم`, W / 2, H - 13);
  return c;
}

/** کلمه‌های بی‌ربطِ پوسترِ اتاق ۲ — فقط نویز، تا قرمزِ LIAR تنها نشانه بماند. */
const NOISE_WORDS = [
  'SILENT', 'ORBIT', 'CANDLE', 'RUST', 'MIRROR', 'HOLLOW', 'STATIC', 'EMBER', 'PAPER', 'THIRST',
  'MARBLE', 'VELVET', 'SIGNAL', 'WINTER', 'ANCHOR', 'PLASTER', 'LANTERN', 'GRAVEL', 'SALT', 'TUNNEL',
  'CLOVER', 'PRISM', 'FABLE', 'NEEDLE', 'COPPER', 'WIDOW', 'LEDGE', 'MURMUR', 'ASHES', 'CRADLE',
  'FROST', 'HINGE', 'IVORY', 'KETTLE', 'LUMEN', 'NOMAD', 'ONYX', 'PEBBLE', 'QUIET', 'RIPPLE',
  'SHUTTER', 'TALLOW', 'UMBER', 'VAPOR', 'WILLOW', 'YARROW', 'ZENITH', 'BRIAR', 'CINDER', 'DUSK',
];

/** پوسترِ اتاق ۲: میدانی از کلمه‌های به‌هم‌ریخته که فقط LIAR در آن قرمز است. */
export function liarCanvas() {
  const W = 420, H = 580;
  const [c, g] = canvas(W, H);
  g.fillStyle = '#10141a';
  g.fillRect(0, 0, W, H);
  // بافتِ کاغذِ کهنه
  let r = 7;
  const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  g.fillStyle = 'rgba(255,255,255,0.02)';
  for (let i = 0; i < 900; i++) g.fillRect(rand() * W, rand() * H, 2, 2);

  g.textAlign = 'left';
  g.direction = 'ltr';
  const rows = 17;
  const lineH = (H - 40) / rows;
  // یک جای تصادفیِ ثابت برای LIAR، نه وسطِ قاب
  const liarRow = 9;
  for (let row = 0; row < rows; row++) {
    let x = 16 + rand() * 14;
    const y = 36 + row * lineH;
    while (x < W - 50) {
      const size = 15 + Math.floor(rand() * 9);
      const word = NOISE_WORDS[Math.floor(rand() * NOISE_WORDS.length)];
      g.font = `700 ${size}px ${UI_FONT}`;
      g.fillStyle = `rgba(120,138,160,${0.3 + rand() * 0.45})`;
      g.fillText(word, x, y);
      x += g.measureText(word).width + 10 + rand() * 16;
    }
    if (row === liarRow) {
      // کلمهٔ قرمز روی همان سطر، کمی درشت‌تر از بقیه
      g.font = `700 30px ${UI_FONT}`;
      const lx = W * 0.3;
      g.fillStyle = '#10141a';
      g.fillRect(lx - 26, y - 27, g.measureText('LIAR').width + 52, 38);
      g.fillStyle = '#e02424';
      g.shadowColor = '#e02424';
      g.shadowBlur = 16;
      g.fillText('LIAR', lx, y);
      g.shadowBlur = 0;
    }
  }
  return c;
}

/** کاغذِ مچالهٔ معمای متناقضِ اتاق ۳. */
export function noteCanvas(lines: string[]) {
  const W = 512, H = 680;
  const [c, g] = canvas(W, H);
  g.fillStyle = '#f2ead8';
  g.fillRect(0, 0, W, H);
  g.save();
  g.translate(W / 2, H / 2);
  g.rotate(-0.012);
  // چین‌وچروکِ مچاله‌شدن
  g.strokeStyle = 'rgba(0,0,0,0.07)';
  g.lineWidth = 2;
  for (const [x1, y1, x2, y2] of [[-180, -260, 40, -60], [60, -300, -40, 120], [-200, 60, 180, 200], [150, -180, 190, 260]] as const) {
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
  }
  g.fillStyle = '#2a2320';
  g.textAlign = 'right';
  g.direction = 'rtl';
  g.font = fontOf(false, 27, 400);
  lines.forEach((l, i) => g.fillText(l, W / 2 - 50, -H / 2 + 92 + i * 64));
  g.restore();
  return c;
}

/** پوسترهای چرت‌وپرتِ اتاق ۳ — زیاد، رنگی و بی‌ربط. */
const JUNK_POSTERS: { lines: string[]; bg: [string, string]; fg: string }[] = [
  { lines: ['هوش مصنوعی', 'دوستت دارد'], bg: ['#3f6bff', '#6f4bff'], fg: '#ffffff' },
  { lines: ['۰٪ خطا', '۱۰۰٪ تو'], bg: ['#ff3fd2', '#ff7a3f'], fg: '#ffffff' },
  { lines: ['هرگز', 'دروغ نمی‌گوید'], bg: ['#ffe14d', '#ffb020'], fg: '#2a1838' },
  { lines: ['فکر نکن.', 'بپرس.'], bg: ['#00d4b4', '#0094ff'], fg: '#06202a' },
  { lines: ['حافظهٔ تو', 'پشتیبان دارد'], bg: ['#2a1838', '#ff3fd2'], fg: '#ffffff' },
  { lines: ['تنهایی', 'یک باگ است'], bg: ['#ff2d55', '#7a1fff'], fg: '#ffffff' },
  { lines: ['۳ از ۴ نفر', 'موافق‌اند'], bg: ['#c8ff3f', '#3fffa8'], fg: '#1a2a06' },
  { lines: ['فردا', 'لغو شد'], bg: ['#18122b', '#4a2d63'], fg: '#ffe14d' },
  { lines: ['بخند!', 'ضبط می‌شود'], bg: ['#ff9f1c', '#ff3fd2'], fg: '#2a1838' },
  { lines: ['اعتماد', 'به‌روزرسانی شد'], bg: ['#00a3ff', '#9b5cff'], fg: '#ffffff' },
  { lines: ['سؤالِ بعدی', 'رایگان است'], bg: ['#ff5a5f', '#ffd400'], fg: '#2a1838' },
  { lines: ['ما گوش می‌دهیم', 'همیشه'], bg: ['#7a2c8f', '#ff3fd2'], fg: '#ffffff' },
];

export const JUNK_POSTER_COUNT = JUNK_POSTERS.length;

export function junkPosterCanvas(i: number) {
  const spec = JUNK_POSTERS[i % JUNK_POSTERS.length];
  const [c, g] = canvas(384, 512);
  const grd = g.createLinearGradient(0, 0, 384, 512);
  grd.addColorStop(0, spec.bg[0]);
  grd.addColorStop(1, spec.bg[1]);
  g.fillStyle = grd;
  g.fillRect(0, 0, 384, 512);
  let r = (i + 3) * 97;
  const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  // اشکالِ تزئینیِ پشتِ متن
  g.globalAlpha = 0.14;
  g.fillStyle = spec.fg;
  for (let k = 0; k < 5; k++) {
    g.beginPath();
    g.arc(rand() * 384, rand() * 512, 30 + rand() * 70, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  g.fillStyle = spec.fg;
  g.textAlign = 'center';
  g.direction = 'rtl';
  const size = spec.lines.length > 1 ? 54 : 70;
  g.font = fontOf(true, size);
  spec.lines.forEach((l, k) => g.fillText(l, 192, 230 + (k - (spec.lines.length - 1) / 2) * size * 1.35));
  g.font = fontOf(true, 22);
  g.globalAlpha = 0.72;
  g.fillText('* شرایط و ضوابط اعمال می‌شود', 192, 470);
  return c;
}

/** نمودارِ تزئینیِ اتاقِ اکو. */
export function chartCanvas() {
  const [c, g] = canvas(512, 384);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 512, 384);
  g.fillStyle = '#1e3a5f';
  g.textAlign = 'center';
  g.direction = 'rtl';
  g.font = fontOf(true, 40);
  g.fillText('اعتمادِ انسان به ماشین', 256, 52);
  g.strokeStyle = '#94a3b8';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(60, 90);
  g.lineTo(60, 330);
  g.lineTo(470, 330);
  g.stroke();
  const vals = [0.18, 0.27, 0.41, 0.55, 0.72, 0.9];
  vals.forEach((v, i) => {
    g.fillStyle = i === vals.length - 1 ? '#2f80ed' : '#93c5fd';
    g.fillRect(80 + i * 64, 330 - v * 230, 44, v * 230);
  });
  g.font = fontOf(true, 26);
  g.fillStyle = '#475569';
  g.fillText('۲۰۳۰ ← ۲۰۵۰', 266, 368);
  return c;
}

// ───────── اتاق ۴: شبکهٔ عصبی، هزارتو، و پوسترِ واحدِ P41 ─────────

/** بازسازیِ fig-nn.jpg: ۴ ورودی → ۶ → ۶ → ۴ خروجی، با همان مقادیرِ تصویرِ تیم. */
export function nnCanvas(input: number[], output: number[], w = 768, h = 512) {
  const [c, g] = canvas(w, h);
  g.fillStyle = '#121212';
  g.fillRect(0, 0, w, h);
  const H1 = [0.82, 0.47, 0.76, 0.31, 0.63, 0.24];
  const H2 = [0.67, 0.42, 0.58, 0.36, 0.71, 0.29];
  const cols: { x: number; v: number[] }[] = [
    { x: w * 0.1, v: input }, { x: w * 0.37, v: H1 }, { x: w * 0.63, v: H2 }, { x: w * 0.9, v: output },
  ];
  const ys = (v: number[], i: number) => (h * 0.16) + ((i + 0.5) / v.length) * (h * 0.68);
  g.lineWidth = 0.7;
  for (let k = 0; k < cols.length - 1; k++) {
    for (let i = 0; i < cols[k].v.length; i++) {
      for (let j = 0; j < cols[k + 1].v.length; j++) {
        g.strokeStyle = 'rgba(220,226,236,0.3)';
        g.beginPath();
        g.moveTo(cols[k].x + 22, ys(cols[k].v, i));
        g.lineTo(cols[k + 1].x - 22, ys(cols[k + 1].v, j));
        g.stroke();
      }
    }
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.direction = 'ltr';
  for (const col of cols) {
    col.v.forEach((val, i) => {
      const y = ys(col.v, i);
      const lv = Math.round(60 + val * 195);
      g.fillStyle = `rgb(${lv},${lv},${lv})`;
      g.beginPath();
      g.arc(col.x, y, 21, 0, Math.PI * 2);
      g.fill();
    });
  }
  // برچسبِ عددی کنارِ گره‌های ورودی و خروجی (همان چیزی که در تصویرِ تیم هست)
  g.font = `600 19px ${UI_FONT}`;
  g.fillStyle = '#e6e9ef';
  input.forEach((v, i) => {
    g.textAlign = 'right';
    g.fillText(v.toFixed(2), cols[0].x - 32, ys(input, i));
  });
  output.forEach((v, i) => {
    g.textAlign = 'left';
    g.fillText(v.toFixed(2), cols[3].x + 32, ys(output, i));
  });
  g.textAlign = 'center';
  g.font = `600 17px ${UI_FONT}`;
  g.fillStyle = '#b9c0cc';
  ['Input Layer', 'Hidden Layer 1', 'Hidden Layer 2', 'Output Layer'].forEach((t, i) => g.fillText(t, cols[i].x, h * 0.07));
  g.textBaseline = 'alphabetic';
  return c;
}

/** بازسازیِ fig-maze.jpeg: هزارتوی دایره‌ای با چهار ضربدر؛ ضربدرِ پایین محصور است. */
export function mazeCanvas(size = 512) {
  const [c, g] = canvas(size, size);
  const k = size / 512;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, size, size);
  const cx = size / 2, cy = size / 2;
  g.strokeStyle = '#13227a';
  g.lineWidth = 5 * k;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(cx, cy, 236 * k, 0, Math.PI * 2);
  g.stroke();
  // حلقه‌های داخلی با شکاف‌های جابه‌جا
  const rings: [number, number, number][] = [[182, 0.18, 1.62], [182, 1.95, 3.1], [182, 3.5, 5.9], [132, 0.6, 2.5], [132, 3.0, 5.6], [84, 2.2, 5.3]];
  for (const [rr, a0, a1] of rings) {
    g.beginPath();
    g.arc(cx, cy, rr * k, a0, a1);
    g.stroke();
  }
  // دیوارهای شعاعی
  for (const [rr0, rr1, a] of [[182, 236, 0.18], [132, 182, 1.95], [84, 132, 3.6], [182, 236, 3.5], [132, 182, 5.6]] as const) {
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * rr0 * k, cy + Math.sin(a) * rr0 * k);
    g.lineTo(cx + Math.cos(a) * rr1 * k, cy + Math.sin(a) * rr1 * k);
    g.stroke();
  }
  // مرکز
  g.beginPath();
  g.arc(cx, cy, 36 * k, 0.5, 5.8);
  g.stroke();
  // ضربدرِ پایین داخلِ یک جیبِ بسته است
  g.beginPath();
  g.arc(cx, cy, 210 * k, 1.17, 1.97);
  g.stroke();
  const cross = (a: number, rr: number) => {
    const x = cx + Math.cos(a) * rr * k, y = cy + Math.sin(a) * rr * k, s = 22 * k;
    g.beginPath();
    g.moveTo(x - s, y - s); g.lineTo(x + s, y + s);
    g.moveTo(x + s, y - s); g.lineTo(x - s, y + s);
    g.stroke();
  };
  cross(-Math.PI / 2, 204);  // بالا
  cross(0, 204);             // راست
  cross(Math.PI / 2, 198);   // پایین — محصور
  cross(Math.PI, 204);       // چپ
  return c;
}

export const P41_SECTIONS: { title: string; note?: string; items: [string, string, string, string] }[] = [
  // ترتیبِ items: بالا، راست، پایین، چپ — یعنی راس‌های لوزی
  { title: '۱', items: ['NH₃', 'KCl', 'CuSO₂', 'H₂O'] },
  { title: '۲', items: ['Maxwell', 'Faraday', 'Turing', 'Kirchhoff'] },
  { title: '۳', items: ['', '', '', ''] },
  // قطب‌نمایی که جنوبش رو به بالاست: «راست»ِ این صفحه در واقع غرب است
  { title: '۴', note: '«راست» کدام جهت است؟', items: ['جنوب', 'غرب', 'شمال', 'شرق'] },
];

/**
 * پوسترِ واحدِ اتاق ۴: یک قاب، چهار بخش. در هر بخش چهار گزینه روی راس‌های یک لوزی
 * نشسته‌اند (بالا/راست/پایین/چپ) و هیچ فلشی کشیده نمی‌شود — موقعیت، خودش جهت است.
 */
export function p41PosterCanvas() {
  const W = 1024, H = 1024;
  const [c, g] = canvas(W, H);
  g.fillStyle = '#f8fafc';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#2f80ed';
  g.lineWidth = 6;
  g.strokeRect(10, 10, W - 20, H - 20);
  g.beginPath();
  g.moveTo(W / 2, 20); g.lineTo(W / 2, H - 20);
  g.moveTo(20, H / 2); g.lineTo(W - 20, H / 2);
  g.strokeStyle = '#c7d7ee';
  g.lineWidth = 3;
  g.stroke();

  P41_SECTIONS.forEach((sec, i) => {
    const ox = (i % 2) * (W / 2), oy = Math.floor(i / 2) * (H / 2);
    const cx = ox + W / 4, cy = oy + H / 4 + 16;
    g.fillStyle = '#2f80ed';
    g.textAlign = 'center';
    g.direction = 'rtl';
    g.font = fontOf(true, 40);
    g.fillText(sec.title, ox + W / 4, oy + 52);
    if (sec.note) {
      g.fillStyle = '#5b7391';
      g.font = fontOf(true, 26);
      g.fillText(sec.note, ox + W / 4, oy + 92);
    }
    if (i === 2) return; // بخشِ هزارتو جداگانه کشیده می‌شود
    const rx = W / 4 - 70, ry = H / 4 - 92;
    const slots: [number, number][] = [[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy]];
    g.fillStyle = '#1e3a5f';
    sec.items.forEach((label, k) => {
      const [x, y] = slots[k];
      const latin = /^[\x20-\x7E₀-₉]+$/.test(label);
      g.direction = latin ? 'ltr' : 'rtl';
      g.font = latin ? `600 34px ${UI_FONT}` : fontOf(true, 36);
      g.fillText(label, x, y + 12);
    });
  });
  return c;
}

/** بخشِ ۳ پوستر: هزارتو در محلِ خودش کشیده می‌شود (یا تصویرِ واقعیِ تیم رویش می‌نشیند). */
export function p41PosterTexture() {
  const c = p41PosterCanvas();
  const t = tex(c);
  const box = { x: 26, y: 584, w: 460, h: 414 }; // بخشِ ۳ = ربعِ پایین-چپِ کانواس، زیرِ شمارهٔ بخش
  const g = c.getContext('2d')!;
  const draw = (src: CanvasImageSource, iw: number, ih: number) => {
    const sc = Math.min(box.w / iw, box.h / ih);
    g.fillStyle = '#f8fafc';
    g.fillRect(box.x, box.y, box.w, box.h);
    g.drawImage(src, box.x + (box.w - iw * sc) / 2, box.y + (box.h - ih * sc) / 2, iw * sc, ih * sc);
    t.needsUpdate = true;
  };
  const fb = mazeCanvas(512);
  draw(fb, 512, 512);
  const img = new Image();
  img.onload = () => {
    if (img.naturalWidth > PLACEHOLDER_MAX) draw(img, img.naturalWidth, img.naturalHeight);
  };
  img.src = `${ASSET_BASE}fig-maze.jpeg`;
  return t;
}

/** سایه‌ی نرمِ زیرِ اشیا (به‌جای shadow-map، تقریباً بی‌هزینه). */
let blob: THREE.Texture | null = null;
export function blobShadowTexture() {
  if (blob) return blob;
  const [c, g] = canvas(128, 128);
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  blob = new THREE.CanvasTexture(c);
  return blob;
}
