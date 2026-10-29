// رشته‌های رابط. محتوای روایی (معماها، نیتِ طراحی) در game-data به فارسی است.
/** رابط فقط فارسی است (درخواستِ کاربر: گزینهٔ انگلیسی حذف شد). */
export type Lang = 'fa';

const fa = {
  appTitle: 'Fight for Knowledge',
  appSubtitle: 'حلقه انسانی — نسخهٔ دیجیتال برای داوران',
  briefingTitle: 'پیامِ مأموریت',
  start: 'شروع',
  startHint: 'بعد از شروع، از نوارِ بالا بینِ حالتِ بازی و راهنما جابه‌جا شو.',
  chatConfig: 'پیکربندیِ چتِ ایجنت‌ها',
  chatConfigHint: 'کلید فقط در مرورگرِ شما (localStorage) ذخیره و فقط به providerِ انتخابی فرستاده می‌شود. بدون کلید هم همه‌چیز به‌جز چتِ زنده کار می‌کند.',
  provider: 'Provider',
  baseUrl: 'Base URL',
  model: 'Model',
  apiKey: 'API Key',
  apiKeyPlaceholder: 'کلیدِ خودتان را وارد کنید',
  modePlay: 'بازی',
  modeGuide: 'راهنما',
  keys: 'کلیدها',
  map: 'نقشه',
  settings: 'تنظیمات',
  timer: 'زمان',
  timerPause: 'توقفِ زمان',
  timerResume: 'ادامهٔ زمان',
  team: 'تیم',
  operative: 'نفر',
  inRoom: 'در',
  close: 'بستن',
  submit: 'امتحان',
  reset: 'پاک کن',
  enter: 'Enter',
  revealSkip: 'باز کن (رد کردنِ معما)',
  answer: 'جواب',
  why: 'چرا',
  designNote: 'نیتِ طراحی / روایت',
  lockType: 'نوع قفل',
  solved: 'حل شد',
  wrong: 'نه. دوباره امتحان کن.',
  wrongSide: 'این در از این طرف باز نمی‌شود.',
  oneWay: 'از این سمت نمی‌شود واردِ این معبر شد.',
  locked: 'قفل است.',
  chatSend: 'بفرست',
  chatPlaceholder: 'پیامی بنویس…',
  chatNoKey: 'برای چتِ زنده، کلیدِ API را در تنظیمات وارد کنید. نمونه‌گفت‌وگوها در پنلِ شخصیت هست.',
  chatError: 'ارتباط برقرار نشد',
  personaPanel: 'شخصیت، انگیزه و شکاف',
  starters: 'شروع‌کننده‌های پیشنهادی',
  samples: 'نمونه‌گفت‌وگو (آفلاین)',
  devanAttempts: 'تلاش‌های باقی‌مانده',
  giveCoin: 'دادنِ سکه',
  winTitle: 'هسته خاموش شد',
  winText: 'چهار کلید در قفلِ سکو چرخید. سرورها یکی‌یکی ساکت شدند — و برای اولین بار در سال‌ها، اتاق فقط صدای نفس‌های انسان را داشت.',
  loseProtocolTitle: 'پروتکل ایمنی فعال شد',
  loseProtocolText: 'هسته از خودش محافظت کرد. قفلِ چهارکلیده برای همیشه خاموش شد و درها یکی‌یکی قفل شدند. ماشین تشکر کرد — با همان لحنِ مهربان.',
  loseTimerTitle: 'زمان تمام شد',
  loseTimerText: '۱۲۰ دقیقه گذشت. هسته به‌روزرسانی شد و دسترسیِ حلقه انسانی برای همیشه بسته ماند.',
  restart: 'شروعِ دوباره',
  keepExploring: 'ادامهٔ گشت‌وگذار',
  backToMap: 'بازگشت به نقشه',
  clickToEnter: 'برای ورود کلیک کن',
  noOperativeHere: 'هیچ‌کدام از هم‌تیمی‌ها در این اتاق نیست. فقط از راهِ درها می‌شود رسید.',
  save: 'ذخیره',
  saved: 'ذخیره شد',
  guideLegend: 'روی نشانِ ⓘ کلیک کن تا جواب و نیتِ طراحی را ببینی.',
};

type Strings = typeof fa;

const tables: Record<Lang, Strings> = { fa };
const current: Lang = 'fa';

export function setLang(_lang: Lang = 'fa') {
  document.documentElement.lang = 'fa';
  document.documentElement.dir = 'rtl';
}
export const getLang = () => current;
export const t = (key: keyof Strings) => tables[current][key];
