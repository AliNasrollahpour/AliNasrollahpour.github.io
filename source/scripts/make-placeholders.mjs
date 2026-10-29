// placeholderهای ۲×۲ پیکسلی برای ۹ تصویرِ معما (BUILD_SPEC بخش ۱۱) — فقط اگر فایل وجود نداشته باشد.
// تصویرِ واقعیِ تیم را با همان نام روی این فایل‌ها بریزید؛ برنامه placeholder را از اندازه‌اش تشخیص می‌دهد.
// مرورگرها نوعِ تصویر را از محتوا تشخیص می‌دهند، پس PNG با پسوندِ jpg هم بدونِ ۴۰۴ لود می‌شود.
import { deflateSync } from 'node:zlib';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'puzzles');
const FILES = ['fig-map.jpg', 'fig-lego.jpeg', 'fig-scrabble.jpg', 'fig-safe2.jpeg', 'fig-nn.jpg', 'fig-pattern.png', 'fig-chess.jpg', 'fig-maze.jpeg', 'fig-switches.jpeg'];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png2x2() {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(2, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const raw = Buffer.from([0, 40, 44, 52, 40, 44, 52, 0, 40, 44, 52, 40, 44, 52]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(dir, { recursive: true });
for (const f of FILES) {
  const p = join(dir, f);
  if (existsSync(p)) continue;
  writeFileSync(p, png2x2());
  console.log('placeholder', f);
}
