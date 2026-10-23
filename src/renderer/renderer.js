'use strict';

const $ = (id) => document.getElementById(id);

const ICONS = {
  found: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  unknown: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.4-2.7 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.3" fill="currentColor"/></svg>',
  invalid: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  idle: '<svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10.5 18.5h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
};

// Ogni stato usa i colori del semaforo (classi CSS esistenti)
const STATES = {
  idle:    { css: 'idle',    label: 'IN ATTESA',       sub: 'Inserisci un IMEI per iniziare' },
  found:   { css: 'clean',   label: 'TROVATO',         sub: 'IMEI valido, modello riconosciuto' },
  unknown: { css: 'unknown', label: 'SCONOSCIUTO',     sub: 'IMEI valido, ma il modello non è nel database' },
  invalid: { css: 'blocked', label: 'IMEI NON VALIDO', sub: 'Cifra di controllo errata: errore di battitura o IMEI falso' }
};

let current = null;

/* ---------- Inserimento ---------- */
const digits = (s) => String(s || '').replace(/\D/g, '');
const formatImei = (d) => d.replace(/^(\d{0,2})(\d{0,6})(\d{0,6})(\d{0,1}).*$/, (_, a, b, c, e) => [a, b, c, e].filter(Boolean).join(' '));

function onImeiInput() {
  const input = $('imei');
  const d = digits(input.value).slice(0, 15);
  input.value = formatImei(d);
  $('counter').textContent = `${d.length}/15`;
  input.classList.remove('bad');
  input.classList.toggle('good', d.length === 15);
  const msg = $('inputMsg');
  msg.className = 'input-msg';
  msg.textContent = d.length === 15 ? 'Premi Cerca (o Invio).' : '';
}

/* ---------- Indicatore e dati ---------- */
function setIndicator(state) {
  const s = STATES[state];
  $('indicator').className = `indicator state-${s.css}`;
  $('indIcon').innerHTML = ICONS[state];
  $('indLabel').textContent = s.label;
  $('indSub').textContent = s.sub;
}

function setTile(id, value, empty) {
  const el = $(id);
  if (value) { el.textContent = value; el.title = value; el.classList.remove('na'); }
  else { el.textContent = empty; el.title = ''; el.classList.add('na'); }
}

function fmtDate(iso) {
  try { return new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }); } catch { return '—'; }
}

function showResult(r) {
  current = r;
  setIndicator(r.status);
  const empty = r.brand ? 'Non disponibile' : 'Non trovato';
  setTile('vBrand', r.brand, empty);
  setTile('vModel', r.model, empty);
  setTile('vYear', r.year, r.brand ? 'Non disponibile' : 'Non trovato');
  $('dImei').textContent = formatImei(r.imei);
  $('dTac').textContent = r.tac;
  $('dLuhn').textContent = r.valid ? 'Corretta ✓' : 'Errata ✗';
  $('dDate').textContent = fmtDate(r.checkedAt);
  $('btnCopy').disabled = false;
}

/* ---------- Ricerca ---------- */
async function runCheck(e) {
  if (e) e.preventDefault();
  const d = digits($('imei').value);
  const msg = $('inputMsg');
  if (d.length !== 15) {
    msg.className = 'input-msg err';
    msg.textContent = `Servono 15 cifre (ne hai ${d.length}).`;
    $('imei').focus();
    return;
  }
  const res = await window.api.check(d);
  if (!res.ok) { msg.className = 'input-msg err'; msg.textContent = res.error; return; }
  $('imei').classList.toggle('good', res.result.valid);
  $('imei').classList.toggle('bad', !res.result.valid);
  msg.className = res.result.valid ? 'input-msg' : 'input-msg err';
  msg.textContent = res.result.valid ? '' : 'Attenzione: questo IMEI non supera il controllo. Ricontrolla le cifre.';
  showResult(res.result);
  loadHistory();
}

/* ---------- Cronologia ---------- */
async function loadHistory() {
  const list = await window.api.getHistory();
  const ul = $('history');
  ul.innerHTML = '';
  $('histEmpty').style.display = list.length ? 'none' : 'block';
  const cls = { found: 'g', unknown: 'y', invalid: 'r' };
  list.forEach(item => {
    if (!item.status) return; // voci della versione precedente
    const li = document.createElement('li');
    const dot = document.createElement('i'); dot.className = `dot ${cls[item.status] || 'y'}`;
    const main = document.createElement('div'); main.className = 'h-main';
    const model = document.createElement('div'); model.className = 'h-model';
    model.textContent = [item.brand, item.model].filter(Boolean).join(' ') || 'Modello sconosciuto';
    const im = document.createElement('div'); im.className = 'h-imei'; im.textContent = item.imei;
    const time = document.createElement('div'); time.className = 'h-time'; time.textContent = fmtDate(item.checkedAt);
    main.append(model, im, time);
    li.append(dot, main);
    li.title = 'Mostra di nuovo questo risultato';
    li.addEventListener('click', () => { $('imei').value = item.imei; onImeiInput(); showResult(item); });
    ul.appendChild(li);
  });
}

function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

function resultAsText(r) {
  return [
    `IMEI: ${r.imei}${r.valid ? '' : ' (NON VALIDO)'}`,
    `Marca: ${r.brand || 'n.d.'}`,
    `Modello: ${r.model || 'n.d.'}`,
    `Anno: ${r.year || 'n.d.'}`
  ].join('\n');
}

/* ---------- Avvio ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  setIndicator('idle');
  $('imei').addEventListener('input', onImeiInput);
  $('form').addEventListener('submit', runCheck);
  $('btnPaste').addEventListener('click', async () => { $('imei').value = await window.api.paste(); onImeiInput(); $('imei').focus(); });
  document.querySelectorAll('[data-ext]').forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); window.api.openExternal(a.dataset.ext); }));
  $('btnCopy').addEventListener('click', async () => { if (current) { await window.api.copy(resultAsText(current)); toast('Risultato copiato'); } });
  $('btnClearHist').addEventListener('click', async () => { await window.api.clearHistory(); loadHistory(); });

  const info = await window.api.info();
  $('dbCount').textContent = `${info.dbSize.toLocaleString('it-IT')} modelli`;
  if (!info.dbSize) { $('dbBadge').textContent = 'DATABASE MANCANTE'; $('dbBadge').className = 'mode-badge'; }
  loadHistory();
  $('imei').focus();
});
