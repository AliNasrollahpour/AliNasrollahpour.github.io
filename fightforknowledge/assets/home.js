/* ─────────────────────────────────────────────────────────────
   Fight for Knowledge — room picker
   Cards are rendered from characters.js and sorted by room number.
   ───────────────────────────────────────────────────────────── */

(function () {
    "use strict";

    const grid = document.getElementById("rooms");
    if (!grid) return;

    function render() {
        const persian = window.FFK.lang === "fa";

        document.title = window.FFK.t("home.pageTitle");

        grid.innerHTML = "";

        Object.values(window.FFK_CHARACTERS)
            .sort(function (a, b) {
                return a.roomNumber - b.roomNumber;
            })
            .forEach(function (character) {
                const card = document.createElement("a");
                card.className = "character-card";
                card.href = "../" + character.slug + "/";
                card.style.setProperty("--accent", character.accent);

                const top = document.createElement("div");
                top.className = "card-top";

                const avatar = document.createElement("div");
                avatar.className = "avatar";
                avatar.setAttribute("aria-hidden", "true");
                avatar.textContent = character.name.charAt(0);

                const identity = document.createElement("div");

                const name = document.createElement("div");
                name.className = "card-name";
                name.textContent = character.name;

                const room = document.createElement("div");
                room.className = "card-room";
                room.textContent = window.FFK.roomLabel(
                    character.roomNumber
                );

                identity.append(name, room);
                top.append(avatar, identity);

                const tagline = document.createElement("p");
                tagline.className = "card-tagline";
                tagline.textContent = persian
                    ? character.taglineFa
                    : character.tagline;

                const blurb = document.createElement("p");
                blurb.className = "card-blurb";
                blurb.textContent = persian
                    ? character.blurbFa
                    : character.blurb;

                const foot = document.createElement("div");
                foot.className = "card-foot";

                const enter = document.createElement("span");
                enter.className = "card-enter";
                enter.textContent = window.FFK.t("home.enter");
                foot.appendChild(enter);

                card.append(top, tagline, blurb, foot);
                grid.appendChild(card);
            });
    }

    window.addEventListener("ffk:lang", render);

    render();
})();
