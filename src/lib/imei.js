// Logica principale: validazione IMEI, chiamata al servizio, interpretazione della risposta.
// Nessuna dipendenza esterna: usa il fetch integrato di Node / Electron.

'use strict';

const DEFAULT_BASE_URL = 'https://dash.imei.info';

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
 * 2) INTERPRETAZIONE DELLA RISPOSTA
 *    I servizi IMEI usano nomi di campo diversi: cerchiamo in tutto
 *    l'oggetto in modo tollerante.
 * ------------------------------------------------------------- */
function walk(obj, visit, path = []) {
  if (!obj || typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    visit(k, v, path);
    if (v && typeof v === 'object') walk(v, visit, path.concat(k));
  }
}

function findFirst(obj, keyRegex) {
  let found;
  walk(obj, (k, v) => {
    if (found !== undefined) return;
    if (keyRegex.test(k) && v !== null && v !== '' && typeof v !== 'object') found = v;
  });
  return found;
}

// Trasforma un valore di stato in: 'clean' | 'blocked' | 'unknown'
function classifyStatusValue(value, key = '') {
  if (typeof value === 'boolean') {
    // es. { blacklisted: true } oppure { stolen: false }
    if (/clean/i.test(key)) return value ? 'clean' : 'blocked';
    return value ? 'blocked' : 'clean';
  }
  const s = String(value).trim().toUpperCase();
  if (!s) return 'unknown';
  // Frasi "negative" da controllare PRIMA (contengono parole rosse ma significano pulito)
  if (/\b(NOT|NO|NON)\s+(BLACKLISTED|BLACKLIST|STOLEN|LOST|BLOCKED|REPORTED|BARRED)\b/.test(s)) return 'clean';
  if (/\bUNBLOCKED\b|\bNON\s+RUBATO\b|\bPULITO\b/.test(s)) return 'clean';
  if (/BLACKLIST|STOLEN|LOST|BLOCK|BARRED|RUBAT|SMARRIT|BLOCCAT|REPORTED/.test(s)) return 'blocked';
  if (/^(CLEAN|OK|GOOD|WHITELIST(ED)?)$|\bCLEAN\b/.test(s)) return 'clean';
  return 'unknown';
}

function extractVerdict(data) {
  const candidates = [];
  walk(data, (k, v) => {
    if (v === null || typeof v === 'object') return;
    if (/blacklist|stolen|lost|gsma|barred|block_status|device_status|imei_status/i.test(k)) {
      candidates.push({ key: k, value: v });
    }
  });
  if (candidates.length === 0) return { verdict: 'unknown', raw: null };

  // Se anche un solo campo dice "bloccato", vince il rosso (prudenza).
  const results = candidates.map(c => ({ ...c, cls: classifyStatusValue(c.value, c.key) }));
  const red = results.find(r => r.cls === 'blocked');
  if (red) return { verdict: 'blocked', raw: String(red.value) };
  const green = results.find(r => r.cls === 'clean');
  if (green) return { verdict: 'clean', raw: String(green.value) };
  return { verdict: 'unknown', raw: String(results[0].value) };
}

function extractYear(data) {
  const v = findFirst(data, /^(release_?year|launch_?year|year|announced|release_?date|launch(ed)?|released|release)$/i);
  if (v === undefined) return null;
  const m = String(v).match(/\b(19[89]\d|20\d\d)\b/);
  return m ? m[1] : null;
}

function normalize(data, imei) {
  const brand = findFirst(data, /^(brand|brand_?name|manufacturer|make)$/i);
  const model = findFirst(data, /^(model|model_?name|marketing_?name)$/i)
             ?? findFirst(data, /^(device_?name|device)$/i);
  const { verdict, raw } = extractVerdict(data);
  const carrierLock = findFirst(data, /^(carrier_?lock|sim_?lock|simlock|locked)$/i);
  const carrier = findFirst(data, /^(original_?carrier|carrier|network|operator)$/i);
  const country = findFirst(data, /^(purchase_?country|country)$/i);

  return {
    imei,
    brand: brand ? String(brand) : null,
    model: model ? String(model) : null,
    year: extractYear(data),
    verdict,                 // 'clean' | 'blocked' | 'unknown'
    statusText: raw,         // testo originale del servizio (es. "BLACKLISTED")
    carrierLock: carrierLock === undefined ? null : carrierLock,
    carrier: carrier ? String(carrier) : null,
    country: country ? String(country) : null,
    checkedAt: new Date().toISOString(),
    raw: data
  };
}

/* ---------------------------------------------------------------
 * 3) CHIAMATA AL SERVIZIO (IMEI.info API v5)
 * ------------------------------------------------------------- */
class ImeiServiceError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

