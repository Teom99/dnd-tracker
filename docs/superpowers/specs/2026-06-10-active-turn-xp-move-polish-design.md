# Turno attivo brillante, XP a destra, spostamento senza tooltip e dentro la propria area — design

**Data:** 2026-06-10 · **Branch:** redesign/grimoire

## Contesto

Quattro rifiniture alla vista combat:

1. il combattente di turno non risalta abbastanza nella rail Iniziativa;
2. il bottone "✨ Assegna XP" sta a sinistra nella toolbar, va a destra accanto a Scena e nave;
3. mentre un token è selezionato per lo spostamento, i tooltip on hover sulla griglia disturbano (deve vedersi solo il ghost);
4. un token più grande di 1×1 non può essere spostato sulle caselle che già occupa (click sul proprio footprint = deselezione).

## 1. Turno attivo più brillante nella rail

Solo CSS su `.rail-item.active-turn .rail-ring`: bagliore oro molto più intenso (doppia ombra, blur/spread maggiori) con leggera pulsazione continua via `@keyframes` (~2s, alterna due intensità di ombra). Nessun cambio di markup o JS. Gli altri stati (selezione, KO) restano invariati.

## 2. Bottone "✨ Assegna XP" a destra nella toolbar

In `index.html` il bottone `#btn-award-xp-open` si sposta da `#master-controls` a `.combat-toolbar-shared`, come primo elemento (prima di `🖼 Scena`), con classe `hidden` nel markup. Uscendo dal contenitore master-only la visibilità diventa esplicita e combinata:

- nel listener realtime (`app.js`, dove oggi c'è il toggle per modalità): `hidden = !isMaster || (progressionMode ?? 'xp') !== 'xp'` (lì `isMaster` è già calcolato);
- `UI.renderMasterPanel` lo nasconde ai non-master all'ingresso in sessione (prima del primo snapshot), come già fa col select progressione.

Listener click in `app.js` invariato (stesso id).

## 3. Niente tooltip sulla griglia durante lo spostamento

Nel `mousemove` dell'SVG in `renderGrid`: se `canMoveSelected` è vero (token selezionato spostabile dal viewer), non mostrare mai il tooltip (`hideCombatTooltip()` al posto di `showCombatTooltip`), si vede solo il ghost. Tooltip invariati quando nessun token spostabile è selezionato e nella rail.

## 4. Spostamento dentro la propria area

In `renderGrid`:

- **Click handler**: quando il click cade su una cella occupata dal token selezionato (`occupantId === selectedId`) e `canMoveSelected` è vero:
  - se la cella è l'ancora attuale (`col === pos[selectedId].col && row === pos[selectedId].row`) → solo `onSelect(null)` (deselezione, nessuna scrittura Firebase);
  - altrimenti → `onMove(selectedId, col, row)` + `onSelect(null)` (la cella diventa la nuova ancora top-left; `canPlace` esenta già le celle del token stesso, ma va comunque chiamata per validare i bordi: un'ancora interna può spingere il footprint fuori griglia o su muri/altri token).
  - Per token 1×1 la cella del footprint coincide con l'ancora: comportamento identico a oggi (click = deselezione).
  - Se `canMoveSelected` è falso (es. giocatore con token altrui selezionato): click sul token = toggle selezione, come oggi.
  - Click su un altro token: selezione, invariato.
- **Ghost**: il check `occId === selectedId` che oggi nasconde il ghost su tutto il footprint viene sostituito da "nascondi solo sull'ancora attuale"; sulle altre celle del proprio footprint il ghost appare (sono destinazioni valide).

## Fuori scope

- Tooltip della rail durante lo spostamento (restano attivi).
- Drag & drop, animazioni di movimento del token.
- Cambi al flusso del modal XP (solo posizione/visibilità del bottone).

## Test

Verifica manuale:

1. Rail: il ritratto del combattente di turno pulsa con bagliore oro intenso, nettamente distinguibile; selezione e KO invariati.
2. Toolbar: ✨ a destra prima di Scena; visibile solo al master in modalità XP; sparisce in Milestone; i giocatori non lo vedono mai (nemmeno al primo render); il modal si apre come prima.
3. Griglia, token selezionato spostabile: nessun tooltip in hover (solo ghost); deselezionando, i tooltip tornano.
4. Token 2×2+: click su una cella interna del footprint diversa dall'ancora → il token si sposta lì; click sull'ancora → deselezione senza movimenti; il ghost appare sulle celle interne (non sull'ancora); ancora interna che porterebbe il footprint fuori griglia o su muri → niente ghost e click senza effetto.
5. Token 1×1: click sul token = deselezione (come prima).
6. Giocatore con token altrui selezionato: click sul token = deselezione, nessuno spostamento.
