// Converte il database TAC gratuito (MoazEb/tac-database, licenza MIT) nel formato compatto usato dall'app.
// Uso: node scripts/build-tacdb.js <percorso tac_full.csv> [file di uscita]
'use strict';
const fs = require('fs');
const path = require('path');

const input = process.argv[2];
const output = process.argv[3] || path.join(__dirname, '..', 'src', 'data', 'tacdb.tsv');
if (!input) { console.error('Indica il file tac_full.csv'); process.exit(1); }

// Lettore CSV minimale (gestisce i campi tra virgolette)
function parseCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const SHORT_UPPER = new Set(['LG', 'ZTE', 'HTC', 'TCL', 'BLU', 'HP', 'BQ', 'RIM', 'NEC', 'BBK', 'UMI', 'IMO']);
function niceBrand(b) {
  const s = b.trim();
  if (!s) return '';
  if (SHORT_UPPER.has(s.toUpperCase()) || s.length <= 3) return s.toUpperCase();
  return s.toLowerCase().replace(/(^|[\s\-&])\p{L}/gu, (m) => m.toUpperCase());
}

// "GALAXY S24+" -> "Galaxy S24+", lascia maiuscole le sigle con numeri (S24, A70, SM-S926U)
function niceWords(s) {
  return s.split(/\s+/).map(w => {
    if (/\d/.test(w) || w.length <= 2) return w.toUpperCase().replace(/^IPHONE/, 'iPhone').replace(/^IPAD/, 'iPad');
    if (/^IPHONE$/i.test(w)) return 'iPhone';
    if (/^IPAD$/i.test(w)) return 'iPad';
    if (/^(PRO|MAX|PLUS|MINI|ULTRA|LITE|NEO|EDGE|NOTE|FOLD|FLIP|AIR|SE)$/i.test(w)) return w[0].toUpperCase() + w.slice(1).toLowerCase();
    return w === w.toUpperCase() ? w[0] + w.slice(1).toLowerCase() : w;
  }).join(' ');
}

const YEAR_RE = /(?:^|[\s,]|(?<=[A-Za-z]))((?:19[89]\d|20[0-3]\d))\s*$/;
function extractYear(parts) {
  for (const p of parts) {
    const m = p.trim().match(/^(19[89]\d|20[0-3]\d)$/);
    if (m) return m[1];
  }
  const last = parts[parts.length - 1] || '';
  const g = last.match(YEAR_RE);
  return g ? g[1] : '';
}

function stripYear(s) { return s.replace(/(?<=[A-Za-z\)])(19[89]\d|20[0-3]\d)\s*$/, '').trim(); }
function stripBrand(model, brand) {
  const re = new RegExp('^' + brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+', 'i');
  return model.replace(re, '').trim();
}

function buildModel(brandRaw, specs) {
  const parts = specs.split(',').map(s => stripYear(s.trim())).filter(Boolean);
  const brandU = brandRaw.trim().toUpperCase();
  let first = parts[0] || '';
  let second = parts[1] || '';
  let model;
  if (first.toUpperCase() === brandU && second) {
    model = stripBrand(second, brandRaw);           // "ITEL, ITEL A70" -> "A70"
  } else if (second && second.toUpperCase().startsWith(first.toUpperCase())) {
    model = stripBrand(second, brandRaw);           // "APPLE IPHONE 12, Apple iPhone 12" -> "iPhone 12"
  } else {
    model = niceWords(stripBrand(first, brandRaw)); // "SAMSUNG GALAXY S24+" -> "Galaxy S24+"
    const code = second && stripBrand(second, brandRaw);
    if (code && /\d/.test(code) && code.length <= 24 && !model.toUpperCase().includes(code.toUpperCase())) {
      model += ` (${code})`;                        // aggiunge il codice modello, es. SM-S926U
    }
  }
  if (!model || model.toUpperCase() === brandU) model = '';
  return model.replace(/\t/g, ' ');
}

const lines = fs.readFileSync(input, 'utf8').split(/\r?\n/);
const header = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
const iB = header.indexOf('brand'), iT = header.indexOf('tac'), iS = header.indexOf('specs');
const seen = new Set();
const out = [];
for (let n = 1; n < lines.length; n++) {
  if (!lines[n].trim()) continue;
  const f = parseCsvLine(lines[n]);
  const tac = String(f[iT] || '').replace(/\D/g, '').padStart(8, '0');
  if (tac.length !== 8 || seen.has(tac)) continue;
  seen.add(tac);
  const specs = f[iS] || '';
  const brand = niceBrand(f[iB] || '');
  const model = buildModel(f[iB] || '', specs);
  const year = extractYear(specs.split(','));
  out.push(`${tac}\t${brand}\t${model}\t${year}`);
}
out.sort();
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, out.join('\n') + '\n', 'utf8');
console.log(`Creato ${output}: ${out.length} modelli`);
