// Griglia esagonale punta-in-alto, offset dispari per riga (odd-r)
// 1 esagono = 1 m

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
  const m = d * 1;
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
      if (isSelected)      cls += occupantId === myCombatantId ? ' hx-sel-my' : ' hx-sel';
      else if (occupantId) cls += ' hx-occ';
      inner += `<polygon class="${cls}" points="${hexPoints(x, y)}" data-c="${c}" data-r="${r}"/>`;

      // ─ Token
      if (occupant) {
        const isPlayer = occupant.type === 'player';
        const isMyToken = occupantId === myCombatantId;
        const isDead = occupant.hpCurrent <= 0;
        
        let fill, stroke;
        if (isMyToken) {
          fill = '#0d2d0d';
          stroke = isSelected ? '#70d070' : '#4aba4a';
        } else {
          fill     = isPlayer ? '#142d4a' : '#2d1010';
          stroke   = isSelected ? '#c9a84c'
                   : isActive   ? '#e5c97a'
                   : isPlayer   ? '#4a8abf' : '#bf4a4a';
        }
        
        // Override per personaggi morti
        if (isDead) {
          fill = '#666666';
          stroke = '#999999';
        }
        
        const sw       = (isSelected || isActive) ? 2.5 : 1.5;
        const initials = esc((occupant.name || '?').slice(0, 2).toUpperCase());

        inner += `<circle cx="${x}" cy="${y}" r="${HEX_R - 4}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" data-c="${c}" data-r="${r}"/>`;
        inner += `<text x="${x}" y="${y + 5}" text-anchor="middle" class="hx-name" data-c="${c}" data-r="${r}">${initials}</text>`;
        
        // Teschio nella cella sopra per personaggi morti
        if (isDead) {
          const aboveRow = r - 1;
          const aboveKey = `${c}_${aboveRow}`;
          // Solo se la cella sopra non è occupata
          if (aboveRow >= 0 && !cellMap[aboveKey]) {
            const { x: aboveX, y: aboveY } = hexCenter(c, aboveRow);
            inner += `<text x="${aboveX}" y="${aboveY + 5}" text-anchor="middle" class="hx-name" data-c="${c}" data-r="${aboveRow}">💀</text>`;
          }
        }

        // Distanza dagli altri token quando uno è selezionato
        if (selPos && !isSelected) {
          const d = hexDistance(selPos.col, selPos.row, c, r);
          inner += `<text x="${x}" y="${y - HEX_R + 2}" text-anchor="middle" class="hx-dist" data-c="${c}" data-r="${r}">${esc(fmtM(d))}</text>`;
        }
      }

      // ─ Target trasparente (sempre sopra, intercetta click)
      inner += `<polygon class="hx-hit" points="${hexPoints(x, y)}" data-c="${c}" data-r="${r}"/>`;
    }
  }

  container.innerHTML =
    `<svg class="hex-svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">${inner}</svg>`;

  // Hover: evidenzia solo l'esagono sotto il cursore
  const svg = container.querySelector('svg');
  
  // Tooltip per la distanza quando il mouse si muove
  let distanceTooltip = null;
  
  svg.addEventListener('mousemove', (e) => {
    if (!selectedId) return;
    
    const hit = e.target.closest('.hx-hit');
    if (!hit) {
      if (distanceTooltip) distanceTooltip.remove();
      distanceTooltip = null;
      return;
    }
    
    const c = parseInt(hit.dataset.c);
    const r = parseInt(hit.dataset.r);
    
    // Non mostrare distanza se siamo sul token selezionato stesso
    if (selPos && c === selPos.col && r === selPos.row) {
      if (distanceTooltip) distanceTooltip.remove();
      distanceTooltip = null;
      return;
    }
    
    const { x, y } = hexCenter(c, r);
    const d = selPos ? hexDistance(selPos.col, selPos.row, c, r) : 0;
    const distText = fmtM(d);
    
    // Crea o aggiorna il tooltip
    if (!distanceTooltip) {
      distanceTooltip = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      distanceTooltip.setAttribute('class', 'hx-tooltip-dist');
      svg.appendChild(distanceTooltip);
    }
    
    distanceTooltip.setAttribute('x', x);
    distanceTooltip.setAttribute('y', y);
    distanceTooltip.textContent = distText;
  });
  
  svg.addEventListener('mouseover', (e) => {
    const hit = e.target.closest('.hx-hit');
    if (!hit) return;
    svg.querySelectorAll('.hx.hx-hover').forEach(h => h.classList.remove('hx-hover'));
    const hex = svg.querySelector(`.hx[data-c="${hit.dataset.c}"][data-r="${hit.dataset.r}"]`);
    if (hex) hex.classList.add('hx-hover');
  });
  svg.addEventListener('mouseleave', () => {
    svg.querySelectorAll('.hx.hx-hover').forEach(h => h.classList.remove('hx-hover'));
    if (distanceTooltip) distanceTooltip.remove();
    distanceTooltip = null;
  });

  // Event delegation click
  container.querySelector('svg').addEventListener('click', (e) => {
    const el = e.target.closest('[data-c]');
    if (!el) return;
    const col = parseInt(el.dataset.c);
    const row = parseInt(el.dataset.r);
    const occupantId = cellMap[`${col}_${row}`];

    if (occupantId) {
      // Chiunque può selezionare un token per vedere le distanze
      onSelect(occupantId === selectedId ? null : occupantId);
    } else if (selectedId) {
      // Solo il master o il proprietario del token possono muoverlo
      const canMove = isMaster || selectedId === myCombatantId;
      if (canMove) {
        onMove(selectedId, col, row);
      }
      onSelect(null);
    } else if (!isMaster && myCombatantId && pos[myCombatantId] == null) {
      // Giocatore non ancora posizionato: piazza il suo token
      onMove(myCombatantId, col, row);
    }
  });
}

export function renderInitiativeList(container, sortedCombatants, gridPos, myCombatantId, selectedId, currentTurnId, isMaster, onSelect) {
  if (!container) return;

  const pos = gridPos || {};
  
  // Decide which character is the reference for distances.
  // If a character is selected on the grid, use that.
  // Otherwise, use myCombatantId.
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
    if (isActive) cls += ' active-turn';
    if (isSelected) cls += ' selected';
    if (c.hpCurrent === 0) cls += ' ko';

    html += `
      <li class="${cls}" style="cursor: pointer;" data-id="${c.id}">
        <span class="grid-initiative-name">${esc(c.name)}</span>
        ${distText}
      </li>
    `;
  }
  
  container.innerHTML = html;

  container.onclick = (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    const id = li.dataset.id;
    // Anyone can click to select a character and see distances
    onSelect(id === selectedId ? null : id);
  };
}
