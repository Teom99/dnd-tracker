# Square Grid with Walls and Creature Sizes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hexagonal battle grid with a square grid whose dimensions the master sets during the session, with master-drawn walls that block movement and per-token creature sizes (1×1 to 4×4).

**Architecture:** Keep the existing SVG + CSS-transform render path (`GridUI.js`); swap hex polygons for square rects, drive grid size from a Firebase `gridConfig` node, add a `walls` node and a `size` field on combatants/characters. Movement validates footprint against bounds, walls, and other tokens.

**Tech Stack:** Vanilla ES6 modules (no bundler/framework), Firebase Realtime Database, SVG. **No automated test harness exists** — verification is manual in-browser with two clients (master + player). Each task ends in a commit.

**Spec:** `docs/superpowers/specs/2026-06-09-square-grid-walls-sizes-design.md`

---

## File Structure

| File | Responsibility for this feature |
|---|---|
| `src/Session.js` | New Firebase ops: `setGridConfig`, `toggleWall`, `clearWalls`, `resetGrid`. |
| `src/Combatant.js` | `size` field on add; `setSize`. |
| `src/GridUI.js` | Rewrite: square geometry, footprint/size helpers, square distance, walls + multi-cell rendering, modeless wall-toggle, dimension-aware SVG. Zoom/pan unchanged. |
| `src/grid.js` | Pass `gridConfig`/`walls` through; wire wall-toggle + size-override callbacks. |
| `app.js` | Read `gridConfig`/`walls` from snapshot; wire master dimension inputs, reset, token-size override; master-only control visibility. |
| `src/sheet.js` | Sync sheet `size` → combatant (like AC). |
| `index.html` | Grid header: dimension inputs, master reset, token-size select, updated hint; `size` selects in sheet + creature form. |
| `style.css` | Square cell styles (`.sq*`) replacing hex (`.hx*`); master grid controls. |
| `CLAUDE.md` | Update grid description + data model. |

---

## Conventions used across tasks

Size → footprint side (cells):

```js
const SIZE_FOOTPRINT = { tiny: 1, small: 1, medium: 1, large: 2, huge: 3, gargantuan: 4 };
function footprintOf(size) { return SIZE_FOOTPRINT[size] || 1; }
```

Anchor = top-left cell. A token at `(col,row)` size side `n` covers `col..col+n-1` × `row..row+n-1`.

Default grid: `cols=20, rows=20`. Missing `gridConfig`/`size` fall back to these defaults.

---

## Task 1: Session + Combatant data layer

**Files:**
- Modify: `src/Session.js` (after `clearAllGridPositions`, ~line 137)
- Modify: `src/Combatant.js` (`add` ~line 16, plus new `setSize`)

- [ ] **Step 1: Add grid-config / walls / reset methods to Session.js**

Insert after the existing `clearAllGridPositions()` method (around line 137):

```js
  async setGridConfig(cols, rows) {
    const c = Math.max(1, Math.min(60, parseInt(cols) || 20));
    const r = Math.max(1, Math.min(60, parseInt(rows) || 20));
    await set(ref(this._db, `sessions/${this.code}/gridConfig`), { cols: c, rows: r });

    // Drop tokens whose footprint no longer fits, and out-of-bounds walls.
    const snap = await get(ref(this._db, `sessions/${this.code}`));
    const data = snap.val() || {};
    const sizeFootprint = { tiny: 1, small: 1, medium: 1, large: 2, huge: 3, gargantuan: 4 };

    const grid = data.grid || {};
    const combatants = data.combatants || {};
    for (const [id, p] of Object.entries(grid)) {
      const n = sizeFootprint[combatants[id]?.size] || 1;
      if (p == null || p.col == null || p.col < 0 || p.row < 0 ||
          p.col + n > c || p.row + n > r) {
        await set(ref(this._db, `sessions/${this.code}/grid/${id}`), null);
      }
    }

    const walls = data.walls || {};
    for (const key of Object.keys(walls)) {
      const [wc, wr] = key.split('_').map(Number);
      if (wc < 0 || wr < 0 || wc >= c || wr >= r) {
        await set(ref(this._db, `sessions/${this.code}/walls/${key}`), null);
      }
    }
  }

  async toggleWall(cellKey) {
    await runTransaction(
      ref(this._db, `sessions/${this.code}/walls/${cellKey}`),
      (current) => (current ? null : true)
    );
  }

  async clearWalls() {
    await set(ref(this._db, `sessions/${this.code}/walls`), null);
  }

  async resetGrid() {
    await set(ref(this._db, `sessions/${this.code}/grid`), null);
    await set(ref(this._db, `sessions/${this.code}/walls`), null);
  }
```

