// Service worker sejfu: trzyma stan odblokowania w chrome.storage.session
// (czyszczony przy zamknięciu przeglądarki), obsługuje zapis/odczyt wpisów,
// generator haseł oraz "oczekujące zapisy" po wysłaniu formularza logowania.

import {
  PBKDF2_ITERATIONS,
  randomBytes,
  toB64,
  fromB64,
  deriveKey,
  exportKeyB64,
  importKeyB64,
  encryptJSON,
  decryptJSON,
} from "./crypto.js";

// ---------- pomocnicze: klucz sesji ----------

let cachedKey = null;

async function getSessionKey() {
  if (cachedKey) return cachedKey;
  const { sessionKey } = await chrome.storage.session.get("sessionKey");
  if (!sessionKey) return null;
  cachedKey = await importKeyB64(sessionKey);
  return cachedKey;
}

async function setSessionKey(key) {
  cachedKey = key;
  if (key) {
    await chrome.storage.session.set({ sessionKey: await exportKeyB64(key) });
  } else {
    await chrome.storage.session.remove("sessionKey");
  }
}

// ---------- pomocnicze: sejf ----------

async function getVaultMeta() {
  const { vault } = await chrome.storage.local.get("vault");
  return vault || null; // { salt, iterations, iv, data }
}

async function readEntries(key) {
  const vault = await getVaultMeta();
  if (!vault) return [];
  return decryptJSON(key, { iv: vault.iv, data: vault.data });
}

async function writeEntries(key, entries) {
  const vault = await getVaultMeta();
  const encrypted = await encryptJSON(key, entries);
  await chrome.storage.local.set({
    vault: { salt: vault.salt, iterations: vault.iterations, ...encrypted },
  });
}

export function normalizeHost(hostname) {
  return String(hostname || "").toLowerCase().replace(/^www\./, "");
}

function hostFromUrl(url) {
  try {
    return normalizeHost(new URL(url).hostname);
  } catch {
    return "";
  }
}

// ---------- generator haseł ----------

const CHARSETS = {
  lower: "abcdefghijkmnopqrstuvwxyz",
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  digits: "23456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?",
};

function randomInt(maxExclusive) {
  // Losowanie bez obciążenia (rejection sampling).
  const range = 256 - (256 % maxExclusive);
  let byte;
  do {
    byte = crypto.getRandomValues(new Uint8Array(1))[0];
  } while (byte >= range);
  return byte % maxExclusive;
}

function generatePassword(options = {}) {
  const length = Math.min(Math.max(Number(options.length) || 16, 8), 64);
  const classes = ["lower", "upper", "digits", "symbols"].filter(
    (name) => options[name] !== false
  );
  if (classes.length === 0) classes.push("lower", "digits");

  const all = classes.map((name) => CHARSETS[name]).join("");
  const chars = [];
  // Gwarancja co najmniej jednego znaku z każdej wybranej klasy.
  for (const name of classes) {
    const set = CHARSETS[name];
    chars.push(set[randomInt(set.length)]);
  }
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  // Tasowanie Fishera-Yatesa.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// ---------- oczekujące zapisy (po wysłaniu formularza) ----------

const PENDING_TTL_MS = 3 * 60 * 1000;

async function getPendingMap() {
  const { pendingSaves } = await chrome.storage.session.get("pendingSaves");
  return pendingSaves || {};
}

async function setPendingMap(map) {
  await chrome.storage.session.set({ pendingSaves: map });
}

async function setPending(tabId, data) {
  const map = await getPendingMap();
  map[tabId] = { ...data, ts: Date.now() };
  await setPendingMap(map);
}

async function takePending(tabId, { remove } = { remove: false }) {
  const map = await getPendingMap();
  const entry = map[tabId];
  if (entry && Date.now() - entry.ts > PENDING_TTL_MS) {
    delete map[tabId];
    await setPendingMap(map);
    return null;
  }
  if (entry && remove) {
    delete map[tabId];
    await setPendingMap(map);
  }
  return entry || null;
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const map = await getPendingMap();
  if (map[tabId]) {
    delete map[tabId];
    await setPendingMap(map);
  }
});

// ---------- obsługa wiadomości ----------

