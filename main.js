const { app, BrowserWindow, session, Menu, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs/promises");

const PROG_RE = /\.(txt|nc|cnc|tap|eia|prg|ngc)$/i;

let win = null;
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
    title: "CNC Manager",
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });
  win.loadFile("index.html");

  attachContextMenu(win);
}

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

/* skanuje podfoldery z plikami programów oraz pliki luzem — BEZ automatycznego pobierania PDF */
ipcMain.handle("scan-programs", async (e, root) => {
  const found = [];
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.isDirectory()) {
      const dirPath = path.join(root, ent.name);
      const progs = [];
      try {
        for (const f of await fs.readdir(dirPath, { withFileTypes: true })) {
          if (!f.isFile()) continue;
          if (PROG_RE.test(f.name)) progs.push(f.name);
        }
      } catch {}
      for (const fn of progs) {
        try {
          const fp = path.join(dirPath, fn);
          const st = await fs.stat(fp);
          found.push({ dir: ent.name, file: fn, code: await fs.readFile(fp, "utf8"), mtime: st.mtimeMs });
        } catch {}
      }
    } else if (ent.isFile() && PROG_RE.test(ent.name)) {
      try {
        const fp = path.join(root, ent.name);
        const st = await fs.stat(fp);
        found.push({ dir: "", file: ent.name, code: await fs.readFile(fp, "utf8"), mtime: st.mtimeMs });
      } catch {}
    }
  }
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

/* ── osobne okno podglądu programu ── */
ipcMain.handle("open-detail", (e, payload) => {
  createDetailWindow(payload);
  return { ok: true };
});
ipcMain.handle("get-detail-data", (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  return w ? (detailPayloads.get(w.id) || null) : null;
});
/* akcje z okna podglądu (Edytuj / Usuń / Pobierz) przekazywane do okna głównego */
ipcMain.on("detail-action", (e, msg) => {
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.focus();
    win.webContents.send("detail-action", msg);
  }
  if (msg && msg.close) {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (w) w.close();
  }
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  // dostęp do folderów (File System Access API) — zezwól bez pytania,
  // wybór folderu i tak przechodzi przez systemowe okno dialogowe
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(true));
  session.defaultSession.setPermissionCheckHandler(() => true);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
