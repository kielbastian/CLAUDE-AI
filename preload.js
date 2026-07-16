// Most między oknem (renderer) a procesem głównym — sterowanie oknem frameless.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cam', {
  minimize: () => ipcRenderer.send('win-min'),
  toggleMaximize: () => ipcRenderer.send('win-max'),
  close: () => ipcRenderer.send('win-close')
});
