// Griglia esagonale punta-in-alto, offset dispari per riga (odd-r)
// 1 esagono = 1,5 m (standard D&D 5e)

export const GRID_COLS = 20;
export const GRID_ROWS = 12;
const HEX_R  = 20;          // raggio (centro → vertice), px
const SQRT3  = Math.sqrt(3);
const PAD    = HEX_R + 2;   // margine svg

// ─── Coordinate helpers ──────────────────────────────────────────────────────

function hexCenter(col, row) {
  return {
    x: HEX_R * SQRT3 * (col + 0.5 * (row & 1)) + PAD,
    y: HEX_R * 1.5 * row + PAD,
  };
}

function hexPoints(cx, cy) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 3 * i - Math.PI / 6;
    return `${(cx + HEX_R * Math.cos(a)).toFixed(1)},${(cy + HEX_R * Math.sin(a)).toFixed(1)}`;
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
  const m = d * 1.5;
  return m === Math.floor(m) ? `${m}m` : `${m.toFixed(1)}m`;
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── Render ──────────────────────────────────────────────────────────────────

/**
 * Ridisegna la griglia all'interno di `container`.
 *
 * @param {HTMLElement} container
 * @param {Object}  gridPos     { [combatantId]: {col, row} }
 * @param {Object}  combatants  { [combatantId]: {name, type, ownerUid, ...} }
 * @param {string|null} myCombatantId  ID combattente del giocatore attivo
 * @param {boolean} isMaster
 * @param {string|null} selectedId  combatantId selezionato
 * @param {string|null} currentTurnId
 * @param {function(string|null)} onSelect  callback(combatantId|null)
 * @param {function(string,number,number)} onMove  callback(id,col,row)
 */
export function renderGrid(container, gridPos, combatants, myCombatantId, isMaster, selectedId, currentTurnId, onSelect, onMove) {
  const pos  = gridPos   || {};
  const comb = combatants || {};

  // "col_row" → combatantId
  const cellMap = {};
  Object.entries(pos).forEach(([id, p]) => {
    if (p != null && p.col != null) cellMap[`${p.col}_${p.row}`] = id;
  });

  const selPos = selectedId ? pos[selectedId] : null;

  const svgW = (HEX_R * SQRT3 * (GRID_COLS + 0.5) + PAD * 2).toFixed(0);
  const svgH = (HEX_R * 1.5 * (GRID_ROWS - 1) + HEX_R * 2 + PAD * 2).toFixed(0);

  let inner = '';

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const { x, y }   = hexCenter(c, r);
      const key        = `${c}_${r}`;
      const occupantId = cellMap[key];
      const occupant   = occupantId ? comb[occupantId] : null;
      const isSelected = occupantId === selectedId;
      const isActive   = occupantId === currentTurnId;

      // ─ Esagono di sfondo
      let cls = 'hx';
      if (isSelected)      cls += ' hx-sel';
      else if (occupantId) cls += ' hx-occ';
      inner += `<polygon class="${cls}" points="${hexPoints(x, y)}" data-c="${c}" data-r="${r}"/>`;

      // ─ Token
      if (occupant) {
        const isPlayer = occupant.type === 'player';
        const fill     = isPlayer ? '#142d4a' : '#2d1010';
        const stroke   = isSelected ? '#c9a84c'
                       : isActive   ? '#e5c97a'
                       : isPlayer   ? '#4a8abf' : '#bf4a4a';
        const sw       = (isSelected || isActive) ? 2.5 : 1.5;
        const initials = esc((occupant.name || '?').slice(0, 2).toUpperCase());

        inner += `<circle cx="${x}" cy="${y}" r="${HEX_R - 4}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" data-c="${c}" data-r="${r}"/>`;
        inner += `<text x="${x}" y="${y + 5}" text-anchor="middle" class="hx-name" data-c="${c}" data-r="${r}">${initials}</text>`;

        // Distanza dagli altri token quando uno è selezionato
        if (selPos && !isSelected) {
          const d = hexDistance(selPos.col, selPos.row, c, r);
          inner += `<text x="${x}" y="${y - HEX_R + 7}" text-anchor="middle" class="hx-dist" data-c="${c}" data-r="${r}">${esc(fmtM(d))}</text>`;
        }
      }

      // ─ Target trasparente (sempre sopra, intercetta click)
      inner += `<polygon class="hx-hit" points="${hexPoints(x, y)}" data-c="${c}" data-r="${r}"/>`;
    }
  }

  container.innerHTML =
    `<svg class="hex-svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">${inner}</svg>`;

  // Event delegation
  container.querySelector('svg').addEventListener('click', (e) => {
    const el = e.target.closest('[data-c]');
    if (!el) return;
    const col = parseInt(el.dataset.c);
    const row = parseInt(el.dataset.r);
    const occupantId = cellMap[`${col}_${row}`];

    if (occupantId) {
      const canCtrl = isMaster || occupantId === myCombatantId;
      if (canCtrl) onSelect(occupantId === selectedId ? null : occupantId);
    } else if (selectedId) {
      onMove(selectedId, col, row);
      onSelect(null);
    } else if (!isMaster && myCombatantId && pos[myCombatantId] == null) {
      // Giocatore non ancora posizionato: piazza il suo token
      onMove(myCombatantId, col, row);
    }
  });
}