async function handleMessage(msg, sender) {
  switch (msg.type) {
    case "GET_STATUS": {
      const vault = await getVaultMeta();
      const key = await getSessionKey();
      return { configured: !!vault, unlocked: !!key };
    }

    case "SETUP": {
      if (await getVaultMeta()) return { ok: false, error: "Sejf już istnieje." };
      if (!msg.masterPassword || msg.masterPassword.length < 8) {
        return { ok: false, error: "Hasło główne musi mieć co najmniej 8 znaków." };
      }
      const salt = randomBytes(16);
      const key = await deriveKey(msg.masterPassword, salt, PBKDF2_ITERATIONS);
      const encrypted = await encryptJSON(key, []);
      await chrome.storage.local.set({
        vault: { salt: toB64(salt), iterations: PBKDF2_ITERATIONS, ...encrypted },
      });
      await setSessionKey(key);
      return { ok: true };
    }

    case "UNLOCK": {
      const vault = await getVaultMeta();
      if (!vault) return { ok: false, error: "Sejf nie jest jeszcze skonfigurowany." };
      const key = await deriveKey(msg.masterPassword, fromB64(vault.salt), vault.iterations);
      try {
        await decryptJSON(key, { iv: vault.iv, data: vault.data });
      } catch {
        return { ok: false, error: "Nieprawidłowe hasło główne." };
      }
      await setSessionKey(key);
      return { ok: true };
    }

    case "LOCK": {
      await setSessionKey(null);
      return { ok: true };
    }

    case "GENERATE_PASSWORD": {
      return { ok: true, password: generatePassword(msg.options || {}) };
    }

    // Lista dopasowań dla strony — bez haseł (te wydaje dopiero FILL_CREDENTIAL).
    case "GET_CREDENTIALS_FOR_HOST": {
      const key = await getSessionKey();
      if (!key) return { ok: false, locked: true };
      const host = normalizeHost(msg.host);
      const entries = await readEntries(key);
      const matches = entries
        .filter((e) => e.host === host)
        .map((e) => ({ id: e.id, username: e.username }));
      return { ok: true, matches };
    }

    case "FILL_CREDENTIAL": {
      const key = await getSessionKey();
      if (!key) return { ok: false, locked: true };
      const entries = await readEntries(key);
      const entry = entries.find((e) => e.id === msg.id);
      if (!entry) return { ok: false, error: "Nie znaleziono wpisu." };
      // Hasło trafia wyłącznie do strony o tym samym hoście, dla którego je zapisano.
      const senderHost = hostFromUrl(sender?.url || sender?.tab?.url || "");
      if (sender?.tab && senderHost !== entry.host) {
        return { ok: false, error: "Wpis nie pasuje do tej strony." };
      }
      return { ok: true, username: entry.username, password: entry.password };
    }

    case "SAVE_CREDENTIAL": {
      const key = await getSessionKey();
      if (!key) return { ok: false, locked: true };
      const host = normalizeHost(msg.entry.host);
      if (!host || !msg.entry.password) {
        return { ok: false, error: "Brak wymaganych danych." };
      }
      const entries = await readEntries(key);
      const existing = entries.find(
        (e) => e.host === host && e.username === (msg.entry.username || "")
      );
      const now = Date.now();
      if (existing) {
        existing.password = msg.entry.password;
        existing.url = msg.entry.url || existing.url;
        existing.updatedAt = now;
      } else {
        entries.push({
          id: crypto.randomUUID(),
          host,
          url: msg.entry.url || "",
          username: msg.entry.username || "",
          password: msg.entry.password,
          createdAt: now,
          updatedAt: now,
        });
      }
      await writeEntries(key, entries);
      return { ok: true, updated: !!existing };
    }

    case "LIST_CREDENTIALS": {
      const key = await getSessionKey();
      if (!key) return { ok: false, locked: true };
      const entries = await readEntries(key);
      entries.sort((a, b) => a.host.localeCompare(b.host));
      return { ok: true, entries };
    }

    case "DELETE_CREDENTIAL": {
      const key = await getSessionKey();
      if (!key) return { ok: false, locked: true };
      const entries = await readEntries(key);
      await writeEntries(key, entries.filter((e) => e.id !== msg.id));
      return { ok: true };
    }

    // Strona zgłasza wysłany formularz z danymi logowania.
    case "PENDING_SAVE_SET": {
      const tabId = sender?.tab?.id;
      if (tabId == null || !msg.data?.password) return { ok: false };
      const host = hostFromUrl(sender.tab.url || msg.data.url || "");
      await setPending(tabId, {
        host,
        url: msg.data.url || sender.tab.url || "",
        username: msg.data.username || "",
        password: msg.data.password,
      });
      return { ok: true };
    }

    // Strona (po przeładowaniu) pyta, czy ma o coś dopytać użytkownika.
    case "PENDING_SAVE_GET": {
      const tabId = msg.tabId ?? sender?.tab?.id;
      if (tabId == null) return { ok: true, pending: null };
      const pending = await takePending(tabId);
      if (!pending) return { ok: true, pending: null };
      const key = await getSessionKey();
      if (!key) return { ok: true, pending: { host: pending.host, username: pending.username }, locked: true };
      // Nie pytamy ponownie, jeśli identyczny wpis już istnieje.
      const entries = await readEntries(key);
      const existing = entries.find(
        (e) => e.host === pending.host && e.username === pending.username
      );
      if (existing && existing.password === pending.password) {
        await takePending(tabId, { remove: true });
        return { ok: true, pending: null };
      }
      return {
        ok: true,
        pending: { host: pending.host, username: pending.username, update: !!existing },
      };
    }

    case "PENDING_SAVE_RESOLVE": {
      const tabId = msg.tabId ?? sender?.tab?.id;
      if (tabId == null) return { ok: false };
      const pending = await takePending(tabId, { remove: true });
      if (!pending) return { ok: false, error: "Brak oczekującego zapisu." };
      if (!msg.accept) return { ok: true, saved: false };
      return handleMessage(
        { type: "SAVE_CREDENTIAL", entry: pending },
        sender
      ).then((res) => ({ ...res, saved: res.ok }));
    }

    // Popup: lista wszystkich oczekujących zapisów (np. gdy sejf był zablokowany).
    case "PENDING_SAVE_LIST": {
      const map = await getPendingMap();
      const list = Object.entries(map)
        .filter(([, p]) => Date.now() - p.ts <= PENDING_TTL_MS)
        .map(([tabId, p]) => ({ tabId: Number(tabId), host: p.host, username: p.username }));
      return { ok: true, list };
    }

    default:
      return { ok: false, error: "Nieznany typ wiadomości: " + msg.type };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender)
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, error: String(err) }));
  return true; // odpowiedź asynchroniczna
});