(`get`, `set`, `runTransaction`, `ref` are already imported at the top of `Session.js`.)

- [ ] **Step 2: Add `size` to Combatant.add and a `setSize` method**

In `src/Combatant.js`, change the `add` signature and data object:

```js
  async add(name, initiative, hpMax, type, ownerUid, charId = null, armorClass = null, monsterApiIndex = null, size = 'medium') {
    const newRef = push(this._ref());
    const data = {
      name,
      initiative: parseInt(initiative) || 0,
      hpMax:      parseInt(hpMax)      || 1,
      hpCurrent:  parseInt(hpMax)      || 1,
      type,
      conditions: {},
      ownerUid,
      faction: 'evil',
      charId: charId ?? null,
      size: size || 'medium',
    };
    if (armorClass !== null && armorClass !== '') data.armorClass = parseInt(armorClass) || 0;
    if (monsterApiIndex) data.monsterApiIndex = monsterApiIndex;
    await set(newRef, data);
    return newRef.key;
  }
```

Add a `setSize` method (e.g. after `setArmorClass`, ~line 76):

```js
  async setSize(id, size) {
    const valid = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];
    const s = valid.includes(size) ? size : 'medium';
    await set(ref(this._db, `sessions/${this._code}/combatants/${id}/size`), s);
  }
```

- [ ] **Step 3: Verify (syntax) and commit**

Run: `node --check src/Session.js && node --check src/Combatant.js`
Expected: no output (both parse).

```bash
git add src/Session.js src/Combatant.js
git commit -m "feat(grid): session gridConfig/walls/reset ops + combatant size field"
```

---

## Task 2: Rewrite GridUI.js for squares

**Files:**
- Modify (rewrite): `src/GridUI.js`

- [ ] **Step 1: Replace the file contents**

Replace the **entire** contents of `src/GridUI.js` with:

