"use strict";

// electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("electronAPI", {
  openTickFiles: () => import_electron.ipcRenderer.invoke("dialog:openTickFiles"),
  readTickData: (filePath) => import_electron.ipcRenderer.invoke("file:readTickData", filePath),
  streamTickContent: (filePath) => import_electron.ipcRenderer.invoke("file:streamTickContent", filePath),
  runBacktest: (request) => import_electron.ipcRenderer.invoke("backtest:run", request),
  onBacktestProgress: (callback) => {
    import_electron.ipcRenderer.on("backtest:progress", (_event, progress) => callback(progress));
  },
  isElectron: true
});
