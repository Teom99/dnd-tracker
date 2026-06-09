# Grid Dynamic Viewport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the user releases the mouse after panning, the hex grid re-renders to show the correct hexes for the new viewport position; a CSS border frames the grid cleanly, masking any partial hexes at the edges.

**Architecture:** Two persistent module-level variables (`viewOffsetX`, `viewOffsetY`) track the cumulative pixel offset of the viewport across renders. `hexCenter` subtracts the offset from screen coordinates; the render loop starts from `gridStart()` (the first col/row that falls in the visible area). On `mouseup` after a pan, the delta is accumulated into viewOffset and `_reRenderCallback` fires a re-render. Zoom resets viewOffset to 0. The container switches from scrollable to `overflow: hidden` with a gold border.

**Tech Stack:** Vanilla JS ES6 modules, SVG, CSS

---

## File Map

| File | Change |
|---|---|
| `src/GridUI.js` | New state vars `viewOffsetX/Y`; new `gridStart()`; modify `hexCenter`; modify render loop; modify `mouseup`; reset viewOffset in zoom functions |
| `style.css` | `.grid-container`: `overflow: hidden`, border, border-radius; remove scrollbar rules |

---

## Task 1: Add viewOffset state + gridStart helper

**Files:**
- Modify: `src/GridUI.js:13-19` (after pan variables) and after `computeGridSize`

- [ ] **Step 1: Add two viewOffset variables after the pan state block**

In `src/GridUI.js`, after this line:
```js
let _dragListenersAttached = false;
```

Add:
```js
let viewOffsetX = 0;
let viewOffsetY = 0;
```

- [ ] **Step 2: Add gridStart helper after computeGridSize**

In `src/GridUI.js`, after the closing `}` of `computeGridSize` (currently at line 28), add:

```js
function gridStart() {
  const r = hexR();
  return {
    startCol: Math.floor(viewOffsetX / (r * SQRT3)),
    startRow: Math.floor(viewOffsetY / (r * 1.5)),
  };
}
```

This returns the first hex col/row that should appear at the top-left of the viewport given the current offset. With viewOffsetX=0/viewOffsetY=0 it returns `{startCol:0, startRow:0}` (unchanged behaviour).

---

## Task 2: Modify hexCenter to subtract viewOffset

**Files:**
- Modify: `src/GridUI.js:32-38`

- [ ] **Step 1: Update hexCenter**

Replace the current `hexCenter` function:
```js
function hexCenter(col, row) {
  const r = hexR();
  return {
    x: r * SQRT3 * (col + 0.5 * (row & 1)) + PAD,
    y: r * 1.5 * row + PAD,
  };
}
```

With:
```js
function hexCenter(col, row) {
  const r = hexR();
  return {
    x: r * SQRT3 * (col + 0.5 * (row & 1)) - viewOffsetX + PAD,
    y: r * 1.5 * row - viewOffsetY + PAD,
  };
}
```

When `viewOffsetX = 0` this is identical to before. When `viewOffsetX > 0` hexes shift left on screen (viewport scrolled right — showing higher-col hexes on the left edge).

---

## Task 3: Modify renderGrid loop to iterate from gridStart

**Files:**
- Modify: `src/GridUI.js:109-110`

- [ ] **Step 1: Replace the loop bounds**

In `renderGrid`, find:
```js
for (let row = 0; row < rows; row++) {
  for (let col = 0; col < cols; col++) {
```

Replace with:
```js
const { startCol, startRow } = gridStart();
for (let row = startRow; row < startRow + rows; row++) {
  for (let col = startCol; col < startCol + cols; col++) {
```

`data-c` and `data-r` attributes already use the loop variables `col` and `row`, which are now absolute hex coordinates. The Firebase `cellMap` lookup `cellMap[\`${col}_${row}\`]` continues to work correctly since it uses the same absolute coords.

---

## Task 4: Modify mouseup to accumulate viewOffset and re-render

**Files:**
- Modify: `src/GridUI.js:368-371`

- [ ] **Step 1: Update the mouseup handler**