```js
// Griglia quadrata. 1 cella = 1 m. Dimensioni guidate da gridConfig.
// Distanza Chebyshev (diagonali = 1), misurata bordo-a-bordo tra footprint.

const CELL = 40;        // lato cella in px (screen, prima dello zoom)
const PAD  = 8;         // margine SVG fisso (px)

const SIZE_FOOTPRINT = { tiny: 1, small: 1, medium: 1, large: 2, huge: 3, gargantuan: 4 };
export function footprintOf(size) { return SIZE_FOOTPRINT[size] || 1; }

let currentZoom = 1;
const MIN_ZOOM  = 0.25;
const MAX_ZOOM  = 4.0;
const ZOOM_STEP = 0.15;

let panX = 0;
let panY = 0;
let _isDragging            = false;
let _didPan                = false;
let _dragStartX            = 0;
let _dragStartY            = 0;
let _dragListenersAttached = false;

function applyTransform() {
  const container = document.getElementById('grid-container');
  const svg = container?.querySelector('svg');
  if (svg) {
    svg.style.transformOrigin = '0 0';
    svg.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
  }
}

// ─── Coordinate / distanza ────────────────────────────────────────────────────

function cellXY(col, row) {
  return { x: PAD + col * CELL, y: PAD + row * CELL };
}

// Separazione su un asse tra due intervalli [a1,a2] e [b1,b2] (0 se si toccano/sovrappongono +1 se adiacenti)
function axisDist(a1, a2, b1, b2) {
  return Math.max(0, Math.max(a1, b1) - Math.min(a2, b2));
}

// Distanza Chebyshev bordo-a-bordo tra due footprint quadrati.
export function squareDistance(c1, r1, n1, c2, r2, n2) {
  const dc = axisDist(c1, c1 + n1 - 1, c2, c2 + n2 - 1);
  const dr = axisDist(r1, r1 + n1 - 1, r2, r2 + n2 - 1);
  return Math.max(dc, dr);
}

function fmtM(d) {
  return d === Math.floor(d) ? `${d}m` : `${d.toFixed(1)}m`;
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Re-render callback (zoom e resize) ──────────────────────────────────────

let _reRenderCallback = null;
export function setReRenderCallback(fn) { _reRenderCallback = fn; }

// ─── Render ──────────────────────────────────────────────────────────────────

/**
 * Ridisegna la griglia quadrata.
 * @param onToggleWall (cellKey) => void   — solo master, toggle muro
 */
export function renderGrid(container, gridPos, combatants, myCombatantId, myOwnedIds, isMaster, selectedId, currentTurnId, gridConfig, walls, onSelect, onMove, onToggleWall) {
  const pos   = gridPos    || {};
  const comb  = combatants || {};
  const wall  = walls      || {};
  const cols  = Math.max(1, gridConfig?.cols || 20);
  const rows  = Math.max(1, gridConfig?.rows || 20);

  // Mappa cella → id del token che la occupa (considerando il footprint)
  const occCell = {};
  Object.entries(pos).forEach(([id, p]) => {
    if (p == null || p.col == null) return;
    const n = footprintOf(comb[id]?.size);
    for (let dc = 0; dc < n; dc++) {
      for (let dr = 0; dr < n; dr++) {
        occCell[`${p.col + dc}_${p.row + dr}`] = id;
      }
    }
  });

  const selPos  = selectedId ? pos[selectedId] : null;
  const selSide = selectedId ? footprintOf(comb[selectedId]?.size) : 1;

  const svgW = (PAD * 2 + cols * CELL).toFixed(0);
  const svgH = (PAD * 2 + rows * CELL).toFixed(0);

  let inner = '';

  // 1) Celle di sfondo + muri
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const { x, y } = cellXY(col, row);
      const key  = `${col}_${row}`;
      const cls  = wall[key] ? 'sq sq-wall' : 'sq';
      inner += `<rect class="${cls}" x="${x}" y="${y}" width="${CELL}" height="${CELL}" data-c="${col}" data-r="${row}"/>`;
    }
  }

  // 2) Token (un rect per footprint)
  Object.entries(pos).forEach(([id, p]) => {
    if (p == null || p.col == null) return;
    const occ = comb[id];
    if (!occ) return;
    const n    = footprintOf(occ.size);
    const { x, y } = cellXY(p.col, p.row);
    const w    = n * CELL;
    const cx   = x + w / 2;
    const cy   = y + w / 2;
    const isSelected = id === selectedId;
    const isActive   = id === currentTurnId;
    const isMyToken  = id === myCombatantId;
    const isPlayer   = occ.type === 'player';
    const isDead     = occ.hpCurrent <= 0;

    let fill, stroke;
    if (isMyToken)      { fill = '#0d2d0d'; stroke = isSelected ? '#70d070' : '#4aba4a'; }
    else if (isPlayer)  { fill = '#142d4a'; stroke = isSelected ? 'var(--gold)' : isActive ? 'var(--gold-light)' : '#4a8abf'; }
    else if (occ.faction === 'good') { fill = 'rgba(124,88,0,0.4)'; stroke = isSelected ? 'var(--gold)' : isActive ? 'var(--gold-light)' : '#d4af37'; }
    else                { fill = '#2d1010'; stroke = isSelected ? 'var(--gold)' : isActive ? 'var(--gold-light)' : '#bf4a4a'; }
    if (isDead) { fill = '#666'; stroke = '#999'; }

    const sw       = (isSelected || isActive) ? 3 : 2;
    const inset    = 3;
    const initials = esc((occ.name || '?').slice(0, 3).toUpperCase());
    const fsz      = Math.max(8, Math.min(18, n * 11)).toFixed(0);

    inner += `<rect x="${x + inset}" y="${y + inset}" width="${w - inset * 2}" height="${w - inset * 2}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" pointer-events="none"/>`;
    inner += `<text x="${cx}" y="${(cy + n * 3).toFixed(1)}" text-anchor="middle" font-size="${fsz}" class="sq-name" pointer-events="none">${initials}${isDead ? ' 💀' : ''}</text>`;

    // Distanza dal token selezionato (etichetta sopra il token)
    if (selPos && !isSelected) {
      const d = squareDistance(selPos.col, selPos.row, selSide, p.col, p.row, n);
      inner += `<text x="${cx}" y="${(y - 3).toFixed(1)}" text-anchor="middle" font-size="11" class="sq-dist" pointer-events="none">${esc(fmtM(d))}</text>`;
    }
  });

  // 3) Hit layer trasparente (intercetta i click su ogni cella)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const { x, y } = cellXY(col, row);
      inner += `<rect class="sq-hit" x="${x}" y="${y}" width="${CELL}" height="${CELL}" data-c="${col}" data-r="${row}"/>`;
    }
  }

  container.innerHTML = `<svg class="sq-svg" width="${svgW}" height="${svgH}">${inner}</svg>`;
  applyTransform();

  const svg = container.querySelector('svg');

  // Validazione piazzamento: footprint dentro i bordi, niente muri, niente sovrapposizioni
  function canPlace(anchorCol, anchorRow, side, movingId) {
    if (anchorCol < 0 || anchorRow < 0 || anchorCol + side > cols || anchorRow + side > rows) return false;
    for (let dc = 0; dc < side; dc++) {
      for (let dr = 0; dr < side; dr++) {
        const key = `${anchorCol + dc}_${anchorRow + dr}`;
        if (wall[key]) return false;
        const occId = occCell[key];
        if (occId && occId !== movingId) return false;
      }
    }
    return true;
  }

  // Tooltip distanza/nome al passaggio del mouse
  let nameTooltip = null;
  svg.addEventListener('mousemove', (e) => {
    const hit = e.target.closest('.sq-hit');
    if (!hit) { nameTooltip?.remove(); nameTooltip = null; return; }
    const c = parseInt(hit.dataset.c), r = parseInt(hit.dataset.r);
    const occId = occCell[`${c}_${r}`];
    const occ   = occId ? comb[occId] : null;
    if (occ) {
      const { x, y } = cellXY(c, r);
      if (!nameTooltip) {
        nameTooltip = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        nameTooltip.setAttribute('class', 'sq-tooltip-name');
        nameTooltip.setAttribute('text-anchor', 'middle');
        nameTooltip.setAttribute('font-size', '13');
        svg.appendChild(nameTooltip);
      }
      nameTooltip.setAttribute('x', x + CELL / 2);
      nameTooltip.setAttribute('y', y - 6);
      nameTooltip.textContent = occ.name;
    } else {
      nameTooltip?.remove(); nameTooltip = null;
    }
  });

  svg.addEventListener('mouseover', (e) => {
    const hit = e.target.closest('.sq-hit');
    if (!hit) return;
    svg.querySelectorAll('.sq.sq-hover').forEach(h => h.classList.remove('sq-hover'));
    svg.querySelector(`.sq[data-c="${hit.dataset.c}"][data-r="${hit.dataset.r}"]`)?.classList.add('sq-hover');
  });
  svg.addEventListener('mouseleave', () => {
    svg.querySelectorAll('.sq.sq-hover').forEach(h => h.classList.remove('sq-hover'));
    nameTooltip?.remove(); nameTooltip = null;
  });

  svg.addEventListener('click', (e) => {
    if (_didPan) { _didPan = false; return; }
    const el = e.target.closest('[data-c]');
    if (!el) return;
    const col = parseInt(el.dataset.c);
    const row = parseInt(el.dataset.r);
    const occupantId = occCell[`${col}_${row}`];

    if (occupantId) {
      // Click su token → seleziona/deseleziona
      onSelect(occupantId === selectedId ? null : occupantId);
      return;
    }

    if (selectedId) {
      // Sposta il token selezionato (la cella cliccata diventa l'angolo top-left)
      if (isMaster || myOwnedIds.has(selectedId)) {
        if (canPlace(col, row, selSide, selectedId)) onMove(selectedId, col, row);
      }
      onSelect(null);
      return;
    }

    if (isMaster) {
      // Nessun token selezionato + master + cella vuota → toggle muro
      onToggleWall?.(`${col}_${row}`);
      return;
    }

    // Player senza selezione → piazza il proprio token (se non ancora sulla griglia)
    const placeId = (myCombatantId && pos[myCombatantId] == null)
      ? myCombatantId
      : [...myOwnedIds].find(id => id !== myCombatantId && pos[id] == null);
    if (placeId) {
      const side = footprintOf(comb[placeId]?.size);
      if (canPlace(col, row, side, placeId)) onMove(placeId, col, row);
    }
  });
}

export function renderInitiativeList(container, sortedCombatants, gridPos, myCombatantId, selectedId, currentTurnId, isMaster, onSelect, combatants) {
  if (!container) return;

  const pos = gridPos || {};
  const comb = combatants || {};
  const referenceId = selectedId || myCombatantId;
  const refPos  = referenceId ? pos[referenceId] : null;
  const refSide = referenceId ? footprintOf(comb[referenceId]?.size) : 1;

  let html = '';
  for (const c of sortedCombatants) {
    const isActive = c.id === currentTurnId;
    const cPos = pos[c.id];

    let distText = '';
    if (refPos && cPos && c.id !== referenceId) {
      const d = squareDistance(refPos.col, refPos.row, refSide, cPos.col, cPos.row, footprintOf(c.size));
      distText = `<span class="grid-initiative-dist">${fmtM(d)}</span>`;
    }

    const isSelected = c.id === selectedId;
    let cls = 'grid-initiative-item';
    if (isActive)          cls += ' active-turn';
    if (isSelected)        cls += ' selected';
    if (c.hpCurrent === 0) cls += ' ko';

    const koIcon = c.hpCurrent === 0
      ? `<span class="grid-initiative-ko">💀</span>`
      : '<span class="grid-initiative-ko"></span>';

    html += `
      <li class="${cls}" style="cursor:pointer" data-id="${c.id}">
        <span class="grid-initiative-name">${esc(c.name)}</span>
        <div class="grid-initiative-meta">${koIcon}${distText}</div>
      </li>`;
  }

  container.innerHTML = html;
  container.onclick = (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    onSelect(li.dataset.id === selectedId ? null : li.dataset.id);
  };
}

// ─── Zoom ────────────────────────────────────────────────────────────────────

export function zoomIn()  { if (currentZoom < MAX_ZOOM) { currentZoom = Math.min(MAX_ZOOM, parseFloat((currentZoom + ZOOM_STEP).toFixed(2))); applyTransform(); } }
export function zoomOut() { if (currentZoom > MIN_ZOOM) { currentZoom = Math.max(MIN_ZOOM, parseFloat((currentZoom - ZOOM_STEP).toFixed(2))); applyTransform(); } }
export function zoomReset() { currentZoom = 1; panX = 0; panY = 0; applyTransform(); }

export function initZoomControls(onGridReset) {
  if (_dragListenersAttached) return;
  _dragListenersAttached = true;

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
    if (svg) svg.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
  });
  container.addEventListener('mouseup', () => { _isDragging = false; container.style.cursor = 'grab'; });
  container.addEventListener('mouseleave', () => { _isDragging = false; _didPan = false; container.style.cursor = 'grab'; });
}
```

