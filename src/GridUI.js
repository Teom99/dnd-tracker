// Griglia quadrata. 1 cella = 1 m. Dimensioni guidate da gridConfig.
// La griglia si adatta sempre al contenitore (viewBox), non è zoomabile né trascinabile.
// Distanza Chebyshev (diagonali = 1), misurata bordo-a-bordo tra footprint.

import { healthHintText } from './UI.js';

const CELL = 40;        // lato cella nelle coordinate del viewBox
const PAD  = 8;         // margine interno (coordinate viewBox)

const SIZE_FOOTPRINT = { tiny: 1, small: 1, medium: 1, large: 2, huge: 3, gargantuan: 4 };
export function footprintOf(size) { return SIZE_FOOTPRINT[size] || 1; }

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

// ─── Tooltip combattente (solo dispositivi con hover reale) ─────────────────
const _canHover = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;
let _tipEl = null;

function _tooltipHtml(c, isMaster) {
  const hpVisible = isMaster || c.type !== 'creature';
  const hpPct = c.hpMax > 0 ? Math.max(0, Math.min(100, (c.hpCurrent / c.hpMax) * 100)) : 0;
  let hpLine = '';
  if (hpVisible)               hpLine = `<div class="ct-hp">HP ${c.hpCurrent} / ${c.hpMax}</div>`;
  else if (c.showHealthHint)   hpLine = `<div class="ct-hint">${esc(healthHintText(hpPct))}</div>`;
  const acVisible = c.type !== 'creature' || isMaster || c.showAC === true;
  const acLine = (acVisible && c.armorClass != null) ? `<div class="ct-ac">CA ${esc(String(c.armorClass))}</div>` : '';
  const conds = c.conditions ? Object.keys(c.conditions) : [];
  const condLine = conds.length ? `<div class="ct-conds">${conds.map(esc).join(' · ')}</div>` : '';
  return `<div class="ct-name">${esc(c.name)}</div>${hpLine}${acLine}${condLine}`;
}

export function showCombatTooltip(c, isMaster, x, y) {
  if (!_canHover || !c) return;
  if (!_tipEl) {
    _tipEl = document.createElement('div');
    _tipEl.id = 'combat-tooltip';
    document.body.appendChild(_tipEl);
  }
  _tipEl.innerHTML = _tooltipHtml(c, isMaster);
  _tipEl.style.left = `${Math.min(x + 14, window.innerWidth - 200)}px`;
  _tipEl.style.top  = `${Math.min(y + 14, window.innerHeight - 130)}px`;
  _tipEl.classList.add('visible');
}

export function hideCombatTooltip() {
  _tipEl?.classList.remove('visible');
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
    if (isMyToken)      { fill = '#16240f'; stroke = isSelected ? '#9ccf6e' : '#5e8f54'; }
    else if (isPlayer)  { fill = '#13241c'; stroke = isSelected ? '#d4af5e' : isActive ? '#e3c87e' : '#4a8a6e'; }
    else if (occ.faction === 'good') { fill = 'rgba(138,109,50,0.35)'; stroke = isSelected ? '#d4af5e' : isActive ? '#e3c87e' : '#b8954a'; }
    else                { fill = '#2a100c'; stroke = isSelected ? '#d4af5e' : isActive ? '#e3c87e' : '#a84a3a'; }
    if (isDead) { fill = '#3a352c'; stroke = '#6e6657'; }

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

  container.innerHTML =
    `<svg class="sq-svg" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" width="100%" height="100%">${inner}</svg>`;
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

  // Tooltip combattente al passaggio del mouse (condiviso con la rail)
  svg.addEventListener('mousemove', (e) => {
    const hit = e.target.closest('.sq-hit');
    const occId = hit ? occCell[`${parseInt(hit.dataset.c)}_${parseInt(hit.dataset.r)}`] : null;
    const occ   = occId ? comb[occId] : null;
    if (occ) showCombatTooltip(occ, isMaster, e.clientX, e.clientY);
    else hideCombatTooltip();
  });

  svg.addEventListener('mouseover', (e) => {
    const hit = e.target.closest('.sq-hit');
    if (!hit) return;
    svg.querySelectorAll('.sq.sq-hover').forEach(h => h.classList.remove('sq-hover'));
    svg.querySelector(`.sq[data-c="${hit.dataset.c}"][data-r="${hit.dataset.r}"]`)?.classList.add('sq-hover');
  });
  svg.addEventListener('mouseleave', () => {
    svg.querySelectorAll('.sq.sq-hover').forEach(h => h.classList.remove('sq-hover'));
    hideCombatTooltip();
  });

  svg.addEventListener('click', (e) => {
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

export function renderInitiativeList(container, sortedCombatants, gridPos, myCombatantId, selectedId, currentTurnId, isMaster, onSelect, combatants, onAddCombatant) {
  if (!container) return;

  let html = '';
  for (const c of sortedCombatants) {
    const isActive   = c.id === currentTurnId;
    const isSelected = c.id === selectedId;
    const isKO       = c.hpCurrent === 0;

    // HP visibile: master sempre; per i player solo PG/pet (le creature restano nascoste)
    const hpVisible = isMaster || c.type !== 'creature';
    const hpPct = c.hpMax > 0 ? Math.max(0, Math.min(100, (c.hpCurrent / c.hpMax) * 100)) : 0;
    const ringPct = hpVisible ? hpPct : 100;

    const isPg = c.type === 'player' || c.type === 'pet';
    let cls = 'rail-item';
    cls += isPg ? ' pg' : (c.faction === 'good' ? ' ally' : ' foe');
    if (isActive)   cls += ' active-turn';
    if (isSelected) cls += ' selected';
    if (isKO)       cls += ' ko';

    html += `
      <li class="${cls}" data-id="${c.id}" style="--hp:${ringPct.toFixed(0)}">
        <span class="rail-ring"><span class="rail-portrait">${isKO ? '💀' : esc((c.name || '?').slice(0, 2).toUpperCase())}</span></span>
      </li>`;
  }

  if (isMaster && onAddCombatant) {
    html += `<li class="rail-item rail-add" data-action="add-combatant" title="Aggiungi alla battaglia"><span class="rail-ring"><span class="rail-portrait">＋</span></span></li>`;
  } else if (!isMaster && onAddCombatant) {
    html += `<li class="rail-item rail-add" data-action="add-combatant" title="Aggiungi compagno"><span class="rail-ring"><span class="rail-portrait">🐾</span></span></li>`;
  }

  container.innerHTML = html;
  container.onclick = (e) => {
    const add = e.target.closest('[data-action="add-combatant"]');
    if (add) { onAddCombatant?.(); return; }
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    onSelect(li.dataset.id === selectedId ? null : li.dataset.id);
  };
  container.onmousemove = (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li) { hideCombatTooltip(); return; }
    const c = sortedCombatants.find(x => x.id === li.dataset.id);
    if (c) showCombatTooltip(c, isMaster, e.clientX, e.clientY);
  };
  container.onmouseleave = () => hideCombatTooltip();
}

// ─── Controlli griglia (solo reset; nessun pan/zoom) ─────────────────────────

let _gridControlsBound = false;
export function initGridControls(onGridReset) {
  if (_gridControlsBound) return;
  _gridControlsBound = true;
  document.getElementById('btn-grid-reset')?.addEventListener('click', () => onGridReset?.());
}
