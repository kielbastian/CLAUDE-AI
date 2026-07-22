// Sejf Haseł — aplikacja mobilna (PWA).
// Czyta i zapisuje ten sam zaszyfrowany plik sejfu na Dysku Google,
// którego używa rozszerzenie Chrome na komputerze.

"use strict";

// ================= kryptografia (identyczna jak w rozszerzeniu) =================

const PBKDF2_ITERATIONS = 310000;
const VAULT_FORMAT = "sejf-hasel/1";
const FOLDER_NAME = "Sejf Haseł";
const FILE_NAME = "sejf-hasel.vault.json";
const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function toB64(bytes) {
  let binary = "";
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

function fromB64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(masterPassword, saltBytes, iterations) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(masterPassword),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptJSON(key, obj) {
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(obj))
  );
  return { iv: toB64(iv), data: toB64(ciphertext) };
}

async function decryptJSON(key, payload) {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(payload.iv) },
    key,
    fromB64(payload.data)
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

// ================= scalanie wpisów (identyczne jak w rozszerzeniu) =================

function purgeTombstones(entries, now = Date.now()) {
  return entries.filter((e) => !e.deleted || now - (e.updatedAt || 0) < TOMBSTONE_TTL_MS);
}

function mergeEntries(local, remote) {
  const byId = new Map();
  for (const entry of [...local, ...remote]) {
    const prev = byId.get(entry.id);
    if (!prev || (entry.updatedAt || 0) > (prev.updatedAt || 0)) {
      byId.set(entry.id, { ...entry });
    }
  }
  const byAccount = new Map();
  for (const entry of byId.values()) {
    if (entry.deleted) continue;
    const accountKey = `${entry.host}\n${entry.username || ""}`;
    const prev = byAccount.get(accountKey);
    if (!prev) {
      byAccount.set(accountKey, entry);
    } else if ((entry.updatedAt || 0) > (prev.updatedAt || 0)) {
      prev.deleted = true;
      byAccount.set(accountKey, entry);
    } else {
      entry.deleted = true;
    }
  }
  const merged = purgeTombstones([...byId.values()]).sort(
    (a, b) =>
      (a.host || "").localeCompare(b.host || "") ||
      (a.username || "").localeCompare(b.username || "")
  );
  const fingerprint = (arr) =>
    JSON.stringify(
      [...arr]
        .sort((a, b) => String(a.id).localeCompare(String(b.id)))
        .map((e) => [e.id, e.updatedAt, e.deleted ? 1 : 0, e.password, e.username, e.host])
    );
  const mergedFp = fingerprint(merged);
  return {
    merged,
    localChanged: mergedFp !== fingerprint(local),
    remoteChanged: mergedFp !== fingerprint(remote),
  };
}

// ================= generator haseł =================

const CHARSETS = {
  lower: "abcdefghijkmnopqrstuvwxyz",
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  digits: "23456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?",
};

function randomInt(maxExclusive) {
  const range = 256 - (256 % maxExclusive);
  let byte;
  do {
    byte = crypto.getRandomValues(new Uint8Array(1))[0];
  } while (byte >= range);
  return byte % maxExclusive;
}

