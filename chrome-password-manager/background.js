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
import * as drive from "./drive.js";
import { VAULT_FORMAT, mergeEntries, purgeTombstones } from "./sync.js";

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
  const encrypted = await encryptJSON(key, purgeTombstones(entries));
  await chrome.storage.local.set({
    vault: { salt: vault.salt, iterations: vault.iterations, ...encrypted },
  });
}

// ---------- synchronizacja z Dyskiem Google ----------

async function buildVaultPayload(key, entries) {
  const vault = await getVaultMeta();
  const encrypted = await encryptJSON(key, purgeTombstones(entries));
  return {
    format: VAULT_FORMAT,
    salt: vault.salt,
    iterations: vault.iterations,
    ...encrypted,
    updatedAt: Date.now(),
  };
}

async function syncNow(key) {
  const token = await drive.getToken(false);
  const folderId = await drive.ensureFolder(token);
  const file = await drive.findVaultFile(token, folderId);
  const localVault = await getVaultMeta();
  const localEntries = await readEntries(key);

  if (!file) {
    await drive.uploadVault(token, folderId, null, await buildVaultPayload(key, localEntries));
    return;
  }

  const remote = await drive.downloadVault(token, file.id);
  if (remote.salt !== localVault.salt) {
    throw new Error(
      'Sejf na Dysku pochodzi z innej konfiguracji — użyj "Połącz z Dyskiem Google" ponownie, aby je powiązać.'
    );
  }
  const remoteEntries = await decryptJSON(key, { iv: remote.iv, data: remote.data });
  const { merged, localChanged, remoteChanged } = mergeEntries(localEntries, remoteEntries);
  if (localChanged) await writeEntries(key, merged);
  if (remoteChanged) {
    await drive.uploadVault(token, folderId, file.id, await buildVaultPayload(key, merged));
  }
}

let syncTimer = null;

function scheduleSync(delayMs = 2000) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    syncIfEnabled();
  }, delayMs);
}

