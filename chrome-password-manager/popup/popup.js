// Logika popupu Sejfu Haseł.

const $ = (id) => document.getElementById(id);

function send(msg) {
  return chrome.runtime.sendMessage(msg);
}

function show(viewId) {
  for (const id of ["viewSetup", "viewUnlock", "viewMain"]) {
    $(id).classList.toggle("hidden", id !== viewId);
  }
  $("lockBtn").classList.toggle("hidden", viewId !== "viewMain");
}

function showError(id, message) {
  const node = $(id);
  node.textContent = message || "";
  node.classList.toggle("hidden", !message);
}

async function copyText(text, button) {
  await navigator.clipboard.writeText(text);
  const original = button.textContent;
  button.textContent = "✓";
  setTimeout(() => (button.textContent = original), 900);
}

// ---------- routing widoków ----------

async function refresh() {
  const status = await send({ type: "GET_STATUS" });
  if (!status.configured) {
    show("viewSetup");
  } else if (!status.unlocked) {
    show("viewUnlock");
  } else {
    show("viewMain");
    await Promise.all([renderEntries(), renderPending(), regeneratePassword()]);
  }
}

// ---------- konfiguracja i odblokowanie ----------

$("setupBtn").addEventListener("click", async () => {
  const p1 = $("setupPass1").value;
  const p2 = $("setupPass2").value;
  if (p1.length < 8) return showError("setupError", "Hasło główne musi mieć co najmniej 8 znaków.");
  if (p1 !== p2) return showError("setupError", "Hasła nie są identyczne.");
  const res = await send({ type: "SETUP", masterPassword: p1 });
  if (!res.ok) return showError("setupError", res.error);
  showError("setupError", "");
  refresh();
});

$("unlockBtn").addEventListener("click", unlock);
$("unlockPass").addEventListener("keydown", (e) => e.key === "Enter" && unlock());

async function unlock() {
  const res = await send({ type: "UNLOCK", masterPassword: $("unlockPass").value });
  if (!res.ok) return showError("unlockError", res.error);
  $("unlockPass").value = "";
  showError("unlockError", "");
  refresh();
}

$("lockBtn").addEventListener("click", async () => {
  await send({ type: "LOCK" });
  refresh();
});

// ---------- lista wpisów ----------

let allEntries = [];

async function renderEntries() {
  const res = await send({ type: "LIST_CREDENTIALS" });
  if (!res.ok) return;
  allEntries = res.entries;
  paintEntries();
}

function paintEntries() {
  const query = $("searchBox").value.trim().toLowerCase();
  const list = $("entriesList");
  list.textContent = "";
  const visible = allEntries.filter(
    (e) => !query || e.host.includes(query) || e.username.toLowerCase().includes(query)
  );
  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = query
      ? "Brak wyników wyszukiwania."
      : "Sejf jest pusty. Hasła zapiszą się automatycznie podczas logowania na stronach.";
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

  const revealBtn = button("👁 Pokaż", () => {
    revealed = !revealed;
    pass.textContent = revealed ? entry.password : "••••••••••";
    revealBtn.textContent = revealed ? "🙈 Ukryj" : "👁 Pokaż";
  });
  const copyUserBtn = button("Kopiuj login", (btn) => copyText(entry.username, btn));
  const copyPassBtn = button("Kopiuj hasło", (btn) => copyText(entry.password, btn));
  const deleteBtn = button("Usuń", async () => {
    if (!confirm(`Usunąć wpis dla ${entry.host} (${entry.username || "bez loginu"})?`)) return;
    await send({ type: "DELETE_CREDENTIAL", id: entry.id });
    renderEntries();
  });
  deleteBtn.classList.add("danger");

  actions.append(revealBtn, copyUserBtn, copyPassBtn, deleteBtn);
  box.append(host, user, pass, actions);
  return box;
}

function button(label, onClick) {
  const btn = document.createElement("button");
  btn.className = "ghost";
  btn.textContent = label;
  btn.addEventListener("click", () => onClick(btn));
  return btn;
}

$("searchBox").addEventListener("input", paintEntries);

// ---------- ręczne dodawanie ----------

$("addGenBtn").addEventListener("click", async (e) => {
  e.preventDefault();
  const res = await send({ type: "GENERATE_PASSWORD", options: { length: 18 } });
  if (res.ok) {
    $("addPass").type = "text";
    $("addPass").value = res.password;
  }
});

$("addBtn").addEventListener("click", async () => {
  const host = $("addHost").value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const username = $("addUser").value.trim();
  const password = $("addPass").value;
  if (!host) return showError("addError", "Podaj adres strony.");
  if (!password) return showError("addError", "Podaj hasło.");
  const res = await send({ type: "SAVE_CREDENTIAL", entry: { host, username, password } });
  if (!res.ok) return showError("addError", res.error || "Nie udało się zapisać.");
  showError("addError", "");
  $("addHost").value = $("addUser").value = $("addPass").value = "";
  $("addBox").open = false;
  renderEntries();
});

// ---------- oczekujące zapisy ----------

async function renderPending() {
  const res = await send({ type: "PENDING_SAVE_LIST" });
  const box = $("pendingBox");
  const list = $("pendingList");
  list.textContent = "";
  if (!res.ok || !res.list.length) {
    box.classList.add("hidden");
    return;
  }
  box.classList.remove("hidden");
  for (const pending of res.list) {
    const item = document.createElement("div");
    item.className = "item";
    const label = document.createElement("span");
    label.textContent = `${pending.host} — ${pending.username || "(bez loginu)"}`;
    const saveBtn = button("Zapisz", async () => {
      await send({ type: "PENDING_SAVE_RESOLVE", tabId: pending.tabId, accept: true });
      await Promise.all([renderPending(), renderEntries()]);
    });
    saveBtn.classList.remove("ghost");
    saveBtn.classList.add("primary");
    saveBtn.style.width = "auto";
    const dropBtn = button("Odrzuć", async () => {
      await send({ type: "PENDING_SAVE_RESOLVE", tabId: pending.tabId, accept: false });
      renderPending();
    });
    item.append(label, saveBtn, dropBtn);
    list.append(item);
  }
}

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

async function regeneratePassword() {
  const res = await send({ type: "GENERATE_PASSWORD", options: generatorOptions() });
  if (res.ok) $("genValue").textContent = res.password;
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

refresh();
