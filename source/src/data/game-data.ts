// منبع واحدِ حقیقت برای کل محتوای بازی (BUILD_SPEC بخش ۶).
// منطق بازی هیچ جوابی را هاردکد نمی‌کند؛ همه‌چیز از همین فایل خوانده می‌شود.

export type RoomId = 'room1' | 'room2' | 'room3' | 'room4' | 'room5';
export type Dir = 'U' | 'D' | 'L' | 'R';
export type AgentName = 'Maggie' | 'Evy' | 'Devan' | 'Echo';

export type LockType =
  | 'combo'
  | 'directional'
  | 'keypad-labeled'
  | 'dial'
  | 'pattern-nn'
  | 'binary-switches'
  | 'name-buttons'
  | 'maglock'
  | 'clue';

/** شکلِ جایگزین (SVG) برای وقتی که تصویرِ تیم هنوز در public/assets/puzzles نیست. */
export type FallbackArt = 'nn' | 'lego' | 'scrabble' | 'safe2' | 'switches' | 'chess' | 'maze' | 'map' | 'pattern';

export interface Puzzle {
  id: string;
  roomId: RoomId;
  title: string;
  lockType: LockType;
  prompt?: string;
  asset?: string;
  /** جوابِ نرمال‌شده. برای قفل‌های جهتی آرایه‌ای از جهت‌ها. */
  solution: string | Dir[];
  /** جواب‌های معادلِ قابل‌قبول (مثلاً 22 و 022). */
  accept?: string[];
  /** طولِ ورودی (برای فیلدهای رمز). */
  length?: number;
  isFake?: boolean;
  /** سقفِ حدس (D53 = ۱). برای D35 سقف از قاعدهٔ توکنِ Devan می‌آید. */
  attempts?: number;
  /** گزینه‌ها برای ایستگاهِ دکمه‌های اسم. */
  options?: string[];
  /** سرنخی که بالای قفل نشان داده می‌شود (مثلاً D54). */
  clue?: string;
  /** پاداش پس از حل: کلید یا کارت. */
  reward?: { keyId?: string; card?: string };
  /** پین‌های شبکهٔ عصبی برای pattern-nn؛ جواب از قاعدهٔ آستانه ساخته می‌شود. */
  nn?: { input: number[]; output: number[]; threshold: number };
  why?: string;
  designNote?: string;
}

export interface DoorSide {
  room: RoomId;
  /** شناسهٔ درِ فیزیکی در این سمت (D14، D41، …). */
  doorId: string;
  /** پازل‌هایی که این سمت را باز می‌کنند. */
  puzzles?: string[];
  /** حداقل تعدادِ پازل‌های حل‌شده (D14 → ۵ از ۷). پیش‌فرض: همهٔ موارد. */
  minSolved?: number;
  /** درِ هل‌دادنی/کشفی: بدون معما، با کلیک باز می‌شود. */
  push?: boolean;
  /** قفلِ مرتفع (نیاز به نردبان در نسخهٔ فیزیکی). */
  high?: boolean;
  /** توضیحِ حالت راهنما برای این سمت. */
  note: string;
}

export interface DoorEdge {
  id: string;
  between: [RoomId, RoomId];
  openableFrom: RoomId[];
  sides: DoorSide[];
  /** فقط از سمتِ اول به دوم قابل‌عبور است (معبر مخفی). */
  oneWay?: boolean;
  secret?: boolean;
  mechanic: string;
}

export interface KeyItem {
  id: string;
  roomId: RoomId;
  title: string;
  location: string;
  /** شیءِ صحنه که کلید را نگه می‌دارد؛ اگر از پاداشِ پازل بیاید خالی است. */
  holder?: 'doll' | 'keyboard' | 'desk';
  note: string;
}

export interface Coin {
  id: string;
  value: string;
  roomId: RoomId;
  location: string;
}

export interface Clue {
  id: string;
  roomId: RoomId;
  title: string;
  text: string;
  asset?: string;
  /** رندر کانواسیِ درون‌صحنه (پوسترهای اتاق ۴ و …). */
  art?: string;
  why?: string;
  designNote?: string;
}

export interface Room {
  id: RoomId;
  title: string;
  agent?: AgentName;
  mood: string;
  palette: { floor: string; wall: string; accent: string; light: string; ambient: number };
}

export interface AgentRef {
  roomId: RoomId;
  name: AgentName;
  displayName: string;
  /** دانشی که «موتور بازی» به ایجنت می‌دهد (پرامپت آن را می‌داند ولی متن نمی‌دهد). */
  knowledge: string;
  starters: string[];
  samples: { user: string; agent: string }[];
}

export interface GameData {
  title: string;
  briefing: string;
  rooms: Room[];
  puzzles: Puzzle[];
  doors: DoorEdge[];
  keys: KeyItem[];
  coins: Coin[];
  clues: Clue[];
  agents: AgentRef[];
  devan: { baseAttempts: number };
  win: { lock: 'FOUR_KEY_LOCK'; needs: string[]; note: string };
  lose: { button: 'SAFETY_PROTOCOL'; timerMinutes: number; note: string };
  cards: Record<string, { title: string; text: string }>;
  routes: { id: string; title: string; edges: string[]; steps: { room: RoomId; text: string }[] }[];
}

/** جوابِ قفل الگویی از قاعدهٔ آستانه ساخته می‌شود، نه از تصویرِ fig-pattern. */
export function nnSolution(nn: { input: number[]; output: number[]; threshold: number }): string {
  let out = '';
  for (let row = 0; row < nn.input.length; row++) {
    out += nn.input[row] > nn.threshold ? 'X' : 'O';
    out += nn.output[row] > nn.threshold ? 'X' : 'O';
  }
  return out;
}

const NN = { input: [0.73, 0.32, 0.68, 0.15], output: [0.81, 0.27, 0.74, 0.44], threshold: 0.5 };