- [ ] **Step 2: Verify syntax and that nothing still imports `hexDistance`**

Run: `node --check src/GridUI.js && grep -rn "hexDistance" src/ app.js || echo "no hexDistance refs"`
Expected: parses; `grep` prints nothing or the `no hexDistance refs` line. (If any file still imports `hexDistance`, Task 3 fixes the caller — note it.)

- [ ] **Step 3: Commit**

```bash
git add src/GridUI.js
git commit -m "feat(grid): square rendering, footprint distance, walls + collision"
```

---

## Task 3: Wire grid.js + app.js

**Files:**
- Modify: `src/grid.js` (`renderGrid`, `renderTokenBar`)
- Modify: `app.js` (snapshot pass-through ~line 947, master controls in `_enterCombatView` ~line 895)

- [ ] **Step 1: Update `src/grid.js` to thread gridConfig/walls + wall toggle**

Replace the whole `renderGrid` function body in `src/grid.js` with:

```js
export function renderGrid(gridPos, combatants, currentTurnId, sortedCombatants, gridConfig, walls) {
  const container = document.getElementById('grid-container');
  if (!container) return;

  GridUI.setReRenderCallback(() => {
    if (state.snapshot) {
      const sorted = state.tracker.sortedCombatants(state.snapshot.combatants);
      renderGrid(state.snapshot.grid || {}, state.snapshot.combatants || {}, state.snapshot.currentTurnId ?? null, sorted, state.snapshot.gridConfig || null, state.snapshot.walls || {});
    }
  });

  const comb = combatants || {};
  const myOwnedIds = new Set(
    state.myUid
      ? Object.entries(comb).filter(([, c]) => c.ownerUid === state.myUid).map(([id]) => id)
      : []
  );

  const reRender = () => {
    if (state.snapshot) {
      const sorted = state.tracker.sortedCombatants(state.snapshot.combatants);
      renderGrid(state.snapshot.grid || {}, state.snapshot.combatants || {}, state.snapshot.currentTurnId ?? null, sorted, state.snapshot.gridConfig || null, state.snapshot.walls || {});
    }
  };

  GridUI.renderInitiativeList(
    document.getElementById('grid-initiative-list'),
    sortedCombatants,
    gridPos,
    state.myCombatantId,
    state.selectedGridTokenId,
    currentTurnId,
    state.session.isMaster,
    (id) => { state.selectedGridTokenId = id; reRender(); },
    comb
  );

  GridUI.renderGrid(
    container,
    gridPos,
    combatants,
    state.myCombatantId,
    myOwnedIds,
    state.session.isMaster,
    state.selectedGridTokenId,
    currentTurnId,
    gridConfig,
    walls,
    (id) => { state.selectedGridTokenId = id; reRender(); },
    (id, col, row) => state.session.setGridPosition(id, col, row),
    (cellKey) => state.session.toggleWall(cellKey)
  );
  renderTokenBar(gridPos, combatants);
}
```

