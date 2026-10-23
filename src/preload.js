'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  check: (imei) => ipcRenderer.invoke('imei:check', imei),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (s) => ipcRenderer.invoke('settings:save', s),
  clearKey: () => ipcRenderer.invoke('settings:clearKey'),
  getHistory: () => ipcRenderer.invoke('history:get'),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  copy: (t) => ipcRenderer.invoke('clipboard:write', t),
  paste: () => ipcRenderer.invoke('clipboard:read'),
  openExternal: (u) => ipcRenderer.invoke('open:external', u)
});
