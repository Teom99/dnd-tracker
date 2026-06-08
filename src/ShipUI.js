const DAMSELFLY_CONFIG = {
  top: {
    label: 'Top Deck',
    cols: 12,
    rows: 4,
    rooms: [
      { id: 'open_deck', label: 'Ponte', x: 0, y: 0, w: 12, h: 4, color: '#4a6741' },
    ],
  },
  main: {
    label: 'Main Deck',
    cols: 12,
    rows: 7,
    rooms: [
      { id: 'cargo',   label: 'Stiva',          x: 0, y: 0, w: 5, h: 4, color: '#5a4a3a' },
      { id: 'kitchen', label: 'Cucina',          x: 5, y: 0, w: 3, h: 3, color: '#6b4c2a' },
      { id: 'crew',    label: 'Alloggi',         x: 8, y: 0, w: 4, h: 3, color: '#3a4a5a' },
      { id: 'common',  label: 'Zona Comune',     x: 5, y: 3, w: 4, h: 4, color: '#4a3a5a' },
      { id: 'captain', label: 'Cabina Capitano', x: 9, y: 3, w: 3, h: 4, color: '#6b3a2a' },
    ],
  },
  forward: {
    label: 'Forward Deck',
    cols: 6,
    rows: 4,
    invertedGravity: true,
    rooms: [
      { id: 'forward_hold', label: 'Prua', x: 0, y: 0, w: 6, h: 4, color: '#3a4a4a' },
    ],
  },
};

const CELL = 44;

const WEAPON_LABELS = { ballista: 'Ballista', mangonel: 'Mangonel' };
const WEAPON_STATES = {
  ready:     'Pronta',
  loading:   'In carica',
  fired:     'Sparata',
  destroyed: 'Distrutta',
};

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderShipPanel(shipData, combatants, myUid, isMaster, localDeck, selectedTokenId) {
  const hp    = shipData?.hp    ?? 200;
  const hpMax = shipData?.hpMax ?? 200;
  const pct   = hpMax > 0 ? Math.round((hp / hpMax) * 100) : 0;
  const weapons      = shipData?.weapons ?? {};
  const tokens       = shipData?.tokens  ?? {};
  const roomsData    = shipData?.rooms   ?? {};

  const weaponCardsHtml = Object.entries(WEAPON_LABELS).map(([wId, wLabel]) => {
    const w       = weapons[wId] ?? {};
    const wState  = w.state    ?? 'ready';
    const crewIds = w.crewIds  ?? {};

    const stateOptions = Object.entries(WEAPON_STATES).map(([val, lbl]) =>
      `<option value="${val}"${wState === val ? ' selected' : ''}>${esc(lbl)}</option>`
    ).join('');

    const crewChips = combatants.map(c => {
      const inCrew    = !!crewIds[c.id];
      const canToggle = isMaster || c.ownerUid === myUid;
      const toggleAttrs = canToggle
        ? `data-action="toggle-crew" data-weapon="${esc(wId)}" data-combatant="${esc(c.id)}"`
        : '';
      return `<span class="ship-crew-chip${inCrew ? ' in-crew' : ''}${canToggle ? ' toggleable' : ''}" ${toggleAttrs}>${esc(c.name)}</span>`;
    }).join('');

    return `<div class="ship-weapon-card">
      <div class="ship-weapon-header">
        <span class="ship-weapon-name">${esc(wLabel)}</span>
        <select class="ship-weapon-state" data-action="weapon-state" data-weapon="${esc(wId)}">${stateOptions}</select>
      </div>
      <div class="ship-crew-list">${crewChips || '<span class="ship-crew-empty">Nessun membro</span>'}</div>
    </div>`;
  }).join('');

  const deckTabs = Object.entries(DAMSELFLY_CONFIG).map(([key, cfg]) =>
    `<button class="ship-deck-tab${localDeck === key ? ' active' : ''}" data-action="switch-deck" data-deck="${key}">${esc(cfg.label)}</button>`
  ).join('');

  const deckCfg       = DAMSELFLY_CONFIG[localDeck] ?? DAMSELFLY_CONFIG['main'];
  const roomOverrides = roomsData[localDeck] ?? {};
  const svgHtml       = renderShipSvg(localDeck, deckCfg, roomOverrides, tokens, combatants, selectedTokenId, myUid, isMaster);

  const hpControls = isMaster
    ? `<div class="ship-hp-controls">
         <button class="btn-secondary btn-sm" data-action="ship-hp" data-delta="-10">−10</button>
         <button class="btn-secondary btn-sm" data-action="ship-hp" data-delta="10">+10</button>
       </div>`
    : '';

  const DECK_LABELS = { top: 'Top', main: 'Main', forward: 'Prua' };
  const trayChips = combatants.map(c => {
    const canSelect  = isMaster || c.ownerUid === myUid;
    if (!canSelect) return '';
    const isSelected = c.id === selectedTokenId;
    const tokenPos   = tokens[c.id];
    const deckBadge  = tokenPos
      ? `<span class="ship-tray-badge${tokenPos.deck === localDeck ? ' same-deck' : ''}">${DECK_LABELS[tokenPos.deck] ?? tokenPos.deck}</span>`
      : '';
    const dotColor = c.faction === 'good' ? 'var(--faction-good, #4caf50)' : 'var(--faction-evil, #e53935)';
    return `<span class="ship-tray-chip${isSelected ? ' selected' : ''}"
                  data-action="select-token" data-combatant="${esc(c.id)}">
              <span class="ship-tray-dot" style="background:${dotColor}"></span>
              ${esc(c.name)}${deckBadge}
            </span>`;
  }).join('');

  const selectedName = selectedTokenId
    ? (combatants.find(c => c.id === selectedTokenId)?.name ?? '')
    : null;
  const trayHint = selectedName
    ? `<div class="ship-tray-hint">🎯 <strong>${esc(selectedName)}</strong> selezionato — clicca una cella per posizionarlo</div>`
    : `<div class="ship-tray-hint muted">Clicca un personaggio, poi clicca una cella sulla mappa per posizionarlo</div>`;

  return `<div class="ship-panel-inner">
    <div class="ship-header">
      <span class="ship-name">🚢 Damselfly</span>
      <div class="ship-hp-section">
        <div class="ship-hp-bar-track"><div class="ship-hp-bar-fill" style="width:${pct}%"></div></div>
        <span class="ship-hp-label">${hp} / ${hpMax} PF</span>
        ${hpControls}
      </div>
    </div>
    <div class="ship-weapons">${weaponCardsHtml}</div>
    <div class="ship-deck-tabs">${deckTabs}</div>
    <div class="ship-token-tray">
      <div class="ship-tray-chips">${trayChips || '<span class="ship-crew-empty">Nessun personaggio</span>'}</div>
      ${trayHint}
    </div>
    <div class="ship-svg-container">${svgHtml}</div>
  </div>`;
}

