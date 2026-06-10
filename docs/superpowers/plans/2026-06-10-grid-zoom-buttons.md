# Zoom griglia con bottoni — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bottoni ➖/➕/⛶ nell'header della griglia per zoomare da 1× a 3×, con scroll nativo per il pan; a 1× tutto identico a oggi.

**Architecture:** Stato di zoom locale in `src/GridUI.js` (livelli discreti), applicato impostando `width`/`height` percentuali sull'SVG e la classe `grid-zoomed` (`overflow: auto`) sul contenitore; riapplicato dopo ogni re-render preservando lo scroll. Bottoni wired in `initGridControls` (binding once, pattern esistente). Nessun listener wheel.

**Tech Stack:** HTML + CSS + ES6 modules, no bundler. **Nessuna suite di test**: verifica statica con `~/.local/node/bin/node --check` (node NON è nel PATH) e verifica manuale finale.

**Spec:** `docs/superpowers/specs/2026-06-10-grid-zoom-buttons-design.md`

---

### Task 1: Zoom con bottoni

**Files:**
- Modify: `index.html:203-206` (`.grid-zoom-controls`)
- Modify: `src/GridUI.js` (stato zoom, `renderGrid`, `initGridControls`, commento di testa)
- Modify: `style.css` (`.grid-container.grid-zoomed`, `.grid-zoom-btn:disabled`)

- [ ] **Step 1: Bottoni nel markup**

In `index.html`, dentro `<div class="grid-zoom-controls">` (riga ~203), PRIMA di `btn-grid-edit`, aggiungere:

```html
              <button id="btn-zoom-out" class="grid-zoom-btn" title="Riduci zoom">➖</button>
              <button id="btn-zoom-in" class="grid-zoom-btn" title="Aumenta zoom">➕</button>
              <button id="btn-zoom-fit" class="grid-zoom-btn" title="Adatta alla finestra">⛶</button>
```

I bottoni master esistenti (`btn-grid-edit`, `btn-grid-reset`, con `style="display:none"`) restano invariati dopo i nuovi; i nuovi NON hanno `display:none` (visibili a tutti).

- [ ] **Step 2: Stato zoom e helper in `src/GridUI.js`**

Subito prima del commento `// ─── Re-render callback (resize) ───…` (dopo `tokenBaseColors`), aggiungere:

```js
// ─── Zoom griglia (stato locale per client; pan via scroll nativo) ──────────
const ZOOM_LEVELS = [1, 1.5, 2, 2.5, 3];
let _zoom = 1;

function _applyZoom(container) {
  const svg = container?.querySelector('svg');
  if (!svg) return;
  svg.setAttribute('width', `${_zoom * 100}%`);
  svg.setAttribute('height', `${_zoom * 100}%`);
  container.classList.toggle('grid-zoomed', _zoom > 1);
}

function _updateZoomButtons() {
  const i = ZOOM_LEVELS.indexOf(_zoom);
  const btnIn  = document.getElementById('btn-zoom-in');
  const btnOut = document.getElementById('btn-zoom-out');
  const btnFit = document.getElementById('btn-zoom-fit');
  if (btnIn)  btnIn.disabled  = i >= ZOOM_LEVELS.length - 1;
  if (btnOut) btnOut.disabled = i <= 0;
  if (btnFit) btnFit.disabled = _zoom === 1;
}

function _setZoom(z) {
  _zoom = z;
  _applyZoom(document.getElementById('grid-container'));
  _updateZoomButtons();
}
```

- [ ] **Step 3: Riapplicare zoom e scroll in `renderGrid`**

Attorno al rebuild dell'SVG (righe ~231-233), trasformare:

```js
  container.innerHTML =
    `<svg class="sq-svg" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" width="100%" height="100%">${inner}</svg>`;
  container.classList.toggle('grid-edit-active', !!editMode);
```

in:

```js
  // Preserva lo scroll del contenitore attraverso il rebuild (il clamp temporaneo lo azzererebbe)
  const prevScrollLeft = container.scrollLeft;
  const prevScrollTop  = container.scrollTop;

  container.innerHTML =
    `<svg class="sq-svg" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" width="100%" height="100%">${inner}</svg>`;
  container.classList.toggle('grid-edit-active', !!editMode);
  _applyZoom(container);
  container.scrollLeft = prevScrollLeft;
  container.scrollTop  = prevScrollTop;
