# Grid Pan & Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove mouse-wheel zoom, add left-mouse-button drag-to-pan via CSS transform, and add a master-only reset button that clears all token positions from the grid.

**Architecture:** Pan is implemented as a CSS `translate` transform on the SVG element — no re-render on drag, smooth and minimal. Module-level state tracks drag position and a `_didPan` flag prevents click events from firing after a drag. The reset button calls a new `Session.clearAllGridPositions()` method which nulls the entire Firebase `grid/` node.

**Tech Stack:** Vanilla JS ES6 modules, SVG, Firebase Realtime Database (`set` from `firebase/database`)

---

## File Map

| File | Change |
|---|---|
| `src/GridUI.js` | Remove wheel listener; add pan state + drag listeners; update `initZoomControls` signature; reset pan on render; add `_didPan` guard to click handler |
| `src/Session.js` | Add `clearAllGridPositions()` method |
| `index.html` | Add `#btn-grid-reset` button (hidden by default) |
| `app.js` | Pass `onGridReset` callback to `initZoomControls`; show button only for master |

---

## Task 1: Remove wheel zoom from GridUI.js

**Files:**
- Modify: `src/GridUI.js:334-338`

- [ ] **Step 1: Remove the wheel event listener block**

In `src/GridUI.js`, inside `initZoomControls()`, delete these lines (currently ~334–338):

```js
// DELETE this entire block:
container.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (e.deltaY < 0) zoomIn();
  else zoomOut();
}, { passive: false });
```

After the deletion, `initZoomControls` should look like:

```js
export function initZoomControls() {
  document.getElementById('btn-zoom-in')?.addEventListener('click', zoomIn);
  document.getElementById('btn-zoom-out')?.addEventListener('click', zoomOut);
  document.getElementById('btn-zoom-reset')?.addEventListener('click', zoomReset);

  const container = document.getElementById('grid-container');
  if (!container) return;

  // Re-render al resize del container
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => { _reRenderCallback?.(); }).observe(container);
  }
}
```

- [ ] **Step 2: Manual verify**

Open the app in the browser, navigate to the grid view. Scroll the mouse wheel over the grid — nothing should happen (no zoom). The zoom `+` / `−` / `↺` buttons should still work.

---

## Task 2: Add pan state variables to GridUI.js

**Files:**
- Modify: `src/GridUI.js` (top of file, after line 11)

- [ ] **Step 1: Add pan state after the existing zoom constants**

In `src/GridUI.js`, after this line:
```js
const ZOOM_STEP = 0.15;
```

Add:
```js
let panX       = 0;
let panY       = 0;
let _isDragging = false;
let _didPan    = false;
let _dragStartX = 0;
let _dragStartY = 0;
```

---

## Task 3: Add drag-to-pan listeners in initZoomControls

**Files:**
- Modify: `src/GridUI.js:initZoomControls`

- [ ] **Step 1: Update initZoomControls to set cursor and register drag listeners**

Replace the entire `initZoomControls` function with:

```js
export function initZoomControls(onGridReset) {
  document.getElementById('btn-zoom-in')?.addEventListener('click', zoomIn);
  document.getElementById('btn-zoom-out')?.addEventListener('click', zoomOut);
  document.getElementById('btn-zoom-reset')?.addEventListener('click', zoomReset);
  document.getElementById('btn-grid-reset')?.addEventListener('click', () => onGridReset?.());

  const container = document.getElementById('grid-container');
  if (!container) return;

  container.style.cursor = 'grab';

  container.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    _isDragging = true;
    _didPan     = false;
    _dragStartX = e.clientX - panX;
    _dragStartY = e.clientY - panY;
    container.style.cursor = 'grabbing';
  });

  container.addEventListener('mousemove', (e) => {
    if (!_isDragging) return;
    panX = e.clientX - _dragStartX;
    panY = e.clientY - _dragStartY;
    _didPan = true;
    const svg = container.querySelector('svg');
    if (svg) svg.style.transform = `translate(${panX}px,${panY}px)`;
  });

  container.addEventListener('mouseup', () => {
    _isDragging = false;
    container.style.cursor = 'grab';
  });

  container.addEventListener('mouseleave', () => {
    _isDragging = false;
    container.style.cursor = 'grab';
  });

  // Re-render al resize del container
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => { _reRenderCallback?.(); }).observe(container);
  }
}
```

