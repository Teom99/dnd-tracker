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

// Separazione su un asse tra due intervalli [a1,a2] e [b1,b2] (0 se si toccano/sovrappongono, +1 se adiacenti)
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

  // Tooltip nome al passaggio del mouse
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
