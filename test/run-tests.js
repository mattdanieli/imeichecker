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
const check = (imei) => lib.checkImei(imei, { dbFile: tmp });
lib.resetDb();

console.log('Validazione');
t('Cifra di controllo corretta', () => assert.ok(lib.luhnValid('353541326469521')));
t('Cifra di controllo errata', () => assert.ok(!lib.luhnValid('353541326469522')));
t('Meno di 15 cifre → errore chiaro', () => { const r = check('12345'); assert.equal(r.ok, false); assert.match(r.error, /15 cifre/); });
t('Spazi e trattini vengono ignorati', () => assert.equal(check('35-354132 646952 1').result.imei, '353541326469521'));

console.log('Semaforo');
t('Verde: valido e trovato (iPhone 12 Pro Max, 2020)', () => {
  const r = check('353541326469521').result;
  assert.equal(r.status, 'found'); assert.equal(r.brand, 'Apple'); assert.equal(r.model, 'iPhone 12 Pro Max'); assert.equal(r.year, '2020');
});
t('Giallo: valido ma modello sconosciuto', () => {
  const r = check('490154203237518').result;
  assert.equal(r.status, 'unknown'); assert.equal(r.brand, null);
});
t('Rosso: cifra di controllo errata', () => {
  const r = check('353541326469522').result;
  assert.equal(r.status, 'invalid'); assert.equal(r.valid, false);
});
t('Rosso ma mostra comunque il modello dal TAC', () => assert.equal(check('353541326469522').result.model, 'iPhone 12 Pro Max'));
t('Modello senza anno → anno vuoto', () => assert.equal(lib.lookupTac('01006860', tmp).year, null));

const real = lib.DEFAULT_DB;
if (fs.existsSync(real)) {
  console.log('Database reale');
  lib.resetDb();
  t('Contiene più di 200.000 modelli', () => assert.ok(lib.loadDb(real).size > 200000));
  t('Riconosce iPhone 12 Pro Max', () => assert.equal(lib.lookupTac('35354132').model, 'iPhone 12 Pro Max'));
}

console.log(`\n${passed} test superati${process.exitCode ? ', ALCUNI FALLITI' : ''}.`);