- [ ] **Step 2: Update the `renderTokenBar` re-render call to pass gridConfig/walls**

In `src/grid.js` `renderTokenBar`, the `bar.onclick` handler calls `renderGrid(...)`. Replace that inner call with:

```js
    if (state.snapshot) {
      const sorted = state.tracker.sortedCombatants(state.snapshot.combatants);
      renderGrid(state.snapshot.grid || {}, state.snapshot.combatants || {}, state.snapshot.currentTurnId ?? null, sorted, state.snapshot.gridConfig || null, state.snapshot.walls || {});
    }
```

- [ ] **Step 3: Update app.js snapshot call**

In `app.js`, the listener line (~947):

```js
    renderGrid(data.grid || {}, data.combatants || {}, data.currentTurnId ?? null, sorted);
```

becomes:

```js
    renderGrid(data.grid || {}, data.combatants || {}, data.currentTurnId ?? null, sorted, data.gridConfig || null, data.walls || {});
```

- [ ] **Step 4: Wire master reset to `resetGrid` and keep reset visibility**

In `app.js` `_enterCombatView` (~895), change:

```js
  GridUI.initZoomControls(() => state.session.clearAllGridPositions());
```

to:

```js
  GridUI.initZoomControls(() => state.session.resetGrid());
```

- [ ] **Step 5: Syntax check and commit**

