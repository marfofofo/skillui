# IDLE SYNC

**Versione 2 di IDLE SOCIAL** ([`../idle-social`](../idle-social)). Il tuo vecchio iPhone, o qualsiasi iPad o browser, diventa un telecomando AI vocale per il Mac: parli, Claude agisce sul MacBook e ti risponde a voce. Tutti i dispositivi abbinati restano sincronizzati.

**Non serve nessuna API key**: IDLE SYNC usa **Claude Code** già installato sul Mac, con il tuo account.

> «Metti un po' di musica» · «Alza il volume al 40» · «Cosa c'è sullo schermo?» · «Accendi le luci del salotto»

```
 iPhone ─┐                                  ┌───────────────────────────┐   claude -p   ┌──────────────┐
 iPad   ─┼── Wi-Fi (HTTPS + WebSocket) ───▶ │ Mac: IDLE SYNC            │ ────────────▶ │ Claude Code  │
 browser─┘  dispositivi abbinati,           │ abbinamento, sync, widget │ ◀──── MCP ─── │ (il tuo      │
            stessa conversazione            │ strumenti del Mac         │   strumenti   │  account)    │
                                            └───────────────────────────┘               └──────────────┘
```

## Novità della versione 2

| Funzione | Cosa fa |
|---|---|
| **Claude Code come motore** | Ogni comando lancia `claude -p` sul Mac con il tuo login. Gli strumenti del Mac arrivano a Claude Code da un server MCP interno; la conversazione continua con `--resume` |
| **Abbinamento dei dispositivi** | Codice a 6 cifre monouso (o QR che lo contiene), token personale per ogni dispositivo, elenco dei dispositivi con stato, rinomina e rimozione |
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

Servono **Node.js 20.12 o successivo** (`brew install node`) e **Claude Code** installato e autenticato: se il comando `claude` ti apre una sessione, sei a posto.

```bash
cd idle-sync
npm install
npm start
```

Il terminale mostra un **codice a 6 cifre** e un **QR code** per abbinare il primo dispositivo. Il file `.env` è facoltativo (vedi Configurazione).

### 2. Permessi di macOS (una volta sola)

Al primo utilizzo macOS chiede alcune autorizzazioni per il Terminale (o per `node`). Accettale, oppure attivale in **Impostazioni di Sistema → Privacy e sicurezza**:

- **Accessibilità**: serve per digitare testo e premere tasti
- **Registrazione schermo**: serve per gli screenshot
- **Automazione**: serve per controllare Spotify, Musica, Finder, ecc.

### 3. Abbina l'iPhone

1. Collega l'iPhone alla **stessa rete Wi-Fi** del Mac.
2. Inquadra il QR con la Fotocamera: si apre Safari e l'abbinamento parte da solo. In alternativa apri l'indirizzo mostrato nel terminale e scrivi il codice.
3. Safari avvisa che il certificato non è attendibile, perché è generato dal tuo Mac: **Mostra dettagli → visita questo sito web**.
4. **Condividi → Aggiungi alla schermata Home**. Da ora IDLE SYNC si apre a tutto schermo come un'app.
5. Tocca la sfera e concedi il microfono.

**Altri dispositivi**: da un dispositivo già abbinato vai in **Opzioni › Abbina un nuovo dispositivo** (QR + codice, valido 10 minuti), oppure scrivi `p` e premi Invio nel terminale del Mac. In Opzioni vedi tutti i dispositivi abbinati, se sono collegati, e puoi rimuoverli.

> Se il riconoscimento vocale di Safari non funziona sul tuo iOS, usa il tasto 🎤 della tastiera nel campo di testo.

## Design

Minimal, in bianco e nero, con il linguaggio visivo dei sistemi Apple: SF Pro, logo IDLE SYNC al centro (due cerchi che si sincronizzano mentre lavora), widget stile StandBy, sfera fluida monocromatica con bordi luminosi mentre ascolta, card di vetro, fogli e menu nativi, **scorri per eseguire** per le conferme.

- **Scuro**: nero `#000000`, testo `#F5F5F5`
- **Chiaro**: bianco `#F5F5F5` / `#FFFFFF`, testo `#0A0A0A`

L'unico colore è funzionale: verde/rosso per lo stato della connessione e rosso per le azioni distruttive.

## Farlo diventare un "oggetto" dedicato

