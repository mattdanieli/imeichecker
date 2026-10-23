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

function validate(input) {
  const imei = cleanImei(input);
  if (imei.length === 0) return { ok: false, imei, error: 'Inserisci un IMEI.' };
  if (imei.length !== 15) return { ok: false, imei, error: `L'IMEI deve avere 15 cifre (ne hai inserite ${imei.length}).` };
  if (!luhnValid(imei)) return { ok: false, imei, error: "IMEI non valido: l'ultima cifra di controllo non torna. Ricontrolla il numero." };
  return { ok: true, imei, tac: imei.slice(0, 8) };
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
  const d = loadDb(file);
  const hit = d.get(tac);
  if (!hit) return null;
  return { brand: hit[0] || null, model: hit[1] || null, year: hit[2] || null };
}

/* ---------------------------------------------------------------
 * 3) CONTROLLO COMPLETO
 *    Lo stato (clean / rubato) NON è nel numero: si parte sempre da
 *    "unknown" (giallo) finché l'utente non lo verifica.
 * ------------------------------------------------------------- */
function checkImei(input, { dbFile } = {}) {
  const v = validate(input);
  if (!v.ok) return { ok: false, error: v.error };
  const device = lookupTac(v.tac, dbFile);
  return {
    ok: true,
    result: {
      imei: v.imei,
      tac: v.tac,
      found: !!device,
      brand: device ? device.brand : null,
      model: device ? device.model : null,
      year: device ? device.year : null,
      verdict: 'unknown',      // 'clean' | 'blocked' | 'unknown'
      verdictSource: null,     // 'manuale' quando l'utente lo imposta
      checkedAt: new Date().toISOString()
    }
  };
}

const VERDICTS = ['clean', 'blocked', 'unknown'];

/* ---------------------------------------------------------------
 * 4) SITI GRATUITI per verificare lo stato (si aprono nel browser)
 * ------------------------------------------------------------- */
const FREE_CHECKERS = [
  { id: 'imeiinfo', name: 'IMEI.info', url: 'https://www.imei.info/', note: 'Controllo base gratuito' },
  { id: 'imeicheck', name: 'IMEICheck.com', url: 'https://imeicheck.com/', note: 'Blacklist gratuita' },
  { id: 'swappa', name: 'Swappa', url: 'https://swappa.com/esn', note: 'Blacklist gratuita (operatori USA)' }
];

module.exports = {
  DEFAULT_DB, VERDICTS, FREE_CHECKERS,
  cleanImei, luhnValid, validate,
  loadDb, resetDb, lookupTac, checkImei
};
