const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("native", {
  pickFolder: (title) => ipcRenderer.invoke("pick-folder", title),
  exists: (p) => ipcRenderer.invoke("exists", p),
  scanPrograms: (root) => ipcRenderer.invoke("scan-programs", root),
  scanPdfs: (root) => ipcRenderer.invoke("scan-pdfs", root),
  readFile: (p) => ipcRenderer.invoke("read-file", p),
  writeProgram: (root, dir, file, content) => ipcRenderer.invoke("write-program", { root, dir, file, content }),
  copyFile: (src, destRoot, destDir, name) => ipcRenderer.invoke("copy-file", { src, destRoot, destDir, name }),
  writeBinary: (root, dir, name, data) => ipcRenderer.invoke("write-binary", { root, dir, name, data }),
  deleteFile: (root, dir, file) => ipcRenderer.invoke("delete-file", { root, dir, file }),
  showInFolder: (p) => ipcRenderer.invoke("show-in-folder", p),
  minimize: () => ipcRenderer.send("win-minimize"),
  toggleMaximize: () => ipcRenderer.send("win-toggle-maximize"),
  close: () => ipcRenderer.send("win-close"),
  openDetail: (id) => ipcRenderer.invoke("open-detail", id)
});
