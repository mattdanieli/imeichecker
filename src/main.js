'use strict';

const { app, BrowserWindow, ipcMain, safeStorage, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const imeiLib = require('./lib/imei');

const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'settings.json');
const HISTORY_FILE = () => path.join(app.getPath('userData'), 'history.json');
const MAX_HISTORY = 50;

/* ---------- Impostazioni (la chiave API viene cifrata dal sistema operativo) ---------- */
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function loadSettings() {
  const s = readJson(SETTINGS_FILE(), {});
  let apiKey = '';
  if (s.apiKeyEnc && safeStorage.isEncryptionAvailable()) {
    try { apiKey = safeStorage.decryptString(Buffer.from(s.apiKeyEnc, 'base64')); } catch { apiKey = ''; }
  } else if (s.apiKeyPlain) {
    apiKey = s.apiKeyPlain;
  }
  return {
    apiKey,
    serviceId: s.serviceId ?? 0,
    baseUrl: s.baseUrl || imeiLib.DEFAULT_BASE_URL,
    demoMode: s.demoMode ?? true
  };
}

function saveSettings({ apiKey, serviceId, baseUrl, demoMode }) {
  const out = {
    serviceId: Number.isFinite(Number(serviceId)) ? Number(serviceId) : 0,
    baseUrl: (baseUrl || imeiLib.DEFAULT_BASE_URL).trim(),
    demoMode: !!demoMode
  };
  if (apiKey) {
    if (safeStorage.isEncryptionAvailable()) out.apiKeyEnc = safeStorage.encryptString(apiKey.trim()).toString('base64');
    else out.apiKeyPlain = apiKey.trim();
  }
  writeJson(SETTINGS_FILE(), out);
}

/* ---------- Finestra ---------- */
function createWindow() {
  const win = new BrowserWindow({
    width: 1080,
    height: 780,
    minWidth: 820,
    minHeight: 640,
    backgroundColor: '#0b0f17',
    title: 'IMEI Checker Pro',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // I link esterni si aprono nel browser, non dentro l'app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

/* ---------- Comunicazione con l'interfaccia ---------- */
ipcMain.handle('settings:get', () => {
  const s = loadSettings();
  return { hasKey: !!s.apiKey, keyPreview: s.apiKey ? '••••' + s.apiKey.slice(-4) : '', serviceId: s.serviceId, baseUrl: s.baseUrl, demoMode: s.demoMode };
});

ipcMain.handle('settings:save', (_e, payload) => {
  const current = loadSettings();
  saveSettings({
    apiKey: payload.apiKey ? payload.apiKey : current.apiKey,
    serviceId: payload.serviceId,
    baseUrl: payload.baseUrl,
    demoMode: payload.demoMode
  });
  return { ok: true };
});

ipcMain.handle('settings:clearKey', () => {
  const s = loadSettings();
  writeJson(SETTINGS_FILE(), { serviceId: s.serviceId, baseUrl: s.baseUrl, demoMode: s.demoMode });
  return { ok: true };
});

ipcMain.handle('imei:check', async (_e, input) => {
  const v = imeiLib.validate(input);
  if (!v.ok) return { ok: false, error: v.error, code: 'validation' };

  const s = loadSettings();
  try {
    const result = s.demoMode
      ? await imeiLib.demoCheck(v.imei)
      : await imeiLib.checkImei({ imei: v.imei, apiKey: s.apiKey, serviceId: s.serviceId, baseUrl: s.baseUrl });

    const { raw, ...light } = result;
    const history = readJson(HISTORY_FILE(), []);
    history.unshift(light);
    writeJson(HISTORY_FILE(), history.slice(0, MAX_HISTORY));

    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err.message || 'Errore sconosciuto', code: err.code || 'unknown' };
  }
});

ipcMain.handle('history:get', () => readJson(HISTORY_FILE(), []));
ipcMain.handle('history:clear', () => { writeJson(HISTORY_FILE(), []); return { ok: true }; });
ipcMain.handle('clipboard:write', (_e, text) => { clipboard.writeText(String(text || '')); return { ok: true }; });
ipcMain.handle('clipboard:read', () => clipboard.readText());
ipcMain.handle('open:external', (_e, url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
