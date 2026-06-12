// Griglia quadrata. 1 cella = 1 m. Dimensioni guidate da gridConfig.
// Zoom via viewBox: _zoom scala il viewBox, _panX/_panY traslano l'origine.
// Distanza Chebyshev (diagonali = 1), misurata bordo-a-bordo tra footprint.

const CELL = 40;        // lato cella nelle coordinate del viewBox
const PAD  = 8;         // margine interno (coordinate viewBox)

const SIZE_FOOTPRINT = { tiny: 1, small: 1, medium: 1, large: 2, huge: 3, gargantuan: 4 };
export function footprintOf(size) { return SIZE_FOOTPRINT[size] || 1; }

// ─── Stato zoom e pan ─────────────────────────────────────────────────────────
let _zoom     = 1;
let _panX     = 0;
let _panY     = 0;
let _panStart = null;   // { x, y, px, py, moved } durante un drag
let _totalW   = 0;      // dimensioni totali viewBox in coordinate SVG
let _totalH   = 0;

// ─── Disegno muri con drag (tieni premuto LMB in modalità modifica) ──────────
// Le listener stanno sul container (persiste tra i re-render); leggono _ctx,
// il contesto dell'ultimo render, aggiornato a ogni renderGrid.
let _ctx               = null;
let _paintBound        = false;
let _painting          = false;
let _paintValue        = false;
let _paintedThisStroke = null;

function _cellFromEvent(e) {
  let hit = e.target?.closest?.('.sq-hit');
  if (!hit) hit = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.sq-hit');
  if (!hit) return null;
  return { col: parseInt(hit.dataset.c), row: parseInt(hit.dataset.r) };
}

function _paintAt(col, row) {
  if (!_ctx) return;
  const key = `${col}_${row}`;
  if (_paintedThisStroke.has(key)) return;
  _paintedThisStroke.add(key);
  if (_ctx.occCell[key]) return;                       // niente muri sotto i token
  if (Boolean(_ctx.wall[key]) === _paintValue) return; // già nello stato voluto
  _ctx.onSetWall(key, _paintValue);
}

function _bindWallPaint(container) {
  if (_paintBound) return;
  _paintBound = true;

  container.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (!_ctx || !_ctx.isMaster || !_ctx.editMode) return;
    const cell = _cellFromEvent(e);
    if (!cell) return;
    const key = `${cell.col}_${cell.row}`;
    if (_ctx.occCell[key]) return;
    _painting          = true;
    _paintValue        = !_ctx.wall[key];   // cella vuota → disegna; muro → cancella
    _paintedThisStroke = new Set();
    _paintAt(cell.col, cell.row);
    e.preventDefault();
  });

  container.addEventListener('mousemove', (e) => {
    if (!_painting) return;
    const cell = _cellFromEvent(e);
    if (cell) _paintAt(cell.col, cell.row);
  });

  const stop = () => { _painting = false; };
  container.addEventListener('mouseup', stop);
  container.addEventListener('mouseleave', stop);
  window.addEventListener('mouseup', stop);
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

// ─── Re-render callback (resize) ─────────────────────────────────────────────

let _reRenderCallback = null;
export function setReRenderCallback(fn) { _reRenderCallback = fn; }

// ─── Render ──────────────────────────────────────────────────────────────────

/**
 * Ridisegna la griglia quadrata, adattata al contenitore.
 * @param editMode boolean       — modalità modifica del master (disegno muri)
 * @param onSetWall (cellKey, value) => void   — imposta/rimuove un muro
 */
