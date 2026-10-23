# IMEI Checker Pro

App desktop **gratuita** per **Windows e Mac**: inserisci un IMEI e vedi subito

- **Marca**, **Modello**, **Anno** → automatici, gratis, anche senza internet
- Un semaforo al centro: 🟢 **CLEAN** · 🟡 **UNKNOWN** · 🔴 **RUBATO / BLOCCATO**

---

## Come si usa

1. Inserisci l'IMEI (sul telefono digita `*#06#` per vederlo) e premi **Verifica**.
2. Compaiono **Marca, Modello e Anno**. Il semaforo parte 🟡 **giallo = da verificare**.
3. Clicca uno dei siti gratuiti (**IMEI.info**, **IMEICheck.com**, **Swappa**): l'IMEI viene copiato e il sito si apre nel browser.
4. Incolla l'IMEI sul sito e leggi il risultato.
5. Torna nell'app e premi **Clean**, **Rubato / Bloccato** o **Non chiaro**: il semaforo si aggiorna e il risultato resta salvato nella cronologia.

## Perché lo stato non è automatico?

Le liste dei telefoni rubati appartengono agli operatori e al GSMA e sono **a pagamento**.
Non esiste un servizio gratuito che le fornisca automaticamente a un'app.
Per questo l'app ti porta ai siti di controllo gratuiti e ti fa registrare il risultato.

## Da dove arrivano marca, modello e anno

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