export function renderShipSvg(deckKey, deckCfg, roomOverrides, tokens, combatants, selectedTokenId, myUid, isMaster) {
  const { cols, rows, rooms } = deckCfg;
  const W = cols * CELL;
  const H = rows * CELL;

  const roomRects = rooms.map(room => {
    const override = roomOverrides[room.id] ?? {};
    const label    = override.name || room.label;
    return `<rect x="${room.x * CELL}" y="${room.y * CELL}" width="${room.w * CELL}" height="${room.h * CELL}"
                  fill="${room.color}" fill-opacity="0.65" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
            <text x="${(room.x + room.w / 2) * CELL}" y="${(room.y + room.h / 2) * CELL}"
                  text-anchor="middle" dominant-baseline="middle"
                  font-size="11" fill="rgba(255,255,255,0.75)" font-family="Cinzel,serif"
                  pointer-events="none">${esc(label)}</text>`;
  }).join('');

  let gridLines = '';
  for (let c = 0; c <= cols; c++) {
    gridLines += `<line x1="${c * CELL}" y1="0" x2="${c * CELL}" y2="${H}" stroke="rgba(255,255,255,0.07)" stroke-width="0.5"/>`;
  }
  for (let r = 0; r <= rows; r++) {
    gridLines += `<line x1="0" y1="${r * CELL}" x2="${W}" y2="${r * CELL}" stroke="rgba(255,255,255,0.07)" stroke-width="0.5"/>`;
  }

  const cellTargets = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cellTargets.push(
        `<rect x="${c * CELL}" y="${r * CELL}" width="${CELL}" height="${CELL}"
               fill="transparent" data-action="place-token" data-col="${c}" data-row="${r}"/>`
      );
    }
  }

  const deckTokens = Object.entries(tokens)
    .filter(([, t]) => t.deck === deckKey)
    .map(([cId, t]) => {
      const c = combatants.find(cb => cb.id === cId);
      if (!c) return '';
      const cx         = (t.col + 0.5) * CELL;
      const cy         = (t.row + 0.5) * CELL;
      const r          = CELL * 0.38;
      const initial    = (c.name || '?')[0].toUpperCase();
      const isSelected = cId === selectedTokenId;
      const isOwn      = c.ownerUid === myUid;
      const canSelect  = isMaster || isOwn;
      const fillColor  = c.faction === 'good'
        ? 'var(--faction-good, #4caf50)'
        : 'var(--faction-evil, #e53935)';
      const strokeColor = isSelected ? '#ffd93d' : (isOwn ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)');
      const strokeW     = isSelected ? 3 : (isOwn ? 2 : 1);
      return `<g data-action="select-token" data-combatant="${cId}"
                 style="cursor:${canSelect ? 'pointer' : 'default'}">
                <circle cx="${cx}" cy="${cy}" r="${r}"
                        fill="${fillColor}" fill-opacity="0.85"
                        stroke="${strokeColor}" stroke-width="${strokeW}"/>
                <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle"
                      font-size="13" font-weight="bold" fill="white" font-family="sans-serif"
                      pointer-events="none">${esc(initial)}</text>
              </g>`;
    }).join('');

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block">
    <rect width="${W}" height="${H}" fill="#1a1a2e"/>
    ${roomRects}
    ${gridLines}
    ${cellTargets.join('')}
    ${deckTokens}
  </svg>`;
}