export function renderGrid(container, gridPos, combatants, myCombatantId, myOwnedIds, isMaster, selectedId, currentTurnId, gridConfig, walls, editMode, onSelect, onMove, onSetWall) {
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

  const vbW = (PAD * 2 + cols * CELL).toFixed(0);
  const vbH = (PAD * 2 + rows * CELL).toFixed(0);
  _totalW = PAD * 2 + cols * CELL;
  _totalH = PAD * 2 + rows * CELL;

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

  const zVbW = (parseFloat(vbW) / _zoom).toFixed(0);
  const zVbH = (parseFloat(vbH) / _zoom).toFixed(0);
  container.innerHTML =
    `<svg class="sq-svg" viewBox="${_panX.toFixed(0)} ${_panY.toFixed(0)} ${zVbW} ${zVbH}" preserveAspectRatio="xMidYMid meet" width="100%" height="100%">${inner}</svg>`;
  container.classList.toggle('grid-edit-active', !!editMode);

  // Aggiorna il contesto usato dal disegno muri con drag e assicura il binding.
  _ctx = { cols, rows, wall, occCell, isMaster, editMode: !!editMode, onSetWall };
  _bindWallPaint(container);

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
    if (_panStart?.moved) return;
    const el = e.target.closest('[data-c]');
    if (!el) return;
    const col = parseInt(el.dataset.c);
    const row = parseInt(el.dataset.r);
    const occupantId = occCell[`${col}_${row}`];

    // Modalità modifica (master): i muri si disegnano con mousedown/drag (vedi _bindWallPaint)
    if (editMode && isMaster) return;

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

    // Player senza selezione → piazza il proprio token (se non ancora sulla griglia)
    if (!isMaster) {
      const placeId = (myCombatantId && pos[myCombatantId] == null)
        ? myCombatantId
        : [...myOwnedIds].find(id => id !== myCombatantId && pos[id] == null);
      if (placeId) {
        const side = footprintOf(comb[placeId]?.size);
        if (canPlace(col, row, side, placeId)) onMove(placeId, col, row);
      }
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

    const factionDot = c.type === 'creature'
      ? `<i class="init-faction-dot ${c.faction === 'good' ? 'ally' : 'enemy'}"></i>`
      : '';

    html += `
      <li class="${cls}" style="cursor:pointer" data-id="${c.id}">
        <span class="grid-initiative-init">${c.initiative}</span>
        <span class="grid-initiative-name">${esc(c.name)}</span>
        <div class="grid-initiative-meta">${koIcon}${factionDot}${distText}</div>
      </li>`;
  }

  container.innerHTML = html;
  container.onclick = (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    onSelect(li.dataset.id === selectedId ? null : li.dataset.id);
  };
}

// ─── Controlli griglia: reset, zoom, pan ─────────────────────────────────────

let _gridControlsBound = false;
export function initGridControls(onGridReset) {
  if (_gridControlsBound) return;
  _gridControlsBound = true;
  document.getElementById('btn-grid-reset')?.addEventListener('click', () => onGridReset?.());

  function _zoomTo(z) {
    if (!_totalW || !_totalH) return;
    // Centro del viewport corrente in coordinate SVG
    const cx = _panX + (_totalW / _zoom) / 2;
    const cy = _panY + (_totalH / _zoom) / 2;
    _zoom = Math.min(4, Math.max(1, z));
    const maxPanX = _totalW - _totalW / _zoom;
    const maxPanY = _totalH - _totalH / _zoom;
    _panX = Math.min(maxPanX, Math.max(0, cx - (_totalW / _zoom) / 2));
    _panY = Math.min(maxPanY, Math.max(0, cy - (_totalH / _zoom) / 2));
    _reRenderCallback?.();
  }

  document.getElementById('btn-zoom-in')?.addEventListener('click',    () => _zoomTo(_zoom * 1.3));
  document.getElementById('btn-zoom-out')?.addEventListener('click',   () => _zoomTo(_zoom / 1.3));
  document.getElementById('btn-zoom-reset')?.addEventListener('click', () => { _zoom = 1; _panX = 0; _panY = 0; _reRenderCallback?.(); });

  // Pan con drag (solo quando zoom > 1, non in modalità modifica)
  const container = document.getElementById('grid-container');
  if (!container) return;

  container.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (_zoom <= 1) return;
    if (_ctx?.editMode && _ctx?.isMaster) return;
    _panStart = { x: e.clientX, y: e.clientY, px: _panX, py: _panY, moved: false };
  });

  container.addEventListener('mousemove', (e) => {
    if (!_panStart) return;
    const dx = e.clientX - _panStart.x;
    const dy = e.clientY - _panStart.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) _panStart.moved = true;
    if (_panStart.moved) {
      const svg  = container.querySelector('svg');
      const rect = container.getBoundingClientRect();
      const scaleX = parseFloat(svg?.viewBox.baseVal.width  ?? 1) / (rect.width  || 1);
      const scaleY = parseFloat(svg?.viewBox.baseVal.height ?? 1) / (rect.height || 1);
      const maxPanX = _totalW - _totalW / _zoom;
      const maxPanY = _totalH - _totalH / _zoom;
      _panX = Math.min(maxPanX, Math.max(0, _panStart.px - dx * scaleX));
      _panY = Math.min(maxPanY, Math.max(0, _panStart.py - dy * scaleY));
      _reRenderCallback?.();
    }
  });

  const _stopPan = () => { setTimeout(() => { _panStart = null; }, 0); };
  container.addEventListener('mouseup',    _stopPan);
  container.addEventListener('mouseleave', _stopPan);
  window.addEventListener('mouseup',       _stopPan);
}
