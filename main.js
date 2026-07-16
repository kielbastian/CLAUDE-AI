// CAM Generator — proces główny Electron (okno bezramkowe, własny pasek okna).
const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1080,
    minHeight: 680,
    backgroundColor: '#0c1020',
    title: 'CAM Generator',
    frame: false,
    titleBarStyle: 'hidden',
    show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Linki zewnętrzne w przeglądarce systemowej.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Zapis pliku .nc przez natywne okno „Zapisz jako".
  mainWindow.webContents.session.on('will-download', (event, item) => {
    const savePath = dialog.showSaveDialogSync(mainWindow, {
      title: 'Zapisz program NC',
      defaultPath: item.getFilename() || 'program.nc',
      filters: [
        { name: 'Program NC', extensions: ['nc', 'txt', 'cnc'] },
        { name: 'Wszystkie pliki', extensions: ['*'] }
      ]
    });
    if (savePath) {
      item.setSavePath(savePath);
      item.once('done', (e, state) => { if (state === 'completed') shell.showItemInFolder(savePath); });
    } else {
      item.cancel();
    }
  });

  // Menu kontekstowe (kopiuj/wklej) w polach edycji.
  mainWindow.webContents.on('context-menu', (e, params) => {
    if (!params.isEditable && !params.selectionText) return;
    const items = params.isEditable ? [
      { role: 'cut', label: 'Wytnij', enabled: params.editFlags.canCut },
      { role: 'copy', label: 'Kopiuj', enabled: params.editFlags.canCopy },
      { role: 'paste', label: 'Wklej', enabled: params.editFlags.canPaste },
      { type: 'separator' },
      { role: 'selectAll', label: 'Zaznacz wszystko' }
    ] : [{ role: 'copy', label: 'Kopiuj' }];
    Menu.buildFromTemplate(items).popup();
  });
}

// Sterowanie oknem z własnego paska tytułu.
ipcMain.on('win-min', (e) => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.minimize(); });
ipcMain.on('win-max', (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w) return;
  w.isMaximized() ? w.unmaximize() : w.maximize();
});
ipcMain.on('win-close', (e) => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.close(); });

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
