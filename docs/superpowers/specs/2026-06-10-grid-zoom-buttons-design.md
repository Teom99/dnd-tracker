# Zoom della griglia con bottoni — design

**Data:** 2026-06-10 · **Branch:** redesign/grimoire

## Contesto

La griglia di battaglia è un SVG che si adatta sempre al contenitore (`#grid-container`, `overflow: hidden`, altezza `min(70vh, 620px)`; SVG `viewBox` + `preserveAspectRatio` con `width/height: 100%`). Serve poter zoomare in dentro e in fuori **tramite bottoni** (esplicitamente: non con la rotella del mouse).

## Design

Approccio: scala CSS + scroll nativo. A 1× nulla cambia rispetto a oggi; a zoom maggiore l'SVG diventa più grande del contenitore e ci si sposta con le scrollbar native (o pan touch).

### Bottoni

In `.grid-zoom-controls` (header della griglia), **prima** degli attuali bottoni master (✏️ 🗑) e **visibili a tutti**:

- `btn-zoom-out` (➖), `btn-zoom-in` (➕), `btn-zoom-fit` (⛶, torna a 1×), classe `.grid-zoom-btn` esistente.
- Livelli: `1 → 1.5 → 2 → 2.5 → 3` (clamp). A 1×: ➖ e ⛶ `disabled`; a 3×: ➕ `disabled`.

### Meccanica

- Stato **locale per client** (variabile di modulo in `GridUI.js`, non su Firebase, si azzera al reload).
- A zoom z: l'SVG riceve `width`/`height` = `${z*100}%` e `#grid-container` ha la classe `grid-zoomed` (`overflow: auto`). A 1× attributi `100%` e niente classe (comportamento odierno identico).
- Lo zoom si riapplica **dopo ogni re-render** (l'SVG viene ricreato a ogni snapshot via `innerHTML`): in `renderGrid` si salvano `scrollLeft`/`scrollTop` del contenitore prima del rebuild e si ripristinano dopo aver riapplicato lo zoom (altrimenti il clamp temporaneo del contenuto azzererebbe lo scroll).
- Il letterbox di `preserveAspectRatio` scala con lo zoom (i margini vuoti crescono proporzionalmente): accettato, mantiene la geometria identica a oggi.
- Wiring dei bottoni una sola volta (pattern `_gridControlsBound` esistente in `initGridControls`).

### Invarianti

Nessun cambio a: movimento/click, ghost di anteprima, disegno muri a drag (`elementFromPoint` è scroll-safe), tooltip (coordinate `fixed` da `clientX/Y`), etichette distanza, modalità modifica, rotella del mouse (nessun listener wheel).

## Fuori scope

- Zoom con rotella o pinch-to-zoom.
- Zoom < 1× (la vista fit è già il minimo).
- Persistenza del livello di zoom tra sessioni o sync tra client.

## Test

Verifica manuale:

1. A 1× la griglia è identica a oggi (fit, nessuna scrollbar); ➖/⛶ disabilitati.
2. ➕ fino a 3×: la griglia cresce, compaiono le scrollbar, ➕ si disabilita a 3×; ➖ scala indietro; ⛶ torna subito a 1×.
3. Da zoomati: click/spostamento token, ghost, selezione, disegno muri (master in modifica), tooltip e etichette distanza funzionano normalmente anche dopo scroll.
4. Con zoom attivo, un aggiornamento realtime (es. un altro client muove un token) non azzera zoom né posizione di scroll.
5. Mobile: pan col dito sulla griglia zoomata; i bottoni rispondono al tap.
6. I bottoni sono visibili sia al master sia ai giocatori.
