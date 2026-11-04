# SegnaLis

Piattaforma per raccogliere un dataset video della **Lingua dei Segni Italiana (LIS)**, pensata per essere estesa alle altre lingue dei segni.

Chi contribuisce legge una parola, una lettera o una frase, la segna davanti alla fotocamera e invia il video. **MediaPipe Hands** gira nel browser: controlla che le mani siano nell'inquadratura e salva 21 punti per mano, fotogramma per fotogramma, accanto al video. La comunità valida i video (2 conferme) prima che entrino nel dataset.

## Avvio

```bash
npm install
npm start          # http://localhost:3000
npm test           # flusso completo dell'API su un database temporaneo
npm run export     # esporta i video validati in data/export/<data>/ (aggiungi -- --all per includere quelli in verifica)
```

In locale non serve configurare nulla: il database è [PGlite](https://pglite.dev) (Postgres dentro Node, salvato in `data/pg`) e i video finiscono in `data/videos`. MediaPipe (`@mediapipe/tasks-vision`) e il modello `public/models/hand_landmarker.task` sono serviti dal sito stesso: il browser di chi registra non contatta servizi esterni.

## Deploy su Vercel

| Variabile | Da dove arriva | Uso |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | Store Vercel Blob **privato** `segnalis-video` (Francoforte) collegato al progetto | Video e punti delle mani |
| `DATABASE_URL` | Integrazione Neon dal Marketplace di Vercel, regione Francoforte | Profili, consensi, registrazioni, revisioni |

- `vercel.json` fissa le funzioni a Francoforte (`fra1`) e applica gli header di sicurezza anche ai file statici.
- MediaPipe è copiato in `public/vendor/mediapipe` (solo la variante WASM con SIMD, supportata dai browser moderni). Dopo un aggiornamento di `@mediapipe/tasks-vision` esegui `npm run vendor`.
- Senza queste variabili, su Vercel le API rispondono 503 invece di scrivere su un disco temporaneo.
- I video passano dalla funzione, che accetta al massimo 4,5 MB: il browser registra a 1,5 Mbps (una frase di 15 s pesa circa 3 MB) e scarta i video troppo pesanti.
- Per esportare il dataset dal tuo computer: `vercel env pull .env.local`, poi `node --env-file=.env.local server.js export`.

La fotocamera funziona solo su `localhost` o in **HTTPS**. Per provarla da telefono usa un tunnel HTTPS o metti il server dietro un reverse proxy con certificato.

Variabili: `PORT` (default 3000), `DATA_DIR` (default `./data`).

## Struttura

| Percorso | Cosa contiene |
|---|---|
| `server.js` | API, database SQLite, file statici, export del dataset |
| `vocabolari/ise.json` | Vocabolario LIS (codice ISO 639-3 `ise`): categorie, tipo e voci |
| `public/` | App a pagina singola: home, onboarding, studio, validazione, profilo, dataset, privacy |
| `data/` | Solo in locale: database PGlite (`pg/`) e `videos/` (video + `*.landmarks.json`) |

## Come funziona

- **Identità anonima**: nessun account; ogni persona riceve una chiave casuale (salvata sul server solo come hash SHA-256).
- **Consensi granulari**: maggiore età e ricerca obbligatori; validazione dalla comunità, condivisione con enti di ricerca e uso commerciale facoltativi. Esportati per ogni video come licenza.
- **Sessioni bilanciate**: ogni sessione propone 10 voci, prima quelle con meno persone diverse (obiettivo 50 per voce). Le voci già registrate o segnate come «non lo conosco» non tornano.
- **Validazione**: riservata a persone sorde, CODA, interpreti o chi segna da almeno un anno. Un video è validato con 2 «corretto» in maggioranza, scartato con 2 giudizi negativi.
- **Privacy delle statistiche**: le distribuzioni pubbliche nascondono i gruppi sotto 5 persone.
- **Diritti GDPR**: scaricare i propri dati, cambiare consensi, eliminare singoli video o tutto l'account dal profilo.

## Aggiungere una lingua

Crea `vocabolari/<codice-iso-639-3>.json` con la stessa struttura di `ise.json`. Oggi il server ne carica uno solo (`ise`); il campo `lang` è già salvato su ogni video.

## Prima del lancio pubblico

- Completare l'informativa (`#/privacy`) con titolare e DPO, e far fare una DPIA: i video del volto sono dati biometrici.
- Sostituire `CONTACT_EMAIL` in `public/app.js`.
- Aggiungere un limite di richieste (rate limiting) e attivare i backup di Neon.
- Far rivedere il vocabolario da persone sorde e interpreti LIS.

## Licenza

Codice rilasciato con licenza [MIT](LICENSE). Il modello `public/models/hand_landmarker.task` e la libreria `@mediapipe/tasks-vision` sono di Google, con licenza Apache 2.0. I video raccolti non sono coperti da questa licenza: valgono i consensi scelti da ogni persona.
