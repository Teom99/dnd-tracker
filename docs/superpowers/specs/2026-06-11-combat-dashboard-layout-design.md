# Riorganizzazione layout vista combat — Design

**Data:** 2026-06-11
**Stato:** validato col partner (wireframe in `.superpowers/brainstorm/`, scelte confermate nel browser companion)

## Obiettivo

Tre modifiche alla vista combat, più una conseguenza:

1. Rimuovere i chip token (`#grid-token-bar`) dalla sezione griglia: ridondanti rispetto alla rail iniziativa.
2. Portare la toolbar azioni a larghezza piena, sopra rail + griglia + colonna destra; rail e griglia partono alla stessa altezza.
3. Mostrare il dettaglio del combattente selezionato a destra della griglia (al posto della colonna log).
4. (conseguenza di 3) Spostare il log eventi sotto la griglia, come fisarmonica espandibile.

## Layout desktop (≥1100px), dall'alto

```
[header sottile]      Sessione ABC123 📋 | ⚜ Round 3 ⚜ | [XP▾] ← Esci
[barra di comando]    ▶ Turno Successivo  ↺ Reset Incontro | ✨ XP  🖼 Scena  🚢 Damselfly
[dashboard]           rail iniziativa (84px) | griglia + cronaca (1fr) | dettaglio (340px)
```

### 1. Header sottile

`.combat-header` perde cornice e sfondo: riga di testo discreta. Sessione + 📋 Copia a sinistra; **Round** in evidenza al centro (small-caps, fregi ⚜); select XP/Milestone (solo master) e ← Esci a destra. Nessun cambio di markup funzionale, solo stile.

### 2. Barra di comando a larghezza piena

`#combat-toolbar` esce da `#combat-center` e si colloca tra header e `.dashboard`, a larghezza piena. È l'unico elemento in cima con bordo e bottoni pieni. I gruppi interni restano invariati: master a sinistra (`#master-controls`: Turno Successivo, Reset), condivisi a destra (`.combat-toolbar-shared`: ✨ Assegna XP — solo master in modalità XP —, Scena, Damselfly). Nessun bottone Cronaca in toolbar: il controllo del log sta nella barra fisarmonica.

### 3. Dettaglio a destra della griglia

La `.detail-area` (con `#detail-list` e `#empty-detail-msg`) entra nella `.dashboard` come terza colonna (~340px), sticky come la rail. La logica di rendering non cambia: mostra `state.selectedGridTokenId ?? currentTurnId`.

### 4. Cronaca a fisarmonica sotto la griglia

`#event-log-section` si sposta dentro `#combat-center`, subito sotto `#grid-section`:

- **Chiusa (default):** una sola riga — `📜 Cronaca`, badge rosso con il conteggio degli eventi arrivati da chiusa, chevron ▲.
- **Aperta:** la riga diventa intestazione (con 🗑 cancella log e chevron ▼) e sotto appare `#event-log` con altezza massima ~200px e scroll interno.
- L'intera riga è cliccabile e fa toggle. Stato per client, in memoria (a ogni load riparte chiusa).
- **Badge:** il client tiene il numero di log all'ultima apertura (`state`, in memoria); a ogni `renderLogs` se la fisarmonica è chiusa il badge mostra `totale − ultimoVisto` (nascosto se 0); all'apertura il contatore si allinea e il badge sparisce. Nessuna scrittura su Firebase: regola "nel listener solo render" invariata.

### 5. Rimozione chip token

Via `#grid-token-bar` dal markup, `renderTokenBar` (definizione, export e chiamata in `src/grid.js`) e i CSS `.grid-token-bar` / `.grid-token-chip*`. Selezione e piazzamento restano da rail iniziativa e da griglia: selezionare un ritratto e toccare una casella piazza anche i token non ancora posizionati (flusso già esistente, nessuna funzione persa).

## Mobile (<1100px)

- La toolbar sale in cima, subito dopo l'header (oggi è dentro la colonna centrale a metà pagina). Nuovo ordine flex: header 0, error 1, **toolbar 2**, rail 3, dettaglio 4, centro 5 (griglia + cronaca), colonne card 6, note sessione 7.
- La fisarmonica della cronaca segue la griglia dentro il centro (stesso meccanismo del desktop); chiusa costa una riga.
- La `detail-area` dentro `.dashboard` continua a partecipare all'ordine flex grazie a `display: contents` sulla dashboard.

## Cosa NON cambia

- Render di rail, griglia, dettaglio, log (`UI.renderLogs`) e relative regole di visibilità HP/CA.
- Posizione del bottone ✨ Assegna XP (a destra, accanto a Scena e nave).
- Comportamento di scena/nave che si scambiano con la griglia in `#combat-center`.
- Vista scheda personaggio, home, modali.

## Rischi e attenzioni

- Le card combattente devono stare bene a ~340px: già accade su mobile, ma verificare elementi larghi (barre HP, bottoni azione).
- Su desktop stretto (1100–1250px) la colonna dettaglio da 340px comprime la griglia: accettabile, la griglia si adatta via viewBox; eventualmente `minmax` più morbido in implementazione.
- L'ordine mobile cambia per la toolbar e la cronaca: verificare manualmente il flusso su schermo stretto.
