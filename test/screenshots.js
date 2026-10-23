// Avvia l'app vera e salva uno screenshot per ogni stato del semaforo.
'use strict';
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const out = process.argv[process.argv.length - 1];
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'imei-shot-')));
require('../src/main.js');

const cases = [
  ['idle', null, null],
  ['unknown', '353541326469521', null],
  ['clean', '353541326469521', 'clean'],
  ['blocked', '350545260771498', 'blocked']
];

app.on('browser-window-created', (_e, win) => {
  win.webContents.once('did-finish-load', async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const js = (code) => win.webContents.executeJavaScript(code);
    await wait(900);
    for (const [name, imei, verdict] of cases) {
      if (imei) {
        await js(`document.getElementById('imei').value='${imei}';
          document.getElementById('imei').dispatchEvent(new Event('input'));
          document.getElementById('form').requestSubmit();`);
        await wait(500);
      }
      if (verdict) { await js(`document.querySelector('.mark[data-verdict="${verdict}"]').click()`); await wait(500); }
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(out, `${name}.png`), img.toPNG());
    }
    app.quit();
  });
});
