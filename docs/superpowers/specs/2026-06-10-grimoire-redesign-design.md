# Redesign "Grimorio miniato" — Design Doc

**Data:** 2026-06-10
**Stato:** approvato dall'utente (brainstorming con visual companion)
**Branch di lavoro:** `redesign/grimoire`

## Obiettivo

Redesign visivo completo del D&D Combat Tracker con identità **"Grimorio miniato"**: il sito come libro antico — cornici dorate, blackletter, capolettera, sigilli di cera. Due fasi: (1) design system + reskin di tutte le viste a struttura invariata, (2) ristrutturazione della vista combattimento in dashboard tattica.

## Decisioni prese

| Tema | Decisione |
|---|---|
| Concept visivo | Grimorio miniato (scelto tra 12 alternative mostrate nel visual companion) |
| Temi | Tema unico; rimossi il toggle "🎨 Stile" e `theme-old` |
| Intensità metafora | Media: cornici, capolettera, sigilli sulle azioni chiave; layout e leggibilità moderni; decorazioni solo CSS, niente texture/immagini |
| Dispositivi | Mobile-first per i giocatori (telefono al tavolo), desktop ricco per il master |
| Layout combat desktop | Dashboard tattica: rail turni a sinistra, griglia dominante al centro, cronaca a destra, dettaglio del selezionato sotto |
| Ordine mobile | Turni → La mia card → Griglia → Altri combattenti → Cronaca |
| Strategia | Due fasi sulla stessa branch, ognuna funzionante e testabile |

## Design system "Grimorio"

### Palette (variabili CSS in `:root`, sostituisce entrambe le palette attuali)

| Token | Valore | Uso |
|---|---|---|
| `--bg-deep` | `#14100a` | sfondo profondo (cuoio) |
| `--bg-page` | `#1f1812` | contenitori di vista (pagina); gradiente `175deg` verso `--bg-deep` |
| `--bg-panel` | `rgba(0,0,0,.28)` | pannelli/card su pagina |
| `--gold` | `#d4af5e` | titoli, bordi attivi, azioni primarie |
| `--gold-light` | `#e3c87e` | testo su bottoni oro, nomi |
| `--gold-dim` | `#8a6d32` | bordi marcati, fregi |
| `--border` | `#5e4a20` / `#4a3a1c` | bordi pannelli (forte/tenue) |
| `--text` | `#dcc9a4` | testo principale |
| `--text-muted` | `#9c8a66` | testo secondario |
| `--wax` | `#a83232` (scuro `#7a1d1d`) | danni, pericolo, sigilli, capolettera |
| `--heal` | `#5e8f54` | cure, HP giocatori, anello token PG |
| `--arcane` | `#6e4a8a` | condizioni magiche |

### Tipografia (Google Fonts)

| Font | Ruolo |
|---|---|
| UnifrakturMaguntia | SOLO titolo app e titoli di vista — mai testo o dati |
| Cinzel | intestazioni di sezione, nomi combattenti, bottoni |
| EB Garamond | corpo testo, dati, input (già in uso) |
| IM Fell English (corsivo) | note a margine, placeholder, sottotitoli, voci log |

Si rimuove Crimson Text. Font da caricare nel `<link>` esistente in `index.html`.

### Componenti

- **Cornice di vista**: doppia cornice dorata via `::before`/`::after` (inset 6px e 10px) sul contenitore `.view` — zero markup extra; su mobile (<640px) si assottiglia a cornice singola
- **Pannelli/card**: fondo scuro, bordo oro tenue, fregi `❧` agli angoli via pseudo-elementi
- **Bottoni primari**: gradiente oro inciso (`#3a2a10→#241806`), bordo `--gold-dim`, testo Cinzel maiuscolo
- **Bottoni pericolosi**: ceralacca — gradiente rosso scuro con sigillo rotondo (radial-gradient) per Reset e azioni distruttive
- **Bottoni secondari/fantasma**: bordo tenue, fondo trasparente
- **Capolettera rosso**: prima lettera in `--wax` più grande, nei punti narrativi (log, anteprima personaggio in home)
- **Barra HP**: fondo quasi nero con bordo `#3a2d12`, riempimento gradiente rosso (`#5e1e1e→#9c3030`); verde per cure/PG dove già differenziato
- **Condizioni**: pillole con bordo colorato per famiglia (arcano/oro/ceralacca) su fondo translucido
- **Log**: corsivo IM Fell con `✒` rosso, timestamp a margine
- **Input**: fondo `#0e0a06`, bordo tenue, placeholder in corsivo Fell
- **Divisori**: filetto sfumato con parola centrale in corsivo ("oppure")
- **Modal**: foglio pergamena con doppia cornice
- **Toast notifiche**: pergamena con sigillo rosso (danno) / verde (cura)
- **Banner errori**: striscia ceralacca

