# Griglia: alleati opachi e ghost di anteprima spostamento — design

**Data:** 2026-06-10 · **Branch:** redesign/grimoire

## Contesto

Due migliorie alla griglia di battaglia (`renderGrid` in `src/GridUI.js`):

1. i token delle creature alleate (`faction: 'good'`) hanno fill semitrasparente `rgba(138,109,50,0.35)`: sui token più grandi di 1×1 si vedono le linee della griglia sotto;
2. spostando un token (seleziona → click destinazione) manca un feedback visivo della destinazione prima del click.

## 1. Alleati opachi

In `renderGrid` (riga ~161), il fill delle creature alleate diventa opaco: `#2b2110` (cuoio-oro scuro, coerente con gli altri token opachi: proprio token `#16240f`, PG `#13241c`, nemici `#2a100c`). Lo stroke resta `#b8954a` (selezione/turno attivo invariati). Nessun altro colore cambia.

## 2. Ghost di anteprima spostamento

Quando esiste un token selezionato spostabile dal viewer (`isMaster || myOwnedIds.has(selectedId)`) e il mouse si muove sulla griglia:

- Sulla cella sotto il cursore — interpretata come angolo top-left dell'impronta, stessa semantica del click di spostamento — appare un **ghost del token selezionato**: stesso `rect` arrotondato con i colori fazione del token (fill/stroke calcolati come per il token reale), `opacity: 0.45`, dimensione dell'intera impronta (1×1…4×4), con le iniziali del nome.
- Il ghost appare **solo se il piazzamento è valido** secondo `canPlace` (dentro i bordi, niente muri, niente sovrapposizioni con altri token); su destinazioni vietate non appare nulla.
- Sparisce quando: il mouse esce dalla griglia, la cella sotto il cursore è occupata dal token selezionato stesso, non c'è selezione, o il viewer non può muovere il token.
- Implementazione: nello stesso listener `mousemove` dell'SVG già usato dal tooltip; un singolo gruppo `<g class="sq-ghost">` riusato/riposizionato, `pointer-events: none`, rimosso su `mouseleave`. Nessun re-render completo per frame.
- In modalità modifica griglia (`editMode`, disegno muri) la preview è disattivata, come lo è il movimento.
- Su touch non c'è `mousemove` da hover: nessun cambiamento di comportamento.

Nessuna modifica a click, validazione, Firebase o modello dati: solo feedback visivo locale.

## Fuori scope

- Drag & drop dei token (il movimento resta seleziona → click).
- Preview su touch.
- Cambi ai colori di PG, nemici o token morti.

## Test

Verifica manuale:

1. Creatura alleata 2×2/3×3 sulla griglia: fill opaco, niente linee visibili sotto; nemici e PG invariati.
2. Token selezionato (master e proprietario): muovendo il mouse, ghost con colori e impronta del token sulle destinazioni valide; nulla su muri/fuori bordi/celle occupate; il ghost segue il cursore senza scie.
3. Click sulla destinazione: il token si sposta esattamente dove mostrava il ghost.
4. Giocatore con token altrui selezionato: nessun ghost.
5. Modalità modifica: nessun ghost mentre si disegnano muri.
6. Deselezione/mouse fuori griglia: ghost rimosso.