Run: `node --check src/grid.js && node --check app.js`
Expected: no output.

```bash
git add src/grid.js app.js
git commit -m "feat(grid): thread gridConfig/walls through render + reset clears walls"
```

---

## Task 4: Grid header UI (dimensions, size override) + CSS

**Files:**
- Modify: `index.html` grid header (~533–542)
- Modify: `style.css` — replace `.hx*` block (~3101–3175), add `.grid-master-controls`
- Modify: `app.js` `_enterCombatView` — wire dimension inputs + token-size override

- [ ] **Step 1: Replace the grid header markup**

In `index.html`, replace lines 533–542 (the `.grid-header` div) with:

```html
        <div class="grid-header">
          <span class="grid-title">Griglia di Battaglia</span>
          <div class="grid-zoom-controls">
            <button id="btn-zoom-in" class="grid-zoom-btn" title="Ingrandisci">🔍+</button>
            <button id="btn-zoom-out" class="grid-zoom-btn" title="Rimpicciolisci">🔍−</button>
            <button id="btn-zoom-reset" class="grid-zoom-btn" title="Reset vista">↺</button>
            <button id="btn-grid-reset" class="grid-zoom-btn" title="Svuota la griglia (token e muri)" style="display:none">🗑</button>
          </div>
          <div id="grid-master-controls" class="grid-master-controls" style="display:none">
            <label>Dimensioni:</label>
            <input type="number" id="input-grid-cols" min="1" max="60" class="grid-dim-input" title="Larghezza (caselle)">
            <span>×</span>
            <input type="number" id="input-grid-rows" min="1" max="60" class="grid-dim-input" title="Altezza (caselle)">
            <button id="btn-grid-apply" class="grid-zoom-btn" title="Applica dimensioni">✔</button>
            <label class="grid-size-label">Token sel.:</label>
            <select id="select-token-size" class="grid-dim-select" disabled title="Dimensione del token selezionato">
              <option value="small">Piccola (1×1)</option>
              <option value="medium">Media (1×1)</option>
              <option value="large">Grande (2×2)</option>
              <option value="huge">Enorme (3×3)</option>
              <option value="gargantuan">Mastodontica (4×4)</option>
            </select>
          </div>
          <span class="grid-hint">1 casella = 1 m · Seleziona un token, poi tocca la destinazione · Master: clicca una casella vuota per muri</span>
        </div>
```

- [ ] **Step 2: Replace hex CSS with square CSS**

In `style.css`, replace the block from `.hex-svg {` (line ~3101) through the end of `.hx-tooltip-name { ... }` (line ~3175) with:

```css
.sq-svg {
  display: block;
  margin: 0 auto;
}

.sq {
  fill: var(--bg-deep);
  stroke: var(--border-warm);
  stroke-width: 1;
  transition: fill 0.1s;
}

.sq-wall {
  fill: #4a3a2a;
  stroke: #6b5538;
}

.sq-hit {
  fill: transparent;
  stroke: none;
  cursor: pointer;
}

.sq-hover {
  fill: rgba(255,255,255,0.06);
}

.sq-name {
  fill: var(--text);
  font-family: 'Cinzel', serif;
  font-weight: 700;
  user-select: none;
}

.sq-dist {
  fill: var(--gold-light);
  font-family: 'Cinzel', serif;
  font-weight: 700;
  user-select: none;
  text-shadow: 0 0 3px rgba(0,0,0,0.9);
}

.sq-tooltip-name {
  fill: #ffffff;
  font-family: 'Cinzel', serif;
  font-weight: 700;
  pointer-events: none;
  user-select: none;
  text-shadow: 0 0 4px rgba(0,0,0,1);
}

.grid-master-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  color: var(--text-muted);
  justify-content: center;
  margin-top: 0.15rem;
}
.grid-master-controls label { color: var(--text-muted); }
.grid-dim-input {
  width: 3.2rem;
  background: var(--bg-card-alt);
  border: 1px solid var(--border-warm);
  border-radius: var(--radius-sm);
  color: var(--text);
  padding: 0.1rem 0.3rem;
  font-size: 0.72rem;
}
.grid-size-label { margin-left: 0.5rem; }
.grid-dim-select {
  background: var(--bg-card-alt);
  border: 1px solid var(--border-warm);
  border-radius: var(--radius-sm);
  color: var(--text);
  padding: 0.1rem 0.3rem;
  font-size: 0.72rem;
}
.grid-dim-select:disabled { opacity: 0.4; }
```

