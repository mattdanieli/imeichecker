# IMEI Checker Pro

App desktop per **Windows e Mac**: inserisci un IMEI e vedi subito

- **Marca**, **Modello**, **Anno**
- Un semaforo al centro: 🟢 **CLEAN** · 🟡 **UNKNOWN** · 🔴 **RUBATO / BLOCCATO**

---

## 1. Primo avvio (modalità DEMO)

L'app parte in **modalità demo**: risultati finti, gratis, senza internet. Serve solo per provarla.

IMEI di prova:

| IMEI | Risultato |
|---|---|
| `353541326469521` | 🟢 Apple iPhone 12 Pro Max |
| `350545260771498` | 🟢 Samsung Galaxy S24 Ultra |
| `355030794352540` | 🔴 Google Pixel 8 Pro (blacklist) |
| qualsiasi altro valido | 🟡 Unknown |

## 2. Attivare i controlli reali

1. Registrati su **https://dash.imei.info** e copia la tua **chiave API**.
2. Ricarica qualche euro di credito (ogni controllo costa pochi centesimi).
3. Nell'app: **ingranaggio ⚙️** → incolla la chiave → **spegni "Modalità demo"** → **Salva**.
4. In alto a destra deve comparire **LIVE** in verde.

La chiave viene salvata **cifrata** dal sistema operativo sul tuo computer.

## 3. Come leggere il semaforo

| Colore | Significa | Cosa fare |
|---|---|---|
| 🟢 Verde | Nessuna segnalazione di furto/smarrimento | OK |
| 🟡 Giallo | Il servizio non ha dato uno stato chiaro, oppure c'è stato un errore | Ricontrolla più tardi o con un altro servizio |
| 🔴 Rosso | Segnalato come rubato, smarrito o bloccato | Non acquistare |

Regola di sicurezza: se qualcosa va storto l'app mostra **giallo, mai verde**.

## 4. Creare gli installer (.exe e .dmg)

**Metodo automatico (consigliato, funziona anche per Mac senza avere un Mac):**

1. Crea un repository su GitHub e carica tutta questa cartella.
2. Vai su **Actions** → **Build app** → **Run workflow**.
3. Dopo ~10 minuti scarica i file da **Artifacts**: installer Windows + DMG per Mac.

**Metodo manuale** (serve Node.js 18+):

```bash
npm install
npm start          # avvia l'app
npm test           # test automatici
npm run build:win  # su Windows → dist/*.exe
npm run build:mac  # su Mac → dist/*.dmg
```

## 5. Nota per Mac

L'app non è firmata da Apple, quindi al primo avvio macOS la blocca.
Soluzione: **tasto destro sull'app → Apri → Apri**. Solo la prima volta.

## Struttura

```
src/main.js          finestra, salvataggio impostazioni e cronologia
src/preload.js       ponte sicuro tra interfaccia e sistema
src/lib/imei.js      validazione IMEI, chiamata al servizio, lettura risposta
src/renderer/        interfaccia (HTML, CSS, JS)
test/                test automatici e screenshot
```
