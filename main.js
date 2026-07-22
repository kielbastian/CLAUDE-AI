const { app, BrowserWindow, session, Menu, Tray, nativeImage, ipcMain, dialog, shell, screen, globalShortcut } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");

/* zapamiętane położenie widgetu (plik w danych aplikacji) */
function widgetPosPath() { return path.join(app.getPath("userData"), "widget-pos.json"); }
function readWidgetPos() {
  try {
    const o = JSON.parse(fsSync.readFileSync(widgetPosPath(), "utf8"));
    if (o && Number.isFinite(o.x) && Number.isFinite(o.y)) return o;
  } catch {}
  return null;
}
function writeWidgetPos(x, y) {
  try { fsSync.writeFileSync(widgetPosPath(), JSON.stringify({ x, y })); } catch {}
}

const PROG_RE = /\.(txt|nc|cnc|tap|eia|prg|ngc)$/i;

let win = null;
let widgetWin = null;                // pływający widget szybkiego wyszukiwania
let tray = null;                     // ikona w zasobniku systemowym (tray)
let isQuitting = false;              // czy naprawdę zamykamy aplikację
let widgetPayload = { theme: "dark", accent: "default" };
const detailPayloads = new Map();   // id okna podglądu -> dane programu

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#06080f",
    autoHideMenuBar: true,
    frame: false,
    titleBarStyle: "hidden",
    skipTaskbar: true,          // brak osobnego przycisku na pasku zadań — dostęp przez ikonę w zasobniku
    title: "CNC Manager",
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });
  win.loadFile("index.html");

  attachContextMenu(win);

  /* zapytanie o potwierdzenie przy zamykaniu — stylizowane okno w aplikacji */
  win.on("close", (e) => {
    if (isQuitting) return;               // zamknięcie przez tray / potwierdzone – przepuść
    if (!win.webContents || win.webContents.isDestroyed()) return;
    e.preventDefault();
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    win.webContents.send("app-ask-close");
  });

  win.on("closed", () => {
    if (widgetWin && !widgetWin.isDestroyed()) widgetWin.destroy();
    if (tray) { try { tray.destroy(); } catch (e) {} tray = null; }
  });
}

/* przywołanie / przywrócenie głównego okna */
function showMainWindow() {
  if (!win || win.isDestroyed()) { createWindow(); return; }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

/* ikona w zasobniku systemowym – domyślnie ląduje w „Pokaż ukryte ikony” */
function createTray() {
  if (tray) return tray;
  try {
    const iconPath = path.join(__dirname, "build", "icon.png");
    let img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) img = img.resize({ width: 16, height: 16 });
    tray = new Tray(img.isEmpty() ? iconPath : img);
    tray.setToolTip("CNC Manager");
    const menu = Menu.buildFromTemplate([
      { label: "Pokaż okno", click: () => showMainWindow() },
      { label: "Szukaj (widget)", click: () => setWidget(true, widgetPayload) },
      { type: "separator" },
      { label: "Zamknij", click: () => { isQuitting = true; app.quit(); } }
    ]);
    tray.setContextMenu(menu);
    tray.on("click", () => showMainWindow());
    tray.on("double-click", () => showMainWindow());
  } catch (e) {}
  return tray;
}

