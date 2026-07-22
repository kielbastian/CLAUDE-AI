// Content script Sejfu Haseł.
// - wykrywa formularze logowania/rejestracji,
// - proponuje wygenerowane hasło przy polach "nowe hasło",
// - pyta, czy uzupełnić zapisane dane logowania,
// - po wysłaniu formularza pyta, czy zapisać login i hasło.

(() => {
  "use strict";

  const USERNAME_HINT = /user|login|email|e-mail|mail|konto|uzytkownik|użytkownik|nick|identyf/i;
  const REGISTER_HINT = /regist|sign-?up|signup|rejestr|zarejestr|create-?account|nowe-?konto|join/i;

  const state = {
    unlocked: false,
    configured: false,
    fillBarShown: false,
    saveBarShown: false,
    dismissedFill: false,
  };

  function send(msg) {
    return chrome.runtime.sendMessage(msg).catch(() => null);
  }

  function currentHost() {
    return location.hostname.toLowerCase().replace(/^www\./, "");
  }

  // ---------- interfejs (shadow DOM, odporny na style strony) ----------

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", Arial, sans-serif; }
    .bar {
      position: fixed; top: 16px; right: 16px; z-index: 2147483647;
      max-width: 360px; background: #1f2937; color: #f9fafb;
      border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,.35);
      padding: 14px 16px; font-size: 14px; line-height: 1.45;
    }
    .bar + .bar { top: auto; }
    .title { font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
    .title .logo { font-size: 15px; }
    .row { margin: 10px 0 0; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    button {
      border: 0; border-radius: 7px; padding: 7px 12px; font-size: 13px;
      cursor: pointer; font-weight: 600;
    }
    .primary { background: #2563eb; color: #fff; }
    .primary:hover { background: #1d4ed8; }
    .ghost { background: #374151; color: #e5e7eb; }
    .ghost:hover { background: #4b5563; }
    select {
      width: 100%; margin-top: 8px; padding: 6px 8px; border-radius: 7px;
      border: 1px solid #4b5563; background: #111827; color: #f9fafb; font-size: 13px;
    }
    .bubble {
      position: absolute; z-index: 2147483647;
      background: #1f2937; color: #f9fafb; border-radius: 10px;
      box-shadow: 0 6px 24px rgba(0,0,0,.35); padding: 12px 14px;
      font-size: 13px; max-width: 320px;
    }
    .pass {
      font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 14px;
      background: #111827; border-radius: 7px; padding: 7px 9px; margin-top: 8px;
      word-break: break-all; user-select: all;
    }
    .muted { color: #9ca3af; font-size: 12px; margin-top: 6px; }
  `;

  let shadowRoot = null;

  function ui() {
    if (shadowRoot) return shadowRoot;
    const host = document.createElement("div");
    host.id = "sejf-hasel-host";
    shadowRoot = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = CSS;
    shadowRoot.append(style);
    (document.body || document.documentElement).append(host);
    return shadowRoot;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // ---------- wykrywanie pól ----------

  function isVisible(input) {
    return !!(input.offsetWidth || input.offsetHeight || input.getClientRects().length);
  }

  function passwordFields(root) {
    return [...root.querySelectorAll('input[type="password"]')].filter(isVisible);
  }

  function containerOf(input) {
    return input.form || input.closest("form") || document;
  }

  function findUsernameField(container, passwordInput) {
    const candidates = [
      ...container.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input:not([type])'),
    ].filter(isVisible);
    if (!candidates.length) return null;
    const before = candidates.filter(
      (c) => passwordInput.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_PRECEDING
    );
    const pool = before.length ? before : candidates;
    const scored = pool.filter((c) => {
      const meta = `${c.name} ${c.id} ${c.autocomplete} ${c.placeholder}`;
      return c.type === "email" || c.autocomplete === "username" || USERNAME_HINT.test(meta);
    });
    const chosen = scored.length ? scored[scored.length - 1] : pool[pool.length - 1];
    return chosen || null;
  }

  function isNewPasswordContext(passwordInput) {
    if (passwordInput.autocomplete === "new-password") return true;
    const container = containerOf(passwordInput);
    if (passwordFields(container).length >= 2) return true;
    const meta = [
      container instanceof HTMLFormElement ? container.action : "",
      container instanceof HTMLFormElement ? container.id + " " + container.className : "",
      location.href,
    ].join(" ");
    return REGISTER_HINT.test(meta);
  }

  function setFieldValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // ---------- dymek: propozycja hasła ----------

  let bubble = null;

  function closeBubble() {
    bubble?.remove();
    bubble = null;
  }

  async function showSuggestionBubble(passwordInput) {
    if (!state.configured) return;
    closeBubble();
    const res = await send({ type: "GENERATE_PASSWORD", options: { length: 18 } });
    if (!res?.ok) return;

    const root = ui();
    bubble = el("div", "bubble");
    const rect = passwordInput.getBoundingClientRect();
    bubble.style.left = Math.max(8, rect.left + scrollX) + "px";
    bubble.style.top = rect.bottom + scrollY + 6 + "px";

    const title = el("div", "title");
    title.append(el("span", "logo", "\u{1F511}"), el("span", null, "Proponowane silne hasło"));
    const passBox = el("div", "pass", res.password);
    const hint = el("div", "muted", "Po zapisaniu formularza zapytam, czy zachować je w sejfie.");
    const row = el("div", "row");
    const useBtn = el("button", "primary", "Użyj hasła");
    const againBtn = el("button", "ghost", "Wygeneruj inne");
    const closeBtn = el("button", "ghost", "Zamknij");
    row.append(useBtn, againBtn, closeBtn);
    bubble.append(title, passBox, hint, row);
    root.append(bubble);

    useBtn.addEventListener("click", () => {
      for (const field of passwordFields(containerOf(passwordInput))) {
        setFieldValue(field, passBox.textContent);
      }
      closeBubble();
    });
    againBtn.addEventListener("click", async () => {
      const next = await send({ type: "GENERATE_PASSWORD", options: { length: 18 } });
      if (next?.ok) passBox.textContent = next.password;
    });
    closeBtn.addEventListener("click", closeBubble);
  }

  document.addEventListener(
    "focusin",
    (event) => {
      const input = event.target;
      if (
        input instanceof HTMLInputElement &&
        input.type === "password" &&
        !input.value &&
        isNewPasswordContext(input)
      ) {
        showSuggestionBubble(input);
      }
    },
    true
  );

  document.addEventListener(
    "focusout",
    () => setTimeout(() => {
      if (bubble && !bubble.matches(":hover")) closeBubble();
    }, 250),
    true
  );

  // ---------- pasek: pytanie o autouzupełnienie ----------

  async function maybeOfferFill() {
    if (state.fillBarShown || state.dismissedFill || !state.unlocked) return;
    const loginFields = passwordFields(document).filter((f) => !isNewPasswordContext(f));
    if (!loginFields.length) return;

    const res = await send({ type: "GET_CREDENTIALS_FOR_HOST", host: currentHost() });
    if (!res?.ok || !res.matches?.length) return;

    state.fillBarShown = true;
    const root = ui();
    const bar = el("div", "bar");
    const title = el("div", "title");
    title.append(el("span", "logo", "\u{1F510}"), el("span", null, "Sejf Haseł"));
    const question = el(
      "div",
      null,
      `Uzupełnić login i hasło dla ${currentHost()}?`
    );
    bar.append(title, question);

    let select = null;
    if (res.matches.length > 1) {
      select = el("select");
      for (const match of res.matches) {
        const option = el("option", null, match.username || "(bez loginu)");
        option.value = match.id;
        select.append(option);
      }
      bar.append(select);
    }

    const row = el("div", "row");
    const fillBtn = el("button", "primary", "Uzupełnij");
    const noBtn = el("button", "ghost", "Nie teraz");
    row.append(fillBtn, noBtn);
    bar.append(row);
    root.append(bar);

    fillBtn.addEventListener("click", async () => {
      const id = select ? select.value : res.matches[0].id;
      const cred = await send({ type: "FILL_CREDENTIAL", id });
      if (cred?.ok) fillLoginForm(cred.username, cred.password, loginFields[0]);
      bar.remove();
    });
    noBtn.addEventListener("click", () => {
      state.dismissedFill = true;
      bar.remove();
    });
  }

  function fillLoginForm(username, password, passwordInput) {
    setFieldValue(passwordInput, password);
    if (username) {
      const usernameField = findUsernameField(containerOf(passwordInput), passwordInput);
      if (usernameField) setFieldValue(usernameField, username);
    }
  }

  // ---------- przechwytywanie wysłania formularza ----------

  function captureCredentials(sourceNode) {
    const container = sourceNode instanceof HTMLFormElement ? sourceNode : containerOf(sourceNode);
    const passwords = passwordFields(container).filter((f) => f.value);
    if (!passwords.length) return;
    // Przy rejestracji (2 pola hasła) bierzemy pierwsze — to jest właściwe hasło.
    const password = passwords[0].value;
    const usernameField = findUsernameField(container, passwords[0]);
    send({
      type: "PENDING_SAVE_SET",
      data: {
        url: location.href,
        username: usernameField?.value || "",
        password,
      },
    });
    // Jeśli strona nie przeładuje się (SPA), sami dopytamy o zapis.
    setTimeout(maybeOfferSave, 1600);
  }

  document.addEventListener(
    "submit",
    (event) => {
      if (event.target instanceof HTMLFormElement) captureCredentials(event.target);
    },
    true
  );

  document.addEventListener(
    "click",
    (event) => {
      const btn = event.target instanceof Element
        ? event.target.closest('button, input[type="submit"], [role="button"]')
        : null;
      if (btn) captureCredentials(btn);
    },
    true
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Enter" &&
        event.target instanceof HTMLInputElement &&
        event.target.type === "password"
      ) {
        captureCredentials(event.target);
      }
    },
    true
  );

  // ---------- pasek: pytanie o zapis hasła ----------

  async function maybeOfferSave() {
    if (state.saveBarShown) return;
    const res = await send({ type: "PENDING_SAVE_GET" });
    if (!res?.ok || !res.pending) return;

    state.saveBarShown = true;
    const root = ui();
    const bar = el("div", "bar");
    const title = el("div", "title");
    title.append(el("span", "logo", "\u{1F4BE}"), el("span", null, "Sejf Haseł"));

    if (res.locked) {
      bar.append(
        title,
        el(
          "div",
          null,
          `Wykryto dane logowania dla ${res.pending.host}. Otwórz Sejf Haseł (ikona rozszerzenia) i odblokuj go, aby je zapisać.`
        )
      );
      const row = el("div", "row");
      const okBtn = el("button", "ghost", "OK");
      row.append(okBtn);
      bar.append(row);
      root.append(bar);
      okBtn.addEventListener("click", () => bar.remove());
      return;
    }

    const who = res.pending.username ? ` (login: ${res.pending.username})` : "";
    const question = res.pending.update
      ? `Zaktualizować zapisane hasło dla ${res.pending.host}${who}?`
      : `Zapisać hasło dla ${res.pending.host}${who}?`;
    bar.append(title, el("div", null, question));

    const row = el("div", "row");
    const saveBtn = el("button", "primary", res.pending.update ? "Zaktualizuj" : "Zapisz");
    const noBtn = el("button", "ghost", "Nie zapisuj");
    row.append(saveBtn, noBtn);
    bar.append(row);
    root.append(bar);

    saveBtn.addEventListener("click", async () => {
      await send({ type: "PENDING_SAVE_RESOLVE", accept: true });
      bar.remove();
    });
    noBtn.addEventListener("click", async () => {
      await send({ type: "PENDING_SAVE_RESOLVE", accept: false });
      bar.remove();
    });
  }

  // ---------- start ----------

  let scanScheduled = false;

  async function scan() {
    scanScheduled = false;
    const status = await send({ type: "GET_STATUS" });
    if (!status) return;
    state.configured = status.configured;
    state.unlocked = status.unlocked;
    await maybeOfferFill();
  }

  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    setTimeout(scan, 500);
  }

  new MutationObserver(scheduleScan).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Po powrocie na kartę (np. po odblokowaniu sejfu w popupie) sprawdzamy ponownie.
  window.addEventListener("focus", scheduleScan);

  scan();
  if (window === window.top) {
    // Po przejściu na kolejną stronę pytamy o zapis danych z poprzedniego formularza.
    maybeOfferSave();
  }
})();
