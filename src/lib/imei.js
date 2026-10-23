// Logica principale: validazione IMEI e riconoscimento del telefono dal database TAC gratuito incluso nell'app.
// Tutto funziona offline e senza costi.
'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_DB = path.join(__dirname, '..', 'data', 'tacdb.tsv');

/* ---------------------------------------------------------------
 * 1) VALIDAZIONE (algoritmo di Luhn, la "cifra di controllo")
 * ------------------------------------------------------------- */
function cleanImei(input) {
  return String(input || '').replace(/\D/g, '');
}

function luhnValid(imei) {
  if (!/^\d{15}$/.test(imei)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = Number(imei[i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

/* ---------------------------------------------------------------
 * 2) DATABASE TAC (prime 8 cifre dell'IMEI = modello del telefono)
 * ------------------------------------------------------------- */
let db = null;

function loadDb(file = DEFAULT_DB) {
  if (db) return db;
  db = new Map();
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { return db; }
  for (const line of text.split('\n')) {
    if (!line) continue;
    const [tac, brand, model, year] = line.split('\t');
    db.set(tac, [brand, model, year]);
  }
  return db;
}

function resetDb() { db = null; }

function lookupTac(tac, file) {
  const hit = loadDb(file).get(tac);
  if (!hit) return null;
  return { brand: hit[0] || null, model: hit[1] || null, year: hit[2] || null };
}

/* ---------------------------------------------------------------
 * 3) CONTROLLO COMPLETO
 *    status: 'found'   → IMEI valido, modello riconosciuto      (verde)
 *            'unknown' → IMEI valido, modello non nel database  (giallo)
 *            'invalid' → cifra di controllo errata              (rosso)
 * ------------------------------------------------------------- */
function checkImei(input, { dbFile } = {}) {
  const imei = cleanImei(input);
  if (imei.length === 0) return { ok: false, error: 'Inserisci un IMEI.' };
  if (imei.length !== 15) return { ok: false, error: `L'IMEI deve avere 15 cifre (ne hai inserite ${imei.length}).` };

  const tac = imei.slice(0, 8);
  const valid = luhnValid(imei);
  const device = lookupTac(tac, dbFile);
  return {
    ok: true,
    result: {
      imei,
      tac,
      valid,
      status: !valid ? 'invalid' : (device ? 'found' : 'unknown'),
      brand: device ? device.brand : null,
      model: device ? device.model : null,
      year: device ? device.year : null,
      checkedAt: new Date().toISOString()
    }
  };
}

module.exports = { DEFAULT_DB, cleanImei, luhnValid, loadDb, resetDb, lookupTac, checkImei };
