// Griglia esagonale punta-in-alto, offset dispari per riga (odd-r)
// 1 esagono = 1 m

const BASE_HEX_R = 28;   // raggio di default (px screen)
const PAD        = 8;    // margine SVG fisso (px)
const SQRT3      = Math.sqrt(3);

let currentZoom = 1;
const MIN_ZOOM  = 0.25;
const MAX_ZOOM  = 4.0;
const ZOOM_STEP = 0.15;

let panX        = 0;
let panY        = 0;
let _isDragging           = false;
let _didPan               = false;
let _dragStartX           = 0;
let _dragStartY           = 0;
let _dragListenersAttached = false;
let viewOffsetX = 0;
let viewOffsetY = 0;

function hexR() { return BASE_HEX_R * currentZoom; }

function computeGridSize(containerW, containerH) {
  const r    = hexR();
  const cols = Math.min(80, Math.max(4, Math.floor((containerW - PAD * 2) / (r * SQRT3) - 0.5)));
  const rows = Math.min(50, Math.max(3, Math.floor(((containerH - PAD * 2) / r - 0.5) / 1.5)));
  return { cols, rows };
}

function gridStart() {
  const r = hexR();
  return {
    startCol: Math.floor(viewOffsetX / (r * SQRT3)),
    startRow: Math.floor(viewOffsetY / (r * 1.5)),
  };
}

// ─── Coordinate helpers ──────────────────────────────────────────────────────

function hexCenter(col, row) {
  const r = hexR();
  return {
    x: r * SQRT3 * (col + 0.5 * (row & 1)) - viewOffsetX + PAD,
    y: r * 1.5 * row - viewOffsetY + PAD,
  };
}

function hexPoints(cx, cy) {
  const r = hexR();
  return Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 3 * i - Math.PI / 6;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

function offsetToCube(col, row) {
  const x = col - (row - (row & 1)) / 2;
  const z = row;
  return { x, y: -x - z, z };
}

export function hexDistance(c1, r1, c2, r2) {
  const a = offsetToCube(c1, r1), b = offsetToCube(c2, r2);
  return (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z)) / 2;
}

