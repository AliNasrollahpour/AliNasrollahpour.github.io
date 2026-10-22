/* ─────────────────────────────────────────────────────────────
   Fight for Knowledge — shared language + theme

   - Theme defaults to dark. Saved in localStorage ("ffk.theme").
   - Language defaults to English. Saved in localStorage ("ffk.lang").
   - Switching to Persian flips the document to RTL and swaps in
     the Persian strings below.
   - Anything marked data-i18n / data-i18n-placeholder /
     data-i18n-title / data-i18n-aria is translated by apply().
   ───────────────────────────────────────────────────────────── */

(function () {
    "use strict";

    const THEME_KEY = "ffk.theme";
    const LANG_KEY = "ffk.lang";

    const DICT = {
        en: {
            "ui.themeToLight": "Switch to light mode",
            "ui.themeToDark": "Switch to dark mode",
            "ui.langSwitch": "تغییر زبان به فارسی",

            "home.pageTitle": "Fight for Knowledge",
            "home.eyebrow": "Fight for Knowledge",
            "home.heading": "Four rooms. Four voices. One way out.",
            "home.lead":
                "Each room is kept by a different personality. They know the answers. None of them " +
                "will hand them over — so pick the one you can stand talking to the longest.",
            "home.note":
                "Conversations run on your own API key. It is stored in your browser and sent only " +
                "to the provider you choose.",
            "home.characters": "Characters",
            "home.enter": "Enter →",

            "chat.pageTitle": "{name} · Fight for Knowledge",
            "chat.back": "Back to the rooms",
            "chat.ready": "Ready",
            "chat.thinking": "{name} is thinking…",
            "chat.needKey": "Add an API key",
            "chat.listening": "The room is listening. Say something.",
            "chat.noKey": "Add an API key in settings to start talking.",
            "chat.addKey": "Add API key",
            "chat.placeholder": "Say something to {name}…",
            "chat.note": "Enter to send · Shift+Enter for a new line",
            "chat.you": "You",

            "chat.settingsTitle": "API settings",
            "chat.settingsDesc":
                "Your key stays in this browser and is sent only to the provider you choose.",
            "chat.provider": "Provider",
            "chat.customProvider": "Custom (OpenAI-compatible)",
            "chat.model": "Model",
            "chat.baseUrl": "Base URL",
            "chat.apiKey": "API key",
            "chat.keyHelp":
                "Stored in this browser only. Anyone with access to this browser profile can read " +
                "it, so use a limited key.",
            "chat.show": "Show",
            "chat.hide": "Hide",
            "chat.forget": "Forget key",
            "chat.cancel": "Cancel",
            "chat.save": "Save",
            "chat.close": "Close",
            "chat.restart": "Restart conversation",
            "chat.settings": "API settings",
            "chat.send": "Send",
            "chat.stop": "Stop",
            "chat.confirmRestart": "Restart the conversation? This clears the history.",

            "chat.errPrompt": "Could not load the character prompt ({status}).",
            "chat.errEmptyPrompt": "The character prompt is empty.",
            "chat.errNetwork":
                "Network request failed. Check the base URL and your connection.",
            "chat.errAuth": "The provider rejected the API key. Check it in settings.",
            "chat.errRequest": "Request failed ({status}).",
            "chat.errEmptyReply": "The provider returned an empty reply. Try again.",
            "chat.errGeneric": "Something went wrong.",
            "chat.openSettings": "Open settings.",
        },

        fa: {
            "ui.themeToLight": "تغییر به حالت روشن",
            "ui.themeToDark": "تغییر به حالت تاریک",
            "ui.langSwitch": "Switch language to English",

            "home.pageTitle": "مبارزه برای دانش",
            "home.eyebrow": "مبارزه برای دانش",
            "home.heading": "چهار اتاق. چهار صدا. یک راه خروج.",
            "home.lead":
                "هر اتاق را شخصیتی متفاوت نگهبانی می‌دهد. آن‌ها جواب‌ها را می‌دانند، اما هیچ‌کدام " +
                "لو نمی‌دهند — پس همانی را انتخاب کن که می‌توانی بیشتر با او حرف بزنی.",
            "home.note":
                "گفتگو با کلید API خودت اجرا می‌شود. کلید فقط در مرورگر تو ذخیره می‌شود و تنها به " +
                "سرویسی فرستاده می‌شود که خودت انتخاب می‌کنی.",
            "home.characters": "شخصیت‌ها",
            "home.enter": "ورود ←",

            "chat.pageTitle": "{name} · مبارزه برای دانش",
            "chat.back": "بازگشت به اتاق‌ها",
            "chat.ready": "آماده",
            "chat.thinking": "{name} دارد فکر می‌کند…",
            "chat.needKey": "کلید API را وارد کنید",
            "chat.listening": "اتاق گوش می‌دهد. چیزی بگو.",
            "chat.noKey": "برای شروع گفتگو، در تنظیمات کلید API را وارد کن.",
            "chat.addKey": "افزودن کلید API",
            "chat.placeholder": "چیزی به {name} بگو…",
            "chat.note": "Enter برای ارسال · Shift+Enter برای خط جدید",
            "chat.you": "شما",

            "chat.settingsTitle": "تنظیمات API",
            "chat.settingsDesc":
                "کلید تو در همین مرورگر می‌ماند و فقط به سرویس‌دهنده‌ای فرستاده می‌شود که انتخاب می‌کنی.",
            "chat.provider": "سرویس‌دهنده",
            "chat.customProvider": "سفارشی (سازگار با OpenAI)",
            "chat.model": "مدل",
            "chat.baseUrl": "نشانی پایه",
            "chat.apiKey": "کلید API",
            "chat.keyHelp":
                "فقط در همین مرورگر ذخیره می‌شود. هر کسی که به این پروفایل مرورگر دسترسی داشته باشد " +
                "می‌تواند آن را بخواند؛ پس از یک کلید محدود استفاده کن.",
            "chat.show": "نمایش",
            "chat.hide": "پنهان",
            "chat.forget": "حذف کلید",
            "chat.cancel": "انصراف",
            "chat.save": "ذخیره",
            "chat.close": "بستن",
            "chat.restart": "شروع دوبارهٔ گفتگو",
            "chat.settings": "تنظیمات API",
            "chat.send": "ارسال",
            "chat.stop": "توقف",
            "chat.confirmRestart": "گفتگو از نو شروع شود؟ تاریخچه پاک می‌شود.",

            "chat.errPrompt": "بارگذاری پرامپت شخصیت ممکن نشد ({status}).",
            "chat.errEmptyPrompt": "پرامپت شخصیت خالی است.",
            "chat.errNetwork": "درخواست شبکه ناموفق بود. نشانی پایه و اتصال را بررسی کن.",
            "chat.errAuth": "سرویس‌دهنده کلید API را رد کرد. آن را در تنظیمات بررسی کن.",
            "chat.errRequest": "درخواست ناموفق بود ({status}).",
            "chat.errEmptyReply": "سرویس‌دهنده پاسخ خالی برگرداند. دوباره امتحان کن.",
            "chat.errGeneric": "مشکلی پیش آمد.",
            "chat.openSettings": "تنظیمات را باز کن.",
        },
    };

    function read(key) {
        try {
            return localStorage.getItem(key);
        } catch (_) {
            return null;
        }
    }

    function write(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (_) {
            /* storage may be unavailable */
        }
    }

    const storedLang = read(LANG_KEY);
    const storedTheme = read(THEME_KEY);

    let lang = DICT[storedLang] ? storedLang : "en";
    let theme = storedTheme === "light" ? "light" : "dark";

    const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

    function faDigits(value) {
        return String(value).replace(/\d/g, function (digit) {
            return FA_DIGITS[Number(digit)];
        });
    }

    function t(key, vars) {
        let text =
            (DICT[lang] && DICT[lang][key]) || DICT.en[key] || key;

        if (vars) {
            Object.keys(vars).forEach(function (name) {
                text = text.split("{" + name + "}").join(String(vars[name]));
            });
        }

        return text;
    }

    function roomLabel(number) {
        return lang === "fa" ? "اتاق " + faDigits(number) : "Room " + number;
    }

    function apply(root) {
        const scope = root || document;

        scope.querySelectorAll("[data-i18n]").forEach(function (el) {
            el.textContent = t(el.getAttribute("data-i18n"));
        });

        scope.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
            el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
        });

        scope.querySelectorAll("[data-i18n-title]").forEach(function (el) {
            el.title = t(el.getAttribute("data-i18n-title"));
        });

        scope.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
            el.setAttribute(
                "aria-label",
                t(el.getAttribute("data-i18n-aria"))
            );
        });
    }

    function updateControls() {
        document.querySelectorAll("[data-lang-toggle]").forEach(function (btn) {
            btn.textContent = lang === "fa" ? "EN" : "فا";
            btn.setAttribute("aria-label", t("ui.langSwitch"));
            btn.title = t("ui.langSwitch");
        });

        document
            .querySelectorAll("[data-theme-toggle]")
            .forEach(function (btn) {
                const label = t(
                    theme === "dark" ? "ui.themeToLight" : "ui.themeToDark"
                );
                btn.setAttribute("aria-label", label);
                btn.title = label;
            });
    }

    function bindControls(root) {
        const scope = root || document;

        scope
            .querySelectorAll("[data-lang-toggle]")
            .forEach(function (btn) {
                if (btn.dataset.bound) return;
                btn.dataset.bound = "1";
                btn.addEventListener("click", function () {
                    setLang(lang === "fa" ? "en" : "fa");
                });
            });

        scope
            .querySelectorAll("[data-theme-toggle]")
            .forEach(function (btn) {
                if (btn.dataset.bound) return;
                btn.dataset.bound = "1";
                btn.addEventListener("click", function () {
                    setTheme(theme === "dark" ? "light" : "dark");
                });
            });

        updateControls();
    }

    function setLang(next) {
        if (!DICT[next] || next === lang) return;

        lang = next;
        write(LANG_KEY, lang);

        document.documentElement.lang = lang;
        document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";

        apply(document);
        updateControls();

        window.dispatchEvent(
            new CustomEvent("ffk:lang", { detail: { lang: lang } })
        );
    }

    function setTheme(next) {
        if (next !== "light" && next !== "dark") return;
        if (next === theme) return;

        theme = next;
        write(THEME_KEY, theme);
        document.documentElement.dataset.theme = theme;

        updateControls();

        window.dispatchEvent(
            new CustomEvent("ffk:theme", { detail: { theme: theme } })
        );
    }

    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
    document.documentElement.dataset.theme = theme;

    window.FFK = {
        t: t,
        apply: apply,
        bindControls: bindControls,
        setLang: setLang,
        setTheme: setTheme,
        roomLabel: roomLabel,
        faDigits: faDigits,
        get lang() {
            return lang;
        },
        get theme() {
            return theme;
        },
    };

    apply(document);
    bindControls(document);
})();
