'use strict';

const $ = (id) => document.getElementById(id);

const ICONS = {
  clean: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  unknown: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.4-2.7 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.3" fill="currentColor"/></svg>',
  blocked: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  idle: '<svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10.5 18.5h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
};

const STATE_TEXT = {
  idle:    { label: 'IN ATTESA', sub: 'Inserisci un IMEI per iniziare' },
  unknown: { label: 'UNKNOWN',   sub: 'Da verificare: usa i siti gratuiti qui a fianco' },
  clean:   { label: 'CLEAN',     sub: 'Nessuna segnalazione di furto o blocco' },
  blocked: { label: 'RUBATO / BLOCCATO', sub: 'Segnalato in blacklist. Non acquistare.' }
};
const VERDICT_NAME = { clean: 'CLEAN', unknown: 'UNKNOWN', blocked: 'RUBATO / BLOCCATO' };

let current = null;

/* ---------- Validazione IMEI (Luhn) per il feedback immediato ---------- */
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
function setIndicator(state, sub) {
  $('indicator').className = `indicator state-${state}`;
  $('indIcon').innerHTML = ICONS[state];
  $('indLabel').textContent = STATE_TEXT[state].label;
  $('indSub').textContent = sub || STATE_TEXT[state].sub;
}

function setTile(id, value, empty = 'Non disponibile') {
  const el = $(id);
  if (value) { el.textContent = value; el.title = value; el.classList.remove('na'); }
  else { el.textContent = empty; el.title = ''; el.classList.add('na'); }
}

function fmtDate(iso) {
  try { return new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }); } catch { return '—'; }
}

function showResult(r) {
  current = r;
  const sub = r.verdict === 'unknown'
    ? (r.found ? STATE_TEXT.unknown.sub : 'Modello non presente nel database. Verifica lo stato qui a fianco.')
    : `${STATE_TEXT[r.verdict].sub}${r.verdictSource === 'manuale' ? ' (verificato da te)' : ''}`;
  setIndicator(r.verdict, sub);
  setTile('vBrand', r.brand);
  setTile('vModel', r.model, r.found ? 'Non disponibile' : 'Non trovato');
  setTile('vYear', r.year);
  $('dImei').textContent = formatImei(r.imei);
  $('dTac').textContent = r.tac || r.imei.slice(0, 8);
  $('dSource').textContent = r.verdictSource === 'manuale' ? `Da te, ${fmtDate(r.markedAt || r.checkedAt)}` : 'Non ancora verificato';
  $('dDate').textContent = fmtDate(r.checkedAt);
  $('btnCopy').disabled = false;
  $('verify').classList.remove('disabled');
  document.querySelectorAll('.mark').forEach(b => b.classList.toggle('on', r.verdictSource === 'manuale' && b.dataset.verdict === r.verdict));
}

/* ---------- Controllo ---------- */
async function runCheck(e) {
  if (e) e.preventDefault();
  const d = digits($('imei').value);
  const msg = $('inputMsg');
  if (d.length !== 15 || !luhnValid(d)) {
    msg.className = 'input-msg err';
    msg.textContent = d.length !== 15 ? `Servono 15 cifre (ne hai ${d.length}).` : 'IMEI non valido: ricontrolla il numero.';
    $('imei').focus();
    return;
  }
  const res = await window.api.check(d);
  if (!res.ok) { msg.className = 'input-msg err'; msg.textContent = res.error; return; }
  msg.className = 'input-msg';
  msg.textContent = res.result.found ? '' : 'Modello non trovato nel database (può succedere con telefoni molto nuovi o rari).';
  showResult(res.result);
  loadHistory();
}

async function mark(verdict) {
  if (!current) return;
  const res = await window.api.mark({ imei: current.imei, checkedAt: current.checkedAt, verdict });
  if (res.ok) { showResult(res.result); loadHistory(); toast(`Stato impostato: ${VERDICT_NAME[verdict]}`); }
}

/* ---------- Siti gratuiti ---------- */
function renderCheckers(list) {
  const box = $('checkers');
  box.innerHTML = '';
  list.forEach(c => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'checker';
    const t = document.createElement('b'); t.textContent = `${c.name} ↗`;
    const n = document.createElement('span'); n.textContent = c.note;
    b.append(t, n);
    b.addEventListener('click', async () => {
      if (!current) return;
      await window.api.copy(current.imei);
      await window.api.openExternal(c.url);
      toast('IMEI copiato: incollalo sul sito');
    });
    box.appendChild(b);
  });
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
  toast._t = setTimeout(() => t.classList.remove('show'), 1900);
}

function resultAsText(r) {
  return [
    `IMEI: ${r.imei}`,
    `Marca: ${r.brand || 'n.d.'}`,
    `Modello: ${r.model || 'n.d.'}`,
    `Anno: ${r.year || 'n.d.'}`,
    `Stato: ${VERDICT_NAME[r.verdict]}${r.verdictSource === 'manuale' ? ' (verificato manualmente)' : ' (da verificare)'}`,
    `Controllato il: ${fmtDate(r.checkedAt)}`
  ].join('\n');
}

/* ---------- Avvio ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  setIndicator('idle');
  $('imei').addEventListener('input', onImeiInput);
  $('form').addEventListener('submit', runCheck);
  $('btnPaste').addEventListener('click', async () => { $('imei').value = await window.api.paste(); onImeiInput(); $('imei').focus(); });
  document.querySelectorAll('.mark').forEach(b => b.addEventListener('click', () => mark(b.dataset.verdict)));
  document.querySelectorAll('[data-ext]').forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); window.api.openExternal(a.dataset.ext); }));
  $('btnCopy').addEventListener('click', async () => { if (current) { await window.api.copy(resultAsText(current)); toast('Risultato copiato'); } });
  $('btnClearHist').addEventListener('click', async () => { await window.api.clearHistory(); loadHistory(); });

  const info = await window.api.info();
  renderCheckers(info.checkers);
  $('dbCount').textContent = `${info.dbSize.toLocaleString('it-IT')} modelli`;
  if (!info.dbSize) { $('dbBadge').textContent = 'DATABASE MANCANTE'; $('dbBadge').className = 'mode-badge'; }
  loadHistory();
  $('imei').focus();
});
