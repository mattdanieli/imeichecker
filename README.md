# IMEI Model Checker

App desktop **gratuita** per **Windows e Mac**: inserisci un IMEI e scopri subito **Marca**, **Modello** e **Anno** del telefono.
Funziona **senza internet** e **senza costi**.

---

## Come si usa

1. Sul telefono digita `*#06#` per vedere l'IMEI.
2. Scrivilo (o incollalo) nell'app e premi **Cerca**.
3. Leggi **Marca, Modello e Anno** e guarda l'indicatore al centro.

## L'indicatore

| Colore | Significa |
|---|---|
| 🟢 **TROVATO** | IMEI valido e modello riconosciuto |
| 🟡 **SCONOSCIUTO** | IMEI valido, ma il modello non è nel database (telefoni molto nuovi o rari) |
| 🔴 **IMEI NON VALIDO** | La cifra di controllo non torna: errore di battitura oppure IMEI falso o manomesso |

## Da dove arrivano i dati

Dal database libero **[MoazEb/tac-database](https://github.com/MoazEb/tac-database)** (licenza MIT, circa 255.000 modelli).
Le prime 8 cifre dell'IMEI (il **TAC**) identificano il modello. L'anno non è disponibile per tutti i modelli.

## Creare gli installer (.exe e .dmg)

Ogni modifica caricata su GitHub avvia la build automatica (**Actions → Build app**).
Alla fine scarichi i file da **Artifacts**. I file restano disponibili per 90 giorni.

Manuale (serve Node.js 18+):

```bash
curl -L -o tac_full.csv https://raw.githubusercontent.com/MoazEb/tac-database/main/tac_full.csv
node scripts/build-tacdb.js tac_full.csv
npm install
npm start          # avvia l'app
npm test           # test automatici
npm run build:win  # su Windows → dist/*.exe
npm run build:mac  # su Mac → dist/*.dmg
```

## Nota per Mac

L'app non è firmata da Apple: al primo avvio usa **tasto destro sull'app → Apri → Apri**.
