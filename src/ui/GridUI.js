// Griglia quadrata. 1 cella = 1 m. Dimensioni guidate da gridConfig.
// Zoom via viewBox: _zoom scala il viewBox, _panX/_panY traslano l'origine.
// Distanza a diagonali alternate (variante DMG 5-10-5: la 1ª diagonale costa 1,
// la 2ª costa 2, ...), misurata bordo-a-bordo tra footprint.

const CELL = 40;        // lato cella nelle coordinate del viewBox
const PAD  = 14;        // margine interno (coordinate viewBox) — spazio per etichette nome/distanza

const SIZE_FOOTPRINT = { tiny: 1, small: 1, medium: 1, large: 2, huge: 3, gargantuan: 4 };
export function footprintOf(size) { return SIZE_FOOTPRINT[size] || 1; }

// ─── Stato zoom e pan ─────────────────────────────────────────────────────────
let _zoom     = 1;
let _panX     = 0;
let _panY     = 0;
let _panStart = null;   // { x, y, px, py, moved } durante un drag
let _totalW   = 0;      // dimensioni totali viewBox in coordinate SVG
let _totalH   = 0;

// ─── Disegno muri / colore con drag (tieni premuto LMB) ──────────────────────
// Le listener stanno sul container (persiste tra i re-render); leggono _ctx,
// il contesto dell'ultimo render, aggiornato a ogni renderGrid. Muri (master-
// only) e colore (chiunque) sono mutuamente esclusivi, quindi condividono lo
// stesso tracking del drag — solo _paintMode cambia cosa viene scritto.
let _ctx               = null;
let _paintBound        = false;
let _painting          = false;
let _paintMode         = null;  // 'wall' | 'color', deciso al pointerdown
let _paintValue        = false; // usato da _paintMode === 'wall'
let _paintColorValue   = null;  // usato da _paintMode === 'color' (hex o null = gomma)
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
  if (_paintMode === 'wall') {
    if (_ctx.occCell[key]) return;                       // niente muri sotto i token
    if (Boolean(_ctx.wall[key]) === _paintValue) return; // già nello stato voluto
    _ctx.onSetWall(key, _paintValue);
  } else if (_paintMode === 'color') {
    const current = _ctx.paint?.[key] ?? null;
    if (current === _paintColorValue) return; // già nello stato voluto
    _ctx.onSetPaint(key, _paintColorValue);
  }
}

function _bindCellPaint(container) {
  if (_paintBound) return;
  _paintBound = true;

  container.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (!_ctx) return;
    const cell = _cellFromEvent(e);
    if (!cell) return;
    const key = `${cell.col}_${cell.row}`;

    const wallMode  = _ctx.isMaster && _ctx.editMode;
    const colorMode = !wallMode && _ctx.drawMode;
    if (!wallMode && !colorMode) return;

    if (wallMode) {
      if (_ctx.occCell[key]) return;
      _paintMode  = 'wall';
      _paintValue = !_ctx.wall[key];   // cella vuota → disegna; muro → cancella
    } else {
      _paintMode       = 'color';
      _paintColorValue = _ctx.drawColor; // null = gomma
    }
    _painting          = true;
    _paintedThisStroke = new Set();
    _paintAt(cell.col, cell.row);
    e.preventDefault();
  });

  container.addEventListener('pointermove', (e) => {
    if (!_painting) return;
    const cell = _cellFromEvent(e);
    if (cell) _paintAt(cell.col, cell.row);
  });

  const stop = () => { _painting = false; };
  container.addEventListener('pointerup', stop);
  container.addEventListener('pointercancel', stop);
  window.addEventListener('pointerup', stop);
}

// ─── Coordinate / distanza ────────────────────────────────────────────────────

function cellXY(col, row) {
  return { x: PAD + col * CELL, y: PAD + row * CELL };
}

// Screen-px ↔ spazio SVG fisso (indipendente da zoom/pan) — stessa idiomatica
// già usata dal pan-drag in initGridControls (rect + rapporto viewBox/rect).
function _screenToGrid(clientX, clientY, svg, container) {
  const rect = container.getBoundingClientRect();
  const scaleX = svg.viewBox.baseVal.width  / (rect.width  || 1);
  const scaleY = svg.viewBox.baseVal.height / (rect.height || 1);
  const svgX = _panX + (clientX - rect.left) * scaleX;
  const svgY = _panY + (clientY - rect.top)  * scaleY;
  return { col: (svgX - PAD) / CELL, row: (svgY - PAD) / CELL };
}

