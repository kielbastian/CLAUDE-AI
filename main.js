// CNC Manager — proces główny Electron.
// Opakowuje aplikację CAM (index.html) w okno aplikacji desktopowej Windows.
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0b1120',
    title: 'CNC Manager',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Linki zewnętrzne otwieraj w przeglądarce systemowej, nie w oknie aplikacji.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Zapis pliku .nc — pokaż okno "Zapisz jako" i zapisz zawartość bloba.
  mainWindow.webContents.session.on('will-download', (event, item) => {
    const suggested = item.getFilename() || 'program.nc';
    const savePath = dialog.showSaveDialogSync(mainWindow, {
      title: 'Zapisz program NC',
      defaultPath: suggested,
      filters: [
        { name: 'Program NC', extensions: ['nc', 'txt', 'cnc'] },
        { name: 'Wszystkie pliki', extensions: ['*'] }
      ]
    });
    if (savePath) {
      item.setSavePath(savePath);
      item.once('done', (e, state) => {
        if (state === 'completed') {
          shell.showItemInFolder(savePath);
        }
      });
    } else {
      item.cancel();
    }
  });
}

// Minimalne menu (Alt pokazuje pasek). Skróty: przeładuj, zoom, pełny ekran, DevTools.
function buildMenu() {
  const template = [
    {
      label: 'Plik',
      submenu: [
        { role: 'quit', label: 'Zamknij' }
      ]
    },
    {
      label: 'Widok',
      submenu: [
        { role: 'reload', label: 'Przeładuj' },
        { role: 'resetZoom', label: 'Zoom 100%' },
        { role: 'zoomIn', label: 'Powiększ' },
        { role: 'zoomOut', label: 'Pomniejsz' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pełny ekran' },
        { role: 'toggleDevTools', label: 'Narzędzia deweloperskie' }
      ]
    },
    {
      label: 'Pomoc',
      submenu: [
        {
          label: 'O programie',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'O programie',
              message: 'CNC Manager',
              detail: 'Generator G-code Haas ST-35Y — CAM Studio.\nToczenie zewnętrzne / wytaczanie, cykle G71 / G70,\nwymiarowanie tabelą, fazy i promienie, symulacja i tryb krokowy.'
            });
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