function generatePassword(options = {}) {
  const length = Math.min(Math.max(Number(options.length) || 16, 8), 64);
  const classes = ["lower", "upper", "digits", "symbols"].filter((n) => options[n] !== false);
  if (classes.length === 0) classes.push("lower", "digits");
  const all = classes.map((n) => CHARSETS[n]).join("");
  const chars = [];
  for (const name of classes) {
    const set = CHARSETS[name];
    chars.push(set[randomInt(set.length)]);
  }
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// ================= Dysk Google (GIS + Drive API) =================

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const SCOPE = "https://www.googleapis.com/auth/drive.file";

const app = {
  clientId: localStorage.getItem("sh_clientId") || "",
  tokenClient: null,
  accessToken: null,
  key: null,
  entries: [],
  vaultMeta: null, // { salt, iterations }
  folderId: null,
  fileId: null,
  offline: false,
  createMode: false,
  syncTimer: null,
};

function requestToken(promptMode) {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error("Nie udało się załadować logowania Google. Sprawdź połączenie z internetem."));
      return;
    }
    if (!app.tokenClient) {
      app.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: app.clientId,
        scope: SCOPE,
        callback: (resp) => app.onToken?.(resp),
        error_callback: (err) => app.onTokenError?.(err),
      });
    }
    app.onToken = (resp) => {
      if (resp.error) reject(new Error("Logowanie Google: " + resp.error));
      else {
        app.accessToken = resp.access_token;
        resolve(resp.access_token);
      }
    };
    app.onTokenError = (err) =>
      reject(new Error("Logowanie Google: " + (err?.message || err?.type || "błąd")));
    app.tokenClient.requestAccessToken({ prompt: promptMode });
  });
}

async function driveFetch(url, options = {}, retried = false) {
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${app.accessToken}`, ...(options.headers || {}) },
  });
  if (res.status === 401 && !retried) {
    await requestToken(""); // ciche odświeżenie tokenu
    return driveFetch(url, options, true);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Dysk Google: błąd ${res.status}. ${body.slice(0, 200)}`);
  }
  return res;
}

async function ensureFolder() {
  if (app.folderId) return app.folderId;
  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const res = await driveFetch(`${API}/files?q=${q}&fields=files(id)`);
  const { files } = await res.json();
  if (files?.length) {
    app.folderId = files[0].id;
  } else {
    const createRes = await driveFetch(`${API}/files?fields=id`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
    });
    app.folderId = (await createRes.json()).id;
  }
  return app.folderId;
}

async function findVaultFile() {
  const folderId = await ensureFolder();
  const q = encodeURIComponent(
    `name='${FILE_NAME}' and '${folderId}' in parents and trashed=false`
  );
  const res = await driveFetch(`${API}/files?q=${q}&fields=files(id,modifiedTime)`);
  const { files } = await res.json();
  app.fileId = files?.[0]?.id || null;
  return files?.[0] || null;
}

async function downloadVault() {
  const res = await driveFetch(`${API}/files/${app.fileId}?alt=media`);
  return res.json();
}

async function uploadVault(payload) {
  const body = JSON.stringify(payload);
  if (app.fileId) {
    await driveFetch(`${UPLOAD_API}/files/${app.fileId}?uploadType=media&fields=id`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return;
  }
  const folderId = await ensureFolder();
  const boundary = "sejfhasel" + Math.random().toString(36).slice(2);
  const multipart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: FILE_NAME, parents: [folderId] }) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    body +
    `\r\n--${boundary}--`;
  const res = await driveFetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body: multipart,
  });
  app.fileId = (await res.json()).id;
}

async function buildPayload() {
  const encrypted = await encryptJSON(app.key, purgeTombstones(app.entries));
  return {
    format: VAULT_FORMAT,
    salt: app.vaultMeta.salt,
    iterations: app.vaultMeta.iterations,
    ...encrypted,
    updatedAt: Date.now(),
  };
}

function cachePayload(payload) {
  localStorage.setItem("sh_vaultCache", JSON.stringify(payload));
}

function cachedPayload() {
  try {
    return JSON.parse(localStorage.getItem("sh_vaultCache"));
  } catch {
    return null;
  }
}

