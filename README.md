# ⚔ D&D Combat Tracker

Un tracker di combattimento interattivo per Dungeons & Dragons 5e, progettato per gestire sessioni multiplayer con supporto per master e giocatori.

## Caratteristiche

- **Autenticazione multi-utente**: Accedi con Google o continua come ospite per partecipare a sessioni collaborative
- **Sessioni multiplayer**: Un Dungeon Master può creare sessioni e i giocatori possono unirsi con i loro personaggi
- **Gestione dei combattimenti**: Tracker dei turni, iniziativa, punti vitali e status dei combattenti
- **Griglia di battaglia**: Posiziona i tuoi token e quelli delle creature sulla griglia
- **Schede personaggio**: Visualizza e gestisci i dettagli del tuo personaggio (classe, livello, abilità, ecc.)
- **Libreria personaggi**: Salva e carica i tuoi personaggi per sessioni future
- **Gestione delle creature**: Il master può aggiungere e controllare creature nemiche
- **Sincronizzazione in tempo reale**: Tutti i partecipanti vedono gli aggiornamenti istantaneamente grazie a Firebase

## Struttura del Progetto

```
├── app.js              # Entry point principale dell'applicazione
├── index.html          # Interfaccia HTML
├── style.css           # Styling dell'interfaccia
│
├── Session.js          # Gestione della sessione e autenticazione
├── CombatTracker.js    # Logica del sistema di combattimento
├── Combatant.js        # Classe rappresentante un combattente
│
├── CharacterSheet.js   # Gestione delle schede personaggio
├── CharacterLibrary.js # Libreria di personaggi salvati
│
├── UI.js               # Componenti UI generali
├── SheetUI.js          # UI delle schede personaggio
├── GridUI.js           # UI della griglia di battaglia
│
├── config.js           # Configurazione Firebase
└── README.md           # Questo file
```

## Come Iniziare

### Prerequisiti
- Un browser moderno con supporto JavaScript ES6+
- Accesso a Internet (per Firebase)
- Account Google (opzionale, per persistenza dati)

### Installazione

1. Clona o scarica il progetto
2. Configura le credenziali Firebase in `config.js`
3. Apri `index.html` nel tuo browser
4. Accedi con Google o continua come ospite

### Prima Sessione

**Per il Master:**
1. Accedi all'applicazione
2. Crea una nuova sessione
3. Aggiungi creature nemiche dalla libreria
4. Condividi il codice della sessione con i giocatori

**Per i Giocatori:**
1. Accedi all'applicazione
2. Entra in una sessione usando il codice fornito dal master
3. Seleziona il tuo personaggio dalla libreria
4. Posiziona il tuo token sulla griglia di battaglia

## Funzionalità Principali

### Combattimento
- Gestione automatica dei turni basata sull'iniziativa
- Tracciamento dei punti vitali di tutti i combattenti
- Visualizzazione dello stato dei personaggi (vivo, ferito, morto)
- Possibilità di settare effetti e status

### Griglia di Battaglia
- Interfaccia interattiva per il posizionamento dei token
- Visibilità sincronizzata tra master e giocatori
- Supporto per creature e personaggi giocanti

### Schede Personaggio
- Visualizzazione dei dettagli del personaggio
- Gestione dei punti vita
- Tracciamento delle abilità e dei dettagli di classe

## Tecnologie Utilizzate

- **Frontend**: HTML5, CSS3, JavaScript ES6+
- **Database**: Firebase Realtime Database
- **Autenticazione**: Firebase Authentication
- **Font**: Google Fonts (Cinzel, Crimson Text)

## Roadmap e Miglioramenti Futuri

Vedi [TODO.txt](TODO.txt) per le funzionalità pianificate e i miglioramenti in corso.

## Licenza

Vedi il file [LICENSE](LICENSE) per i dettagli.