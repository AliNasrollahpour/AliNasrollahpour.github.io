// بیلد آماده (dist) را داخل fightforknowledge/ ریپوی GitHub Pages کپی می‌کند.
// ساختار نهایی روی دامنه:
//   /fightforknowledge/            → دموی بازی سه‌بعدی (همین بیلد)
//   /fightforknowledge/<agent>/    → صفحه گفت‌وگوی مستقل هر ایجنت (اپ چت، دست‌نخورده)
//   /fightforknowledge/agents/     → فهرست چهار ایجنت
// فقط چیزهایی که خود بیلد می‌سازد جایگزین می‌شوند (index.html، app/، media/)؛
// assets/ و prompts/ و پوشه‌های ایجنت‌ها که مال اپ چت‌اند دست نمی‌خورند.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(project, '..');
const dist = join(project, 'dist');
const target = join(repoRoot, 'fightforknowledge');

if (basename(project) !== 'source' || !existsSync(join(repoRoot, '.git'))) {
  console.error('این اسکریپت فقط وقتی اجرا می‌شود که پروژه در پوشه source/ ریپوی Pages باشد.');
  process.exit(1);
}
if (!existsSync(join(dist, 'index.html'))) {
  console.error('اول npm run build را اجرا کنید.');
  process.exit(1);
}

mkdirSync(target, { recursive: true });
// فقط خروجی‌های خود بیلد پاک می‌شوند
for (const name of ['app', 'media', 'index.html']) {
  rmSync(join(target, name), { recursive: true, force: true });
}
cpSync(dist, target, { recursive: true });
writeFileSync(join(repoRoot, '.nojekyll'), '');
console.log('dist → fightforknowledge/ کپی شد. حالا کامیت و push کنید.');