- [ ] **Step 3: Wire master controls in app.js**

In `app.js` `_enterCombatView`, replace the reset-visibility block:

```js
  const _btnGridReset = document.getElementById('btn-grid-reset');
  if (_btnGridReset) _btnGridReset.style.display = isMaster ? '' : 'none';
```

with:

```js
  const _btnGridReset = document.getElementById('btn-grid-reset');
  if (_btnGridReset) _btnGridReset.style.display = isMaster ? '' : 'none';
  _initGridMasterControls(isMaster);
```

Then add this function near the other grid helpers in `app.js` (e.g. just below `_enterCombatView`):

```js
let _gridMasterBound = false;
function _initGridMasterControls(isMaster) {
  const wrap = document.getElementById('grid-master-controls');
  if (wrap) wrap.style.display = isMaster ? 'flex' : 'none';
  if (!isMaster || _gridMasterBound) return;
  _gridMasterBound = true;

  document.getElementById('btn-grid-apply')?.addEventListener('click', () => {
    const cols = document.getElementById('input-grid-cols').value;
    const rows = document.getElementById('input-grid-rows').value;
    state.session.setGridConfig(cols, rows);
  });

  document.getElementById('select-token-size')?.addEventListener('change', (e) => {
    const id = state.selectedGridTokenId;
    if (id) state.combatantManager.setSize(id, e.target.value);
  });
}
```

- [ ] **Step 4: Reflect live gridConfig + selected-token size into the controls**

In `app.js`, inside the `state.session.listen` callback, right after `renderGrid(...)` (~947), add:

```js
    if (state.session.isMaster) {
      const cfg = data.gridConfig || { cols: 20, rows: 20 };
      const colsInput = document.getElementById('input-grid-cols');
      const rowsInput = document.getElementById('input-grid-rows');
      if (colsInput && document.activeElement !== colsInput) colsInput.value = cfg.cols;
      if (rowsInput && document.activeElement !== rowsInput) rowsInput.value = cfg.rows;

      const sizeSel = document.getElementById('select-token-size');
      const sel = state.selectedGridTokenId;
      const selComb = sel ? (data.combatants || {})[sel] : null;
      if (sizeSel) {
        sizeSel.disabled = !selComb;
        if (selComb) sizeSel.value = selComb.size || 'medium';
      }
    }
```

- [ ] **Step 5: Syntax check and commit**

Run: `node --check app.js`
Expected: no output. (HTML/CSS are not node-checkable; verify visually in Step of Task 6.)

```bash
git add index.html style.css app.js
git commit -m "feat(grid): master dimension inputs, wall hint, token-size override + square CSS"
```

---

## Task 5: Size field in sheet, library, creature form + sheet sync

**Files:**
- Modify: `index.html` — `size` select in character sheet (near `armorClass`, line ~321) and creature form (line ~234)
- Modify: `src/sheet.js` — sync sheet `size` → combatant (~after line 58)
- Modify: `app.js` — pass size from creature form to `add` (~line 211)

- [ ] **Step 1: Add a size select to the character sheet**

In `index.html`, after the Armor Class field row (line ~321), add a new field row inside the same block:

```html
                  <div class="field-row field-row-center"><label>Taglia</label><select data-path="size" class="input-select"><option value="small">Piccola (1×1)</option><option value="medium">Media (1×1)</option><option value="large">Grande (2×2)</option><option value="huge">Enorme (3×3)</option><option value="gargantuan">Mastodontica (4×4)</option></select></div>
```

(`SheetUI.populateSheet` already populates any `[data-path]` select; `CharacterSheet.setField` already persists it via the existing change listener — no JS change needed for read/write.)

- [ ] **Step 2: Add a size select to the creature form**

In `index.html`, after the creature input-row (closing `</div>` at line ~234, before the hidden api-index input at line 235), add:

```html
            <select id="input-creature-size" class="input-select">
              <option value="small">Piccola (1×1)</option>
              <option value="medium" selected>Media (1×1)</option>
              <option value="large">Grande (2×2)</option>
              <option value="huge">Enorme (3×3)</option>
              <option value="gargantuan">Mastodontica (4×4)</option>
            </select>
```

