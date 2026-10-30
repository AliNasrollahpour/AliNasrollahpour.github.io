/* ─────────────────────────────────────────────────────────────
   Fight for Knowledge — chat runtime

   Static site, no backend: the browser calls an OpenAI-compatible
   chat-completions endpoint directly with the key the visitor
   pastes into settings. The key lives in localStorage and is never
   part of the repository.

   The character's AGENTS.md is loaded from ../prompts/<slug>.md and
   sent as the system prompt on every request. A language override
   is appended so every character can answer in English or Persian,
   whichever the player picked in the UI.
   ───────────────────────────────────────────────────────────── */

(function () {
    "use strict";

    const SETTINGS_KEY = "ffk.settings.v1";
    const CHAT_KEY = "ffk.chat.v1.";
    const HISTORY_LIMIT = 40;

    const t = window.FFK.t;

    const PROVIDERS = {
        openai: {
            label: "OpenAI",
            baseUrl: "https://api.openai.com/v1",
            model: "gpt-4.1-mini",
        },
        openrouter: {
            label: "OpenRouter",
            baseUrl: "https://openrouter.ai/api/v1",
            model: "openai/gpt-4.1-mini",
        },
        groq: {
            label: "Groq",
            baseUrl: "https://api.groq.com/openai/v1",
            model: "llama-3.3-70b-versatile",
        },
        custom: {
            label: "Custom (OpenAI-compatible)",
            baseUrl: "",
            model: "",
        },
    };

    const slug = document.body.dataset.character;
    const character = (window.FFK_CHARACTERS || {})[slug];

    if (!character) {
        document.body.textContent = "Unknown character.";
        return;
    }

    const state = {
        history: [],
        count: 0,
        systemPrompt: null,
        busy: false,
        controller: null,
        session: 0,
    };

    /* ── settings ────────────────────────────────────────────── */

    function loadSettings() {
        let stored = {};
        try {
            stored = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
        } catch (_) {
            stored = {};
        }

        const provider = PROVIDERS[stored.provider] ? stored.provider : "openai";
        const preset = PROVIDERS[provider];

        return {
            provider: provider,
            baseUrl: (stored.baseUrl || preset.baseUrl || "").trim(),
            model: (stored.model || preset.model || "").trim(),
            apiKey: (stored.apiKey || "").trim(),
        };
    }

    function saveSettings(next) {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
        } catch (_) {
            /* storage may be unavailable — the session still works */
        }
    }

    let settings = loadSettings();

    /* ── chat persistence ────────────────────────────────────── */

    function loadChat() {
        try {
            const stored = JSON.parse(
                sessionStorage.getItem(CHAT_KEY + slug) || "null"
            );
            if (stored && Array.isArray(stored.history)) {
                state.history = stored.history.filter(
                    (m) =>
                        m &&
                        (m.role === "user" || m.role === "assistant") &&
                        typeof m.content === "string"
                );
                state.count = Number(stored.count) || 0;
            }
        } catch (_) {
            /* ignore malformed state */
        }
    }

    function saveChat() {
        try {
            sessionStorage.setItem(
                CHAT_KEY + slug,
                JSON.stringify({ history: state.history, count: state.count })
            );
        } catch (_) {
            /* ignore quota errors */
        }
    }

    /* ── markup ──────────────────────────────────────────────── */

    const icons = {
        back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>',
        sun: '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
        moon: '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
        reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
        gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
        send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>',
        stop: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.5"/></svg>',
    };

    const shell = document.createElement("div");
    shell.className = "chat-shell";
    shell.innerHTML = `
        <header class="chat-header">
            <a class="icon-button chat-back" href="../" data-i18n-title="chat.back" data-i18n-aria="chat.back">${icons.back}</a>
            <div class="avatar" aria-hidden="true">${character.name.charAt(0)}</div>
            <div class="chat-identity">
                <div class="chat-name">${character.name}<span class="chat-room" id="chat-room">${window.FFK.roomLabel(character.roomNumber)}</span></div>
                <div class="chat-status" id="status" role="status" aria-live="polite"></div>
            </div>
            <div class="chat-actions">
                <button class="lang-toggle" type="button" data-lang-toggle>فا</button>
                <button class="icon-button theme-toggle" type="button" data-theme-toggle>${icons.sun}${icons.moon}</button>
                <button class="icon-button" type="button" id="restart" data-i18n-title="chat.restart" data-i18n-aria="chat.restart">${icons.reset}</button>
                <button class="icon-button" type="button" id="open-settings" data-i18n-title="chat.settings" data-i18n-aria="chat.settings">${icons.gear}</button>
            </div>
        </header>

        <div class="messages" id="messages">
            <div class="messages-inner" id="log"></div>
        </div>

        <div class="composer-wrap">
            <form class="composer" id="composer" autocomplete="off">
                <textarea id="input" rows="1" aria-label="Message"></textarea>
                <button class="send-button" type="submit" id="send">${icons.send}</button>
            </form>
            <p class="composer-note" data-i18n="chat.note"></p>
        </div>

        <dialog class="settings" id="settings">
            <form class="settings-form" id="settings-form" method="dialog">
                <div class="settings-head">
                    <div>
                        <h2 data-i18n="chat.settingsTitle"></h2>
                        <p data-i18n="chat.settingsDesc"></p>
                    </div>
                    <button class="icon-button" type="button" id="close-settings" data-i18n-aria="chat.close" data-i18n-title="chat.close">✕</button>
                </div>

                <div class="field">
                    <label for="provider" data-i18n="chat.provider"></label>
                    <select id="provider"></select>
                </div>

                <div class="field-row">
                    <div class="field">
                        <label for="model" data-i18n="chat.model"></label>
                        <input id="model" type="text" spellcheck="false" placeholder="gpt-4.1-mini" dir="ltr" />
                    </div>
                    <div class="field">
                        <label for="base-url" data-i18n="chat.baseUrl"></label>
                        <input id="base-url" type="url" spellcheck="false" placeholder="https://api.openai.com/v1" dir="ltr" />
                    </div>
                </div>

                <div class="field">
                    <label for="api-key" data-i18n="chat.apiKey"></label>
                    <div class="key-wrap">
                        <input id="api-key" type="password" spellcheck="false" placeholder="sk-…" autocomplete="off" dir="ltr" />
                        <button class="key-toggle" type="button" id="toggle-key"></button>
                    </div>
                    <p class="help" data-i18n="chat.keyHelp"></p>
                </div>

                <div class="settings-actions">
                    <button class="button ghost" type="button" id="forget-key" data-i18n="chat.forget"></button>
                    <span class="spacer"></span>
                    <button class="button" type="button" id="cancel-settings" data-i18n="chat.cancel"></button>
                    <button class="button primary" type="submit" data-i18n="chat.save"></button>
                </div>
            </form>
        </dialog>
    `;
    document.body.appendChild(shell);

    window.FFK.apply(shell);
    window.FFK.bindControls(shell);

    const els = {
        messages: document.getElementById("messages"),
        log: document.getElementById("log"),
        composer: document.getElementById("composer"),
        input: document.getElementById("input"),
        send: document.getElementById("send"),
        status: document.getElementById("status"),
        room: document.getElementById("chat-room"),
        restart: document.getElementById("restart"),
        openSettings: document.getElementById("open-settings"),
        settings: document.getElementById("settings"),
        settingsForm: document.getElementById("settings-form"),
        closeSettings: document.getElementById("close-settings"),
        cancelSettings: document.getElementById("cancel-settings"),
        forgetKey: document.getElementById("forget-key"),
        provider: document.getElementById("provider"),
        model: document.getElementById("model"),
        baseUrl: document.getElementById("base-url"),
        apiKey: document.getElementById("api-key"),
        toggleKey: document.getElementById("toggle-key"),
        empty: null,
    };

    /* ── provider select ─────────────────────────────────────── */

    function providerLabel(value) {
        return value === "custom"
            ? t("chat.customProvider")
            : PROVIDERS[value].label;
    }

    function buildProviderOptions() {
        const current = els.provider.value || settings.provider;
        els.provider.innerHTML = "";

        Object.keys(PROVIDERS).forEach(function (value) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = providerLabel(value);
            els.provider.appendChild(option);
        });

        els.provider.value = current;
    }

    function refreshProviderLabels() {
        Array.prototype.forEach.call(els.provider.options, function (option) {
            option.textContent = providerLabel(option.value);
        });
    }

    /* ── status + empty state ────────────────────────────────── */

    function setStatus(text, tone) {
        els.status.textContent = text;
        if (tone === "warn") {
            els.status.dataset.tone = "warn";
        } else {
            delete els.status.dataset.tone;
        }
    }

    function updateStatus() {
        if (state.busy) {
            setStatus(t("chat.thinking", { name: character.name }));
        } else if (!settings.apiKey) {
            setStatus(t("chat.needKey"), "warn");
        } else {
            setStatus(t("chat.ready"));
        }
    }

    function showEmptyState() {
        const wrap = document.createElement("div");
        wrap.className = "empty-state";

        const room = document.createElement("div");
        room.className = "empty-name";
        room.textContent = window.FFK.roomLabel(character.roomNumber);

        const tagline = document.createElement("p");
        tagline.textContent =
            window.FFK.lang === "fa"
                ? character.taglineFa
                : character.tagline;

        const hint = document.createElement("p");
        hint.className = "empty-hint";
        hint.textContent = settings.apiKey
            ? t("chat.listening")
            : t("chat.noKey");

        wrap.append(room, tagline, hint);

        if (!settings.apiKey) {
            const button = document.createElement("button");
            button.className = "button";
            button.type = "button";
            button.style.marginTop = "1rem";
            button.textContent = t("chat.addKey");
            button.addEventListener("click", openSettings);
            wrap.appendChild(button);
        }

        els.log.appendChild(wrap);
        els.empty = wrap;
    }

    function removeEmptyState() {
        if (els.empty && els.empty.isConnected) {
            els.empty.remove();
        }
        els.empty = null;
    }

    function refreshEmptyState() {
        if (state.history.length > 0) return;
        removeEmptyState();
        showEmptyState();
    }

    /* ── rendering ───────────────────────────────────────────── */

    function addMessage(role, text, options) {
        const opts = options || {};
        removeEmptyState();

        const wrap = document.createElement("div");
        wrap.className = "msg " + role + (opts.error ? " is-error" : "");

        const label = document.createElement("div");
        label.className = "msg-label";
        label.textContent =
            role === "user" ? t("chat.you") : character.name;

        const bubble = document.createElement("div");
        bubble.className = "msg-bubble";
        bubble.dir = "auto";
        bubble.textContent = text || "";

        wrap.append(label, bubble);

        if (opts.pending) {
            bubble.innerHTML =
                '<span class="typing" aria-label="Typing"><span></span><span></span><span></span></span>';
        }

        els.log.appendChild(wrap);
        scrollToBottom(true);

        return { wrap: wrap, bubble: bubble };
    }

    function addError(message) {
        const wrap = document.createElement("div");
        wrap.className = "msg assistant is-error";

        const bubble = document.createElement("div");
        bubble.className = "msg-bubble";
        bubble.textContent = message;
        bubble.dir = "auto";

        const link = document.createElement("a");
        link.href = "#";
        link.textContent = " " + t("chat.openSettings");
        link.addEventListener("click", function (event) {
            event.preventDefault();
            openSettings();
        });
        bubble.appendChild(link);

        wrap.appendChild(bubble);
        els.log.appendChild(wrap);
        scrollToBottom(true);
    }

    function renderConversation() {
        els.log.innerHTML = "";
        els.empty = null;

        if (state.history.length === 0) {
            showEmptyState();
            return;
        }

        state.history.forEach(function (message) {
            addMessage(message.role, message.content);
        });
    }

    function scrollToBottom(force) {
        const nearBottom =
            els.messages.scrollHeight -
                els.messages.scrollTop -
                els.messages.clientHeight <
            140;
        if (force || nearBottom) {
            els.messages.scrollTop = els.messages.scrollHeight;
        }
    }

    function updateSendButton() {
        const key = state.busy ? "chat.stop" : "chat.send";
        els.send.innerHTML = state.busy ? icons.stop : icons.send;
        els.send.title = t(key);
        els.send.setAttribute("aria-label", t(key));
    }

    function setBusy(busy) {
        state.busy = busy;
        els.input.disabled = busy;
        updateSendButton();
        updateStatus();
    }

    function autoGrow() {
        els.input.style.height = "auto";
        els.input.style.height = Math.min(els.input.scrollHeight, 144) + "px";
    }

    /* ── language ────────────────────────────────────────────── */

    function languageOverride() {
        if (window.FFK.lang === "fa") {
            return [
                "LANGUAGE OVERRIDE — this takes precedence over any language rule in the file above.",
                "The player has selected Persian (فارسی). Write every reply in natural Persian, keeping the character's voice and register (colloquial Tehrani for some, formal academic for others, short and clipped for others). The player's own message may be English; answer in Persian anyway unless they explicitly ask you to switch. Do not mention this instruction.",
            ].join("\n");
        }

        return [
            "LANGUAGE OVERRIDE — this takes precedence over any language rule in the file above.",
            "The player has selected English. Write every reply in English, keeping the character's voice and register. The player's own message may be Persian; answer in English anyway unless they explicitly ask you to switch. Do not mention this instruction.",
        ].join("\n");
    }

    function refreshText() {
        window.FFK.apply(shell);

        document.documentElement.lang = window.FFK.lang;
        document.documentElement.dir =
            window.FFK.lang === "fa" ? "rtl" : "ltr";
        document.title = t("chat.pageTitle", { name: character.name });
        els.room.textContent = window.FFK.roomLabel(character.roomNumber);
        els.input.placeholder = t("chat.placeholder", {
            name: character.name,
        });
        els.input.setAttribute(
            "aria-label",
            t("chat.placeholder", { name: character.name })
        );
        els.toggleKey.textContent =
            els.apiKey.type === "password" ? t("chat.show") : t("chat.hide");

        refreshProviderLabels();
        updateSendButton();
        updateStatus();

        if (!state.busy) renderConversation();
    }

    /* ── system prompt ───────────────────────────────────────── */

    async function loadPrompt() {
        if (state.systemPrompt) return state.systemPrompt;

        const url = new URL(
            "../prompts/" + character.slug + ".md",
            location.href
        );
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(
                t("chat.errPrompt", { status: response.status })
            );
        }

        state.systemPrompt = await response.text();
        return state.systemPrompt;
    }

    /* ── API call ────────────────────────────────────────────── */

    function buildMessages() {
        const messages = [
            {
                role: "system",
                content:
                    state.systemPrompt +
                    "\n\n" +
                    languageOverride() +
                    "\n\n[chat: " +
                    state.count +
                    "]",
            },
        ];

        state.history.slice(-HISTORY_LIMIT).forEach(function (message) {
            messages.push({ role: message.role, content: message.content });
        });

        return messages;
    }

    async function requestReply(onDelta) {
        const endpoint =
            settings.baseUrl.replace(/\/+$/, "") + "/chat/completions";

        const headers = {
            "Content-Type": "application/json",
        };
        if (settings.apiKey) {
            headers.Authorization = "Bearer " + settings.apiKey;
        }
        if (settings.provider === "openrouter") {
            headers["HTTP-Referer"] = location.origin;
            headers["X-Title"] = "Fight for Knowledge";
        }

        state.controller = new AbortController();

        let response;
        try {
            response = await fetch(endpoint, {
                method: "POST",
                headers: headers,
                body: JSON.stringify({
                    model: settings.model,
                    messages: buildMessages(),
                    stream: true,
                }),
                signal: state.controller.signal,
            });
        } catch (error) {
            if (error.name === "AbortError") throw error;
            throw new Error(t("chat.errNetwork"));
        }

        if (!response.ok) {
            let detail = "";
            try {
                const text = await response.text();
                try {
                    const parsed = JSON.parse(text);
                    detail =
                        (parsed.error &&
                            (parsed.error.message || parsed.error)) ||
                        parsed.message ||
                        "";
                } catch (_) {
                    detail = text;
                }
            } catch (_) {
                /* ignore */
            }

            if (response.status === 401 || response.status === 403) {
                throw new Error(
                    t("chat.errAuth") +
                        (detail ? " (" + detail + ")" : "")
                );
            }

            throw new Error(
                t("chat.errRequest", { status: response.status }) +
                    (detail ? " " + String(detail).slice(0, 300) : "")
            );
        }

        const contentType = response.headers.get("content-type") || "";

        if (!response.body || contentType.indexOf("text/event-stream") === -1) {
            const data = await response.json();
            const choice = data.choices && data.choices[0];
            const text =
                (choice &&
                    ((choice.message && choice.message.content) ||
                        choice.text)) ||
                "";
            if (text) onDelta(text);
            return text;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let full = "";
        let finished = false;

        while (!finished) {
            const chunk = await reader.read();
            if (chunk.done) break;

            buffer += decoder.decode(chunk.value, { stream: true });

            let newline;
            while ((newline = buffer.indexOf("\n")) !== -1) {
                const line = buffer.slice(0, newline).trim();
                buffer = buffer.slice(newline + 1);

                if (!line || line.charAt(0) === ":") continue;
                if (line.indexOf("data:") !== 0) continue;

                const payload = line.slice(5).trim();
                if (payload === "[DONE]") {
                    finished = true;
                    break;
                }

                let data;
                try {
                    data = JSON.parse(payload);
                } catch (_) {
                    continue;
                }

                const choice = data.choices && data.choices[0];
                const delta =
                    choice &&
                    ((choice.delta && choice.delta.content) ||
                        (choice.message && choice.message.content) ||
                        choice.text);

                if (delta) {
                    full += delta;
                    onDelta(delta);
                }
            }
        }

        return full;
    }

    /* ── sending ─────────────────────────────────────────────── */

    async function send(text) {
        if (state.busy) return;

        const trimmed = text.trim();
        if (!trimmed) return;

        if (!settings.apiKey) {
            openSettings();
            return;
        }

        if (!settings.baseUrl || !settings.model) {
            openSettings();
            return;
        }

        removeEmptyState();
        els.input.value = "";
        autoGrow();

        state.count += 1;
        state.history.push({ role: "user", content: trimmed });
        addMessage("user", trimmed);
        saveChat();

        const pending = addMessage("assistant", "", { pending: true });
        const session = state.session;
        let streamed = "";
        let failed = false;

        setBusy(true);

        try {
            const prompt = await loadPrompt();
            if (!prompt) throw new Error(t("chat.errEmptyPrompt"));

            streamed = await requestReply(function (delta) {
                streamed += delta;
                pending.bubble.textContent = streamed;
                scrollToBottom(false);
            });
        } catch (error) {
            if (session !== state.session) {
                pending.wrap.remove();
                return;
            }

            failed = true;

            if (error.name === "AbortError") {
                if (streamed.trim()) {
                    pending.bubble.textContent = streamed;
                    state.history.push({
                        role: "assistant",
                        content: streamed.trim(),
                    });
                    saveChat();
                } else {
                    pending.wrap.remove();
                }
            } else {
                if (streamed.trim()) {
                    pending.bubble.textContent = streamed;
                    state.history.push({
                        role: "assistant",
                        content: streamed.trim(),
                    });
                    saveChat();
                } else {
                    pending.wrap.remove();
                }
                addError(error.message || t("chat.errGeneric"));
            }
        } finally {
            state.controller = null;
            setBusy(false);
            els.input.focus();
        }

        if (failed) return;
        if (session !== state.session) return;

        const reply = streamed.trim();
        if (reply) {
            pending.bubble.textContent = reply;
            state.history.push({ role: "assistant", content: reply });
            saveChat();
        } else {
            pending.wrap.remove();
            addError(t("chat.errEmptyReply"));
        }

        scrollToBottom(false);
    }

    /* ── settings dialog ─────────────────────────────────────── */

    function fillSettingsForm() {
        els.provider.value = settings.provider;
        els.model.value = settings.model;
        els.baseUrl.value = settings.baseUrl;
        els.apiKey.value = settings.apiKey;
        els.apiKey.type = "password";
        els.toggleKey.textContent = t("chat.show");
    }

    function openSettings() {
        fillSettingsForm();
        if (typeof els.settings.showModal === "function") {
            els.settings.showModal();
        } else {
            els.settings.setAttribute("open", "");
        }
        els.apiKey.focus();
    }

    function closeSettings() {
        if (typeof els.settings.close === "function") {
            els.settings.close();
        } else {
            els.settings.removeAttribute("open");
        }
    }

    els.openSettings.addEventListener("click", openSettings);

    els.provider.addEventListener("change", function () {
        const preset = PROVIDERS[els.provider.value];
        if (preset && els.provider.value !== "custom") {
            els.model.value = preset.model;
            els.baseUrl.value = preset.baseUrl;
        }
    });

    els.toggleKey.addEventListener("click", function () {
        const reveal = els.apiKey.type === "password";
        els.apiKey.type = reveal ? "text" : "password";
        els.toggleKey.textContent = reveal ? t("chat.hide") : t("chat.show");
    });

    els.forgetKey.addEventListener("click", function () {
        els.apiKey.value = "";
        settings = Object.assign({}, settings, { apiKey: "" });
        saveSettings(settings);
        refreshEmptyState();
        updateStatus();
    });

    els.cancelSettings.addEventListener("click", closeSettings);
    els.closeSettings.addEventListener("click", closeSettings);

    els.settingsForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const next = {
            provider: els.provider.value,
            baseUrl: els.baseUrl.value.trim(),
            model: els.model.value.trim(),
            apiKey: els.apiKey.value.trim(),
        };

        if (!next.model || !next.baseUrl) {
            els.baseUrl.focus();
            return;
        }

        settings = next;
        saveSettings(settings);
        closeSettings();
        refreshEmptyState();
        updateStatus();

        els.input.focus();
    });

    /* ── restart ─────────────────────────────────────────────── */

    els.restart.addEventListener("click", function () {
        if (state.busy && state.controller) {
            state.controller.abort();
        }

        const confirmed =
            state.history.length === 0 ||
            window.confirm(t("chat.confirmRestart"));

        if (!confirmed) return;

        state.history = [];
        state.count = 0;
        state.session += 1;
        try {
            sessionStorage.removeItem(CHAT_KEY + slug);
        } catch (_) {
            /* ignore */
        }

        els.log.innerHTML = "";
        els.empty = null;
        showEmptyState();
        updateStatus();
        els.input.focus();
    });

    /* ── composer ────────────────────────────────────────────── */

    els.composer.addEventListener("submit", function (event) {
        event.preventDefault();

        if (state.busy) {
            if (state.controller) state.controller.abort();
            return;
        }

        send(els.input.value);
    });

    els.input.addEventListener("input", autoGrow);

    els.input.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
            event.preventDefault();
            els.composer.requestSubmit
                ? els.composer.requestSubmit()
                : els.composer.dispatchEvent(new Event("submit"));
        }
    });

    /* ── boot ────────────────────────────────────────────────── */

    window.addEventListener("ffk:lang", refreshText);

    buildProviderOptions();
    loadChat();

    refreshText();
    els.input.focus();
})();