async function syncIfEnabled() {
  const { driveEnabled } = await chrome.storage.local.get("driveEnabled");
  if (!driveEnabled) return;
  const key = await getSessionKey();
  if (!key) return;
  try {
    await syncNow(key);
    await chrome.storage.local.set({ driveLastSync: Date.now(), driveLastError: null });
  } catch (err) {
    await chrome.storage.local.set({ driveLastError: String(err?.message || err) });
  }
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
      scheduleSync(500);
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
        .filter((e) => e.host === host && !e.deleted)
        .map((e) => ({ id: e.id, username: e.username }));
      return { ok: true, matches };
    }

    case "FILL_CREDENTIAL": {
      const key = await getSessionKey();
      if (!key) return { ok: false, locked: true };
      const entries = await readEntries(key);
      const entry = entries.find((e) => e.id === msg.id && !e.deleted);
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
      const wasUpdate = !!existing && !existing.deleted;
      if (existing) {
        existing.password = msg.entry.password;
        existing.url = msg.entry.url || existing.url;
        existing.deleted = false;
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
      scheduleSync();
      return { ok: true, updated: wasUpdate };
    }

    case "LIST_CREDENTIALS": {
      const key = await getSessionKey();
      if (!key) return { ok: false, locked: true };
      const entries = (await readEntries(key)).filter((e) => !e.deleted);
      entries.sort((a, b) => a.host.localeCompare(b.host));
      return { ok: true, entries };
    }

    case "DELETE_CREDENTIAL": {
      const key = await getSessionKey();
      if (!key) return { ok: false, locked: true };
      const entries = await readEntries(key);
      const entry = entries.find((e) => e.id === msg.id);
      if (entry) {
        // Nagrobek zamiast twardego usunięcia — żeby kasowanie
        // zsynchronizowało się na pozostałe urządzenia.
        entry.deleted = true;
        entry.updatedAt = Date.now();
        await writeEntries(key, entries);
        scheduleSync();
      }
      return { ok: true };
    }

    case "DRIVE_STATUS": {
      const data = await chrome.storage.local.get([
        "driveEnabled",
        "driveLastSync",
        "driveLastError",
      ]);
      const clientId = chrome.runtime.getManifest().oauth2?.client_id || "";
      return {
        ok: true,
        enabled: !!data.driveEnabled,
        lastSync: data.driveLastSync || null,
        lastError: data.driveLastError || null,
        needsClientId: clientId.startsWith("WPISZ"),
      };
    }

    case "DRIVE_CONNECT": {
      const localVault = await getVaultMeta();
      if (!localVault) return { ok: false, error: "Najpierw utwórz sejf." };

      // Weryfikacja hasła głównego na lokalnym sejfie.
      const localKey = await deriveKey(
        msg.masterPassword,
        fromB64(localVault.salt),
        localVault.iterations
      );
      let localEntries;
      try {
        localEntries = await decryptJSON(localKey, {
          iv: localVault.iv,
          data: localVault.data,
        });
      } catch {
        return { ok: false, error: "Nieprawidłowe hasło główne." };
      }

      let token;
      try {
        token = await drive.getToken(true);
      } catch (err) {
        return { ok: false, error: String(err?.message || err) };
      }
      const folderId = await drive.ensureFolder(token);
      const file = await drive.findVaultFile(token, folderId);

      if (file) {
        // Na Dysku jest już sejf (np. z telefonu) — scalamy i przejmujemy
        // jego sól jako wspólną dla wszystkich urządzeń.
        const remote = await drive.downloadVault(token, file.id);
        const remoteKey =
          remote.salt === localVault.salt
            ? localKey
            : await deriveKey(
                msg.masterPassword,
                fromB64(remote.salt),
                remote.iterations || PBKDF2_ITERATIONS
              );
        let remoteEntries;
        try {
          remoteEntries = await decryptJSON(remoteKey, {
            iv: remote.iv,
            data: remote.data,
          });
        } catch {
          return {
            ok: false,
            error:
              "Sejf na Dysku Google jest zaszyfrowany innym hasłem głównym. Użyj tego samego hasła na obu urządzeniach.",
          };
        }
        const { merged } = mergeEntries(localEntries, remoteEntries);
        const encrypted = await encryptJSON(remoteKey, purgeTombstones(merged));
        await chrome.storage.local.set({
          vault: {
            salt: remote.salt,
            iterations: remote.iterations || PBKDF2_ITERATIONS,
            ...encrypted,
          },
        });
        await setSessionKey(remoteKey);
        await drive.uploadVault(token, folderId, file.id, {
          format: VAULT_FORMAT,
          salt: remote.salt,
          iterations: remote.iterations || PBKDF2_ITERATIONS,
          ...(await encryptJSON(remoteKey, purgeTombstones(merged))),
          updatedAt: Date.now(),
        });
      } else {
        await setSessionKey(localKey);
        await drive.uploadVault(token, folderId, null, {
          format: VAULT_FORMAT,
          salt: localVault.salt,
          iterations: localVault.iterations,
          iv: localVault.iv,
          data: localVault.data,
          updatedAt: Date.now(),
        });
      }

      await chrome.storage.local.set({
        driveEnabled: true,
        driveLastSync: Date.now(),
        driveLastError: null,
      });
      return { ok: true };
    }

    case "DRIVE_SYNC": {
      const key = await getSessionKey();
      if (!key) return { ok: false, locked: true };
      const { driveEnabled } = await chrome.storage.local.get("driveEnabled");
      if (!driveEnabled) return { ok: false, error: "Dysk Google nie jest połączony." };
      try {
        await syncNow(key);
        await chrome.storage.local.set({ driveLastSync: Date.now(), driveLastError: null });
        return { ok: true };
      } catch (err) {
        const error = String(err?.message || err);
        await chrome.storage.local.set({ driveLastError: error });
        return { ok: false, error };
      }
    }

    case "DRIVE_DISCONNECT": {
      await chrome.storage.local.set({ driveEnabled: false, driveLastError: null });
      try {
        const token = await drive.getToken(false);
        await new Promise((resolve) =>
          chrome.identity.removeCachedAuthToken({ token }, resolve)
        );
      } catch {
        // brak tokenu — nic do wyczyszczenia
      }
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
        (e) => e.host === pending.host && e.username === pending.username && !e.deleted
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
