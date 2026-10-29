// بیلدِ آماده (dist) را در ریشهٔ ریپوی GitHub Pages کپی می‌کند (این پروژه در پوشهٔ source/ آن ریپو است).
// فقط index.html، assets/ و .nojekyll در ریشه جایگزین می‌شوند؛ source/ و archive/ دست نمی‌خورند.
import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(project, '..');
const dist = join(project, 'dist');

if (basename(project) !== 'source' || !existsSync(join(repoRoot, '.git'))) {
  console.error('این اسکریپت فقط وقتی اجرا می‌شود که پروژه در پوشهٔ source/ ریپوی Pages باشد.');
  process.exit(1);
}
if (!existsSync(join(dist, 'index.html'))) {
  console.error('اول npm run build را اجرا کنید.');
  process.exit(1);
}

rmSync(join(repoRoot, 'assets'), { recursive: true, force: true });
rmSync(join(repoRoot, 'index.html'), { force: true });
cpSync(dist, repoRoot, { recursive: true });
writeFileSync(join(repoRoot, '.nojekyll'), '');
console.log('dist → ریشهٔ ریپو کپی شد. حالا کامیت و push کنید.');