function _gridToScreen(col, row, svg, container) {
  const rect = container.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const scaleX = rect.width  / vb.width;
  const scaleY = rect.height / vb.height;
  return {
    x: (PAD + col * CELL - vb.x) * scaleX,
    y: (PAD + row * CELL - vb.y) * scaleY,
  };
}

// Separazione su un asse tra due intervalli [a1,a2] e [b1,b2] (0 se si toccano/sovrappongono, +1 se adiacenti)
function axisDist(a1, a2, b1, b2) {
  return Math.max(0, Math.max(a1, b1) - Math.min(a2, b2));
}

// Distanza bordo-a-bordo tra due footprint quadrati, con diagonali alternate
// (variante DMG: ogni seconda diagonale costa doppio) → max + floor(min/2).
export function squareDistance(c1, r1, n1, c2, r2, n2) {
  const dc = axisDist(c1, c1 + n1 - 1, c2, c2 + n2 - 1);
  const dr = axisDist(r1, r1 + n1 - 1, r2, r2 + n2 - 1);
  return Math.max(dc, dr) + Math.floor(Math.min(dc, dr) / 2);
}

function fmtM(d) {
  return d === Math.floor(d) ? `${d}m` : `${d.toFixed(1)}m`;
}

// ─── Disegno a colori sulla mappa ─────────────────────────────────────────────
// Validato anche in lettura (non solo in scrittura, vedi Session.setPaintCell):
// le security rules permettono a qualsiasi utente autenticato di scrivere su
// sessions/{code}, quindi un valore malevolo potrebbe bypassare l'app e finire
// direttamente in Firebase — qui evitiamo di interpolarlo comunque nell'SVG.
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

// ─── Template ad area (cerchio/cono/linea) ───────────────────────────────────
const TEMPLATE_LABEL     = { circle: 'Cerchio', cone: 'Cono', line: 'Linea' };
const TEMPLATE_COLOR     = '#c084fc'; // viola neutro, distinto da muri/reach/selezione
const CONE_HALF_ANGLE    = 45;        // cono 5e: larghezza = distanza dall'origine (angolo totale 90°)
const LINE_HALF_WIDTH_M  = 0.75;      // linea larga 1.5m
const TEMPLATE_MIN_M     = { circle: 3, cone: 9, line: 9 }; // default se origine e conferma coincidono

function cellCenterOf(col, row) {
  const { x, y } = cellXY(col, row);
  return { x: x + CELL / 2, y: y + CELL / 2 };
}

// Distanza (in metri) e angolo (in gradi) dall'origine a una cella target
function templateGeometryTo(originCol, originRow, col, row) {
  const o = cellCenterOf(originCol, originRow);
  const p = cellCenterOf(col, row);
  const dx = p.x - o.x, dy = p.y - o.y;
  const distM = Math.sqrt(dx * dx + dy * dy) / CELL;
  const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
  return { distM, angleDeg };
}

function templateContainsCell(t, col, row) {
  const { distM, angleDeg } = templateGeometryTo(t.originCol, t.originRow, col, row);
  if (distM < 0.05) return true; // la cella di origine è sempre inclusa
  if (t.shape === 'circle') return distM <= t.size;
  let diff = Math.abs(angleDeg - t.angleDeg);
  if (diff > 180) diff = 360 - diff;
  if (t.shape === 'cone') return distM <= t.size && diff <= CONE_HALF_ANGLE;
  if (t.shape === 'line') {
    const rad  = diff * Math.PI / 180;
    const along = distM * Math.cos(rad);
    const perp  = Math.abs(distM * Math.sin(rad));
    return along >= -0.05 && along <= t.size && perp <= LINE_HALF_WIDTH_M;
  }
  return false;
}