// Pełna synchronizacja: pobierz -> scal -> wyślij (jeśli coś się zmieniło).
async function syncNow() {
  if (app.offline || !app.key) return;
  setSyncStatus("Synchronizowanie…");
  try {
    const file = await findVaultFile();
    if (!file) {
      await uploadVault(await buildPayload());
    } else {
      const remote = await downloadVault();
      if (remote.salt !== app.vaultMeta.salt) {
        throw new Error("Sejf na Dysku został utworzony na nowo — zaloguj się ponownie.");
      }
      const remoteEntries = await decryptJSON(app.key, { iv: remote.iv, data: remote.data });
      const { merged, localChanged, remoteChanged } = mergeEntries(app.entries, remoteEntries);
      app.entries = merged;
      if (remoteChanged) await uploadVault(await buildPayload());
      if (localChanged) paintEntries();
    }
    cachePayload(await buildPayload());
    setSyncStatus("Zsynchronizowano: " + new Date().toLocaleTimeString("pl-PL"));
  } catch (err) {
    setSyncStatus("⚠️ " + (err?.message || "Błąd synchronizacji"));
  }
}

async function persistAndSync() {
  cachePayload(await buildPayload());
  paintEntries();
  if (!app.offline) syncNow();
}

// ================= interfejs =================

const $ = (id) => document.getElementById(id);

function show(viewId) {
  for (const id of ["viewConfig", "viewConnect", "viewUnlock", "viewMain"]) {
    $(id).classList.toggle("hidden", id !== viewId);
  }
  $("lockBtn").classList.toggle("hidden", viewId !== "viewMain");
}

function showError(id, message) {
  const node = $(id);
  node.textContent = message || "";
  node.classList.toggle("hidden", !message);
}

function setSyncStatus(text) {
  $("syncStatus").textContent = app.offline ? "Tryb offline (tylko odczyt kopii)" : text;
}

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    const original = button.textContent;
    button.textContent = "✓";
    setTimeout(() => (button.textContent = original), 900);
  } catch {
    prompt("Skopiuj ręcznie:", text);
  }
}

// ---------- krok 1: client ID ----------

$("clientIdSaveBtn").addEventListener("click", () => {
  // Usuwamy wszystkie odstępy — klawiatury mobilne często wstawiają spacje.
  const value = $("clientIdInput").value.replace(/\s+/g, "");
  if (!value.endsWith(".apps.googleusercontent.com")) {
    return showError("configError", "To nie wygląda na identyfikator klienta OAuth (powinien kończyć się na .apps.googleusercontent.com).");
  }
  app.clientId = value;
  localStorage.setItem("sh_clientId", value);
  showError("configError", "");
  startConnectView();
});

$("changeClientId").addEventListener("click", (e) => {
  e.preventDefault();
  $("clientIdInput").value = app.clientId;
  show("viewConfig");
});

// ---------- krok 2: logowanie ----------

function startConnectView() {
  show("viewConnect");
  $("offlineBtn").classList.toggle("hidden", !cachedPayload());
}

$("connectBtn").addEventListener("click", async () => {
  showError("connectError", "");
  try {
    await requestToken(""); // najpierw próba bez okna zgody
  } catch {
    try {
      await requestToken("consent");
    } catch (err) {
      return showError("connectError", err.message);
    }
  }
  try {
    const file = await findVaultFile();
    if (file) {
      const payload = await downloadVault();
      cachePayload(payload);
      app.createMode = false;
      openUnlockView(payload, `Znaleziono sejf na Dysku Google (ostatnia zmiana: ${new Date(file.modifiedTime).toLocaleString("pl-PL")}).`);
    } else {
      app.createMode = true;
      openUnlockView(null, "Nie znaleziono sejfu na Dysku. Ustaw hasło główne, aby utworzyć nowy — lub najpierw kliknij „Połącz z Dyskiem Google” w rozszerzeniu na komputerze i wtedy zaloguj się tutaj ponownie.");
    }
  } catch (err) {
    showError("connectError", err.message);
  }
});

$("offlineBtn").addEventListener("click", () => {
  const payload = cachedPayload();
  if (!payload) return;
  app.offline = true;
  app.createMode = false;
  openUnlockView(payload, "Tryb offline — otwierasz ostatnią pobraną kopię sejfu (tylko odczyt).");
});

// ---------- krok 3: odblokowanie ----------

let pendingPayload = null;

