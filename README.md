# ⚔ D&D Combat Tracker

Un tracker di combattimento interattivo per Dungeons & Dragons 5e, progettato per gestire sessioni multiplayer con supporto per master e giocatori.

## Caratteristiche

- **Autenticazione multi-utente**: Accedi con Google o continua come ospite; possibilità di upgrade da ospite a Google senza perdere dati
- **Sessioni multiplayer**: Il master crea la sessione, i giocatori si uniscono con un codice; rejoin automatico al reload
- **Gestione dei combattimenti**: Tracker dei turni, iniziativa, punti vitali, condizioni e azioni dichiarate
- **Griglia di battaglia**: Posiziona token sulla griglia esagonale (1m per hex, punta in alto); distanze calcolate automaticamente; token morti in grigio con teschio
- **Schede personaggio**: Abilità, skill, tiri salvezza, slot magia, attacchi, incantesimi, inventario, death saves — sincronizzate in real-time con il combattente
- **Slot incantesimo**: Counter numerico +/− per gli slot usati, max editabile inline; modificatore extra per CD e bonus attacco magia
- **Libreria personaggi**: Salva e carica personaggi/creature per sessioni future
- **Gestione delle creature**: Il master può aggiungere creature dalla libreria e controllarle in combattimento
- **Sincronizzazione in tempo reale**: Tutti i partecipanti vedono gli aggiornamenti istantaneamente grazie a Firebase
- **Scritture concorrenti sicure**: `runTransaction` su HP, slot incantesimo e cambio turno per evitare race condition in multi-client
- **Notifiche eventi**: Popup per danni/cure subiti dal proprio personaggio
- **Log eventi**: Cronologia in tempo reale di danni, cure, KO, revive, cambi turno, condizioni, entrata/uscita combattenti

## Struttura del Progetto

```
├── app.js              # Entry point: event listeners top-level, orchestrazione viste
├── index.html          # Interfaccia HTML
├── style.css           # Tema fantasy dark (Cinzel/Crimson Text)
├── config.js           # Configurazione Firebase
│
└── src/
    ├── state.js            # Stato globale singleton (db, auth, session, myUid, ...)
    ├── core.js             # Helper core: initCombatManagers, exitToHome, modal condizioni
    ├── home.js             # Auth UI, libreria personaggi, picker, sessioni salvate
    ├── sheet.js            # Sheet listener, callbacks combattimento, apertura scheda
    ├── grid.js             # Render griglia e token bar
    │
    ├── Session.js          # Gestione sessione, auth, log eventi
    ├── CombatTracker.js    # Logica turni: nextTurn, sortedCombatants, reset
    ├── Combatant.js        # CRUD combattenti: add, updateHp, condizioni, remove
    ├── CharacterSheet.js   # Lettura/scrittura scheda su Firebase
    ├── CharacterLibrary.js # Libreria personaggi/creature per utente
    │
    ├── UI.js               # Render lista combattenti, modal condizioni, log
    ├── SheetUI.js          # Render scheda personaggio
    └── GridUI.js           # Render griglia esagonale SVG
```

## Come Iniziare

### Prerequisiti
- Un browser moderno con supporto JavaScript ES6+
- Accesso a Internet (per Firebase)
- Account Google (opzionale, per persistenza dati)

### Installazione

1. Clona o scarica il progetto
2. Configura le credenziali Firebase in `config.js`
3. Imposta le Firebase Security Rules (vedi CLAUDE.md)
4. Apri `index.html` nel browser — nessun build step necessario

### Prima Sessione

**Per il Master:**
1. Accedi con Google o come ospite
2. Crea una nuova sessione
3. Aggiungi creature dalla libreria o manualmente
4. Condividi il codice sessione con i giocatori

**Per i Giocatori:**
1. Accedi con Google o come ospite
2. Entra nella sessione con il codice del master
3. Seleziona o crea il tuo personaggio
4. Posiziona il tuo token sulla griglia

## Funzionalità Principali

### Combattimento
- Turni automatici ordinati per iniziativa
- HP con notifiche popup per danni/cure ricevuti
- Player KO restano nel turno per i death saves (3 successi = revive a 1 HP)
- Creature KO saltate automaticamente nel turno
- Condizioni applicabili a ogni combattente (avvelenato, stordito, ecc.)
- Azioni dichiarate visibili a tutti in real-time

### Griglia di Battaglia
- Griglia esagonale SVG interattiva (20×12 hex, 1m per hex)
- Token selector bar per posizionare/spostare i token
- Distanze calcolate automaticamente al click su un token
- Token morti visualizzati in grigio con teschio; token del proprio personaggio selezionato con bordo verde

### Scheda Personaggio
- Abilità, skill (3 livelli di competenza), tiri salvezza con toggle
- Slot incantesimo per livello con counter +/− e max editabile; modificatore extra per CD e bonus attacco
- Attacchi, incantesimi per livello (con prepared toggle), cantrip, inventario
- Death saves con tracking successi/fallimenti
- Sincronizzazione automatica CA e HP max al combattente in real-time

### Notifiche e Log
- Popup per danni/cure ricevuti dal proprio personaggio
- Log condiviso in real-time con tutti gli eventi di combattimento
- Cancellazione log disponibile per il master

## Tecnologie Utilizzate

- **Frontend**: HTML5, CSS3, JavaScript ES6+ (ES modules nativi, no bundler)
- **Database**: Firebase Realtime Database
- **Autenticazione**: Firebase Authentication (Google + anonima)
- **Font**: Google Fonts (Cinzel, Crimson Text)
- **Deploy**: GitHub Pages

## Roadmap e Miglioramenti Futuri

Vedi [TODO.txt](TODO.txt) per le funzionalità pianificate e i bug noti.

## Licenza

Vedi il file [LICENSE](LICENSE) per i dettagli.
