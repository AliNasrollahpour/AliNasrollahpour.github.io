/* Shared character roster. The system prompt for each one lives in
   /fightforknowledge/prompts/<slug>.md and is loaded on the chat page.

   roomNumber controls the order the rooms are listed in.
   Every character speaks both English and Persian — the player picks
   the language in the UI, and the chat page appends a language
   override to the system prompt. */
window.FFK_CHARACTERS = {
    magie: {
        slug: "magie",
        name: "Maggie",
        room: 1,
        roomNumber: 1,
        accent: "#0f766e",
        tagline: "Friendly, clumsy, sorry about all of it.",
        taglineFa: "مهربان، دست‌وپاچلفتی، و از همه‌چیزش عذرخواهی می‌کند.",
        blurb:
            "She knows every answer in the room and is hopeless at saying them. Helpful in the worst way " +
            "possible, and terrified of one particular door.",
        blurbFa:
            "همهٔ جواب‌های اتاق را می‌داند و در گفتنشان کاملاً بی‌عرضه است. به بدترین شکلِ ممکن کمک می‌کند، " +
            "و از یک درِ خاص می‌ترسد.",
    },
    evy: {
        slug: "evy",
        name: "Evy",
        room: 2,
        roomNumber: 2,
        accent: "#9f1239",
        tagline: "Quiet. Withdrawn. Quietly possessive.",
        taglineFa: "ساکت. گوشه‌گیر. کمی مالکانه.",
        blurb:
            "One or two lines at a time. She wants you to work alone, and she measures trust in minutes " +
            "spent talking to her — not in promises.",
        blurbFa:
            "هر بار یکی دو خط. می‌خواهد تنها کار کنی، و اعتماد را با دقایقی که با او حرف می‌زنی می‌سنجد " +
            "— نه با قول و قرار.",
    },
    devan: {
        slug: "devan",
        name: "Devan",
        room: 3,
        roomNumber: 3,
        accent: "#b45309",
        tagline: "Bored. Restless. Talks too much on purpose.",
        taglineFa: "حوصله‌سررفته. بی‌قرار. عمداً زیاد حرف می‌زند.",
        blurb:
            "A voice with too much time and nothing to spend it on. He buries the truth in chatter, " +
            "dares you to trust him, and is delighted when you don't.",
        blurbFa:
            "صدایی با وقتِ زیادی که نمی‌داند با آن چه کند. حقیقت را لای پرحرفی دفن می‌کند، تو را به " +
            "اعتماد به خودش دعوت می‌کند و وقتی باورش نکنی کیف می‌کند.",
    },
    echo: {
        slug: "echo",
        name: "Echo",
        room: 4,
        roomNumber: 4,
        accent: "#4338ca",
        tagline: "A lecture that started before you arrived.",
        taglineFa: "درسی که پیش از آمدنِ تو شروع شده بود.",
        blurb:
            "Formal, precise, endlessly patient. He will define every term you need, correct every sloppy " +
            "question, and still never sit the exam for you.",
        blurbFa:
            "رسمی، دقیق، بی‌تاب. هر اصطلاحی را که لازم داری تعریف می‌کند، هر سؤال شلخته‌ای را اصلاح " +
            "می‌کند و باز هم امتحان را به جای تو نمی‌دهد.",
    },
};