function fmtM(d) {
  const m = d * 1;
  return m === Math.floor(m) ? `${m}m` : `${m.toFixed(1)}m`;
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── Re-render callback (zoom e resize) ──────────────────────────────────────

let _reRenderCallback = null;

export function setReRenderCallback(fn) {
  _reRenderCallback = fn;
}

// ─── Render ──────────────────────────────────────────────────────────────────

/**
 * Ridisegna la griglia all'interno di `container`.
 */
export function renderGrid(container, gridPos, combatants, myCombatantId, myOwnedIds, isMaster, selectedId, currentTurnId, onSelect, onMove) {
  const pos  = gridPos   || {};
  const comb = combatants || {};

  const r          = hexR();
  const tokenR     = Math.max(3, r * 0.8).toFixed(1);
  const nameFsz    = Math.max(5, Math.min(14, r * 0.42)).toFixed(1);
  const distFsz    = Math.max(4, Math.min(11, r * 0.35)).toFixed(1);
  const tooltipFsz = Math.max(6, Math.min(14, r * 0.44)).toFixed(1);

  // "col_row" → combatantId
  const cellMap = {};
  Object.entries(pos).forEach(([id, p]) => {
    if (p != null && p.col != null) cellMap[`${p.col}_${p.row}`] = id;
  });

  const selPos = selectedId ? pos[selectedId] : null;

  const rect       = container.getBoundingClientRect();
  const containerW = Math.max(400, rect.width  || container.clientWidth  || 600);
  const containerH = Math.max(300, rect.height || container.clientHeight || 400);
  const { cols, rows } = computeGridSize(containerW, containerH);

  const svgW = (r * SQRT3 * (cols + 0.5) + PAD * 2).toFixed(0);
  const svgH = (r * (1.5 * rows + 0.5) + PAD * 2).toFixed(0);

  let inner = '';

  const { startCol, startRow } = gridStart();
  for (let row = startRow; row < startRow + rows; row++) {
    for (let col = startCol; col < startCol + cols; col++) {
      const { x, y }   = hexCenter(col, row);
      const key        = `${col}_${row}`;
      const occupantId = cellMap[key];
      const occupant   = occupantId ? comb[occupantId] : null;
      const isSelected = occupantId === selectedId;
      const isActive   = occupantId === currentTurnId;

      // ─ Esagono di sfondo
      let cls = 'hx';
      if (isSelected)      cls += occupantId === myCombatantId ? ' hx-sel-my' : ' hx-sel';
      else if (occupantId) cls += ' hx-occ';
      inner += `<polygon class="${cls}" points="${hexPoints(x, y)}" data-c="${col}" data-r="${row}"/>`;

      // ─ Token
      if (occupant) {
        const isPlayer  = occupant.type === 'player';
        const isMyToken = occupantId === myCombatantId;
        const isDead    = occupant.hpCurrent <= 0;

        let fill, stroke;
        if (isMyToken) {
          fill   = '#0d2d0d';
          stroke = isSelected ? '#70d070' : '#4aba4a';
        } else if (isPlayer) {
          fill   = '#142d4a';
          stroke = isSelected ? 'var(--gold)' : isActive ? 'var(--gold-light)' : '#4a8abf';
        } else {
          const isGood = occupant.faction === 'good';
          if (isGood) {
            fill   = 'rgba(124,88,0,0.4)';
            stroke = isSelected ? 'var(--gold)' : isActive ? 'var(--gold-light)' : '#d4af37';
          } else {
            fill   = '#2d1010';
            stroke = isSelected ? 'var(--gold)' : isActive ? 'var(--gold-light)' : '#bf4a4a';
          }
        }

        if (isDead) { fill = '#666'; stroke = '#999'; }

        const sw       = (isSelected || isActive) ? 2.5 : 1.5;
        const initials = esc((occupant.name || '?').slice(0, 2).toUpperCase());
        const yText    = (y + r * 0.16).toFixed(1);

        inner += `<circle cx="${x}" cy="${y}" r="${tokenR}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" data-c="${col}" data-r="${row}"/>`;
        inner += `<text x="${x}" y="${yText}" text-anchor="middle" font-size="${nameFsz}" class="hx-name" data-c="${col}" data-r="${row}">${initials}</text>`;

        if (isDead) {
          const aboveRow = row - 1;
          if (aboveRow >= 0 && !cellMap[`${col}_${aboveRow}`]) {
            const { x: ax, y: ay } = hexCenter(col, aboveRow);
            inner += `<text x="${ax}" y="${(ay + r * 0.16).toFixed(1)}" text-anchor="middle" font-size="${nameFsz}" class="hx-name" data-c="${col}" data-r="${aboveRow}">💀</text>`;
          }
        }

        if (selPos && !isSelected) {
          const d = hexDistance(selPos.col, selPos.row, col, row);
          inner += `<text x="${x}" y="${(y - r + 2).toFixed(1)}" text-anchor="middle" font-size="${distFsz}" class="hx-dist" data-c="${col}" data-r="${row}">${esc(fmtM(d))}</text>`;
        }
      }

      // ─ Target trasparente (intercetta click)
      inner += `<polygon class="hx-hit" points="${hexPoints(x, y)}" data-c="${col}" data-r="${row}"/>`;
    }
  }

  container.innerHTML =
    `<svg class="hex-svg" width="${svgW}" height="${svgH}">${inner}</svg>`;
  panX = 0;
  panY = 0;

  const svg = container.querySelector('svg');

  let distanceTooltip = null;
  let nameTooltip     = null;

  svg.addEventListener('mousemove', (e) => {
    const hit = e.target.closest('.hx-hit');
    if (!hit) {
      distanceTooltip?.remove(); distanceTooltip = null;
      nameTooltip?.remove();     nameTooltip     = null;
      return;
    }

    const c   = parseInt(hit.dataset.c);
    const row = parseInt(hit.dataset.r);
    const { x, y } = hexCenter(c, row);
    const rr  = hexR();

    const occId = cellMap[`${c}_${row}`];
    const occ   = occId ? comb[occId] : null;
    if (occ) {
      if (!nameTooltip) {
        nameTooltip = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        nameTooltip.setAttribute('class', 'hx-tooltip-name');
        nameTooltip.setAttribute('text-anchor', 'middle');
        nameTooltip.setAttribute('font-size', tooltipFsz);
        svg.appendChild(nameTooltip);
      }
      nameTooltip.setAttribute('x', x);
      nameTooltip.setAttribute('y', y - rr - 5);
      nameTooltip.textContent = occ.name;
    } else {
      nameTooltip?.remove(); nameTooltip = null;
    }

    if (selectedId) {
      if (selPos && c === selPos.col && row === selPos.row) {
        distanceTooltip?.remove(); distanceTooltip = null;
      } else {
        const d = selPos ? hexDistance(selPos.col, selPos.row, c, row) : 0;
        if (!distanceTooltip) {
          distanceTooltip = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          distanceTooltip.setAttribute('class', 'hx-tooltip-dist');
          distanceTooltip.setAttribute('text-anchor', 'middle');
          distanceTooltip.setAttribute('font-size', tooltipFsz);
          svg.appendChild(distanceTooltip);
        }
        distanceTooltip.setAttribute('x', x);
        distanceTooltip.setAttribute('y', y + rr + 12);
        distanceTooltip.textContent = fmtM(d);
      }
    }
  });

  svg.addEventListener('mouseover', (e) => {
    const hit = e.target.closest('.hx-hit');
    if (!hit) return;
    svg.querySelectorAll('.hx.hx-hover').forEach(h => h.classList.remove('hx-hover'));
    svg.querySelector(`.hx[data-c="${hit.dataset.c}"][data-r="${hit.dataset.r}"]`)?.classList.add('hx-hover');
  });
  svg.addEventListener('mouseleave', () => {
    svg.querySelectorAll('.hx.hx-hover').forEach(h => h.classList.remove('hx-hover'));
    distanceTooltip?.remove(); distanceTooltip = null;
  });

  svg.addEventListener('click', (e) => {
    if (_didPan) { _didPan = false; return; }
    const el = e.target.closest('[data-c]');
    if (!el) return;
    const col = parseInt(el.dataset.c);
    const row = parseInt(el.dataset.r);
    const occupantId = cellMap[`${col}_${row}`];

    if (occupantId) {
      onSelect(occupantId === selectedId ? null : occupantId);
    } else if (selectedId) {
      if (isMaster || myOwnedIds.has(selectedId)) onMove(selectedId, col, row);
      onSelect(null);
    } else if (!isMaster) {
      if (myCombatantId && pos[myCombatantId] == null) {
        onMove(myCombatantId, col, row);
      } else {
        const unplaced = [...myOwnedIds].find(id => id !== myCombatantId && pos[id] == null);
        if (unplaced) onMove(unplaced, col, row);
      }
    }
  });
}

export function renderInitiativeList(container, sortedCombatants, gridPos, myCombatantId, selectedId, currentTurnId, isMaster, onSelect) {
  if (!container) return;

  const pos = gridPos || {};
  const referenceId = selectedId || myCombatantId;
  const refPos = referenceId ? pos[referenceId] : null;

  let html = '';

  for (const c of sortedCombatants) {
    const isActive = c.id === currentTurnId;
    const cPos = pos[c.id];

    let distText = '';
    if (refPos && cPos && c.id !== referenceId) {
      const d = hexDistance(refPos.col, refPos.row, cPos.col, cPos.row);
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
    if (svg) svg.style.transform = `translate(${panX}px,${panY}px)`;
  });

  container.addEventListener('mouseup', () => {
    if (_isDragging && _didPan) {
      viewOffsetX -= panX;
      viewOffsetY -= panY;
      _reRenderCallback?.();
    }
    _isDragging = false;
    container.style.cursor = 'grab';
  });

  container.addEventListener('mouseleave', () => {
    if (_isDragging) {
      const svg = container.querySelector('svg');
      if (svg) svg.style.transform = '';
    }
    _isDragging = false;
    _didPan     = false;
    container.style.cursor = 'grab';
  });

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => { _reRenderCallback?.(); }).observe(container);
  }
}
