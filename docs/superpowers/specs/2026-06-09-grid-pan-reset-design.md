---
name: grid-pan-reset
description: Rimozione zoom rotella, pan con LMB drag (CSS transform), tasto reset griglia solo master
metadata:
  type: project
---

# Griglia di Battaglia — Pan e Reset

## Obiettivo

Modificare l'interazione con la griglia esagonale:
1. La rotella del mouse non cambia più lo zoom.
2. Tenere premuto il tasto sinistro del mouse e trascinare pana la griglia.
3. Un nuovo tasto "Reset griglia" (solo master) rimuove tutti i token dalla griglia senza toccare la lista combattenti.

---

## Architettura

### 1. Rimozione wheel zoom (`src/GridUI.js`)

In `initZoomControls()`, eliminare il listener `wheel` su `#grid-container`. I tre bottoni zoom esistenti (`btn-zoom-in`, `btn-zoom-out`, `btn-zoom-reset`) restano invariati.

### 2. Pan con LMB drag (`src/GridUI.js`)

**Stato modulo** — tre variabili aggiunte a livello modulo:
```js
let panX = 0;
let panY = 0;
let _isDragging = false;
```

**Reset pan** — `panX` e `panY` vengono azzerati ogni volta che la griglia viene ri-renderizzata (al termine di `renderGrid`, prima di attaccare i listener SVG). Questo evita offset incoerenti dopo zoom o resize.

**Listener** — aggiunti in `initZoomControls()` sul `#grid-container`:

| Evento | Azione |
|---|---|
| `mousedown` (button 0) | Salva posizione iniziale, imposta `_isDragging = true`, cursore `grabbing` |
| `mousemove` | Se `_isDragging`: calcola delta, aggiorna `panX/panY`, applica `svg.style.transform = translate(${panX}px,${panY}px)` |
| `mouseup` | Ferma drag, cursore `grab` |
| `mouseleave` | Ferma drag |

Il cursore del container è `grab` di default e `grabbing` durante il drag. L'SVG non viene ri-renderizzato durante il drag — solo il suo `style.transform` cambia.

**Conflitto con click** — il drag non deve triggerare la selezione/movimento di token. Si aggiunge un flag `_didPan = false` che viene impostato a `true` al primo `mousemove` con `_isDragging`. Nel listener `click` dell'SVG, se `_didPan` è `true` si ignora il click e si resetta il flag.

### 3. Reset griglia

**`src/Session.js`** — nuovo metodo:
```js
async clearAllGridPositions() {
  await set(ref(this._db, `sessions/${this.code}/grid`), null);
}
```

**`index.html`** — aggiungere in `.grid-zoom-controls`:
```html
<button id="btn-grid-reset" class="grid-zoom-btn" title="Rimuovi tutti i token dalla griglia">🗑</button>
```

**`src/GridUI.js → initZoomControls()`** — firma aggiornata per accettare un callback opzionale `onGridReset`:
```js
export function initZoomControls(onGridReset) { ... }
```
Il listener su `btn-grid-reset` chiama `onGridReset?.()`.

**`src/grid.js`** — passare il callback a `initZoomControls`:
```js
GridUI.initZoomControls(() => state.session.clearAllGridPositions());
```

**Visibilità** — il bottone `btn-grid-reset` viene nascosto/mostrato via JS in `grid.js` dopo l'init, in base a `state.session.isMaster`. Non è necessario CSS dedicato: `element.style.display = isMaster ? '' : 'none'`.

---

## File modificati

| File | Cambiamento |
|---|---|
| `src/GridUI.js` | Rimuove wheel zoom; aggiunge stato pan + listener drag; aggiorna firma `initZoomControls` |
| `src/grid.js` | Passa callback `clearAllGridPositions` a `initZoomControls`; nasconde `btn-grid-reset` se non master |
| `src/Session.js` | Aggiunge `clearAllGridPositions()` |
| `index.html` | Aggiunge `btn-grid-reset` nella toolbar griglia |

---

## Comportamenti attesi

- La rotella del mouse sopra la griglia non fa nulla (scroll nativo del browser se il container è overflow).
- LMB drag pana la griglia; LMB click su un esagono seleziona/muove come prima.
- Pan si azzera ad ogni re-render (zoom, resize, cambio stato Firebase).
- Il master vede il bottone 🗑 nella toolbar; i player no.
- Premendo 🗑 tutti i `sessions/{code}/grid/{id}` vengono cancellati; i combattenti restano nella lista.