// Markup SVG della forma (usato sia per il template confermato sia per l'anteprima)
function templateShapeMarkup(shape, originCol, originRow, size, angleDeg, color, fillOpacity, strokeOpacity, dashed) {
  const o = cellCenterOf(originCol, originRow);
  const r = size * CELL;
  const dash = dashed ? ' stroke-dasharray="6 4"' : '';
  const common = `fill="${color}" fill-opacity="${fillOpacity}" stroke="${color}" stroke-opacity="${strokeOpacity}" stroke-width="2"${dash} pointer-events="none"`;

  if (shape === 'circle') {
    return `<circle cx="${o.x.toFixed(1)}" cy="${o.y.toFixed(1)}" r="${r.toFixed(1)}" ${common}/>`;
  }
  const rad = angleDeg * Math.PI / 180;
  if (shape === 'cone') {
    const a1 = rad - CONE_HALF_ANGLE * Math.PI / 180;
    const a2 = rad + CONE_HALF_ANGLE * Math.PI / 180;
    const p2 = { x: o.x + r * Math.cos(a1), y: o.y + r * Math.sin(a1) };
    const p3 = { x: o.x + r * Math.cos(a2), y: o.y + r * Math.sin(a2) };
    return `<polygon points="${o.x.toFixed(1)},${o.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)} ${p3.x.toFixed(1)},${p3.y.toFixed(1)}" ${common}/>`;
  }
  if (shape === 'line') {
    const dirX = Math.cos(rad), dirY = Math.sin(rad);
    const perpX = -dirY, perpY = dirX;
    const hw = LINE_HALF_WIDTH_M * CELL;
    const p1 = { x: o.x + perpX * hw,         y: o.y + perpY * hw };
    const p2 = { x: o.x - perpX * hw,         y: o.y - perpY * hw };
    const p3 = { x: p2.x + dirX * r,          y: p2.y + dirY * r };
    const p4 = { x: p1.x + dirX * r,          y: p1.y + dirY * r };
    return `<polygon points="${p1.x.toFixed(1)},${p1.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)} ${p3.x.toFixed(1)},${p3.y.toFixed(1)} ${p4.x.toFixed(1)},${p4.y.toFixed(1)}" ${common}/>`;
  }
  return '';
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Re-render callback (resize) ─────────────────────────────────────────────

let _reRenderCallback = null;
export function setReRenderCallback(fn) { _reRenderCallback = fn; }

// ─── Cursori live multiplayer ─────────────────────────────────────────────────
// Layer HTML separato, sibling di #grid-container (mai toccato dal
// container.innerHTML di renderGrid, che ricostruisce l'SVG a ogni update
// Firebase). I dati arrivano da un canale Firebase dedicato (vedi
// Session.listenCursors), non dal render principale della griglia.
let _cursors     = {};
let _cursorLayer = null;
let _lastCursorSend = 0;
const CURSOR_THROTTLE_MS = 120;

function _ensureCursorLayer(container) {
  if (_cursorLayer && _cursorLayer.isConnected) return _cursorLayer;
  _cursorLayer = document.createElement('div');
  _cursorLayer.className = 'grid-cursor-layer';
  container.insertAdjacentElement('afterend', _cursorLayer);
  return _cursorLayer;
}

function _renderCursorOverlay() {
  const container = document.getElementById('grid-container');
  const svg = container?.querySelector('svg');
  if (!container || !svg) return;
  const layer = _ensureCursorLayer(container);

  const seen = new Set();
  for (const [uid, c] of Object.entries(_cursors)) {
    if (c == null || typeof c.col !== 'number' || typeof c.row !== 'number') continue;
    seen.add(uid);
    const { x, y } = _gridToScreen(c.col, c.row, svg, container);
    let el = layer.querySelector(`[data-cursor-uid="${uid}"]`);
    if (!el) {
      el = document.createElement('div');
      el.className = 'grid-cursor';
      el.dataset.cursorUid = uid;
      el.innerHTML = '<span class="dot"></span><span class="label"></span>';
      layer.appendChild(el);
    }
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    const color = typeof c.color === 'string' ? c.color : '#888';
    el.querySelector('.dot').style.background   = color;
    const label = el.querySelector('.label');
    label.style.background = color;
    label.textContent = typeof c.name === 'string' ? c.name : 'Giocatore';
  }
  layer.querySelectorAll('[data-cursor-uid]').forEach(el => {
    if (!seen.has(el.dataset.cursorUid)) el.remove();
  });
}

export function setCursors(cursorsObj) {
  _cursors = cursorsObj || {};
  _renderCursorOverlay();
}

// ─── Render ──────────────────────────────────────────────────────────────────

/**
 * Ridisegna la griglia quadrata, adattata al contenitore.
 * @param editMode boolean       — modalità modifica del master (disegno muri)
 * @param onSetWall (cellKey, value) => void   — imposta/rimuove un muro
 * @param drawMode boolean       — modalità "disegna sulla mappa" (chiunque)
 * @param onSetPaint (cellKey, color) => void  — imposta/rimuove il colore di una cella
 * @param onCursorMove (col, row) => void      — broadcast della propria posizione mouse (null,null = uscito dalla griglia)
 */
export function renderGrid(container, gridPos, combatants, myCombatantId, myOwnedIds, isMaster, selectedId, currentTurnId, gridConfig, walls, editMode, onSelect, onMove, onSetWall, template, placingShape, templateOrigin, onSetTemplateOrigin, onCommitTemplate, paint, drawMode, drawColor, onSetPaint, onCursorMove) {
  const pos   = gridPos    || {};
  const comb  = combatants || {};
  const wall  = walls      || {};
  const cellPaint = paint  || {};
  const cols  = Math.max(1, gridConfig?.cols || 20);
  const rows  = Math.max(1, gridConfig?.rows || 20);

  // Celle coperte dal template attivo + combattenti coinvolti (per evidenziazione ed elenco)
  const templateCells = new Set();
  const templateHitNames = [];
  if (template) {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (templateContainsCell(template, col, row)) templateCells.add(`${col}_${row}`);
      }
    }
    Object.entries(pos).forEach(([id, p]) => {
      if (p == null || p.col == null || !comb[id]) return;
      const n = footprintOf(comb[id].size);
      let hit = false;
      for (let dc = 0; dc < n && !hit; dc++) {
        for (let dr = 0; dr < n && !hit; dr++) {
          if (templateCells.has(`${p.col + dc}_${p.row + dr}`)) hit = true;
        }
      }
      if (hit) templateHitNames.push(comb[id].name || '?');
    });
  }

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

  // Raggio di movimento del token selezionato (1 casella = 1 m; velocità dalla scheda, 9 m di default)
  const selComb    = selectedId ? comb[selectedId] : null;
  const reachSpeed = selComb?.speed > 0 ? selComb.speed : 9;
  const showReach  = !!(selPos && selComb && selComb.hpCurrent > 0 && !editMode);

  // I token grandi si ancorano (circa) al centro: la cella cliccata non è il top-left ma il centro del footprint
  const selOff  = Math.floor((selSide - 1) / 2);
  const selRing = !selComb ? '#8a8a8a'
    : (selComb.type === 'player' || selectedId === myCombatantId) ? '#4aba4a'
    : selComb.faction === 'good' ? '#4aa8d8'
    : '#bf4a4a';

  const vbW = (PAD * 2 + cols * CELL).toFixed(0);
  const vbH = (PAD * 2 + rows * CELL).toFixed(0);
  _totalW = PAD * 2 + cols * CELL;
  _totalH = PAD * 2 + rows * CELL;

  let defs  = '';
  let inner = '';

  // 1) Celle di sfondo + muri + raggio di movimento
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const { x, y } = cellXY(col, row);
      const key  = `${col}_${row}`;
      let cls = wall[key] ? 'sq sq-wall' : 'sq';
      if (showReach && !wall[key] && (!occCell[key] || occCell[key] === selectedId)
          && squareDistance(selPos.col, selPos.row, selSide, col, row, 1) <= reachSpeed) {
        cls += ' sq-reach';
      }
      if (templateCells.has(key)) cls += ' sq-template';
      inner += `<rect class="${cls}" x="${x}" y="${y}" width="${CELL}" height="${CELL}" data-c="${col}" data-r="${row}"/>`;

      const paintColor = cellPaint[key];
      if (paintColor && HEX_COLOR_RE.test(paintColor)) {
        inner += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${paintColor}" fill-opacity=".45" pointer-events="none"/>`;
      }
    }
  }

  // 1b) Contorno del template confermato (sopra le celle, sotto i token)
  if (template) {
    inner += templateShapeMarkup(template.shape, template.originCol, template.originRow, template.size, template.angleDeg, TEMPLATE_COLOR, 0.12, 0.7, false);
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

    // Colore del bordo per tipo di token; sfondo opaco in tinta scura
    let fill, ring;
    if (isPlayer || isMyToken)       { fill = '#0d2d0d'; ring = '#4aba4a'; }   // giocatori: verde
    else if (occ.faction === 'good') { fill = '#10293c'; ring = '#4aa8d8'; }   // creature alleate: azzurro
    else                             { fill = '#2d1010'; ring = '#bf4a4a'; }   // nemici: rosso
    if (isDead) { fill = '#2e2e2e'; ring = '#8a8a8a'; }

    const inset  = 3;
    const letter = esc((occ.name || '?').trim().charAt(0).toUpperCase());
    const fsz    = Math.max(13, Math.min(24, 11 + n * 4));

    // Token rotondo: alone attivo/selezionato + un unico bordo che è anche la barra HP
    const rOuter = w / 2 - inset;
    const ringW  = 3.5;
    const rRing  = rOuter - ringW / 2;
    const rBody  = rRing - ringW / 2;

    if (isActive) {
      inner += `<circle cx="${cx}" cy="${cy}" r="${rOuter + 2}" fill="none" stroke="var(--gold-bright)" stroke-width="1.5" pointer-events="none"/>`;
    } else if (isSelected) {
      inner += `<circle cx="${cx}" cy="${cy}" r="${rOuter + 2}" fill="none" stroke="var(--gold)" stroke-width="1.5" stroke-dasharray="4 4" pointer-events="none"/>`;
    }

    // HP esatti: master vede tutto, i player solo PG/famigli — per le creature il bordo resta pieno
    const hpVisible = occ.hpMax > 0 && (isMaster || occ.type !== 'creature');
    const hpPct     = (isDead || !hpVisible) ? 1 : Math.max(0, Math.min(1, occ.hpCurrent / occ.hpMax));
    const circ      = 2 * Math.PI * rRing;

    inner += `<circle cx="${cx}" cy="${cy}" r="${rBody}" fill="${fill}" pointer-events="none"/>`;
    inner += `<circle cx="${cx}" cy="${cy}" r="${rRing}" fill="none" stroke="${ring}" stroke-opacity=".25" stroke-width="${ringW}" pointer-events="none"/>`;
    inner += `<circle cx="${cx}" cy="${cy}" r="${rRing}" fill="none" stroke="${ring}" stroke-width="${ringW}"${hpPct < 1 ? ' stroke-linecap="round"' : ''}
                      stroke-dasharray="${(circ * hpPct).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})" pointer-events="none"/>`;

    // Avatar: <image> SVG con clipPath circolare; fallback lettera/teschio se assente o morto
    const rawThumb = occ.avatarThumb;
    const avatarSrc = typeof rawThumb === 'string' && rawThumb.startsWith('data:image/') ? rawThumb : null;
    if (avatarSrc && !isDead) {
      const clipId = `tc_${id.replace(/[^a-zA-Z0-9]/g, '_')}`;
      defs += `<clipPath id="${clipId}"><circle cx="${cx}" cy="${cy}" r="${rBody.toFixed(1)}"/></clipPath>`;
      inner += `<image href="${avatarSrc}" x="${(cx - rBody).toFixed(1)}" y="${(cy - rBody).toFixed(1)}" width="${(rBody * 2).toFixed(1)}" height="${(rBody * 2).toFixed(1)}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice" pointer-events="none"/>`;
    } else {
      inner += `<text x="${cx}" y="${(cy + fsz * 0.36).toFixed(1)}" text-anchor="middle" font-size="${fsz}" class="sq-name" pointer-events="none">${isDead ? '💀' : letter}</text>`;
    }
    inner += `<text x="${cx}" y="${(y + w + 9).toFixed(1)}" text-anchor="middle" class="sq-nm" pointer-events="none">${esc((occ.name || '').trim().slice(0, 12).toUpperCase())}</text>`;

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
    `<svg class="sq-svg" viewBox="${_panX.toFixed(0)} ${_panY.toFixed(0)} ${zVbW} ${zVbH}" preserveAspectRatio="xMidYMid meet" width="100%" height="100%">${defs ? `<defs>${defs}</defs>` : ''}${inner}</svg>`;
  container.classList.toggle('grid-edit-active', !!editMode);
  container.classList.toggle('grid-draw-active', !!drawMode);

  // Il layer cursori vive fuori dall'SVG (sibling), ma le posizioni a schermo
  // vanno ricalcolate ad ogni rebuild (nuovo viewBox.baseVal dopo zoom/pan/update).
  _ensureCursorLayer(container);
  _renderCursorOverlay();

  // Hint contestuale nella toolbar
  const hintEl = document.getElementById('grid-hint');
  if (hintEl) {
    if (drawMode) {
      hintEl.textContent = drawColor
        ? '🎨 Disegna: trascina per colorare le caselle'
        : '🎨 Disegna: trascina per cancellare il colore (gomma attiva)';
    } else if (placingShape && !templateOrigin) {
      hintEl.textContent = `${TEMPLATE_LABEL[placingShape]}: tocca la cella di origine`;
    } else if (placingShape && templateOrigin) {
      hintEl.textContent = `${TEMPLATE_LABEL[placingShape]}: muovi per orientare, tocca per confermare`;
    } else if (editMode && isMaster) {
      hintEl.textContent = '✏️ Modifica: imposta le dimensioni e clicca le caselle vuote per i muri';
    } else if (showReach) {
      hintEl.textContent = `${selComb.name} — raggio di movimento ${fmtM(reachSpeed)} · tocca la destinazione`;
    } else if (selectedId && selComb) {
      hintEl.textContent = selPos
        ? `${selComb.name} selezionato`
        : `${selComb.name} — tocca una casella per posizionarlo`;
    } else if (template) {
      const label = `${TEMPLATE_LABEL[template.shape]} ${fmtM(template.size)}`;
      hintEl.textContent = templateHitNames.length > 0
        ? `${label} — nel template: ${templateHitNames.join(', ')}`
        : `${label} — nessun combattente nel template`;
    } else {
      hintEl.textContent = '1 casella = 1 m · Seleziona un token, poi tocca la destinazione';
    }
  }

  // Aggiorna il contesto usato dal disegno (muri/colore) con drag e assicura il binding.
  _ctx = { cols, rows, wall, occCell, isMaster, editMode: !!editMode, onSetWall, paint: cellPaint, drawMode: !!drawMode, drawColor: drawColor ?? null, onSetPaint };
  _bindCellPaint(container);

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

  // Preview di spostamento: ghost del footprint sotto il cursore, grigio se la destinazione non è valida
  let ghost = null;
  const removeGhost = () => { ghost?.remove(); ghost = null; };
  function updateGhost(c, r) {
    const canMoveSel = selectedId && !((editMode && isMaster)) && !drawMode && (isMaster || myOwnedIds.has(selectedId));
    if (!canMoveSel || occCell[`${c}_${r}`]) { removeGhost(); return; }   // sopra un token il click seleziona, niente preview
    const ac = c - selOff;
    const ar = r - selOff;
    const ok = canPlace(ac, ar, selSide, selectedId);
    const { x: gx, y: gy } = cellXY(ac, ar);
    const gw    = selSide * CELL;
    const color = ok ? selRing : '#8a8a8a';
    if (!ghost) {
      ghost = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      ghost.setAttribute('pointer-events', 'none');
      svg.appendChild(ghost);
    }
    ghost.innerHTML =
      `<rect x="${gx + 1.5}" y="${gy + 1.5}" width="${gw - 3}" height="${gw - 3}" fill="${color}" fill-opacity=".1"
             stroke="${color}" stroke-opacity=".6" stroke-width="1.5" stroke-dasharray="5 4"/>` +
      `<circle cx="${gx + gw / 2}" cy="${gy + gw / 2}" r="${gw / 2 - 4.75}" fill="none"
               stroke="${color}" stroke-opacity=".55" stroke-width="3.5"/>`;
  }

  // Anteprima del template in corso di piazzamento: segue il mouse una volta fissata l'origine
  let templateGhost = null;
  const removeTemplateGhost = () => { templateGhost?.remove(); templateGhost = null; };
  function updateTemplateGhost(c, r) {
    if (!placingShape || !templateOrigin) { removeTemplateGhost(); return; }
    const { distM, angleDeg } = templateGeometryTo(templateOrigin.col, templateOrigin.row, c, r);
    const size = distM < 0.5 ? TEMPLATE_MIN_M[placingShape] : distM;
    if (!templateGhost) {
      templateGhost = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      templateGhost.setAttribute('pointer-events', 'none');
      svg.appendChild(templateGhost);
    }
    templateGhost.innerHTML = templateShapeMarkup(placingShape, templateOrigin.col, templateOrigin.row, size, angleDeg, TEMPLATE_COLOR, 0.18, 0.9, true);
  }

  // Tooltip nome al passaggio del mouse
  let nameTooltip = null;
  svg.addEventListener('mousemove', (e) => {
    if (onCursorMove) {
      const now = Date.now();
      if (now - _lastCursorSend >= CURSOR_THROTTLE_MS) {
        _lastCursorSend = now;
        const { col, row } = _screenToGrid(e.clientX, e.clientY, svg, container);
        onCursorMove(Math.max(0, Math.min(cols, col)), Math.max(0, Math.min(rows, row)));
      }
    }
    const hit = e.target.closest('.sq-hit');
    if (!hit) { nameTooltip?.remove(); nameTooltip = null; removeGhost(); removeTemplateGhost(); return; }
    const c = parseInt(hit.dataset.c), r = parseInt(hit.dataset.r);
    if (placingShape) { removeGhost(); updateTemplateGhost(c, r); }
    else { removeTemplateGhost(); updateGhost(c, r); }
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
    removeGhost();
    removeTemplateGhost();
    onCursorMove?.(null, null);
  });

  svg.addEventListener('click', (e) => {
    if (_panStart?.moved) return;
    const el = e.target.closest('[data-c]');
    if (!el) return;
    const col = parseInt(el.dataset.c);
    const row = parseInt(el.dataset.r);
    const occupantId = occCell[`${col}_${row}`];

    // Piazzamento template: primo tocco fissa l'origine, il secondo conferma
    if (placingShape) {
      if (!templateOrigin) {
        onSetTemplateOrigin(col, row);
      } else {
        const { distM, angleDeg } = templateGeometryTo(templateOrigin.col, templateOrigin.row, col, row);
        const size = distM < 0.5 ? TEMPLATE_MIN_M[placingShape] : distM;
        onCommitTemplate(placingShape, templateOrigin.col, templateOrigin.row, size, angleDeg);
      }
      return;
    }

    // Modalità modifica (master) o disegno: si dipinge con mousedown/drag (vedi _bindCellPaint)
    if ((editMode && isMaster) || drawMode) return;

    if (occupantId) {
      // Click su token → seleziona/deseleziona
      onSelect(occupantId === selectedId ? null : occupantId);
      return;
    }

    if (selectedId) {
      // Sposta il token selezionato (la cella cliccata è circa il centro del footprint, come la preview)
      if (isMaster || myOwnedIds.has(selectedId)) {
        const ac = col - selOff;
        const ar = row - selOff;
        if (canPlace(ac, ar, selSide, selectedId)) onMove(selectedId, ac, ar);
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
        const off  = Math.floor((side - 1) / 2);
        if (canPlace(col - off, row - off, side, placeId)) onMove(placeId, col - off, row - off);
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

  // Pan con drag — pointer events, così funziona anche col touch (solo zoom > 1, non in modifica)
  const container = document.getElementById('grid-container');
  if (!container) return;

  container.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (_zoom <= 1) return;
    if ((_ctx?.editMode && _ctx?.isMaster) || _ctx?.drawMode) return;
    if (_panStart) return;   // un solo puntatore alla volta
    _panStart = { id: e.pointerId, x: e.clientX, y: e.clientY, px: _panX, py: _panY, moved: false };
  });

  container.addEventListener('pointermove', (e) => {
    if (!_panStart || e.pointerId !== _panStart.id) return;
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
  container.addEventListener('pointerup',     _stopPan);
  container.addEventListener('pointercancel', _stopPan);
  window.addEventListener('pointerup',        _stopPan);
}