---

## Task 4: Reset pan on re-render and guard click against drag

**Files:**
- Modify: `src/GridUI.js:renderGrid`

- [ ] **Step 1: Reset pan state at the start of renderGrid**

In `renderGrid`, immediately after the line:
```js
container.innerHTML =
  `<svg class="hex-svg" width="${svgW}" height="${svgH}">${inner}</svg>`;
```

Add:
```js
panX = 0;
panY = 0;
```

This ensures that after a zoom or Firebase-triggered re-render, pan is at the origin and the newly-created SVG has no leftover transform.

- [ ] **Step 2: Add _didPan guard to the SVG click handler**

In `renderGrid`, find the `svg.addEventListener('click', ...)` block. Add a `_didPan` check at the very top of the handler:

```js
svg.addEventListener('click', (e) => {
  if (_didPan) { _didPan = false; return; }   // ← ADD THIS LINE
  const el = e.target.closest('[data-c]');
  if (!el) return;
  // ... rest of existing code unchanged
});
```

- [ ] **Step 3: Manual verify pan**

Open the app, go to the grid. Click and drag on the grid — the hexes should slide with the mouse. Release and click a hex — a token should select/move as before (no accidental move during drag). Zoom in/out with buttons — pan resets to zero (grid snaps back to origin).

- [ ] **Step 4: Commit Tasks 1–4**

```bash
git add src/GridUI.js
git commit -m "feat: replace wheel zoom with LMB drag-to-pan on grid"
```

---

## Task 5: Add clearAllGridPositions to Session.js

**Files:**
- Modify: `src/Session.js:131-133` (after existing `clearGridPosition`)

- [ ] **Step 1: Add the new method after clearGridPosition**

In `src/Session.js`, after this block:
```js
async clearGridPosition(combatantId) {
  await set(ref(this._db, `sessions/${this.code}/grid/${combatantId}`), null);
}
```

Add:
```js
async clearAllGridPositions() {
  await set(ref(this._db, `sessions/${this.code}/grid`), null);
}
```

No new imports needed — `set` and `ref` are already imported at the top of `Session.js`.

---

## Task 6: Add reset button to index.html

**Files:**
- Modify: `index.html:538`

- [ ] **Step 1: Add the reset button after btn-zoom-reset**

In `index.html`, find:
```html
<button id="btn-zoom-reset" class="grid-zoom-btn" title="Reset">↺</button>
```

Add the new button immediately after it:
```html
<button id="btn-grid-reset" class="grid-zoom-btn" title="Rimuovi tutti i token dalla griglia" style="display:none">🗑</button>
```

`style="display:none"` ensures the button is hidden by default in HTML; JS in app.js will reveal it for the master only.

---

## Task 7: Wire up reset callback and visibility in app.js

**Files:**
- Modify: `app.js:895`

- [ ] **Step 1: Pass callback and show button only for master**

In `app.js`, find:
```js
GridUI.initZoomControls();
```

Replace with:
```js
GridUI.initZoomControls(() => state.session.clearAllGridPositions());
const _btnGridReset = document.getElementById('btn-grid-reset');
if (_btnGridReset) _btnGridReset.style.display = state.session.isMaster ? '' : 'none';
```

- [ ] **Step 2: Manual verify reset button**

Log in as **master**: the 🗑 button should be visible in the grid toolbar. Place a few tokens on the grid. Click 🗑 — all tokens should disappear from the grid immediately (Firebase update propagates), but the combatants remain in the initiative list.

Log in as **player**: the 🗑 button must be invisible.

- [ ] **Step 3: Commit Tasks 5–7**

```bash
git add src/Session.js index.html app.js
git commit -m "feat: add master-only grid reset button clearing all token positions"
```