```

- [ ] **Step 4: Wiring bottoni in `initGridControls`**

Sostituire (righe ~408-415):

```js
// ─── Controlli griglia (solo reset; nessun pan/zoom) ─────────────────────────

let _gridControlsBound = false;
export function initGridControls(onGridReset) {
  if (_gridControlsBound) return;
  _gridControlsBound = true;
  document.getElementById('btn-grid-reset')?.addEventListener('click', () => onGridReset?.());
}
```

con:

```js
// ─── Controlli griglia (reset e zoom a bottoni) ──────────────────────────────

let _gridControlsBound = false;
export function initGridControls(onGridReset) {
  if (_gridControlsBound) return;
  _gridControlsBound = true;
  document.getElementById('btn-grid-reset')?.addEventListener('click', () => onGridReset?.());
  document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
    const i = ZOOM_LEVELS.indexOf(_zoom);
    if (i < ZOOM_LEVELS.length - 1) _setZoom(ZOOM_LEVELS[i + 1]);
  });
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
    const i = ZOOM_LEVELS.indexOf(_zoom);
    if (i > 0) _setZoom(ZOOM_LEVELS[i - 1]);
  });
  document.getElementById('btn-zoom-fit')?.addEventListener('click', () => _setZoom(1));
  _updateZoomButtons();
}
```

- [ ] **Step 5: Aggiornare il commento di testa del file**

In `src/GridUI.js` riga 2, sostituire:

```js
// La griglia si adatta sempre al contenitore (viewBox), non è zoomabile né trascinabile.
```

con:

```js
// La griglia si adatta al contenitore (viewBox); zoom 1×-3× con bottoni, pan via scroll nativo.
```

- [ ] **Step 6: CSS**

In `style.css`, dopo il blocco `.grid-container` (righe ~2564-2571), aggiungere:

```css
.grid-container.grid-zoomed { overflow: auto; }
```

e, vicino alle regole `.grid-zoom-btn` esistenti (riga ~2573+), aggiungere:

```css
.grid-zoom-btn:disabled { opacity: 0.4; cursor: default; }
```

- [ ] **Step 7: Verifica statica**

- `~/.local/node/bin/node --check src/GridUI.js` → OK
- `grep -c "btn-zoom-" index.html` → 3; `grep -c "btn-zoom-" src/GridUI.js` → 6 (3 in `_updateZoomButtons`, 3 in `initGridControls`)
- `grep -n "grid-zoomed" src/GridUI.js style.css` → presente in entrambi
- `grep -n "wheel" src/GridUI.js` → nessun risultato (niente zoom con rotella)

- [ ] **Step 8: Commit**

```bash
git add index.html src/GridUI.js style.css
git commit -m "feat(grid): zoom 1x-3x con bottoni e pan via scroll nativo"
```

---

### Task 2: Aggiornare CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (bullet "Griglia quadrata" e bullet redesign in "### Completato")

- [ ] **Step 1: Due aggiornamenti puntuali**

1. Nel bullet che inizia con `- Griglia quadrata:`, sostituire il frammento `niente pan/zoom né bordo perimetrale` con `zoom 1×-3× con bottoni (➖/➕/⛶, pan via scroll nativo, stato locale per client), niente zoom con rotella né bordo perimetrale`.
2. In coda al bullet lungo `- Redesign "Grimorio miniato"` (attualmente termina con `(sull'ancora attuale = deselezione)`), aggiungere: `; zoom griglia a bottoni in .grid-zoom-controls visibile a tutti`.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: stato implementazione aggiornato (zoom griglia a bottoni)"
```

---

### Verifica manuale finale (utente, con Firebase reale)

1. A 1×: griglia identica a prima, nessuna scrollbar, ➖/⛶ disabilitati.
2. ➕ fino a 3× (➕ si disabilita), ➖ a ritroso, ⛶ torna a 1×.
3. Da zoomati e scrollati: click/spostamento, ghost, muri (master in modifica), tooltip, etichette distanza ok.
4. Aggiornamento realtime da altro client: zoom e posizione di scroll preservati.
5. Mobile: pan col dito, bottoni al tap; bottoni visibili a master e giocatori.