/* ── pływający widget szybkiego wyszukiwania ── */
function createWidgetWindow() {
  const wa = screen.getPrimaryDisplay().workArea;
  const W = 400, H = 58;

  /* pozycja: zapamiętana lub domyślna (środek u góry ekranu głównego) */
  let px = Math.round(wa.x + (wa.width - W) / 2);
  let py = wa.y + 48;
  const saved = readWidgetPos();
  if (saved) {
    /* przypnij do widocznego obszaru najbliższego monitora (obsługa wielu ekranów) */
    const area = screen.getDisplayNearestPoint({ x: saved.x, y: saved.y }).workArea;
    px = Math.min(Math.max(saved.x, area.x), area.x + area.width - W);
    py = Math.min(Math.max(saved.y, area.y), area.y + area.height - H);
  }

  widgetWin = new BrowserWindow({
    width: W, height: H,
    x: px,
    y: py,
    useContentSize: true,
    frame: false, titleBarStyle: "hidden", transparent: true, resizable: false, movable: true,
    minimizable: false, maximizable: false, fullscreenable: false,
    skipTaskbar: true, hasShadow: false, show: false,
    title: "Szukaj — CNC Manager",
    webPreferences: { preload: path.join(__dirname, "preload.js") }
  });
  widgetWin.on("moved", () => {
    if (!widgetWin || widgetWin.isDestroyed()) return;
    const b = widgetWin.getBounds();
    writeWidgetPos(b.x, b.y);
  });
  widgetWin.on("closed", () => { widgetWin = null; });
  attachContextMenu(widgetWin);
  widgetWin.loadFile("widget.html");
  return widgetWin;
}
function showWidget(payload) {
  if (payload) widgetPayload = payload;
  if (!widgetWin || widgetWin.isDestroyed()) createWidgetWindow();
  const doShow = () => {
    widgetWin.show();
    widgetWin.focus();
    widgetWin.webContents.send("widget-theme", widgetPayload);
  };
  if (widgetWin.webContents.isLoading()) widgetWin.webContents.once("did-finish-load", doShow);
  else doShow();
}
function hideWidget() { if (widgetWin && !widgetWin.isDestroyed()) widgetWin.hide(); }
function notifyWidgetState(on) { if (win && !win.isDestroyed()) win.webContents.send("widget-state", on); }
function setWidget(on, payload) { if (on) showWidget(payload); else hideWidget(); notifyWidgetState(on); }

/* menu pod prawym przyciskiem myszy w polach tekstowych */
function attachContextMenu(w) {
  w.webContents.on("context-menu", (e, params) => {
    const items = [];
    if (params.isEditable) {
      items.push(
        { label: "Wytnij", role: "cut", enabled: params.editFlags.canCut },
        { label: "Kopiuj", role: "copy", enabled: params.editFlags.canCopy },
        { label: "Wklej", role: "paste", enabled: params.editFlags.canPaste },
        { type: "separator" },
        { label: "Zaznacz wszystko", role: "selectAll" }
      );
    } else if (params.selectionText) {
      items.push({ label: "Kopiuj", role: "copy" });
    }
    if (items.length) Menu.buildFromTemplate(items).popup();
  });
}

/* osobne okno podglądu programu */
function createDetailWindow(payload) {
  const dw = new BrowserWindow({
    width: 900,
    height: 820,
    minWidth: 560,
    minHeight: 420,
    backgroundColor: payload && payload.theme === "light" ? "#dfe4ee" : "#0c1020",
    autoHideMenuBar: true,
    frame: false,
    titleBarStyle: "hidden",
    title: (payload && payload.program && payload.program.name) || "Podgląd programu",
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });
  detailPayloads.set(dw.id, payload);
  dw.on("closed", () => detailPayloads.delete(dw.id));
  attachContextMenu(dw);
  dw.loadFile("detail.html");
  return dw;
}

/* ── operacje na plikach — natywny zapis przez system Windows ── */

ipcMain.handle("pick-folder", async (e, title) => {
  const r = await dialog.showOpenDialog(win, { title, properties: ["openDirectory"] });
  if (r.canceled || !r.filePaths.length) return null;
  const p = r.filePaths[0];
  return { path: p, name: path.basename(p) };
});

ipcMain.handle("exists", async (e, p) => {
  try { await fs.access(p); return true; } catch { return false; }
});

/* skanuje REKURENCYJNIE całe drzewo folderu z plikami programów (bez PDF).
   dir = ścieżka względna podfolderu (np. "1 0 214 761 WKRETKA 25 18"
   albo zagnieżdżona "2024/WKRETKA"); pliki luzem w korzeniu → dir "". */
