---
name: grid-dynamic-viewport
description: Viewport dinamico con re-render al rilascio del pan, bordo perimetrale che maschera semiesagoni
metadata:
  type: project
---

# Griglia — Viewport Dinamico e Bordo Perimetrale

## Obiettivo

1. **Viewport dinamico**: panando la griglia, gli esagoni vengono ri-generati dopo il rilascio del mouse in modo da riempire sempre l'area visibile. Il pan con CSS transform rimane fluido durante il drag.
2. **Bordo perimetrale**: un bordo visibile sul container maschera i semiesagoni ai margini e dà un frame chiaro alla griglia.

---

## Sezione 1 — Bordo perimetrale (`style.css`)

`.grid-container` viene modificato:
- `overflow-x: auto; overflow-y: auto;` → `overflow: hidden;` (i scrollbar non servono più; il pan è gestito via drag)
- Aggiungere `border: 2px solid rgba(201, 168, 76, 0.4);` (oro tema a bassa opacità)
- Aggiungere `border-radius: 4px;`

I scrollbar CSS vanno rimossi (`::-webkit-scrollbar`, `scrollbar-width`, `scrollbar-color`) dato che il container non è più scrollabile.

---

## Sezione 2 — Viewport dinamico (`src/GridUI.js`)

### Stato modulo

Due nuove variabili a livello modulo, **persistenti tra i render**:

```js
let viewOffsetX = 0;   // pixel di offset orizzontale del viewport
let viewOffsetY = 0;   // pixel di offset verticale del viewport
```

A differenza di `panX/panY` (che si azzerano ad ogni render), queste accumulano lo spostamento totale e determinano quale regione del "mondo hex" è visibile.

### Funzione `hexCenter` (modificata)

Sottrae il viewOffset dalla posizione schermo:

```js
function hexCenter(col, row) {
  const r = hexR();
  return {
    x: r * SQRT3 * (col + 0.5 * (row & 1)) - viewOffsetX + PAD,
    y: r * 1.5 * row - viewOffsetY + PAD,
  };
}
```

### Funzione `gridStart` (nuova helper)

Calcola il primo col/row visibile dal viewOffset:

```js
function gridStart() {
  const r = hexR();
  return {
    startCol: Math.floor(viewOffsetX / (r * SQRT3)),
    startRow: Math.floor(viewOffsetY / (r * 1.5)),
  };
}
```

### `renderGrid` — loop modificato

Il loop principale usa `startCol/startRow` da `gridStart()`:

```js
const { startCol, startRow } = gridStart();
for (let row = startRow; row < startRow + rows; row++) {
  for (let col = startCol; col < startCol + cols; col++) {
    // resto invariato — data-c e data-r continuano a usare col/row assoluti
  }
}
```

I `data-c` e `data-r` sugli elementi SVG rimangono le coordinate hex assolute (usate per Firebase e per la selezione token). Solo la posizione schermo cambia.

### `mouseup` handler (modificato)

Quando il drag è terminato con un pan effettivo, accumula il delta nel viewOffset e triggera il re-render:

```js
container.addEventListener('mouseup', () => {
  if (_isDragging && _didPan) {
    viewOffsetX -= panX;
    viewOffsetY -= panY;
    _reRenderCallback?.();
  }
  _isDragging = false;
  container.style.cursor = 'grab';
});
```

Il segno è negativo perché `panX > 0` (drag a destra) significa guardare verso sinistra (viewOffset diminuisce).

### Zoom — reset del viewOffset

`zoomIn()`, `zoomOut()`, `zoomReset()` resettano `viewOffsetX = viewOffsetY = 0` prima del re-render. Questo riporta il viewport all'origine al cambio di zoom (comportamento semplice e prevedibile).

### `renderGrid` — no reset viewOffset

`renderGrid` **non** azzera `viewOffsetX/viewOffsetY` (a differenza di `panX/panY`). Il viewOffset persiste finché non viene esplicitamente resettato (zoom).

---

## File modificati

| File | Cambiamento |
|---|---|
| `style.css` | `.grid-container`: overflow hidden, border oro, border-radius; rimozione scrollbar CSS |
| `src/GridUI.js` | Nuove variabili `viewOffsetX/Y`; modifica `hexCenter`; nuova `gridStart`; modifica loop `renderGrid`; modifica `mouseup`; reset viewOffset in zoom |

---

## Comportamenti attesi

- Durante il drag: il pan è visivamente fluido (CSS transform).
- Al rilascio: la griglia si ri-renderizza mostrando gli esagoni corretti per la posizione raggiunta. I token vengono renderizzati nella posizione corretta.
- Zoom in/out/reset: riporta il viewport all'origine (col=0, row=0 in alto a sinistra).
- Il bordo oro del container maschera i semiesagoni e dà un frame chiaro alla griglia.
- La griglia non ha più scrollbar (il pan gestisce la navigazione).