## Fase 1 — Reskin (struttura HTML/JS invariata)

Riscrittura completa di `style.css` come design system + tocchi minimi a `index.html` (font link, rimozione bottoni tema). Rimozione del codice tema in `app.js`/`home.js` (toggle + localStorage `theme`).

- **Home**: titolo blackletter con bagliore, pannelli con fregi per personaggio/sessioni/libreria/master/giocatore; bottone Google riconoscibile su pannello pergamena; ospite come fantasma
- **Combat**: header come intestazione di capitolo (codice sessione = riquadro-timbro cliccabile per copiare, round in Cinzel); card combattente con nome Cinzel, HP ornata, pillole condizioni; turno attivo = cornice dorata accesa + bagliore; morti desaturati col teschio; death saves come tacche ✦/✗; form aggiungi-creatura e picker come pannelli discreti; modal condizioni pergamena
- **Scheda personaggio**: `<details>` come capitoli (summary Cinzel con ⚜ e filetto), caratteristiche come medaglioni, slot con contatori oro, inventario con puntatura a penna. `data-path` e logica intoccati
- **Griglia**: solo costanti colore in `GridUI.js` — tavola pergamena scura, linee oro tenue, muri pietra, anello oro luminoso sull'attivo, anello verde PG
- **Log, toast, errori**: come da componenti

Checkpoint: sito completamente trasformato e utilizzabile con la struttura attuale.

## Fase 2 — Dashboard tattica

### Desktop (≥1100px) — CSS Grid

```
[ header: ⚜ CODICE · Round N | Turno successivo ▶ · XP · 🖼 · 🚢 · Reset · Esci ]
[ rail 64px ][ griglia (dominante)            ][ cronaca ~270px ]
[ dettaglio combattente selezionato (card completa)             ]
```

- **Rail turni**: ritratti circolari in ordine d'iniziativa (emoji/iniziale) con mini-barra HP sotto; attivo = anello oro luminoso, PG = anello verde, KO = teschio sbiadito; in fondo `＋` apre "Aggiungi creatura" come modal (e "Aggiungi compagno" per i player, secondo i permessi attuali)
- **Centro**: griglia; pannello nave e immagine scena si scambiano col tabellone in quest'area (comportamento attuale conservato)
- **Cronaca**: log + svuota in fondo
- **Dettaglio**: card completa del combattente selezionato, stessi bottoni/callback di oggi; selezione = click su token in griglia o ritratto nel rail; default = combattente di turno; a ogni cambio turno la selezione torna sul nuovo combattente attivo (la selezione manuale vale solo entro il turno corrente)

### Mobile

Pila verticale: rail turni orizzontale scorrevole → la mia card (fissa) → griglia → altri combattenti (tocco su ritratto apre la card qui) → cronaca ripiegabile. Visibilità HP invariata (master vede creature, player vede PG, hint opzionale).

### Impatto JS

- `src/state.js`: nuovo `state.selectedCombatantId`
- `src/UI.js`: nuova `renderTurnRail`; il dettaglio riusa il template card e l'event delegation esistenti; le due liste Creature/Giocatori restano come render "altri combattenti" su mobile
- `src/GridUI.js`: click su token → selezione (oltre al comportamento esistente)
- `app.js`: wiring selezione nel listener (`_startListening` continua a ri-renderizzare tutto; nessuna scrittura nel listener)
- Master controls nell'header; XP award resta pannello a discesa
- Nessuna modifica al modello dati Firebase

## Fuori scope

- Nessuna nuova funzionalità di gioco; nessuna modifica a `Session.js`, `Combatant.js`, `CombatTracker.js`, `CharacterSheet.js`, `CharacterLibrary.js`
- Nessuna modifica alle security rules o al modello dati
- Niente immagini/texture raster: tutte le decorazioni sono CSS

## Collaudo (manuale, niente framework nel progetto)

Checklist a due browser (master desktop + player mobile emulato):

1. Auth Google/ospite, creazione e join sessione, rejoin al reload
2. Turni (incluso KO: player resta per death saves, creature saltate), danni/cure con notifiche, condizioni, revive a 3 successi
3. Aggiunta creatura (modal Fase 2) da libreria, ricerca mostri, compagno player
4. Griglia: movimento con footprint taglie, muri in modifica, reset
5. Selezione: token ↔ rail ↔ dettaglio coerenti; default segue il turno
6. Pannello nave e immagine scena nello slot centrale
7. Log: scrittura sulle azioni, svuota condiviso
8. Visibilità HP per ruolo; scheda personaggio: ogni `data-path` scrive ancora su Firebase
9. Responsive: 360px, 768px, 1100px+, su entrambe le viste principali