In `initZoomControls`, find the current `mouseup` listener:
```js
container.addEventListener('mouseup', () => {
  _isDragging = false;
  container.style.cursor = 'grab';
});
```

Replace with:
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

The sign is negative: `panX > 0` means the user dragged right (grid moved right), so the viewport has shifted to show hexes to the left — viewOffsetX must decrease.

After `_reRenderCallback?.()` fires, `renderGrid` runs synchronously and resets `panX = 0; panY = 0` (already present at line 178–179). The `_didPan` flag remains `true` until the subsequent `click` event consumes it (the guard at line 247 handles this).

---

## Task 5: Reset viewOffset in zoom functions + commit

**Files:**
- Modify: `src/GridUI.js:317-334`

- [ ] **Step 1: Add viewOffset reset to zoomIn, zoomOut, zoomReset**

Replace the three zoom functions:
```js
export function zoomIn() {
  if (currentZoom < MAX_ZOOM) {
    currentZoom = Math.min(MAX_ZOOM, parseFloat((currentZoom + ZOOM_STEP).toFixed(2)));
    _reRenderCallback?.();
  }
}

export function zoomOut() {
  if (currentZoom > MIN_ZOOM) {
    currentZoom = Math.max(MIN_ZOOM, parseFloat((currentZoom - ZOOM_STEP).toFixed(2)));
    _reRenderCallback?.();
  }
}

export function zoomReset() {
  currentZoom = 1;
  _reRenderCallback?.();
}
```

With:
```js
export function zoomIn() {
  if (currentZoom < MAX_ZOOM) {
    currentZoom = Math.min(MAX_ZOOM, parseFloat((currentZoom + ZOOM_STEP).toFixed(2)));
    viewOffsetX = 0;
    viewOffsetY = 0;
    _reRenderCallback?.();
  }
}

export function zoomOut() {
  if (currentZoom > MIN_ZOOM) {
    currentZoom = Math.max(MIN_ZOOM, parseFloat((currentZoom - ZOOM_STEP).toFixed(2)));
    viewOffsetX = 0;
    viewOffsetY = 0;
    _reRenderCallback?.();
  }
}

export function zoomReset() {
  currentZoom = 1;
  viewOffsetX = 0;
  viewOffsetY = 0;
  _reRenderCallback?.();
}
```

- [ ] **Step 2: Manual verify viewport behaviour**

Open the app, go to the grid view. Pan right — grid slides. Release — grid re-renders showing new hexes. Zoom in/out — grid snaps back to origin (startCol=0, startRow=0). Tokens placed on Firebase-tracked positions still appear in the correct hex after pan.

- [ ] **Step 3: Commit Tasks 1–5**

```bash
git add src/GridUI.js
git commit -m "feat: dynamic hex viewport — re-render on pan release"
```

---

## Task 6: Add perimeter border to grid container

**Files:**
- Modify: `style.css:2400-2413`

- [ ] **Step 1: Replace .grid-container rule and remove scrollbar rules**

Find and replace the entire block (lines 2400–2413):
```css
.grid-container {
  overflow-x: auto;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: var(--border-warm) transparent;
  flex: 1;
  min-width: 0;
  min-height: 300px;
}

.grid-container::-webkit-scrollbar       { height: 4px; }
.grid-container::-webkit-scrollbar-track { background: transparent; }
.grid-container::-webkit-scrollbar-thumb { background: var(--border-warm); border-radius: 2px; }
```

With:
```css
.grid-container {
  overflow: hidden;
  flex: 1;
  min-width: 0;
  min-height: 300px;
  border: 2px solid rgba(201, 168, 76, 0.4);
  border-radius: 4px;
}
```

The three `::-webkit-scrollbar` rules are removed entirely (the container is no longer scrollable).

- [ ] **Step 2: Manual verify border**

The grid should have a subtle gold border and rounded corners. Partial hexes at the edges should be cleanly masked by the container boundary. No scrollbars should appear.

- [ ] **Step 3: Commit Task 6**

```bash
git add style.css
git commit -m "feat: gold perimeter border on grid container"
```
