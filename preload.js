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
  openSketch: (root, sketch) => ipcRenderer.invoke("open-sketch", { root, sketch }),
  minimize: () => ipcRenderer.send("win-minimize"),
  toggleMaximize: () => ipcRenderer.send("win-toggle-maximize"),
  close: () => ipcRenderer.send("win-close"),
  openDetail: (payload) => ipcRenderer.invoke("open-detail", payload),
  getDetailData: () => ipcRenderer.invoke("get-detail-data"),
  detailAction: (msg) => ipcRenderer.send("detail-action", msg),
  onDetailAction: (cb) => ipcRenderer.on("detail-action", (e, msg) => cb(msg)),
  // widget szybkiego wyszukiwania — okno główne
  toggleWidget: (on, payload) => ipcRenderer.invoke("toggle-widget", { on, payload }),
  updateWidget: (payload) => ipcRenderer.send("update-widget", payload),
  onWidgetState: (cb) => ipcRenderer.on("widget-state", (e, on) => cb(on)),
  onWidgetSearch: (cb) => ipcRenderer.on("widget-search", (e, q) => cb(q)),
  // widget szybkiego wyszukiwania — okno widgetu
  getWidgetData: () => ipcRenderer.invoke("get-widget-data"),
  widgetSubmit: (q) => ipcRenderer.send("widget-submit", q),
  widgetHide: () => ipcRenderer.send("widget-close"),
  onWidgetTheme: (cb) => ipcRenderer.on("widget-theme", (e, d) => cb(d))
});
