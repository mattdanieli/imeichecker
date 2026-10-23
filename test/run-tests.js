// Test automatici: avvia un finto servizio IMEI in locale e verifica che l'app interpreti bene le risposte.
'use strict';
const http = require('http');
const assert = require('assert');
const lib = require('../src/lib/imei');

let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  OK  ', name); }
  catch (e) { console.error('  FAIL', name, '\n      ', e.message); process.exitCode = 1; }
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const imei = u.searchParams.get('imei');
  const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  if (u.searchParams.get('API_KEY') !== 'good') return send(401, { detail: 'Invalid token' });
  if (u.pathname.startsWith('/api/search_history/')) return send(200, { status: 'Done', result: { brand: 'Xiaomi', model: 'Redmi Note 13', blacklist_status: 'CLEAN', release_date: '2024-01-15' } });
  if (imei === '353541326469521') return send(200, { status: 'Done', result: { brand: 'Apple', model: 'iPhone 12 Pro Max', blacklist_status: 'CLEAN', carrier_lock: false } });
  if (imei === '355030794352540') return send(200, { status: 'Done', result: { brand: 'Google', model: 'Pixel 8 Pro', blacklist_status: 'BLACKLISTED' } });
  if (imei === '350545260771498') return send(202, { status: 'Pending', history_id: 77 });
  return send(402, { error: 'Payment Required', code: 'insufficient_credits' });
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  console.log('Validazione');
  await t('IMEI valido', () => assert.ok(lib.validate('35-354132 646952 1').ok));
  await t('Cifra di controllo errata', () => assert.ok(!lib.validate('353541326469522').ok));
  await t('Lunghezza errata', () => assert.ok(!lib.validate('12345').ok));

  console.log('Classificazione stati');
  const c = lib.classifyStatusValue;
  await t('CLEAN → verde', () => assert.equal(c('CLEAN'), 'clean'));
  await t('NOT BLACKLISTED → verde', () => assert.equal(c('Not Blacklisted'), 'clean'));
  await t('BLACKLISTED → rosso', () => assert.equal(c('BLACKLISTED'), 'blocked'));
  await t('Lost or Stolen → rosso', () => assert.equal(c('Lost or Stolen'), 'blocked'));
  await t('Testo strano → giallo', () => assert.equal(c('Pending review'), 'unknown'));
  await t('blacklisted: true → rosso', () => assert.equal(c(true, 'blacklisted'), 'blocked'));
  await t('Nessun campo stato → giallo', () => assert.equal(lib.normalize({ brand: 'X' }, '1').verdict, 'unknown'));
  await t('Anno da data', () => assert.equal(lib.extractYear({ release_date: '2021-09-24' }), '2021'));

  console.log('Chiamate al servizio (finto)');
  await t('Apple clean', async () => {
    const r = await lib.checkImei({ imei: '353541326469521', apiKey: 'good', baseUrl: base });
    assert.equal(r.verdict, 'clean'); assert.equal(r.brand, 'Apple'); assert.equal(r.model, 'iPhone 12 Pro Max'); assert.equal(r.carrierLock, false);
  });
  await t('Pixel blacklisted', async () => {
    const r = await lib.checkImei({ imei: '355030794352540', apiKey: 'good', baseUrl: base });
    assert.equal(r.verdict, 'blocked');
  });
  await t('Richiesta in coda → attende il risultato', async () => {
    const r = await lib.checkImei({ imei: '350545260771498', apiKey: 'good', baseUrl: base, pollMs: 50 });
    assert.equal(r.verdict, 'clean'); assert.equal(r.year, '2024');
  });
  await t('Chiave errata → messaggio chiaro', async () => {
    await assert.rejects(lib.checkImei({ imei: '353541326469521', apiKey: 'bad', baseUrl: base }), /Chiave API/);
  });
  await t('Crediti finiti → messaggio chiaro', async () => {
    await assert.rejects(lib.checkImei({ imei: '490154203237518', apiKey: 'good', baseUrl: base }), /Crediti esauriti/);
  });
  await t('Servizio irraggiungibile → messaggio chiaro', async () => {
    await assert.rejects(lib.checkImei({ imei: '353541326469521', apiKey: 'good', baseUrl: 'http://127.0.0.1:1' }), /connessione/);
  });
  await t('Demo: IMEI sconosciuto → giallo', async () => assert.equal((await lib.demoCheck('490154203237518')).verdict, 'unknown'));

  server.close();
  console.log(`\n${passed} test superati${process.exitCode ? ', ALCUNI FALLITI' : ''}.`);
})();
