# AI Remote: il tuo vecchio iPhone come telecomando AI per il Mac

Trasforma un iPhone che non usi più in un oggetto fisico dedicato: lo prendi in mano, tocchi il microfono, parli, e l'assistente (Claude) fa le cose sul tuo MacBook e ti risponde a voce.

> «Apri Spotify e metti la musica» · «Alza il volume al 40» · «Cosa c'è sullo schermo?» · «Apri un nuovo tab e cerca il meteo di Milano» · «Accendi le luci del salotto» · «Copia negli appunti l'indirizzo del ristorante»

```
┌──────────────┐   Wi-Fi (HTTPS + WebSocket)  ┌───────────────────────┐        ┌────────────┐
│  iPhone      │ ───── voce → testo ───────▶ │  MacBook              │ ─────▶ │ Claude API │
│  (web app a  │                              │  server.js + agente   │ ◀───── │            │
│  tutto       │ ◀──── risposta parlata ───── │  esegue gli strumenti │        └────────────┘
│  schermo)    │ ◀──── richieste di conferma  │  (app, tasti, shell…) │
└──────────────┘                              └───────────────────────┘
```

- **Niente Xcode né App Store**: sull'iPhone gira una web app installata sulla schermata Home, a tutto schermo come un'app vera.
- **Il cervello è sul Mac**: la chiave API resta lì e i comandi vengono eseguiti lì.
- **Sicuro per impostazione predefinita**: serve un codice di abbinamento segreto, e i comandi "potenti" (terminale, AppleScript libero) vanno confermati sul telefono.

## Cosa sa fare

| Strumento | Cosa fa |
|---|---|
| `open_app` / `quit_app` | Apre o chiude app |
| `open_url` | Apre siti, ricerche, link `mailto:`, `facetime:`, `spotify:` … |
| `get_status` | App e finestra in primo piano, volume, batteria |
| `set_volume` | Volume e muto |
| `media_control` | Play/pausa/avanti/indietro/brano attuale su Spotify o Musica |
| `type_text` / `press_keys` | Scrive testo e preme scorciatoie (⌘T, ⌘W, Invio…) nell'app attiva |
| `take_screenshot` | L'AI "guarda" lo schermo per capire cosa fare |
| `clipboard` | Legge o scrive gli appunti |
| `notify` / `speak_on_mac` | Notifica o voce dal Mac |
| `list_shortcuts` / `run_shortcut` | Esegue i **Comandi Rapidi**: così controlla anche luci e accessori di Casa (HomeKit) e altri dispositivi |
| `run_applescript` 🔒 | AppleScript libero (Finder, Safari, Mail, finestre…). Chiede conferma |
| `run_shell` 🔒 | Comandi da terminale. Chiede conferma |

## Installazione

### 1. Sul Mac

Serve **Node.js 20.12 o successivo** (`brew install node`).

```bash
cd ai-remote
npm install
cp .env.example .env      # poi apri .env e inserisci la tua ANTHROPIC_API_KEY
npm start
```

Il terminale mostra un link del tipo `https://192.168.1.23:8787/?t=…` e un **QR code**.

### 2. Permessi di macOS (una volta sola)

Al primo utilizzo macOS chiede alcune autorizzazioni per il Terminale (o per `node`). Accettale, oppure attivale in **Impostazioni di Sistema → Privacy e sicurezza**:

- **Accessibilità**: serve per digitare testo e premere tasti
- **Registrazione schermo**: serve per gli screenshot
- **Automazione**: serve per controllare Spotify, Musica, Finder, ecc.

### 3. Sull'iPhone

1. Collega l'iPhone alla **stessa rete Wi-Fi** del Mac.
2. Inquadra il QR code con la Fotocamera (oppure apri il link in **Safari**).
3. Safari avvisa che il certificato non è attendibile, perché è generato dal tuo Mac. Tocca **Mostra dettagli → visita questo sito web**.
4. Tocca **Condividi → Aggiungi alla schermata Home**. Da ora "AI Remote" si apre a tutto schermo come un'app.
5. Tocca il microfono e concedi il permesso. Fatto!

> Se il riconoscimento vocale di Safari non funziona sul tuo iOS, usa il tasto 🎤 della tastiera nel campo di testo: la dettatura di iOS funziona sempre.

## Farlo diventare un "oggetto" dedicato

- **Accesso Guidato** (Impostazioni → Accessibilità → Accesso Guidato): blocca l'iPhone dentro AI Remote, così diventa un telecomando e basta. Triplo clic sul tasto laterale per attivarlo.
- **Blocco automatico: Mai** (Impostazioni → Schermo e luminosità), con l'iPhone sempre in carica su un supporto accanto al Mac. L'app tiene già lo schermo acceso quando è aperta.
- **Avvio automatico sul Mac**: `./install-autostart.sh` fa partire il server a ogni accesso, quindi quando accendi il Mac il telecomando è subito pronto. Per toglierlo: `./install-autostart.sh remove`.
- Il codice di abbinamento resta salvato in `.data/token`: il link non cambia tra un riavvio e l'altro. Per revocare l'accesso a tutti i dispositivi, cancella quel file.

## "E poi farlo funzionare anche sul resto"

Il progetto è già pensato per crescere:

- **Casa e accessori**: crea un Comando Rapido sul Mac (es. "Luci salotto", "Scena cinema") e l'AI lo trova ed esegue da sola con `run_shortcut`. Funziona con tutto ciò che è in HomeKit.
- **Altri dispositivi Apple**: tramite i Comandi Rapidi puoi anche mandare messaggi, controllare Apple TV e HomePod, avviare automazioni.
- **Nuovi strumenti**: ogni capacità è un oggetto in `tools.js` (nome, descrizione, schema, funzione `run`). Aggiungerne una significa aggiungere un elemento all'array.
- **Altri computer (Windows/Linux)**: il telefono e l'agente non dipendono dal Mac. Basta una versione di `tools.js` con i comandi del nuovo sistema (`xdg-open`, `wmctrl`, PowerShell…) per portarlo ovunque.

## Configurazione (`.env`)

| Variabile | Predefinito | Note |
|---|---|---|
| `ANTHROPIC_API_KEY` | – | Obbligatoria |
| `PORT` | `8787` | |
| `MODEL` | `claude-opus-5` | |
| `EFFORT` | `low` | `low` = risposte rapide, adatto alla voce. Alza a `medium`/`high` per compiti complessi |
| `AUTO_APPROVE` | `false` | `true` salta la conferma per shell/AppleScript (sconsigliato) |
| `FALLBACKS` | `on` | Se il modello rifiuta una richiesta, l'API riprova in automatico con un altro modello |
| `HTTPS` | `on` | `off` solo per test: senza HTTPS Safari non concede il microfono |

## Sicurezza

- Il server risponde solo a chi conosce il codice di abbinamento; il traffico nella rete locale è cifrato con HTTPS.
- Non esporre la porta su Internet (niente port forwarding sul router). Per usarlo fuori casa, usa una VPN come Tailscale.
- I comandi shell e AppleScript liberi richiedono sempre la tua conferma sul telefono, a meno di `AUTO_APPROVE=true`.