- **Accesso Guidato** (Impostazioni → Accessibilità → Accesso Guidato): blocca l'iPhone dentro IDLE SYNC, così diventa un telecomando e basta. Triplo clic sul tasto laterale per attivarlo.
- **Blocco automatico: Mai** (Impostazioni → Schermo e luminosità), con l'iPhone sempre in carica su un supporto accanto al Mac. L'app tiene già lo schermo acceso quando è aperta.
- **Avvio automatico sul Mac**: `./install-autostart.sh` fa partire il server a ogni accesso, quindi quando accendi il Mac il telecomando è subito pronto. Per toglierlo: `./install-autostart.sh remove`.
- I dispositivi abbinati restano validi anche dopo un riavvio. Per revocarli tutti in una volta, cancella `.data/devices.json`.

## "E poi farlo funzionare anche sul resto"

Il progetto è già pensato per crescere:

- **Casa e accessori**: crea un Comando Rapido sul Mac (es. "Luci salotto", "Scena cinema") e l'AI lo trova ed esegue da sola con `run_shortcut`. Funziona con tutto ciò che è in HomeKit.
- **Altri dispositivi Apple**: tramite i Comandi Rapidi puoi anche mandare messaggi, controllare Apple TV e HomePod, avviare automazioni.
- **Nuovi strumenti**: ogni capacità è un oggetto in `lib/tools.js` (nome, descrizione, schema, funzione `run`). Aggiungerne una significa aggiungere un elemento all'array: arriva da sola sia a Claude Code (MCP) sia all'API.
- **Altri computer (Windows/Linux)**: il telefono e l'agente non dipendono dal Mac. Basta una versione di `lib/tools.js` e `lib/mac.js` con i comandi del nuovo sistema (`xdg-open`, `wmctrl`, PowerShell…) per portarlo ovunque.

## Configurazione (`.env`)

Tutto facoltativo: copia `.env.example` in `.env` solo se vuoi cambiare qualcosa.

| Variabile | Predefinito | Note |
|---|---|---|
| `ENGINE` | `claude-code` | `claude-code` usa la CLI con il tuo account; `api` usa la Claude API e richiede `ANTHROPIC_API_KEY` |
| `MODEL` | – | Con Claude Code un alias come `opus` o `sonnet`; vuoto = quello del tuo account. Con l'API: `claude-opus-5` |
| `CLAUDE_BIN` | `claude` | Percorso di Claude Code, se non è nel PATH |
| `PORT` | `8788` | Diversa da IDLE SOCIAL (8787), così possono girare insieme |
| `EFFORT` | `low` | Valore iniziale di «Risposte» in Opzioni (`low` Rapide, `medium` Bilanciate, `high` Accurate) |
| `AUTO_APPROVE` | `false` | Valore iniziale di «Conferma i comandi potenti» (`true` = nessuna conferma, sconsigliato) |
| `IDLE_DEMO` | – | `1` mostra widget con dati di esempio: utile per provare l'interfaccia senza un Mac |
| `HTTPS` | `on` | `off` solo per test: senza HTTPS Safari non concede il microfono |

## Come è fatto

```
server.js              avvio: HTTP, abbinamento, WebSocket, codice nel terminale
lib/config.js          configurazione (.env e variabili d'ambiente)
lib/pairing.js         codici monouso, token per dispositivo (salvati solo come hash), limiti ai tentativi
lib/hub.js             sincronizzazione: conversazione, conferme, impostazioni, cronologia, widget
lib/engines/           claude-code.js (CLI + stream-json), mcp.js (strumenti via MCP), api.js (opzionale)
lib/tools.js           strumenti dell'AI sul Mac
lib/mac.js             stato e controlli diretti per i widget
lib/system.js          processi e AppleScript
public/js/             web app a moduli: main, pairing, connection, approval, voice, orb, icons, util
```

## Sicurezza

- Solo i dispositivi abbinati possono collegarsi. Il codice di abbinamento è monouso; dopo 5 tentativi sbagliati quell'indirizzo viene bloccato per 5 minuti, e dopo 20 il codice cambia.
- Sul Mac si salva solo l'impronta (SHA-256) dei token, mai i token stessi. Un dispositivo rimosso viene scollegato subito.
- Claude Code gira senza strumenti di codice: può usare solo ricerca web e gli strumenti del Mac, esposti su un server MCP locale (127.0.0.1) protetto da un segreto generato a ogni avvio.
- Il traffico nella rete locale è cifrato con HTTPS. Non esporre la porta su Internet (niente port forwarding): per usarlo fuori casa usa una VPN come Tailscale.
- I comandi del Terminale e gli AppleScript liberi richiedono sempre la conferma da un dispositivo, a meno di disattivarla in Opzioni.
