// Test automatici: validazione IMEI e riconoscimento modelli dal database gratuito.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const lib = require('../src/lib/imei');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  OK  ', name); }
  catch (e) { console.error('  FAIL', name, '\n      ', e.message); process.exitCode = 1; }
}

// Piccolo database di prova (il vero viene creato da scripts/build-tacdb.js)
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tac-')), 'tacdb.tsv');
fs.writeFileSync(tmp, '35354132\tApple\tiPhone 12 Pro Max\t2020\n35054526\tSamsung\tGalaxy S24+ (SM-S926U)\t2024\n01006860\tEricsson\tT28Z\t\n');
lib.resetDb();

console.log('Validazione');
t('IMEI valido (anche con spazi e trattini)', () => assert.ok(lib.validate('35-354132 646952 1').ok));
t('Cifra di controllo errata', () => assert.ok(!lib.validate('353541326469522').ok));
t('Lunghezza errata', () => assert.ok(!lib.validate('12345').ok));

console.log('Riconoscimento modello');
t('Apple iPhone 12 Pro Max 2020', () => {
  const r = lib.checkImei('353541326469521', { dbFile: tmp }).result;
  assert.equal(r.brand, 'Apple'); assert.equal(r.model, 'iPhone 12 Pro Max'); assert.equal(r.year, '2020'); assert.equal(r.found, true);
});
t('Samsung Galaxy S24+', () => {
  const r = lib.checkImei('350545260771498', { dbFile: tmp }).result;
  assert.equal(r.brand, 'Samsung'); assert.equal(r.year, '2024');
});
t('Modello senza anno → anno vuoto', () => {
  lib.resetDb(); lib.loadDb(tmp);
  assert.equal(lib.lookupTac('01006860').year, null);
});
t('Modello sconosciuto → found=false', () => {
  const r = lib.checkImei('490154203237518', { dbFile: tmp }).result;
  assert.equal(r.found, false); assert.equal(r.brand, null);
});
t('Lo stato parte sempre da UNKNOWN (giallo)', () => {
  assert.equal(lib.checkImei('353541326469521', { dbFile: tmp }).result.verdict, 'unknown');
});
t('IMEI non valido → errore chiaro', () => {
  const r = lib.checkImei('123', { dbFile: tmp });
  assert.equal(r.ok, false); assert.match(r.error, /15 cifre/);
});
t('Siti gratuiti configurati (solo https)', () => {
  assert.ok(lib.FREE_CHECKERS.length >= 2);
  lib.FREE_CHECKERS.forEach(c => assert.match(c.url, /^https:\/\//));
});

const real = lib.DEFAULT_DB;
if (fs.existsSync(real)) {
  console.log('Database reale');
  lib.resetDb();
  t('Contiene più di 200.000 modelli', () => assert.ok(lib.loadDb(real).size > 200000));
  t('Riconosce iPhone 12 Pro Max', () => assert.equal(lib.lookupTac('35354132').model, 'iPhone 12 Pro Max'));
}

console.log(`\n${passed} test superati${process.exitCode ? ', ALCUNI FALLITI' : ''}.`);
