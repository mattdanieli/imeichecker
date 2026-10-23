'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  info: () => ipcRenderer.invoke('app:info'),
  check: (imei) => ipcRenderer.invoke('imei:check', imei),
  getHistory: () => ipcRenderer.invoke('history:get'),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  copy: (t) => ipcRenderer.invoke('clipboard:write', t),
  paste: () => ipcRenderer.invoke('clipboard:read'),
  openExternal: (u) => ipcRenderer.invoke('open:external', u)
});
