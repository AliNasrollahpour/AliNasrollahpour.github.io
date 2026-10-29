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

function stickFigure(g: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = Math.max(2, s * 0.08);
  g.lineCap = 'round';
  g.beginPath();
  g.arc(x, y - s * 0.75, s * 0.16, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(x, y - s * 0.58);
  g.lineTo(x, y - s * 0.15);
  g.moveTo(x - s * 0.25, y - s * 0.45);
  g.lineTo(x + s * 0.25, y - s * 0.45);
  g.moveTo(x, y - s * 0.15);
  g.lineTo(x - s * 0.2, y + s * 0.2);
  g.moveTo(x, y - s * 0.15);
  g.lineTo(x + s * 0.2, y + s * 0.2);
  g.stroke();
}

/** یک کانواس با n آدمک — برای شمارشِ P45b. seed ثابت تا تصویر پایدار بماند. */
export function humansCanvas(n: number, seed: number, style: 'monitor' | 'poster' | 'noise') {
  const [c, g] = canvas(512, 320);
  let r = seed;
  const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  if (style === 'monitor') {
    g.fillStyle = '#0d2236';
    g.fillRect(0, 0, 512, 320);
    g.fillStyle = 'rgba(80,180,255,0.08)';
    for (let y = 0; y < 320; y += 4) g.fillRect(0, y, 512, 1);
  } else if (style === 'poster') {
    const grd = g.createLinearGradient(0, 0, 0, 320);
    grd.addColorStop(0, '#e8f1ff');
    grd.addColorStop(1, '#9fc2f0');
    g.fillStyle = grd;
    g.fillRect(0, 0, 512, 320);
    g.fillStyle = '#1b3a66';
    g.font = fontOf(true, 34);
    g.textAlign = 'center';
    g.direction = 'rtl';
    g.fillText('انسانِ بهینه', 256, 42);
  } else {
    g.fillStyle = '#777';
    g.fillRect(0, 0, 512, 320);
    for (let i = 0; i < 9000; i++) {
      const v = Math.floor(rand() * 255);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(rand() * 512, rand() * 320, 2, 2);
    }
  }
  const color = style === 'monitor' ? '#9fe0ff' : style === 'poster' ? '#1b3a66' : '#111';
  const cols = Math.ceil(n / 2);
  for (let i = 0; i < n; i++) {
    const row = i < cols ? 0 : 1;
    const col = row === 0 ? i : i - cols;
    const count = row === 0 ? cols : n - cols;
    const x = ((col + 0.5) / count) * 440 + 36 + (rand() - 0.5) * 20;
    const y = row === 0 ? 150 : 270;
    stickFigure(g, x, y, 70 + rand() * 18, color);
  }
  return c;
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
  g.fillStyle = '#e8f0e8';
  g.textAlign = 'center';
  g.font = `italic 46px Georgia, serif`;
  g.fillText('σ(x) = 1 / (1 + e^−x)', 384, 130);
  g.direction = 'rtl';
  g.font = fontOf(true, 44);
  g.fillText('«فعال یعنی بیشتر از نصف.»', 384, 232);
  g.direction = 'ltr';
  g.font = `30px Georgia, serif`;
  g.fillText('x > 0  ⇔  σ(x) > 0.5', 384, 322);
  return c;
}

export function liarCanvas() {
  const [c, g] = canvas(400, 560);
  g.fillStyle = '#10141a';
  g.fillRect(0, 0, 400, 560);
  g.fillStyle = '#4b5a6e';
  g.font = fontOf(true, 26);
  g.textAlign = 'center';
  g.direction = 'rtl';
  g.fillText('آن‌که پشتِ دیوارِ کناری است', 200, 90);
  g.fillText('هرگز راست نمی‌گوید.', 200, 128);
  g.fillStyle = '#6f8bb3';
  g.direction = 'ltr';
  g.font = fontOf(true, 110);
  g.fillText('L I', 200, 300);
  g.fillText('A R', 200, 420);
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
