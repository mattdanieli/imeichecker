// Avvia l'app vera in modalità demo e salva uno screenshot per ogni stato del semaforo.
'use strict';
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const out = process.argv[process.argv.length - 1];
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'imei-shot-')));
require('../src/main.js');

const cases = [
  ['idle', null],
  ['clean', '353541326469521'],
  ['blocked', '355030794352540'],
  ['unknown', '490154203237518']
];

app.on('browser-window-created', (_e, win) => {
  win.webContents.once('did-finish-load', async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    await wait(600);
    for (const [name, imei] of cases) {
      if (imei) {
        await win.webContents.executeJavaScript(`
          document.getElementById('imei').value='${imei}';
          document.getElementById('imei').dispatchEvent(new Event('input'));
          document.getElementById('form').requestSubmit();`);
        await wait(1800);
      }
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(out, `${name}.png`), img.toPNG());
    }
    app.quit();
  });
});
