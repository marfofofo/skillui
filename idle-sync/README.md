# IDLE SYNC

**Versione 2 di IDLE SOCIAL** ([`../idle-social`](../idle-social)). Il tuo vecchio iPhone, o qualsiasi iPad o browser, diventa un telecomando AI vocale per il Mac: parli, Claude agisce sul MacBook e ti risponde a voce. Tutti i dispositivi collegati restano sincronizzati.

> «Metti un po' di musica» · «Alza il volume al 40» · «Cosa c'è sullo schermo?» · «Accendi le luci del salotto»

```
 iPhone ─┐                                   ┌──────────────────────────┐        ┌────────────┐
 iPad   ─┼── Wi-Fi (HTTPS + WebSocket) ────▶ │ Mac: server.js + agente  │ ─────▶ │ Claude API │
 browser─┘  stessa conversazione, cronologia │ strumenti, stato, dati   │ ◀───── │ (streaming)│
            e impostazioni su tutti          └──────────────────────────┘        └────────────┘
```

## Novità della versione 2

| Funzione | Cosa fa |
|---|---|
| **Sincronizzazione** | Colleghi iPhone, iPad e browser insieme: vedono la stessa conversazione in tempo reale e chiunque può confermare un comando. La voce risponde solo sul dispositivo che ha fatto la domanda |
| **Widget del Mac** | Nella schermata a riposo, in stile StandBy: brano in riproduzione con i controlli, volume, batteria e app in uso. I tasti agiscono subito, senza passare dall'AI (istantanei e gratuiti) |
| **Azioni rapide** | Pulsanti sopra la sfera che mandano un comando con un tocco. Si creano, con nome, comando e icona, da Opzioni |
| **Risposte in streaming** | Il testo compare mentre Claude lo scrive |
| **Opzioni** | In stile Impostazioni di iOS: velocità/precisione delle risposte, istruzioni personali, conferma dei comandi, voce e velocità di lettura, azioni rapide, tema, nome del dispositivo, cancellazione della cronologia |
| **Cronologia persistente** | Salvata sul Mac (`.data/history.json`), con ora e dispositivo di ogni richiesta |

Impostazioni condivise (sul Mac): velocità delle risposte, istruzioni personali, conferme, azioni rapide. Impostazioni di ogni dispositivo: tema, voce, velocità di lettura, nome.

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
cd idle-sync
npm install
cp .env.example .env      # poi apri .env e inserisci la tua ANTHROPIC_API_KEY
npm start
```

Il terminale mostra un link del tipo `https://192.168.1.23:8788/?t=…` e un **QR code**.

### 2. Permessi di macOS (una volta sola)

Al primo utilizzo macOS chiede alcune autorizzazioni per il Terminale (o per `node`). Accettale, oppure attivale in **Impostazioni di Sistema → Privacy e sicurezza**:

- **Accessibilità**: serve per digitare testo e premere tasti
- **Registrazione schermo**: serve per gli screenshot
- **Automazione**: serve per controllare Spotify, Musica, Finder, ecc.

### 3. Sull'iPhone

1. Collega l'iPhone alla **stessa rete Wi-Fi** del Mac.
2. Inquadra il QR code con la Fotocamera (oppure apri il link in **Safari**).
3. Safari avvisa che il certificato non è attendibile, perché è generato dal tuo Mac. Tocca **Mostra dettagli → visita questo sito web**.
4. Tocca **Condividi → Aggiungi alla schermata Home**. Da ora "IDLE SYNC" si apre a tutto schermo come un'app.
5. Tocca il microfono e concedi il permesso. Fatto!

> Se il riconoscimento vocale di Safari non funziona sul tuo iOS, usa il tasto 🎤 della tastiera nel campo di testo: la dettatura di iOS funziona sempre.

## Design

Minimal, in bianco e nero, con il linguaggio visivo dei sistemi Apple: SF Pro, logo IDLE SYNC al centro (due cerchi che si sincronizzano mentre lavora), widget stile StandBy, sfera fluida monocromatica con bordi luminosi mentre ascolta, card di vetro, fogli e menu nativi, **scorri per eseguire** per le conferme.

- **Scuro**: nero `#000000`, testo `#F5F5F5`
- **Chiaro**: bianco `#F5F5F5` / `#FFFFFF`, testo `#0A0A0A`

L'unico colore è funzionale: verde/rosso per lo stato della connessione e rosso per le azioni distruttive.

## Farlo diventare un "oggetto" dedicato

- **Accesso Guidato** (Impostazioni → Accessibilità → Accesso Guidato): blocca l'iPhone dentro IDLE SYNC, così diventa un telecomando e basta. Triplo clic sul tasto laterale per attivarlo.
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
| `PORT` | `8788` | Diversa da IDLE SOCIAL (8787), così possono girare insieme |
| `MODEL` | `claude-opus-5` | |
| `EFFORT` | `low` | Valore iniziale di «Risposte» in Opzioni (`low` Rapide, `medium` Bilanciate, `high` Accurate) |
| `AUTO_APPROVE` | `false` | Valore iniziale di «Conferma i comandi potenti» in Opzioni (`true` = nessuna conferma, sconsigliato) |
| `IDLE_DEMO` | – | `1` mostra widget con dati di esempio: utile per provare l'interfaccia senza un Mac |
| `FALLBACKS` | `on` | Se il modello rifiuta una richiesta, l'API riprova in automatico con un altro modello |
| `HTTPS` | `on` | `off` solo per test: senza HTTPS Safari non concede il microfono |

## Sicurezza

- Il server risponde solo a chi conosce il codice di abbinamento; il traffico nella rete locale è cifrato con HTTPS.
- Non esporre la porta su Internet (niente port forwarding sul router). Per usarlo fuori casa, usa una VPN come Tailscale.
- I comandi shell e AppleScript liberi richiedono sempre la tua conferma sul telefono, a meno di `AUTO_APPROVE=true`.
