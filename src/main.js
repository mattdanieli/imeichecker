'use strict';

const { app, BrowserWindow, ipcMain, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const imeiLib = require('./lib/imei');

const HISTORY_FILE = () => path.join(app.getPath('userData'), 'history.json');
const MAX_HISTORY = 100;
const ALLOWED_LINKS = imeiLib.FREE_CHECKERS.map(c => c.url).concat(['https://github.com/MoazEb/tac-database']);

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 840,
    minHeight: 660,
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
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

/* ---------- Comunicazione con l'interfaccia ---------- */
ipcMain.handle('app:info', () => ({
  dbSize: imeiLib.loadDb().size,
  checkers: imeiLib.FREE_CHECKERS
}));

ipcMain.handle('imei:check', (_e, input) => {
  const res = imeiLib.checkImei(input);
  if (!res.ok) return res;
  const history = readJson(HISTORY_FILE(), []);
  history.unshift(res.result);
  writeJson(HISTORY_FILE(), history.slice(0, MAX_HISTORY));
  return res;
});

// L'utente imposta lo stato dopo averlo verificato su un sito gratuito
ipcMain.handle('imei:mark', (_e, { imei, checkedAt, verdict }) => {
  if (!imeiLib.VERDICTS.includes(verdict)) return { ok: false };
  const history = readJson(HISTORY_FILE(), []);
  const item = history.find(h => h.imei === imei && h.checkedAt === checkedAt);
  if (!item) return { ok: false };
  item.verdict = verdict;
  item.verdictSource = verdict === 'unknown' ? null : 'manuale';
  item.markedAt = new Date().toISOString();
  writeJson(HISTORY_FILE(), history);
  return { ok: true, result: item };
});

ipcMain.handle('history:get', () => readJson(HISTORY_FILE(), []));
ipcMain.handle('history:clear', () => { writeJson(HISTORY_FILE(), []); return { ok: true }; });
ipcMain.handle('clipboard:write', (_e, text) => { clipboard.writeText(String(text || '')); return { ok: true }; });
ipcMain.handle('clipboard:read', () => clipboard.readText());
ipcMain.handle('open:external', (_e, url) => {
  if (ALLOWED_LINKS.includes(url)) shell.openExternal(url);
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