function openUnlockView(payload, info) {
  pendingPayload = payload;
  $("unlockTitle").textContent = app.createMode ? "Utwórz sejf" : "Odblokuj sejf";
  $("unlockInfo").textContent = info || "";
  $("unlockPass2Label").classList.toggle("hidden", !app.createMode);
  $("unlockBtn").textContent = app.createMode ? "Utwórz sejf" : "Odblokuj";
  showError("unlockError", "");
  show("viewUnlock");
}

$("unlockBtn").addEventListener("click", unlock);
$("unlockPass").addEventListener("keydown", (e) => e.key === "Enter" && unlock());

async function unlock() {
  const password = $("unlockPass").value;
  if (app.createMode) {
    if (password.length < 8) return showError("unlockError", "Hasło główne musi mieć co najmniej 8 znaków.");
    if (password !== $("unlockPass2").value) return showError("unlockError", "Hasła nie są identyczne.");
    const salt = randomBytes(16);
    app.vaultMeta = { salt: toB64(salt), iterations: PBKDF2_ITERATIONS };
    app.key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
    app.entries = [];
    try {
      await uploadVault(await buildPayload());
    } catch (err) {
      return showError("unlockError", err.message);
    }
  } else {
    if (!pendingPayload) return;
    app.vaultMeta = {
      salt: pendingPayload.salt,
      iterations: pendingPayload.iterations || PBKDF2_ITERATIONS,
    };
    const key = await deriveKey(password, fromB64(pendingPayload.salt), app.vaultMeta.iterations);
    try {
      app.entries = await decryptJSON(key, { iv: pendingPayload.iv, data: pendingPayload.data });
    } catch {
      return showError("unlockError", "Nieprawidłowe hasło główne.");
    }
    app.key = key;
  }
  $("unlockPass").value = $("unlockPass2").value = "";
  show("viewMain");
  setSyncStatus(app.offline ? "" : "Zsynchronizowano: " + new Date().toLocaleTimeString("pl-PL"));
  paintEntries();
  regeneratePassword();
  if (!app.offline) startAutoSync();
}

$("lockBtn").addEventListener("click", () => {
  app.key = null;
  app.entries = [];
  stopAutoSync();
  startConnectView();
});

// ---------- lista wpisów ----------

function visibleEntries() {
  const query = $("searchBox").value.trim().toLowerCase();
  return app.entries.filter(
    (e) =>
      !e.deleted &&
      (!query || e.host.includes(query) || (e.username || "").toLowerCase().includes(query))
  );
}

function paintEntries() {
  const list = $("entriesList");
  list.textContent = "";
  const visible = visibleEntries();
  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = $("searchBox").value
      ? "Brak wyników wyszukiwania."
      : "Sejf jest pusty. Zapisz hasło na komputerze albo dodaj wpis poniżej.";
    list.append(empty);
    return;
  }
  for (const entry of visible) list.append(renderEntry(entry));
}

function renderEntry(entry) {
  const box = document.createElement("div");
  box.className = "entry";

  const host = document.createElement("div");
  host.className = "host";
  host.textContent = entry.host;

  const user = document.createElement("div");
  user.className = "user";
  user.textContent = entry.username || "(bez loginu)";

  const pass = document.createElement("div");
  pass.className = "pass";
  pass.textContent = "••••••••••";
  let revealed = false;

  const actions = document.createElement("div");
  actions.className = "actions";

  const revealBtn = mkButton("👁 Pokaż", () => {
    revealed = !revealed;
    pass.textContent = revealed ? entry.password : "••••••••••";
    revealBtn.textContent = revealed ? "🙈 Ukryj" : "👁 Pokaż";
  });
  const copyUserBtn = mkButton("Kopiuj login", (btn) => copyText(entry.username || "", btn));
  const copyPassBtn = mkButton("Kopiuj hasło", (btn) => copyText(entry.password, btn));
  const deleteBtn = mkButton("Usuń", async () => {
    if (app.offline) return alert("W trybie offline nie można usuwać wpisów.");
    if (!confirm(`Usunąć wpis dla ${entry.host} (${entry.username || "bez loginu"})?`)) return;
    entry.deleted = true;
    entry.updatedAt = Date.now();
    await persistAndSync();
  });
  deleteBtn.classList.add("danger");

  actions.append(revealBtn, copyUserBtn, copyPassBtn, deleteBtn);
  box.append(host, user, pass, actions);
  return box;
}