function friendlyHttpError(status, body) {
  switch (status) {
    case 401: case 403: return new ImeiServiceError('Chiave API non valida o scaduta. Controllala nelle Impostazioni.', 'auth');
    case 402: return new ImeiServiceError('Crediti esauriti sul tuo account IMEI.info. Ricarica il saldo dal pannello dash.imei.info.', 'credits');
    case 404: return new ImeiServiceError('Servizio non trovato. Controlla il "Numero servizio" nelle Impostazioni.', 'service');
    case 422: return new ImeiServiceError('Il servizio ha rifiutato l\'IMEI (formato o cifra di controllo non validi).', 'validation');
    case 429: return new ImeiServiceError('Troppe richieste in poco tempo. Aspetta qualche secondo e riprova.', 'rate');
    default:
      if (status >= 500) return new ImeiServiceError(`Il servizio IMEI ha un problema temporaneo (errore ${status}). Riprova tra poco.`, 'server');
      return new ImeiServiceError(`Errore dal servizio (${status}). ${String(body || '').slice(0, 160)}`, 'http');
  }
}

async function httpGetJson(url, apiKey, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: ctrl.signal
    });
  } catch (e) {
    if (e.name === 'AbortError') throw new ImeiServiceError('Il servizio non ha risposto in tempo. Riprova.', 'timeout');
    throw new ImeiServiceError('Impossibile collegarsi al servizio. Controlla la connessione a internet.', 'network');
  } finally {
    clearTimeout(t);
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* risposta non JSON */ }
  if (!res.ok) throw friendlyHttpError(res.status, text);
  if (!json || typeof json !== 'object') throw new ImeiServiceError('Risposta del servizio non leggibile.', 'parse');
  if (json.detail && /token|invalid|credential/i.test(String(json.detail))) {
    throw friendlyHttpError(401, json.detail);
  }
  return { status: res.status, json };
}

function isPending(status, json) {
  const s = String(json.status || '').toLowerCase();
  return status === 202 || ['pending', 'processing', 'running', 'queued'].includes(s);
}

async function checkImei({ imei, apiKey, serviceId = 0, baseUrl = DEFAULT_BASE_URL, maxWaitSec = 40, pollMs = 2000 }) {
  if (!apiKey) throw new ImeiServiceError('Manca la chiave API. Aprila dalle Impostazioni (icona ingranaggio).', 'auth');
  const base = String(baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const key = encodeURIComponent(apiKey.trim());

  // API_KEY deve essere il primo parametro (richiesto dal servizio)
  const url = `${base}/api-sync/check/${encodeURIComponent(serviceId)}/?API_KEY=${key}&format=json&imei=${imei}`;
  let { status, json } = await httpGetJson(url, apiKey.trim(), 35000);

  // Se il servizio mette in coda la richiesta, aspettiamo il risultato
  const deadline = Date.now() + maxWaitSec * 1000;
  const historyId = json.history_id ?? json.historyId;
  while (isPending(status, json) && historyId) {
    if (Date.now() > deadline) throw new ImeiServiceError('Il controllo sta richiedendo troppo tempo. Riprova tra un minuto.', 'timeout');
    await new Promise(r => setTimeout(r, pollMs));
    const pollUrl = `${base}/api/search_history/${encodeURIComponent(historyId)}/?API_KEY=${key}&format=json`;
    ({ status, json } = await httpGetJson(pollUrl, apiKey.trim(), 20000));
    const s = String(json.status || '').toLowerCase();
    if (['error', 'failed', 'cancelled'].includes(s)) {
      throw new ImeiServiceError('Il servizio non è riuscito a completare il controllo per questo IMEI.', 'failed');
    }
  }

  return normalize(json, imei);
}

/* ---------------------------------------------------------------
 * 4) MODALITÀ DEMO (offline, per provare l'app senza chiave)
 * ------------------------------------------------------------- */
const DEMO_DATA = {
  '353541326469521': { brand: 'Apple', model: 'iPhone 12 Pro Max', release_year: 2020, blacklist_status: 'CLEAN', carrier_lock: false },
  '350545260771498': { brand: 'Samsung', model: 'Galaxy S24 Ultra', release_year: 2024, blacklist_status: 'CLEAN', carrier_lock: false },
  '355030794352540': { brand: 'Google', model: 'Pixel 8 Pro', release_year: 2023, blacklist_status: 'BLACKLISTED', carrier_lock: true }
};

async function demoCheck(imei) {
  await new Promise(r => setTimeout(r, 900));
  const d = DEMO_DATA[imei] || { brand: null, model: null, blacklist_status: 'UNAVAILABLE' };
  const out = normalize(d, imei);
  out.demo = true;
  return out;
}

module.exports = {
  DEFAULT_BASE_URL, DEMO_DATA,
  cleanImei, luhnValid, validate,
  classifyStatusValue, extractVerdict, extractYear, normalize,
  checkImei, demoCheck, ImeiServiceError
};
