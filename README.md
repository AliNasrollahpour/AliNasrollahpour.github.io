# نبردی برای آگاهی

نسخه دیجیتال سه‌بعدی اتاق‌فرار «نبردی برای آگاهی / حلقه انسانی» برای داوران. سایت: https://alinasrollahpour.github.io/

| مسیر | چیست |
|---|---|
| `index.html`، `assets/` | بیلد آماده بازی سه‌بعدی که GitHub Pages مستقیم سرو می‌کند — دستی ویرایش نکنید |
| `source/` | سورس بازی (Three.js + TypeScript + Vite)؛ راهنمای کامل در [`source/README.md`](source/README.md) |
| `fightforknowledge/` | **اپ چت مستقل**: صفحه انتخاب شخصیت در `/fightforknowledge/` و یک صفحه گفت‌وگو برای هر مدل در `/fightforknowledge/<slug>/` |
| `archive/` | فقط صفحه شخصی قبلی |

## نشانی‌ها

| نشانی | چیست |
|---|---|
| `/` | بازی سه‌بعدی |
| `/fightforknowledge/` | فهرست چهار شخصیت |
| `/fightforknowledge/magie/` | گفت‌وگو با Maggie |
| `/fightforknowledge/evy/` | گفت‌وگو با Evy |
| `/fightforknowledge/devan/` | گفت‌وگو با Devan |
| `/fightforknowledge/echo/` | گفت‌وگو با Echo |
| `/archive/` | صفحه شخصی قبلی |

اپ چت کاملاً مستقل از بازی است: بدون بیلد، با مسیرهای نسبی، و پرامپت هر شخصیت را از `fightforknowledge/prompts/<slug>.md` می‌خواند. بازی از سه جا به این صفحه‌ها لینک می‌دهد: دکمه‌های «گفت‌وگوی مستقیم» در صفحه ورود، دکمه داخل ترمینال هر ایجنت، و کارت راهنمای همان ایجنت.

نسخه دقیق قبلی هم در برنچ `archive/main-2026-10-29` و تگ `archive-main-2026-10-29` نگه داشته شده است.

## به‌روزرسانی سایت

```bash
cd source
npm install
npm run publish:root
```

بعد از ریشه ریپو کامیت و push کنید.
