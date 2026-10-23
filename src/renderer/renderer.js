'use strict';

const $ = (id) => document.getElementById(id);

const ICONS = {
  clean: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  unknown: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.4-2.7 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.3" fill="currentColor"/></svg>',
  blocked: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  idle: '<svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10.5 18.5h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  loading: ''
};

const STATE_TEXT = {
  idle:    { label: 'IN ATTESA', sub: 'Inserisci un IMEI per iniziare' },
  loading: { label: 'VERIFICA…', sub: 'Interrogo il database' },
  clean:   { label: 'CLEAN',     sub: 'Nessuna segnalazione di furto o blocco' },
  unknown: { label: 'UNKNOWN',   sub: 'Stato non determinabile: verifica manualmente' },
  blocked: { label: 'RUBATO / BLOCCATO', sub: 'Segnalato in blacklist. Non acquistare.' }
};

let lastResult = null;
let busy = false;

/* ---------- Validazione IMEI (Luhn) lato interfaccia, per feedback immediato ---------- */
function luhnValid(imei) {
  if (!/^\d{15}$/.test(imei)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = +imei[i];
    if (i % 2) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}
const digits = (s) => String(s || '').replace(/\D/g, '');
const formatImei = (d) => d.replace(/^(\d{0,2})(\d{0,6})(\d{0,6})(\d{0,1}).*$/, (_, a, b, c, e) => [a, b, c, e].filter(Boolean).join(' '));

function onImeiInput() {
  const input = $('imei');
  const d = digits(input.value).slice(0, 15);
  input.value = formatImei(d);
  $('counter').textContent = `${d.length}/15`;
  input.classList.remove('bad', 'good');
  const msg = $('inputMsg');
  msg.className = 'input-msg';
  msg.textContent = '';
  if (d.length === 15) {
    if (luhnValid(d)) { input.classList.add('good'); msg.classList.add('ok'); msg.textContent = 'Formato valido. Premi Verifica (o Invio).'; }
    else { input.classList.add('bad'); msg.classList.add('err'); msg.textContent = "Cifra di controllo errata: probabilmente c'è un numero sbagliato."; }
  }
}

/* ---------- Indicatore e dati ---------- */
function setIndicator(state, subOverride) {
  const el = $('indicator');
  el.className = `indicator state-${state}`;
  $('indIcon').innerHTML = ICONS[state];
  $('indLabel').textContent = STATE_TEXT[state].label;
  $('indSub').textContent = subOverride || STATE_TEXT[state].sub;
}

function setTile(id, value) {
  const el = $(id);
  if (value) { el.textContent = value; el.title = value; el.classList.remove('na'); }
  else { el.textContent = 'Non disponibile'; el.title = ''; el.classList.add('na'); }
}

function fmtDate(iso) {
  try { return new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }); } catch { return '—'; }
}

function showResult(r) {
  lastResult = r;
  const sub = r.demo ? `${STATE_TEXT[r.verdict].sub} (DEMO)` : undefined;
  setIndicator(r.verdict, sub);
  setTile('vBrand', r.brand);
  setTile('vModel', r.model);
  setTile('vYear', r.year);
  $('dImei').textContent = formatImei(r.imei);
  $('dRaw').textContent = r.statusText || 'Nessuno stato';
  $('dLock').textContent = r.carrierLock === null || r.carrierLock === undefined ? 'Non indicato' : (r.carrierLock ? 'Sì (bloccato)' : 'No (libero)');
  $('dDate').textContent = fmtDate(r.checkedAt);
  $('btnCopy').disabled = false;
}

function resetResult() {
  ['vBrand', 'vModel', 'vYear'].forEach(id => { $(id).textContent = '—'; $(id).classList.remove('na'); });
  ['dImei', 'dRaw', 'dLock', 'dDate'].forEach(id => { $(id).textContent = '—'; });
  $('btnCopy').disabled = true;
}

/* ---------- Controllo ---------- */
async function runCheck(e) {
  if (e) e.preventDefault();
  if (busy) return;
  const d = digits($('imei').value);
  const msg = $('inputMsg');
  if (d.length !== 15 || !luhnValid(d)) {
    msg.className = 'input-msg err';
    msg.textContent = d.length !== 15 ? `Servono 15 cifre (ne hai ${d.length}).` : 'IMEI non valido: ricontrolla il numero.';
    $('imei').focus();
    return;
  }
  busy = true;
  $('btnCheck').disabled = true;
  $('btnCheck').textContent = 'Verifico…';
  resetResult();
  setIndicator('loading');

  const res = await window.api.check(d);

  busy = false;
  $('btnCheck').disabled = false;
  $('btnCheck').textContent = 'Verifica';

  if (res.ok) {
    showResult(res.result);
    msg.className = 'input-msg';
    msg.textContent = '';
    loadHistory();
  } else {
    // Errore = non sappiamo lo stato → GIALLO, mai verde
    setIndicator('unknown', 'Controllo non riuscito');
    msg.className = 'input-msg err';
    msg.textContent = res.error;
    if (res.code === 'auth') openSettings();
  }
}