ipcMain.handle("scan-programs", async (e, root) => {
  const found = [];
  async function walk(dir, rel, depth) {
    if (depth > 8) return;
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(abs, rel ? rel + "/" + ent.name : ent.name, depth + 1);
      } else if (ent.isFile() && PROG_RE.test(ent.name)) {
        try {
          const st = await fs.stat(abs);
          found.push({ dir: rel, file: ent.name, code: await fs.readFile(abs, "utf8"), mtime: st.mtimeMs });
        } catch {}
      }
    }
  }
  await walk(root, "", 0);
  return found;
});

ipcMain.handle("scan-pdfs", async (e, root) => {
  const out = [];
  async function walk(dir, rel, depth) {
    if (depth > 4) return;
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      const r = rel ? rel + "/" + ent.name : ent.name;
      if (ent.isFile() && /\.pdf$/i.test(ent.name)) out.push({ name: ent.name, rel: r, abs });
      else if (ent.isDirectory()) await walk(abs, r, depth + 1);
    }
  }
  await walk(root, "", 0);
  return out;
});

ipcMain.handle("write-program", async (e, { root, dir, file, content }) => {
  try {
    const target = dir ? path.join(root, dir) : root;
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(target, file), content, "utf8");
    return { ok: true };
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
});

ipcMain.handle("copy-file", async (e, { src, destRoot, destDir, name }) => {
  try {
    const target = destDir ? path.join(destRoot, destDir) : destRoot;
    await fs.mkdir(target, { recursive: true });
    await fs.copyFile(src, path.join(target, name));
    return { ok: true };
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
});

/* zapis pliku binarnego (np. rysunku PDF upuszczonego na kartę) */
ipcMain.handle("write-binary", async (e, { root, dir, name, data }) => {
  try {
    const target = dir ? path.join(root, dir) : root;
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(target, name), Buffer.from(data));
    return { ok: true };
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
});

ipcMain.handle("delete-file", async (e, { root, dir, file }) => {
  try {
    await fs.unlink(path.join(root, dir || "", file));
    return { ok: true };
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
});

/* otwiera folder w Eksploratorze; gdy podano plik — z zaznaczonym plikiem */
ipcMain.handle("show-in-folder", async (e, p) => {
  const norm = path.normalize(p);
  try {
    const st = await fs.stat(norm);
    if (st.isDirectory()) {
      const err = await shell.openPath(norm);
      return { ok: !err, error: err };
    }
    shell.showItemInFolder(norm);
    return { ok: true };
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
});

ipcMain.handle("read-file", async (e, p) => {
  try {
    const st = await fs.stat(p);
    return { ok: true, data: await fs.readFile(p), mtime: st.mtimeMs };
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
});

/* otwiera w Eksploratorze folder szkicu w folderze rysunków.
   Kolejność: dokładny podfolder → folder, którego nazwa zawiera szkic →
   plik PDF zawierający szkic (zaznaczony) → cały folder rysunków. */
ipcMain.handle("open-sketch", async (e, { root, sketch }) => {
  if (!root) return { ok: false, error: "brak folderu rysunków" };
  const norm = s => String(s || "").toLowerCase().replace(/[\s\-_]+/g, "");
  const target = norm(sketch);
  try {
    if (!target) { const err = await shell.openPath(root); return { ok: !err, error: err }; }
    // 1) dokładny podfolder root/sketch
    try {
      const direct = path.join(root, sketch);
      const st = await fs.stat(direct);
      if (st.isDirectory()) { const err = await shell.openPath(direct); return { ok: !err, error: err }; }
    } catch {}
    // 2) przeszukaj drzewo: folder (albo plik PDF) zawierający szkic
    let hitDir = null, hitFile = null;
    async function walk(dir, depth) {
      if (hitDir || depth > 4) return;
      let entries;
      try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const ent of entries) {
        if (hitDir) return;
        const abs = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          if (norm(ent.name).includes(target)) { hitDir = abs; return; }
          await walk(abs, depth + 1);
        } else if (ent.isFile() && !hitFile && /\.pdf$/i.test(ent.name) && norm(ent.name).includes(target)) {
          hitFile = abs;
        }
      }
    }
    await walk(root, 0);
    if (hitDir) { const err = await shell.openPath(hitDir); return { ok: !err, error: err }; }
    if (hitFile) { shell.showItemInFolder(hitFile); return { ok: true }; }
    // 3) nic nie znaleziono → otwórz cały folder rysunków
    const err = await shell.openPath(root);
    return { ok: !err, error: err, notFound: true };
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
});

/* ── sterowanie oknem — działa dla okna, z którego przyszło żądanie ── */
ipcMain.on("win-minimize", (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (w) w.minimize();
});
ipcMain.on("win-toggle-maximize", (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w) return;
  if (w.isMaximized()) w.unmaximize();
  else w.maximize();
});
ipcMain.on("win-close", (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (w) w.close();
});
/* użytkownik potwierdził zamknięcie w oknie aplikacji */
ipcMain.on("app-confirm-close", () => {
  isQuitting = true;
  if (win && !win.isDestroyed()) win.close();
  else app.quit();
});

/* ── osobne okno podglądu programu ── */
ipcMain.handle("open-detail", (e, payload) => {
  createDetailWindow(payload);
  return { ok: true };
});
ipcMain.handle("get-detail-data", (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  return w ? (detailPayloads.get(w.id) || null) : null;
});
/* akcje z okna podglądu (Zapisz / Usuń / Pobierz) przekazywane do okna głównego.
   Okno główne wychodzi na wierzch tylko, gdy akcja tego wymaga (msg.focusMain) —
   dzięki temu zapis podczas edycji NIE przełącza użytkownika na okno główne. */
ipcMain.on("detail-action", (e, msg) => {
  if (win && !win.isDestroyed()) {
    if (msg && msg.focusMain) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
    win.webContents.send("detail-action", msg);
  }
  if (msg && msg.close) {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (w) w.close();
  }
});

/* ── widget szybkiego wyszukiwania ── */
ipcMain.handle("toggle-widget", (e, { on, payload }) => { setWidget(on, payload); return { ok: true }; });
ipcMain.on("update-widget", (e, payload) => {
  widgetPayload = payload || widgetPayload;
  if (widgetWin && !widgetWin.isDestroyed() && widgetWin.isVisible()) widgetWin.webContents.send("widget-theme", widgetPayload);
});
ipcMain.handle("get-widget-data", () => widgetPayload);
/* wpisywanie na żywo — tylko policz wyniki, bez wychodzenia na wierzch */
ipcMain.on("widget-query", (e, query) => {
  if (win && !win.isDestroyed()) win.webContents.send("widget-live", query);
});
/* zatwierdzenie — pokaż aplikację z wynikami; widget POZOSTAJE widoczny */
ipcMain.on("widget-submit", (e, query) => {
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    win.webContents.send("widget-go", query);
  }
});
/* liczba znalezionych programów z okna głównego → do widgetu */
ipcMain.on("widget-result", (e, count) => {
  if (widgetWin && !widgetWin.isDestroyed()) widgetWin.webContents.send("widget-count", count);
});
ipcMain.on("widget-close", () => { hideWidget(); notifyWidgetState(false); });

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  // skrót globalny do przywołania widgetu (działa też, gdy aplikacja w tle)
  try {
    globalShortcut.register("CommandOrControl+Shift+Space", () => {
      if (widgetWin && !widgetWin.isDestroyed() && widgetWin.isVisible()) setWidget(false);
      else setWidget(true, widgetPayload);
    });
  } catch (e) {}
  // dostęp do folderów (File System Access API) — zezwól bez pytania,
  // wybór folderu i tak przechodzi przez systemowe okno dialogowe
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(true));
  session.defaultSession.setPermissionCheckHandler(() => true);
  createWindow();
  createTray();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => { isQuitting = true; });

app.on("will-quit", () => { try { globalShortcut.unregisterAll(); } catch (e) {} });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