function mkButton(label, onClick) {
  const btn = document.createElement("button");
  btn.className = "ghost";
  btn.textContent = label;
  btn.addEventListener("click", () => onClick(btn));
  return btn;
}

$("searchBox").addEventListener("input", paintEntries);

// ---------- dodawanie wpisu ----------

$("addGenBtn").addEventListener("click", (e) => {
  e.preventDefault();
  $("addPass").type = "text";
  $("addPass").value = generatePassword({ length: 18 });
});

$("addBtn").addEventListener("click", async () => {
  if (app.offline) return showError("addError", "W trybie offline nie można dodawać wpisów.");
  const host = $("addHost").value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const username = $("addUser").value.trim();
  const password = $("addPass").value;
  if (!host) return showError("addError", "Podaj adres strony.");
  if (!password) return showError("addError", "Podaj hasło.");
  const now = Date.now();
  const existing = app.entries.find((e) => e.host === host && (e.username || "") === username);
  if (existing) {
    existing.password = password;
    existing.deleted = false;
    existing.updatedAt = now;
  } else {
    app.entries.push({
      id: crypto.randomUUID(),
      host,
      url: "https://" + host,
      username,
      password,
      createdAt: now,
      updatedAt: now,
    });
  }
  showError("addError", "");
  $("addHost").value = $("addUser").value = $("addPass").value = "";
  $("addBox").open = false;
  await persistAndSync();
});

// ---------- synchronizacja ręczna i automatyczna ----------

$("syncBtn").addEventListener("click", () => {
  if (app.offline) {
    // Próba wyjścia z trybu offline.
    app.offline = false;
    requestToken("")
      .then(() => syncNow())
      .catch(() => {
        app.offline = true;
        setSyncStatus("");
      });
  } else {
    syncNow();
  }
});

function startAutoSync() {
  stopAutoSync();
  app.syncTimer = setInterval(() => {
    if (document.visibilityState === "visible") syncNow();
  }, 60000);
}

function stopAutoSync() {
  if (app.syncTimer) clearInterval(app.syncTimer);
  app.syncTimer = null;
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && app.key && !app.offline) syncNow();
});

// ---------- generator ----------

function generatorOptions() {
  return {
    length: Number($("genLen").value),
    lower: $("genLower").checked,
    upper: $("genUpper").checked,
    digits: $("genDigits").checked,
    symbols: $("genSymbols").checked,
  };
}

function regeneratePassword() {
  $("genValue").textContent = generatePassword(generatorOptions());
}

$("genBtn").addEventListener("click", regeneratePassword);
$("genLen").addEventListener("input", () => {
  $("genLenLabel").textContent = $("genLen").value;
  regeneratePassword();
});
for (const id of ["genLower", "genUpper", "genDigits", "genSymbols"]) {
  $(id).addEventListener("change", regeneratePassword);
}
$("genCopyBtn").addEventListener("click", (e) => copyText($("genValue").textContent, e.target));

// ---------- zakładki ----------

$("tabVaultBtn").addEventListener("click", () => switchTab("vault"));
$("tabGenBtn").addEventListener("click", () => switchTab("gen"));

function switchTab(name) {
  $("tabVault").classList.toggle("hidden", name !== "vault");
  $("tabGen").classList.toggle("hidden", name !== "gen");
  $("tabVaultBtn").classList.toggle("active", name === "vault");
  $("tabGenBtn").classList.toggle("active", name === "gen");
}

// ---------- start ----------

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

if (!app.clientId) {
  show("viewConfig");
} else {
  startConnectView();
}