- [ ] **Step 3: Pass creature size to add() in app.js**

In `app.js` creature submit handler (~202–211), add a size read and pass it:

```js
  const ac       = document.getElementById('input-creature-ac').value || null;
  const apiIndex = document.getElementById('input-creature-api-index').value || null;
  const size     = document.getElementById('input-creature-size').value || 'medium';

  if (!name || !hp) return;

  const charId = state.selectedCreatureCharId ?? null;
  await state.combatantManager.add(name, initiative, hp, 'creature', state.myUid, charId, ac, apiIndex, size);
```

- [ ] **Step 4: Sync sheet size → combatant in sheet.js**

In `src/sheet.js` `setupSheetListener`, add `let prevSize = undefined;` next to the other `prev*` declarations (~line 41), then after the hpMax sync block (~line 58) add:

```js
    // Sincronizza taglia al combattente solo se cambiata
    const size = state.sheetData.size ?? null;
    if (size !== null && size !== prevSize && state.myCombatantId) {
      prevSize = size;
      state.combatantManager.setSize(state.myCombatantId, size);
    }
```

- [ ] **Step 5: Syntax check and commit**

Run: `node --check app.js && node --check src/sheet.js`
Expected: no output.

```bash
git add index.html app.js src/sheet.js
git commit -m "feat(grid): creature size in sheet/library/creature-form with combatant sync"
```

---

## Task 6: Docs + manual verification

**Files:**
- Modify: `CLAUDE.md` (grid description + data model)

- [ ] **Step 1: Update CLAUDE.md**

In the `## Architettura file` table, change the `GridUI.js` row to:

```
| `src/GridUI.js` | Griglia quadrata SVG (dimensioni da `gridConfig`, 1 casella = 1m), muri, token multi-cella per taglia |
```

In the `## Modello dati Firebase` `sessions/{code}/` block, update the grid lines to:

```
  gridConfig/  cols, rows                  (dimensioni decise dal master, default 20x20)
  combatants/{id}/  ... size (tiny|small|medium|large|huge|gargantuan)
  grid/{combatantId}/  col, row            (angolo top-left del footprint)
  walls/{col_row}: true
```

And add `size` to the `characters/{uid}/{charId}/` field list.

In `### Completato`, replace the hex grid bullet with:

```
- Griglia quadrata: dimensioni decise dal master in sessione (gridConfig), muri disegnabili dal master (bloccano il movimento), reset svuota token e muri; token con taglia (Piccola/Media 1×1, Grande 2×2, Enorme 3×3, Mastodontica 4×4); distanza Chebyshev bordo-a-bordo
```

- [ ] **Step 2: Commit docs**

```bash
git add CLAUDE.md
git commit -m "docs: update grid section for square grid, walls, sizes"
```

- [ ] **Step 3: Manual verification (browser, master + player)**

Serve locally (e.g. `python3 -m http.server 8000`) and open two browser profiles. Verify:

1. Master sees dimension inputs; setting e.g. 12×8 + ✔ re-renders the grid to that size on both clients.
2. Master selects a token from the token bar, clicks a cell → token placed; clicking another cell moves it.
3. Master with **no** selection clicks an empty cell → wall appears; clicking it again removes it. A player cannot move a token onto/into a wall cell (move silently rejected).
4. Set a creature to Grande/Enorme/Mastodontica → token occupies 2×2 / 3×3 / 4×4; cannot overlap another token or exceed bounds.
5. Distance labels/initiative distances reflect edge-to-edge Chebyshev (a Large token adjacent to a token reads 1m).
6. 🗑 reset clears all tokens **and** walls but keeps the dimensions.
7. Player sets Taglia on their sheet → their grid token resizes; master size override on a selected token also works.
8. Shrinking dimensions drops tokens/walls that no longer fit.

---

## Self-Review notes

- **Spec coverage:** squares (T2/T4), master-set dimensions w/ out-of-bounds drop (T1/T4), walls click-to-toggle modeless (T1/T2/T3), reset clears tokens+walls (T1/T3), sizes incl. Medium 1×1 (T1/T2/T5), library default + session override (T5 sheet/form + T4 master override), Chebyshev edge-to-edge distance (T2). All covered.
- **Type consistency:** `setGridConfig/toggleWall/clearWalls/resetGrid/setSize` defined in T1, consumed in T3/T4. `renderGrid` signature extended with `gridConfig, walls, onToggleWall` consistently in T2→T3. `footprintOf/squareDistance` exported in T2, used internally.
- **No test harness:** TDD steps replaced with `node --check` syntax gates + a consolidated manual browser checklist (T6 Step 3), appropriate for this no-bundler vanilla-JS project.