/* ---------- Cronologia ---------- */
async function loadHistory() {
  const list = await window.api.getHistory();
  const ul = $('history');
  ul.innerHTML = '';
  $('histEmpty').style.display = list.length ? 'none' : 'block';
  const cls = { clean: 'g', unknown: 'y', blocked: 'r' };
  list.forEach(item => {
    const li = document.createElement('li');
    const dot = document.createElement('i'); dot.className = `dot ${cls[item.verdict] || 'y'}`;
    const main = document.createElement('div'); main.className = 'h-main';
    const model = document.createElement('div'); model.className = 'h-model';
    model.textContent = [item.brand, item.model].filter(Boolean).join(' ') || 'Dispositivo sconosciuto';
    const im = document.createElement('div'); im.className = 'h-imei'; im.textContent = item.imei + (item.demo ? ' · demo' : '');
    const time = document.createElement('div'); time.className = 'h-time'; time.textContent = fmtDate(item.checkedAt);
    main.append(model, im, time);
    li.append(dot, main);
    li.title = 'Mostra di nuovo questo risultato';
    li.addEventListener('click', () => { $('imei').value = item.imei; onImeiInput(); showResult(item); });
    ul.appendChild(li);
  });
}

/* ---------- Impostazioni ---------- */
async function refreshBadge() {
  const s = await window.api.getSettings();
  const b = $('modeBadge');
  if (s.demoMode) { b.textContent = 'DEMO'; b.className = 'mode-badge demo'; b.title = 'Risultati simulati'; }
  else if (s.hasKey) { b.textContent = 'LIVE'; b.className = 'mode-badge live'; b.title = 'Controlli reali attivi'; }
  else { b.textContent = 'CHIAVE MANCANTE'; b.className = 'mode-badge'; b.title = 'Inserisci la chiave nelle Impostazioni'; }
  return s;
}

async function openSettings() {
  const s = await window.api.getSettings();
  $('sDemo').checked = s.demoMode;
  $('sKey').value = '';
  $('sKeyInfo').textContent = s.hasKey ? `Chiave salvata: ${s.keyPreview} (lascia vuoto per mantenerla)` : 'Nessuna chiave salvata.';
  $('sService').value = s.serviceId;
  $('sBase').value = s.baseUrl;
  $('modal').classList.remove('hidden');
}
const closeSettings = () => $('modal').classList.add('hidden');

async function saveSettings() {
  await window.api.saveSettings({
    apiKey: $('sKey').value.trim(),
    serviceId: $('sService').value,
    baseUrl: $('sBase').value.trim(),
    demoMode: $('sDemo').checked
  });
  closeSettings();
  await refreshBadge();
  toast('Impostazioni salvate');
}

function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

function resultAsText(r) {
  const verdict = { clean: 'CLEAN', unknown: 'UNKNOWN', blocked: 'RUBATO / BLOCCATO' }[r.verdict];
  return [
    `IMEI: ${r.imei}`,
    `Marca: ${r.brand || 'n.d.'}`,
    `Modello: ${r.model || 'n.d.'}`,
    `Anno: ${r.year || 'n.d.'}`,
    `Stato: ${verdict}${r.statusText ? ` (${r.statusText})` : ''}`,
    `Controllato il: ${fmtDate(r.checkedAt)}${r.demo ? ' [DEMO]' : ''}`
  ].join('\n');
}

/* ---------- Avvio ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  setIndicator('idle');
  $('imei').addEventListener('input', onImeiInput);
  $('form').addEventListener('submit', runCheck);
  $('btnPaste').addEventListener('click', async () => { $('imei').value = await window.api.paste(); onImeiInput(); $('imei').focus(); });
  $('btnSettings').addEventListener('click', openSettings);
  $('btnCancel').addEventListener('click', closeSettings);
  $('btnSave').addEventListener('click', saveSettings);
  $('btnClearKey').addEventListener('click', async () => { await window.api.clearKey(); $('sKeyInfo').textContent = 'Chiave eliminata.'; refreshBadge(); });
  $('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeSettings(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSettings(); });
  document.querySelectorAll('[data-ext]').forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); window.api.openExternal(a.dataset.ext); }));
  $('btnCopy').addEventListener('click', async () => { if (lastResult) { await window.api.copy(resultAsText(lastResult)); toast('Risultato copiato'); } });
  $('btnClearHist').addEventListener('click', async () => { await window.api.clearHistory(); loadHistory(); });

  await refreshBadge();
  loadHistory();
  $('imei').focus();
});
