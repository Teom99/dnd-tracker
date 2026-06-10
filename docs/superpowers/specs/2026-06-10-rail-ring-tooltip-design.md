# Rail con anelli HP, tooltip hover, select progressione nell'header, distanze euclidee — design

**Data:** 2026-06-10 · **Branch:** redesign/grimoire

## Contesto

Sei migliorie alla vista combat richieste dopo il redesign header/toolbar (spec `2026-06-10-combat-header-xp-rail-design.md`):

1. niente nome sotto i ritratti della rail Iniziativa;
2. HP come anello attorno al ritratto, non barra sotto;
3. tooltip con informazioni al passaggio del mouse su rail e griglia;
4. avversari in rosso nella rail;
5. select XP/Milestone spostato nell'header;
6. distanze di griglia approssimate per quadrati (non più Chebyshev "da esagoni").

## 1. Rail Iniziativa: solo ritratti con anello HP

In `GridUI.renderInitiativeList` e relativo CSS:

- Rimossi l'elemento `rail-name` e la barra `rail-hp`/`rail-hp-fill`/`rail-hp-hidden` (markup e CSS).
- Ogni voce è il solo ritratto (iniziali, o 💀 se KO) avvolto da:
  - **anello esterno** `conic-gradient` che si svuota in senso orario con la percentuale HP (custom property `--hp` impostata inline, colore `--ring-c`);
  - **bordo interno fisso** color fazione, sempre pieno (variante "B" scelta nei mockup): così anche a HP quasi zero si riconosce la fazione.
- Colori fazione: verde (`#5e8f54`) per PG e compagni (`type` player/pet); **rosso** (`--red`/`#a83232`) per creature avversarie (`faction` assente o `evil`); oro (`#b8954a`) per creature alleate (`faction: 'good'`).
- Visibilità HP invariata: per i giocatori l'anello delle creature è **sempre pieno al 100%** (`hpVisible = isMaster || type !== 'creature'`, come oggi per la barra).
- Invariati: bagliore oro su turno attivo, contorno oro su voce selezionata, opacità ridotta + 💀 sui KO, voci ＋ (master) / 🐾 (player) in coda, click per selezione.
- L'attributo `title` sulle voci viene sostituito dal tooltip (sezione 2).

## 2. Tooltip on hover (rail + griglia)

Componente condiviso: un singolo `div#combat-tooltip` (creato una volta, posizionato `position: fixed` vicino al cursore, stile pergamena coerente col tema, `z-index` sopra la griglia). API JS in `GridUI.js`: `showCombatTooltip(combatant, viewerCtx, x, y)` / `hideCombatTooltip()` usata da entrambe le superfici.

Contenuto ("essenziale"), nel rispetto delle regole di visibilità esistenti:

- **Nome** (sempre).
- **HP `12/26`** se visibile (master, propria card, o non-creatura — stessa regola `showFullHp` delle card); se il viewer è un giocatore e la creatura ha `showHealthHint`, mostra l'hint qualitativo testuale (le stesse soglie/etichette di `healthHintText` in `UI.js`) al posto dei numeri; altrimenti nessuna riga HP.
- **CA** se visibile (`!creatura || master || showAC === true`), da `combatant.armorClass` (già sincronizzata real-time dalla scheda).
- **Condizioni attive** (nomi, dalla mappa `conditions`).

Superfici:

- **Rail**: `mouseenter`/`mousemove`/`mouseleave` sulle voci `li[data-id]` (delegati sul container).
- **Griglia**: sostituisce l'attuale tooltip SVG col solo nome (`sq-tooltip-name` e relativa logica in `renderGrid`), riusando l'hit-layer `mousemove` esistente.
- Attivo solo su dispositivi con hover reale (guardia `window.matchMedia('(hover: hover)')`); su touch nessun tooltip e nessun cambio di comportamento.

## 3. Select XP/Milestone nell'header

`#select-progression-mode-live` si sposta dalla toolbar (`#master-controls`) all'header, a destra accanto a "← Esci". Solo master: `UI.renderMasterPanel` lo mostra/nasconde (stessa logica usata per `#master-controls`). Listener in `app.js` invariato (stesso id). Il bottone "✨ Assegna XP" resta nella toolbar.

## 4. Distanze euclidee arrotondate

`GridUI.squareDistance` mantiene la separazione bordo-a-bordo per asse (`axisDist`) ma restituisce la distanza euclidea arrotondata al mezzo metro:

```js
const d = Math.hypot(dc, dr);
return Math.round(d * 2) / 2;
```

Esempio: 4 caselle in diagonale = 5.5 m (oggi 4 m). `fmtM` già formatta i mezzi metri. Unico consumer rimasto: le etichette di distanza sopra i token in `renderGrid`. Aggiornare la riga "distanza Chebyshev bordo-a-bordo" in CLAUDE.md.

## Fuori scope

- Tooltip su mobile/touch (deciso esplicitamente: non serve).
- Nessun cambio a regole di visibilità HP/CA, movimento, validazione piazzamento, card combattente (mobile/dettaglio), token della griglia (colori già a fazione).
- Nessun cambio al modello dati Firebase.

## Test

Verifica manuale (nessuna suite automatica):

1. Rail: solo ritratti, niente nomi né barre; anello verde sui PG, rosso sugli avversari, oro sugli alleati; bordo interno color fazione sempre visibile; da giocatore gli anelli delle creature sono pieni; da master si svuotano con gli HP.
2. Turno attivo, selezione e KO nella rail invariati; ＋/🐾 funzionanti.
3. Tooltip su rail e griglia (desktop): nome sempre; HP/CA secondo le regole (giocatore non vede HP/CA delle creature non rivelati; con hint attivo vede l'etichetta qualitativa); condizioni elencate; il tooltip segue il mouse e sparisce uscendo.
4. Su touch (o emulazione mobile): nessun tooltip, tap/selezione invariati.
5. Header: select XP/Milestone visibile solo al master accanto a Esci, cambio modalità funziona (bottone ✨ appare/sparisce); la toolbar non contiene più il select.
6. Griglia: etichette distanza euclidee (es. diagonale 3 caselle = 4 m, 4 caselle = 5.5 m); token grandi misurati bordo-a-bordo.
7. Mobile: rail orizzontale leggibile con i soli ritratti.
