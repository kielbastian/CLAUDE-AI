const { app, BrowserWindow, session, Menu } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#06080f",
    autoHideMenuBar: true,
    title: "CNC Manager",
    icon: path.join(__dirname, "build", "icon.png"),
  });
  win.loadFile("index.html");
}

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