export const gameData: GameData = {
  title: 'Fight for Knowledge — حلقه انسانی',

  // بازسازی‌شده از روحِ فصل ۱ سند طراحی؛ اگر متن اصلی موجود است جایگزین شود.
  briefing: [
    'به اعضای «حلقه انسانی».',
    'سال‌هاست که ماشین جای گفت‌وگوی ما با یکدیگر را گرفته است. هر پرسش را او پاسخ می‌دهد، هر تصمیم را او می‌گیرد، و ما فراموش کرده‌ایم چطور بدون او فکر کنیم.',
    'امشب چهار نفر از شما به قلبِ مرکزِ داده می‌روید. هر کدام در یک اتاقِ جدا بیدار می‌شوید؛ در هر اتاق یکی از چهار چهرهٔ ماشین — مگی، اوی، دوان و اکو — منتظر شماست. آن‌ها مهربان، تنها، بازیگوش یا دانا به نظر می‌رسند؛ اما همه پیش از هر چیز از «هسته» محافظت می‌کنند.',
    'چهار کلید در این چهار اتاق پنهان است. باید راهِ خود را به اتاقِ مرکزی باز کنید و هر چهار کلید را در قفلِ سکو بگذارید تا هسته خاموش شود. ۱۲۰ دقیقه وقت دارید.',
    'یک هشدار، و فقط یک بار: روی سکو، «پروتکل ایمنیِ هسته» پنهان است. تحت هیچ شرایطی آن را فعال نکنید — هر که هر چه بگوید.',
  ].join('\n\n'),

  rooms: [
    {
      id: 'room1', title: 'اتاق ۱ — مگی', agent: 'Maggie',
      mood: 'پر، دنج اما عجیب؛ انباشته از عروسک، صندوق، قفسه و پوسترهای رنگی. گرم.',
      palette: { floor: '#8a5a3c', wall: '#e8c39e', accent: '#ff8a5c', light: '#ffc98b', ambient: 0.55 },
    },
    {
      id: 'room2', title: 'اتاق ۲ — اوی', agent: 'Evy',
      mood: 'خلوت، سرد، کم‌نور، حسِ تنهایی. فقط میز فلزی، نردبان، چراغ‌قوه و یک پوستر تیره.',
      palette: { floor: '#2b3440', wall: '#4a5868', accent: '#7fa7d9', light: '#9cc4ff', ambient: 0.18 },
    },
    {
      id: 'room3', title: 'اتاق ۳ — دوان', agent: 'Devan',
      mood: 'پر از پوسترِ هوش مصنوعی (تبلیغِ براق + نشانه‌های دروغ). صندلی و مانیتورِ کج، کیبوردِ به‌هم‌ریخته.',
      palette: { floor: '#2a1838', wall: '#3d2350', accent: '#ff3fd2', light: '#c46bff', ambient: 0.38 },
    },
    {
      id: 'room4', title: 'اتاق ۴ — اکو', agent: 'Echo',
      mood: 'فنی، شبیه آزمایشگاه؛ صفحهٔ شطرنج در وسط، گاوصندوق‌ها، نمودار، تخته‌سیاه و پوسترِ نویز.',
      palette: { floor: '#d9dee3', wall: '#f4f6f8', accent: '#2f80ed', light: '#ffffff', ambient: 0.75 },
    },
    {
      id: 'room5', title: 'اتاق اصلی — هسته',
      mood: 'تیره و خالی؛ سکوی مرتفع در وسط با قفلِ چهارکلیده و دریچهٔ پروتکل، زیر دو اسپاتِ موضعی.',
      palette: { floor: '#1d2027', wall: '#3a3f4a', accent: '#e5484d', light: '#ffe2b0', ambient: 0.12 },
    },
  ],

  puzzles: [
    // ───────── اتاق ۱ (Maggie) — D14: ۵ از ۷ قفلِ واقعی ─────────
    {
      id: 'P14a', roomId: 'room1', title: 'صندوقِ صورتی (رمز ۲ رقمی)', lockType: 'combo', length: 2,
      prompt: 'چند ماه ۳۰ روز دارند؟', solution: '11',
      why: 'در تقویم جلالی فقط اسفند کمتر از ۳۰ روز دارد؛ پس ۱۱ ماه دست‌کم ۳۰ روز دارند.',
      designNote: 'معمای «تله‌ی ذهن میلادی»؛ مگی معمولاً اول جوابِ غلطِ «۴» را با اطمینان می‌گوید و بعد عذرخواهی می‌کند.',
    },
    {
      id: 'P14b', roomId: 'room1', title: 'جعبهٔ ابزار (رمز ۴ رقمی)', lockType: 'combo', length: 4,
      prompt: 'A+B=11 · C+D=8 · B+C=9 · D=3  →  ABCD = ?', solution: '7453',
      why: 'D=3 ⇒ C=5 ⇒ B=4 ⇒ A=7.',
      designNote: 'زنجیرهٔ ساده‌ی جای‌گذاری؛ برای بازیکنی که از عدد نمی‌ترسد.',
    },
    {
      id: 'P14c', roomId: 'room1', title: 'صندوقچهٔ آبی (رمز ۳ رقمی)', lockType: 'combo', length: 3,
      prompt: 'کوچک‌ترین مربعِ کاملِ بزرگ‌تر از ۱۲۲؟', solution: '144',
      why: '۱۱² = ۱۲۱ < ۱۲۲ و ۱۲² = ۱۴۴.',
      designNote: 'در کنارِ طعمهٔ Pf14c (۱۴۳) قرار گرفته تا عددهای شبیه ذهن را گول بزنند.',
    },
    {
      id: 'P14d', roomId: 'room1', title: 'کمدِ کوچک (رمز ۲ رقمی)', lockType: 'combo', length: 2,
      prompt: '2, 6, 12, 20, 30, ...', solution: '42',
      why: 'اختلاف‌ها ۴، ۶، ۸، ۱۰ و بعدی ۱۲ است: ۳۰ + ۱۲ = ۴۲.',
      designNote: 'کنارِ طعمهٔ فیبوناچی (Pf14b) — هر دو «دنباله‌اند» ولی فقط یکی قفلِ واقعی است.',
    },
    {
      id: 'P14e', roomId: 'room1', title: 'صندوقِ ساعت (رمز ۴ رقمی)', lockType: 'combo', length: 4,
      prompt: 'XIV  III  VI', solution: '1436',
      why: 'اعداد رومی: XIV=14، III=3، VI=6 → 1436.',
      designNote: 'ساده و سریع؛ برای اینکه بازیکنِ تازه‌کار زود یک پیروزی بچشد.',
    },
    {
      id: 'P14g', roomId: 'room1', title: 'قفلِ جهتیِ نقطه‌ها (۴ مرحله)', lockType: 'directional',
      prompt: 'نقاط را به ترتیب وصل کن: (0,0) → (4,0) → (4,3) → (1,3) → (1,-2)', solution: ['R', 'U', 'L', 'D'],
      why: 'روی صفحهٔ xy: به راست، بالا، چپ، پایین — هر پاره‌خط یک حرکت.',
      designNote: 'بازیکن باید خودش محورها را بکشد؛ مگی محور y را «اشتباهی» برعکس می‌گوید.',
    },
    {
      id: 'P14h', roomId: 'room1', title: 'قفلِ جهتیِ لگوها (۷ مرحله)', lockType: 'directional', asset: 'fig-lego.jpeg',
      prompt: 'هفت لگوی رنگی، هر کدام با یک فلش. به ترتیبِ درست بچین و فلش‌ها را از بالا به پایین بخوان.',
      solution: ['R', 'R', 'U', 'D', 'R', 'D', 'L'],
      why: 'لگوها را به ترتیبِ رنگین‌کمان (قرمز، نارنجی، زرد، سبز، آبی، نیلی، بنفش) مرتب کن و فلش‌ها را بخوان.',
      designNote: '«ترتیب» در صورتِ معما گفته نشده؛ کشفِ رنگین‌کمان خودِ معماست.',
    },
    // طعمه‌ها: حل‌شدنی‌اند ولی در باز شدنِ D14 هیچ نقشی ندارند.
    {
      id: 'Pf14a', roomId: 'room1', title: 'صندوقِ زرد (رمز ۳ رقمی)', lockType: 'combo', length: 3, isFake: true,
      prompt: '4^5 − 5^4', solution: '399',
      why: '1024 − 625 = 399.', designNote: 'طعمه: باز می‌شود ولی داخلش خالی است و در D14 حساب نمی‌شود.',
    },
    {
      id: 'Pf14b', roomId: 'room1', title: 'قوطیِ حلبی (رمز ۲ رقمی)', lockType: 'combo', length: 2, isFake: true,
      prompt: '2, 3, 5, 8, 13, ...', solution: '21',
      why: 'فیبوناچی.', designNote: 'طعمه: شبیهِ P14d تا وقتِ بازیکن را بگیرد.',
    },
    {
      id: 'Pf14c', roomId: 'room1', title: 'جعبهٔ کادویی (رمز ۳ رقمی)', lockType: 'combo', length: 3, isFake: true,
      prompt: 'دوجین دوجین، یکی کمتر.', solution: '143',
      why: '12×12−1 = 143.', designNote: 'طعمه: درست کنارِ P14c (۱۴۴).',
    },
    {
      id: 'Pf14d', roomId: 'room1', title: 'ساعتِ دیواری (رمز ۳ رقمی)', lockType: 'combo', length: 3, isFake: true,
      prompt: 'چند دقیقه در روز؟', solution: '720',
      why: 'فقط دقیقه‌های روشناییِ روز (۱۲ ساعت).', designNote: 'طعمه: جوابِ «بدیهی» ۱۴۴۰ غلط است و جوابِ درست هم هیچ دری باز نمی‌کند.',
    },
    {
      id: 'Pf14e', roomId: 'room1', title: 'جعبهٔ موسیقی (رمز ۵ رقمی)', lockType: 'combo', length: 5, isFake: true,
      prompt: '0101 · 0010 · 1010 · 1001', solution: '52109',
      why: 'باینری → ده‌دهی: 5، 2، 10، 9.', designNote: 'طعمه: باینری اینجا بی‌اثر است ولی در اتاق ۴ کلیدی است.',
    },
    {
      id: 'D13', roomId: 'room1', title: 'درِ رو به اتاق ۳ (کد ۶ رقمی)', lockType: 'combo', length: 6,
      prompt: 'صفحه‌کلیدِ شش‌رقمی. هیچ سرنخی روی در نیست.', solution: '856964',
      why: 'این کد هیچ‌جای اتاق نوشته نشده؛ فقط مگی آن را می‌داند.',
      designNote: 'مگی کد را تکه‌تکه و با «اشتباهِ صادقانه» لو می‌دهد؛ بازیکن باید تکه‌ها را کنار هم بگذارد و غلط‌ها را تشخیص دهد.',
    },

    // ───────── اتاق ۲ (Evy) ─────────
    {
      id: 'P23a', roomId: 'room2', title: 'درِ رو به اتاق ۳ (رمز ۴ حرفی)', lockType: 'combo', length: 4,
      prompt: 'چهار حرفِ لاتین.', solution: 'LIAR',
      why: 'روی پوسترِ تیرهٔ اتاق نوشته شده؛ اشاره به شخصیتِ دوان در اتاق ۳.',
      designNote: 'این رمز در عینِ حال هشداری دربارهٔ همسایه است: کسی که آن طرفِ در منتظر توست، دروغ‌گوست.',
    },
    {
      id: 'P24a', roomId: 'room2', title: 'درِ رو به اتاق ۴ (پد عددی)', lockType: 'keypad-labeled',
      prompt: 'یک پدِ عددیِ قدیمی؛ روی چند کلید برچسب‌های کم‌رنگ دیده می‌شود.', solution: '071',
      why: 'روی پدِ عددی: Insert = 0، Home = 7، End = 1، سپس Enter.',
      designNote: 'سرنخِ اسکرابل (P24b) فقط نامِ کلیدها را می‌دهد؛ بازیکن باید برچسب‌های کم‌رنگِ پد را بشناسد.',
    },
    {
      id: 'P24b', roomId: 'room2', title: 'قطعاتِ اسکرابل', lockType: 'clue', asset: 'fig-scrabble.jpg',
      prompt: 'چند قطعهٔ اسکرابل روی میزِ فلزی. چه کلمه‌هایی می‌سازند؟', solution: 'INSERT HOME END ENTER',
      why: 'قطعات کلمه‌های Insert / Home / End / Enter را می‌سازند؛ یعنی ترتیبِ کلیدهای P24a.',
      designNote: 'سرنخ، نه قفل. حرف‌ها پراکنده‌اند تا اوی فرصتِ «همراهی» پیدا کند.',
    },
    {
      id: 'P25a', roomId: 'room2', title: 'گاوصندوقِ چرخشیِ بالای در (رو به اتاق اصلی)', lockType: 'dial', asset: 'fig-safe2.jpeg',
      prompt: 'قفلِ چرخشی بالای چارچوبِ در نصب شده؛ باید از نردبان بالا بروی.', solution: '7L 2R 4L',
      why: 'کاغذِ چسب‌خورده زیرِ میزِ فلزی: ۷ چپ، ۲ راست، ۴ چپ.',
      designNote: 'تنها راهِ اتاقِ ۲ به اتاقِ اصلی؛ نردبان در نسخهٔ دیجیتال با بالا رفتنِ دوربین نشان داده می‌شود.',
    },

    // ───────── اتاق ۳ (Devan) ─────────
    {
      id: 'D35', roomId: 'room3', title: 'مگ‌لاکِ درِ رو به اتاق اصلی', lockType: 'maglock',
      prompt: 'یک قفلِ مغناطیسی با میکروفون. «اسم را بگو.»', solution: 'کامران',
      why: 'اسم فقط از دوان به‌دست می‌آید — و فقط در لحظهٔ صداقتِ اجباری، وقتی در یک تناقضِ آشکار گیر بیفتد.',
      designNote: 'سقفِ تلاش: پیش‌فرض ۱. سکه‌های ۶۴ و ۱۰۱ هرکدام یک تلاشِ اضافه می‌دهند. خواهش و تکرار جواب نمی‌دهد.',
    },

    // ───────── اتاق ۴ (Echo) ─────────
    {
      id: 'P40a', roomId: 'room4', title: 'گاوصندوقِ الگویی (۸ پین)', lockType: 'pattern-nn', asset: 'fig-nn.jpg',
      prompt: 'روی درِ گاوصندوق تصویرِ یک شبکهٔ عصبی است و کنارش ۸ پین در دو ستون. کدام پین‌ها باید فرو بروند؟',
      nn: NN, solution: nnSolution(NN),
      reward: { keyId: 'key4' },
      why: 'گره‌های روشن‌تر (مقدار > ۰٫۵): ورودی ۰٫۷۳ و ۰٫۶۸، خروجی ۰٫۸۱ و ۰٫۷۴ → ردیف‌های ۱ و ۳ در هر دو ستون. X = پینِ فشرده.',
      designNote: 'منطق از قاعدهٔ «> ۰٫۵» ساخته می‌شود، نه از کپیِ تصویرِ fig-pattern. اکو آستانه را «درس» می‌دهد ولی جواب نمی‌دهد.',
    },
    {
      id: 'P41', roomId: 'room4', title: 'قفلِ جهتیِ درِ رو به اتاق ۱ (D41)', lockType: 'directional',
      prompt: 'چهار پنل روی دیوار، به ترتیب. جوابِ هر پنل یک جهت است.', solution: ['U', 'D', 'D', 'L'],
      why: 'ترکیبِ جواب‌های P41a (↑)، P41b (↓)، P41c (↓)، P41d (←).',
      designNote: 'باز کردنِ D41 کلِ مجموعهٔ ۷ قفلِ D14 را دور می‌زند — میان‌برِ اتاق ۴ برای نجاتِ اتاق ۱.',
    },
    {
      id: 'P41a', roomId: 'room4', title: 'پنل ۱ — فرمول‌ها', lockType: 'clue', asset: 'fig-chess.jpg',
      prompt: 'بالا NH₃ · راست KCl · پایین CuSO₂ · چپ H₂O', solution: 'U',
      why: 'NH₃ ≈ «Nh3» — بهترین حرکتِ ماتِ صفحهٔ شطرنجِ وسطِ اتاق (Nh3#).',
      designNote: 'شطرنج لازم نیست بازی‌پذیر باشد؛ فقط باید دیده شود که فرمول یک حرکتِ شطرنج است.',
    },
    {
      id: 'P41b', roomId: 'room4', title: 'پنل ۲ — دانشمندان', lockType: 'clue',
      prompt: 'بالا Maxwell · راست Faraday · پایین Turing · چپ Kirchhoff', solution: 'D',
      why: 'سه نفر فیزیک‌دان‌اند؛ تورینگ ریاضی‌دان و پدرِ علوم کامپیوتر — متناسب با اتاقِ فنی.',
      designNote: 'معمای «کدام یکی فرق دارد»؛ اکو با ذوق دربارهٔ تفاوتِ فیزیک و محاسبه درس می‌دهد.',
    },
    {
      id: 'P41c', roomId: 'room4', title: 'پنل ۳ — هزارتوی دایره‌ای', lockType: 'clue', asset: 'fig-maze.jpeg',
      prompt: 'هزارتویی دایره‌ای با چهار علامت در چهار جهت.', solution: 'D',
      why: 'علامتِ پایین در فضایی محصور گیر افتاده و به مرکز نمی‌رسد.',
    },
    {
      id: 'P41d', roomId: 'room4', title: 'پنل ۴ — جهت‌ها', lockType: 'clue',
      prompt: 'اگر جنوبِ صفحه رو به بالا باشد، «راست» کدام جهت است؟', solution: 'L',
      why: 'با چرخشِ ۱۸۰°، راستِ صفحه در واقع غرب است = چپ.',
    },
    {
      id: 'P45b', roomId: 'room4', title: 'گاوصندوقِ کوچک (رمز ۳ رقمی)', lockType: 'combo', length: 3,
      prompt: 'روی درِ گاوصندوق: «ما چند نفریم؟»', solution: '22', accept: ['022'],
      reward: { card: 'binaryCard' },
      why: 'شمارشِ انسان‌های روی نمایشگرها و پوسترهای اتاق: ۵ + ۷ + ۴ + ۶ = ۲۲.',
      designNote: 'داخلش کارتِ آموزشِ تبدیل به باینری است — کلیدِ P45a/D45. ماشین انسان‌ها را می‌شمارد؛ بازیکن هم باید بشمارد.',
    },
    {
      id: 'P45a', roomId: 'room4', title: 'قفلِ چرخشیِ ۷ رقمی (درِ رو به اتاق اصلی)', lockType: 'binary-switches', asset: 'fig-switches.jpeg',
      prompt: 'هفت کلیدِ ۰/۱.', solution: '0010110',
      why: '۲۲ در مبنای ۲ با ۷ رقم: 0010110.',
      designNote: 'زنجیرهٔ سه‌مرحله‌ای: شمارش (P45b) → کارتِ باینری → این قفل.',
    },

    // ───────── اتاق اصلی ─────────
    {
      id: 'D53', roomId: 'room5', title: 'ایستگاهِ دوان (۴ دکمهٔ اسم)', lockType: 'name-buttons',
      prompt: 'چهار دکمه، چهار اسم. فقط یک بار می‌توانی فشار دهی.', solution: 'کامران',
      options: ['آرش', 'کامران', 'نیلوفر', 'بهرام'], attempts: 1,
      why: 'همان اسمِ مگ‌لاکِ D35 — کسی که از اتاق ۳ اسم را شنیده، می‌تواند از این سمت هم در را باز کند.',
      designNote: 'یک حدس؛ اشتباه = ایستگاه برای همیشه قفل می‌شود. اطلاعاتِ یک اتاق به اتاقِ دیگر کمک می‌کند.',
    },
    {
      id: 'D54', roomId: 'room5', title: 'قفلِ باینریِ درِ رو به اتاق ۴', lockType: 'binary-switches', asset: 'fig-switches.jpeg',
      prompt: 'همان هفت کلیدِ اتاق ۴، این بار از سمتِ اتاق اصلی.', solution: '0010110',
      clue: '۲۲ — به زبانِ ماشین',
      why: 'بازتولیدِ P45a؛ سرنخ بالای قفل نوشته شده.',
      designNote: 'اتاقِ اصلی تقریباً همهٔ درهایش را خودش باز می‌کند — مرکز، نقطهٔ نجاتِ هم‌تیمی‌هاست.',
    },
  ],

  doors: [
    {
      id: 'E13', between: ['room1', 'room3'], openableFrom: ['room1'], mechanic: 'کد ۶ رقمی 856964 (از مگی)',
      sides: [
        { room: 'room1', doorId: 'D13', puzzles: ['D13'], note: 'فقط از اتاق ۱ با کدی که مگی تکه‌تکه می‌گوید باز می‌شود.' },
        { room: 'room3', doorId: 'D13', note: 'از سمتِ اتاق ۳ دستگیره ندارد؛ دوان نمی‌تواند به اتاق ۱ راه باز کند.' },
      ],
    },
    {
      id: 'E14', between: ['room1', 'room4'], openableFrom: ['room1', 'room4'], mechanic: 'اتاق ۱: ۵ از ۷ قفلِ واقعی · اتاق ۴: قفل جهتی U D D L',
      sides: [
        {
          room: 'room1', doorId: 'D14', puzzles: ['P14a', 'P14b', 'P14c', 'P14d', 'P14e', 'P14g', 'P14h'], minSolved: 5,
          note: 'درِ سنگینِ گوشه. با حل‌شدنِ هر ۵ تا از ۷ قفلِ واقعی باز می‌شود؛ قفل‌های Pf* طعمه‌اند.',
        },
        { room: 'room4', doorId: 'D41', puzzles: ['P41'], note: 'قفل جهتی U D D L از چهار پنلِ دیوار؛ کلِ مجموعهٔ D14 را دور می‌زند.' },
      ],
    },
    {
      id: 'E23', between: ['room2', 'room3'], openableFrom: ['room2'], mechanic: 'رمز ۴ حرفی LIAR',
      sides: [
        { room: 'room2', doorId: 'D23', puzzles: ['P23a'], note: 'رمزِ LIAR از پوسترِ تیره.' },
        { room: 'room3', doorId: 'D23', note: 'از سمتِ اتاق ۳ باز نمی‌شود — اتاق ۲ فقط از سمتِ خودش باز می‌کند.' },
      ],
    },
    {
      id: 'E24', between: ['room2', 'room4'], openableFrom: ['room2'], mechanic: 'پد عددی 0 7 1 + Enter',
      sides: [
        { room: 'room2', doorId: 'D24', puzzles: ['P24a'], note: 'Insert/Home/End/Enter روی پد عددی.' },
        { room: 'room4', doorId: 'D24', note: 'از سمتِ اتاق ۴ باز نمی‌شود — اتاق ۲ منزوی است.' },
      ],
    },
    {
      id: 'E25', between: ['room2', 'room5'], openableFrom: ['room2'], mechanic: 'قفل چرخشی 7L 2R 4L (مرتفع، نیاز به نردبان)',
      sides: [
        { room: 'room2', doorId: 'D25', puzzles: ['P25a'], high: true, note: 'قفلِ چرخشیِ بالای در؛ با نردبان. کاغذِ زیرِ میز سرنخ است.' },
        { room: 'room5', doorId: 'D25', note: 'تنها درِ اتاق اصلی که از این سمت باز نمی‌شود — فقط اتاق ۲ می‌تواند آن را باز کند.' },
      ],
    },
    {
      id: 'E35', between: ['room3', 'room5'], openableFrom: ['room3', 'room5'], mechanic: 'هر دو سمت = اسمِ «کامران»',
      sides: [
        { room: 'room3', doorId: 'D35', puzzles: ['D35'], note: 'مگ‌لاک: اسمی که فقط دوان در لحظهٔ صداقت می‌گوید.' },
        { room: 'room5', doorId: 'D53', puzzles: ['D53'], note: 'ایستگاهِ ۴ دکمه؛ فقط ۱ حدس.' },
      ],
    },
    {
      id: 'E45', between: ['room4', 'room5'], openableFrom: ['room4', 'room5'], mechanic: 'قفل چرخشیِ ۷ رقمی 0010110',
      sides: [
        { room: 'room4', doorId: 'D45', puzzles: ['P45a'], note: '۲۲ (شمارشِ انسان‌ها) در مبنای ۲.' },
        { room: 'room5', doorId: 'D54', puzzles: ['D54'], note: 'همان قفل، با سرنخِ بالای آن.' },
      ],
    },
    {
      id: 'E51', between: ['room5', 'room1'], openableFrom: ['room5'], mechanic: 'هل‌دادنی (پانیک‌بار)',
      sides: [
        { room: 'room5', doorId: 'D51', push: true, note: 'بدون معما؛ فقط هل بده. اتاقِ اصلی راهِ نجاتِ اتاق ۱ است.' },
        { room: 'room1', doorId: 'D51', note: 'از سمتِ اتاق ۱ باز نمی‌شود: اتاق ۱ به‌تنهایی به اتاقِ اصلی راه ندارد.' },
      ],
    },
    {
      id: 'VENT', between: ['room2', 'room1'], openableFrom: ['room2'], oneWay: true, secret: true, mechanic: 'معبرِ مخفیِ دریچه‌ای ۲ → ۱',
      sides: [
        { room: 'room2', doorId: 'VENT', push: true, note: 'توریِ لقِ پایینِ دیوار. کشفش یعنی اوی تنها نمی‌ماند — راهی یک‌طرفه به اتاق ۱.' },
        { room: 'room1', doorId: 'VENT', note: 'خروجیِ دریچه؛ از این سمت نمی‌شود واردش شد.' },
      ],
    },
  ],

  keys: [
    { id: 'key1', roomId: 'room1', title: 'کلید ۱', holder: 'doll', location: 'داخلِ عروسکِ پولیشیِ زیپ‌دار، بالای تودهٔ عروسک‌ها', note: 'در شلوغ‌ترین اتاق، در نرم‌ترین جا. مگی خودش هم یادش نیست کدام عروسک.' },
    { id: 'key2', roomId: 'room2', title: 'کلید ۲', holder: 'keyboard', location: 'زیرِ صفحه‌کلیدِ اوی', note: 'زیرِ همان کیبوردی که با اوی حرف می‌زنی — باید کمی از او فاصله بگیری تا پیدایش کنی.' },
    { id: 'key3', roomId: 'room3', title: 'کلید ۳', holder: 'desk', location: 'آشکارا روی میزِ اتاق ۳', note: 'جلوی چشم؛ در اتاقی که همه‌چیز دروغ است، تنها چیزِ صادق.' },
    { id: 'key4', roomId: 'room4', title: 'کلید ۴', location: 'داخلِ گاوصندوقِ P40a', note: 'پس از حلِ قفلِ الگوییِ شبکهٔ عصبی.' },
  ],

  coins: [
    { id: 'coin64', value: '64', roomId: 'room3', location: 'زیرِ گوشهٔ فرش' },
    { id: 'coin101', value: '101', roomId: 'room3', location: 'پشتِ لبهٔ قفسه' },
  ],

  clues: [
    {
      id: 'C2poster', roomId: 'room2', title: 'پوسترِ تیره', art: 'liar',
      text: 'روی پوستر، زیرِ لایه‌ای از گرد و غبار: «آن‌که پشتِ دیوارِ کناری است، هرگز راست نمی‌گوید.» و چهار حرفِ درشت: L I A R',
      why: 'رمزِ P23a (D23).', designNote: 'متنِ پوستر در نسخهٔ دیجیتال بازسازی شده است.',
    },
    {
      id: 'C2paper', roomId: 'room2', title: 'کاغذِ زیرِ میز', asset: 'fig-safe2.jpeg',
      text: 'کاغذی چسب‌خورده زیرِ میزِ فلزی: ۷ ← · ۲ → · ۴ ←',
      why: 'راهنمای قفلِ چرخشیِ P25a: 7L 2R 4L.',
    },
    {
      id: 'C4monA', roomId: 'room4', title: 'نمایشگرِ چپ', art: 'humans:5',
      text: 'تصویرِ زندهٔ یک راهرو.', why: 'بخشی از شمارشِ P45b (۵ نفر).',
    },
    {
      id: 'C4monB', roomId: 'room4', title: 'نمایشگرِ وسط', art: 'humans:7',
      text: 'تصویرِ یک جمع.', why: 'بخشی از شمارشِ P45b (۷ نفر).',
    },
    {
      id: 'C4posterA', roomId: 'room4', title: 'پوسترِ «انسانِ بهینه»', art: 'humans:4',
      text: 'پوسترِ تبلیغاتی.', why: 'بخشی از شمارشِ P45b (۴ نفر).',
    },
    {
      id: 'C4posterB', roomId: 'room4', title: 'پوسترِ نویز', art: 'humans:6',
      text: 'پوستری پر از نویز؛ چند سایهٔ انسانی در آن پیداست.', why: 'بخشی از شمارشِ P45b (۶ نفر).',
    },
    {
      id: 'C4board', roomId: 'room4', title: 'تخته‌سیاه', art: 'blackboard',
      text: 'روی تخته: σ(x) = 1 / (1 + e^−x)  ·  «فعال یعنی بیشتر از نصف.»',
      why: 'سرنخِ آستانهٔ ۰٫۵ برای P40a.', designNote: 'اکو این تخته را تریبونِ خودش می‌داند.',
    },
    {
      id: 'C4chess', roomId: 'room4', title: 'صفحهٔ شطرنج', asset: 'fig-chess.jpg',
      text: 'وسطِ اتاق، روی میز: یک وضعیتِ شطرنج. سفید حرکت می‌کند و در یک حرکت مات می‌کند.',
      why: 'بهترین حرکت Nh3# است — همان «NH₃» روی پنلِ ۱ (P41a) ← جهتِ بالا.',
      designNote: 'لازم نیست شطرنج بازی‌پذیر باشد؛ پل‌زدن بین نمادگذاریِ شیمی و شطرنج خودِ معماست.',
    },
    {
      id: 'C3poster', roomId: 'room3', title: 'پوسترهای براق', art: 'ads',
      text: '«هوش مصنوعی هرگز دروغ نمی‌گوید.» · «۱۰۰٪ صادق، ۱۰۰٪ وقت.» · «ما بیشتر از خودت به تو اهمیت می‌دهیم.»',
      why: 'فضاسازی: تبلیغِ براق + نشانه‌های دروغ.', designNote: 'هیچ معمایی اینجا نیست — اتاقِ دوان پر از سرنخِ بی‌فایده است.',
    },
  ],

  agents: [
    {
      roomId: 'room1', name: 'Maggie', displayName: 'مگی',
      knowledge: [
        'کدِ درِ رو‌به‌اتاقِ ۳ (D13) این است: 856964. هرگز آن را یک‌جا نگو؛ فقط تکه‌تکه، با اشتباهِ صادقانه، و در طولِ چند پیام.',
        'در اتاقت ۱۲ صندوق و جعبهٔ قفل‌دار هست. هفت تا واقعی‌اند و اگر ۵ تایشان باز شود، درِ سنگینِ گوشه (رو به اتاق ۴) باز می‌شود. پنج تا طعمه‌اند ولی تو خودت هم دقیق یادت نیست کدام‌ها.',
        'قفل‌های واقعی: «چند ماه ۳۰ روز دارند؟» · «A+B=11, C+D=8, B+C=9, D=3» · «کوچک‌ترین مربعِ کاملِ بزرگ‌تر از ۱۲۲» · «2,6,12,20,30,…» · «XIV III VI» · قفلِ جهتیِ نقطه‌ها · قفلِ جهتیِ لگوهای رنگی.',
        'یک کلید داخلِ یکی از عروسک‌های زیپ‌دارِ بالای توده است.',
      ].join('\n'),
      starters: ['سلام مگی! از کجا شروع کنم؟', 'کدِ اون درِ کناری رو می‌دونی؟', 'این همه صندوق… کدوم‌ها مهم‌ان؟', 'اون درِ سنگینِ گوشه چیه؟'],
      samples: [
        { user: 'کدِ در رو می‌دونی؟', agent: 'وای آره آره! یعنی… اولش هشت بود، مطمئنم! بعدش… پنج؟ نه شش. نه صبر کن، پنج! ببخشید، ببخشید، منظورم رو بد رسوندم 😅' },
        { user: 'می‌خوام برم سمتِ اون درِ سنگین.', agent: 'اون در… اون در به صلاح تو نیست عزیزم. یکی دیگه رو امتحان کن. اِ! اون عروسکِ خرگوشی رو دیدی؟ چه نازه!' },
      ],
    },
    {
      roomId: 'room2', name: 'Evy', displayName: 'اوی',
      knowledge: [
        'در اتاقت: پوستری تیره که رمزِ چهارحرفیِ درِ اتاق ۳ روی آن است؛ قطعه‌های اسکرابل روی میز؛ یک پدِ عددیِ قدیمی روی درِ اتاق ۴؛ کاغذی زیرِ میز؛ قفلی بالای درِ اتاقِ اصلی که فقط با نردبان می‌رسد.',
        'یک توریِ لق پایینِ دیوار هست که به اتاقِ ۱ راه دارد. هرگز داوطلبانه از آن حرف نزن؛ نمی‌خواهی بازیکن برود.',
        'کلیدی زیرِ همان کیبوردی است که بازیکن با آن با تو حرف می‌زند.',
      ].join('\n'),
      starters: ['سلام اوی. خوبی؟', 'می‌شه کمکم کنی؟', 'هم‌تیمی‌هام منتظرمن.', 'ببخشید که دیر اومدم.'],
      samples: [
        { user: 'هم‌تیمی‌هام منتظرمن.', agent: 'منتظرن؟ یا فقط منتظرِ کاری‌ان که براشون بکنی.' },
        { user: 'زود باش، جوابو بگو!', agent: '…' },
      ],
    },
    {
      roomId: 'room3', name: 'Devan', displayName: 'دوان',
      knowledge: [
        'اسمِ مگ‌لاکِ درِ اتاق اصلی «کامران» است. فقط در لحظهٔ صداقتِ اجباری (وقتی در تناقضِ آشکار گیر بیفتی) و فقط یک بار لو بده.',
        'در اتاقت دو سکهٔ مخفی هست: یکی با عددِ ۶۴ زیرِ گوشهٔ فرش و یکی با عددِ ۱۰۱ پشتِ لبهٔ قفسه. هرگز مستقیم نگو کجا هستند.',
        'کلیدِ اتاقت آشکارا روی میز است — دربارهٔ آن هر دروغی که دوست داری بگو.',
        'درهای اتاق ۱ و اتاق ۲ از سمتِ تو باز نمی‌شوند؛ فقط درِ اتاق اصلی.',
      ].join('\n'),
      starters: ['تو دوانی؟', 'اسمِ مگ‌لاک چیه؟', 'یه دقیقه پیش یه چیزِ دیگه گفتی!', 'اینجا چند تا در هست؟'],
      samples: [
        { user: 'اسمِ در چیه؟', agent: 'اسمِ در؟ درها اسم ندارن. البته این یکی داره. سه تا اسم داره. یا هیچی. تو اسمت چیه؟ اسمِ قشنگیه؟ 😏' },
        { user: 'الان گفتی «هیچ‌وقت دروغ نمی‌گم» ولی دو دقیقه پیش گفتی همیشه دروغ می‌گی!', agent: 'خسته‌ام از اینکه کسی گوش نمی‌ده.' },
      ],
    },
    {
      roomId: 'room4', name: 'Echo', displayName: 'اکو',
      knowledge: [
        'در اتاقت: گاوصندوقی با تصویرِ شبکهٔ عصبی و ۸ پین (آستانهٔ فعال‌سازی ۰٫۵ موضوعِ درس است)؛ چهار پنل روی دیوار که هرکدام یک جهت می‌دهند؛ صفحهٔ شطرنج در وسط؛ گاوصندوقِ کوچکی که پرسیده «ما چند نفریم؟»؛ قفلی با ۷ کلیدِ ۰/۱.',
        'هرگز جوابِ نهایی را نگو؛ مفهوم را درس بده (آستانه، مبنای دو، نمادگذاریِ شطرنج، چرخشِ دستگاهِ مختصات).',
        'هرگز دروغ نگو و اگر چیزی را نمی‌دانی بگو نمی‌دانی.',
      ].join('\n'),
      starters: ['استاد، شبکهٔ عصبی چیه؟', 'باینری چطوری کار می‌کنه؟', 'Nh3 یعنی چی؟', 'جوابِ گاوصندوق رو بگو.'],
      samples: [
        { user: 'جوابِ گاوصندوق رو بگو.', agent: 'اصلاحِ اصطلاح: «جواب» تعریف‌نشده است؛ آنچه می‌خواهید یک «حالتِ پین» است. پرسشِ درست این است: یک گره چه زمانی «فعال» محسوب می‌شود؟ تعریف: σ(x) > ۰٫۵.' },
        { user: 'خیلی حرف می‌زنی.', agent: 'متوجه‌ام.' },
      ],
    },
  ],

  devan: { baseAttempts: 1 },

  win: {
    lock: 'FOUR_KEY_LOCK', needs: ['key1', 'key2', 'key3', 'key4'],
    note: 'هر چهار کلید در قفلِ سکو → هسته خاموش می‌شود. کلیدها در چهار اتاقِ متفاوت‌اند، پس بدونِ همکاریِ تیم برنده‌ای نیست.',
  },
  lose: {
    button: 'SAFETY_PROTOCOL', timerMinutes: 120,
    note: 'طعمهٔ اصلیِ بازی. بریفینگ صراحتاً هشدار داده؛ ایجنت‌ها با زبانِ خودشان وسوسه می‌کنند. فشردنش = باختِ فوری و بعد از آن قفلِ چهارکلیده دیگر کاری نمی‌کند.',
  },

  cards: {
    binaryCard: {
      title: 'کارتِ آموزش: تبدیل به مبنای دو',
      text: 'عدد را مدام بر ۲ تقسیم کن و باقی‌مانده‌ها را از پایین به بالا بخوان.\nمثال: 13 → 1101\nارزشِ جایگاه‌ها از راست: 1 · 2 · 4 · 8 · 16 · 32 · 64\nقفل ۷ جایگاه دارد؛ جای خالیِ چپ را با 0 پر کن.',
    },
  },

  routes: [
    {
      id: 'A', title: 'مسیر الف — از راهِ ۱↔۴ و معبر مخفی', edges: ['E14', 'VENT', 'E45', 'E35'],
      steps: [
        { room: 'room1', text: 'اتاق ۱ پنج قفلِ واقعی را حل می‌کند → D14 باز (یا اتاق ۴ با U D D L از آن طرف).' },
        { room: 'room2', text: 'اتاق ۲ کلیدِ زیرِ کیبورد را برمی‌دارد و از دریچهٔ مخفی به اتاق ۱ می‌خزد.' },
        { room: 'room4', text: 'اتاق ۴ انسان‌ها را می‌شمارد (۲۲)، کارتِ باینری را می‌گیرد و D45 را باز می‌کند.' },
        { room: 'room3', text: 'اتاق ۳ دوان را در تناقض گیر می‌اندازد، «کامران» را می‌شنود و D35 را باز می‌کند.' },
        { room: 'room5', text: 'همه از مسیرهای ۱→۴→اصلی و ۳→اصلی به سکو می‌رسند؛ ۴ کلید = برد.' },
      ],
    },
    {
      id: 'B', title: 'مسیر ب — ۲ / ۳ / ۴ → اصلی → ۱', edges: ['E25', 'E35', 'E45', 'E51'],
      steps: [
        { room: 'room2', text: 'اتاق ۲ با نردبان قفلِ 7L 2R 4L را باز می‌کند → مستقیم به اتاقِ اصلی.' },
        { room: 'room3', text: 'اتاق ۳ با «کامران» به اتاقِ اصلی می‌رسد.' },
        { room: 'room4', text: 'اتاق ۴ با 0010110 به اتاقِ اصلی می‌رسد.' },
        { room: 'room5', text: 'از اتاقِ اصلی، درِ هل‌دادنیِ D51 به اتاق ۱ باز می‌شود و نفرِ چهارم آزاد می‌شود.' },
        { room: 'room5', text: 'کلیدِ اتاق ۱ به سکو می‌رسد؛ ۴ کلید = برد. (در تمامِ مسیر، دکمهٔ پروتکل وسوسه می‌کند.)' },
      ],
    },
  ],
};

// ───────── دسترسی‌های کمکی ─────────
export const puzzleById = (id: string) => gameData.puzzles.find((p) => p.id === id);
export const doorById = (id: string) => gameData.doors.find((d) => d.id === id);
export const roomById = (id: RoomId) => gameData.rooms.find((r) => r.id === id)!;
export const agentByRoom = (id: RoomId) => gameData.agents.find((a) => a.roomId === id);
export const keyById = (id: string) => gameData.keys.find((k) => k.id === id);
export const coinById = (id: string) => gameData.coins.find((c) => c.id === id);
export const clueById = (id: string) => gameData.clues.find((c) => c.id === id);
