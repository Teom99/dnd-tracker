const DAMSELFLY_CONFIG = {
  top: {
    label: 'Top Deck',
    cols: 12,
    rows: 4,
    rooms: [
      { id: 'open_deck', label: 'Ponte', x: 0, y: 0, w: 12, h: 4, tone: 'pc' },
    ],
  },
  main: {
    label: 'Main Deck',
    cols: 12,
    rows: 7,
    rooms: [
      { id: 'cargo',   label: 'Stiva',          x: 0, y: 0, w: 5, h: 4, tone: 'mute' },
      { id: 'kitchen', label: 'Cucina',          x: 5, y: 0, w: 3, h: 3, tone: 'gold' },
      { id: 'crew',    label: 'Alloggi',         x: 8, y: 0, w: 4, h: 3, tone: 'ally' },
      { id: 'common',  label: 'Zona Comune',     x: 5, y: 3, w: 4, h: 4, tone: 'heading' },
      { id: 'captain', label: 'Cabina Capitano', x: 9, y: 3, w: 3, h: 4, tone: 'foe' },
    ],
  },
  forward: {
    label: 'Forward Deck',
    cols: 6,
    rows: 4,
    invertedGravity: true,
    rooms: [
      { id: 'forward_hold', label: 'Prua', x: 0, y: 0, w: 6, h: 4, tone: 'ally' },
    ],
  },
};

const WEAPONS = {
  ballista: { label: 'Ballista', stats: '3d10 perforanti · gittata 36/144 m · equipaggio min 1' },
  mangonel: { label: 'Mangonel', stats: '5d10 contundenti · gittata 60/240 m · equipaggio min 2' },
};

const WEAPON_STATES = {
  ready:     'Pronta',
  loading:   'In carica',
  fired:     'Sparata',
  destroyed: 'Distrutta',
};

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function findRoom(deckKey, col, row) {
  const cfg = DAMSELFLY_CONFIG[deckKey];
  if (!cfg) return null;
  return cfg.rooms.find(r => col >= r.x && col < r.x + r.w && row >= r.y && row < r.y + r.h) ?? null;
}

export function renderShipPanel(shipData, combatants, myUid, isMaster, selectedTokenId) {
  const hp     = shipData?.hp    ?? 200;
  const hpMax  = shipData?.hpMax ?? 200;
  const pct    = hpMax > 0 ? Math.max(0, Math.min(1, hp / hpMax)) : 0;
  const weapons   = shipData?.weapons ?? {};
  const tokens    = shipData?.tokens  ?? {};
  const roomsData = shipData?.rooms   ?? {};

  const canMove = (c) => isMaster || c.ownerUid === myUid;
  const tokHtml = (c) => {
    const cls = ['crew-tok'];
    if (c.id === selectedTokenId) cls.push('sel');
    if (c.faction !== 'good')     cls.push('is-enemy');
    if (!canMove(c))              cls.push('is-locked');
    return `<span class="${cls.join(' ')}" data-action="select-token" data-combatant="${esc(c.id)}" title="${esc(c.name)}">${esc((c.name || '?').trim().slice(0, 2))}</span>`;
  };

  // assegna ogni token alla stanza che contiene la sua cella; fuori stanza → "non a bordo"
  const roomCrew = {};
  const reserve  = [];
  combatants.forEach(c => {
    const t    = tokens[c.id];
    const room = t ? findRoom(t.deck, t.col, t.row) : null;
    if (room) {
      const key = `${t.deck}:${room.id}`;
      (roomCrew[key] = roomCrew[key] ?? []).push(tokHtml(c));
    } else {
      reserve.push(tokHtml(c));
    }
  });

  const decksHtml = Object.entries(DAMSELFLY_CONFIG).map(([deckKey, cfg]) => {
    const overrides = roomsData[deckKey] ?? {};
    const roomsHtml = cfg.rooms.map(room => {
      const label = overrides[room.id]?.name || room.label;
      const crew  = (roomCrew[`${deckKey}:${room.id}`] ?? []).join('');
      return `<div class="room${selectedTokenId ? ' droppable' : ''}"
                   data-action="place-token" data-deck="${deckKey}"
                   data-col="${room.x + Math.floor(room.w / 2)}" data-row="${room.y + Math.floor(room.h / 2)}"
                   style="--rc:var(--c-${room.tone}); grid-column:${room.x + 1} / span ${room.w}; grid-row:${room.y + 1} / span ${room.h};">
        <span class="rl">${esc(label)}</span>
        <div class="crew">${crew}</div>
      </div>`;
    }).join('');
    const widthPct = Math.round((cfg.cols / 12) * 100);
    return `<div class="deck">
      <h4 class="rule-head">${esc(cfg.label)}${cfg.invertedGravity ? ' · gravità invertita' : ''}</h4>
      <div class="deck-map" style="grid-template-columns:repeat(${cfg.cols},1fr); grid-auto-rows:24px; max-width:${widthPct}%;">${roomsHtml}</div>
    </div>`;
  }).join('');

  const selectedName = selectedTokenId
    ? (combatants.find(c => c.id === selectedTokenId)?.name ?? '')
    : null;
  const hint = selectedName
    ? `<b>${esc(selectedName)}</b> selezionato — tocca la stanza di destinazione.`
    : `Tocca un membro dell'equipaggio, poi la stanza di destinazione.`;

  const reserveHtml = `<div class="deck">
    <h4 class="rule-head">Non a bordo</h4>
    <div class="ship-reserve">${reserve.join('') || '<span class="ship-note">Nessuno — tutta la compagnia è a bordo.</span>'}</div>
  </div>`;

  const weaponCardsHtml = Object.entries(WEAPONS).map(([wId, w]) => {
    const wData   = weapons[wId] ?? {};
    const wState  = wData.state   ?? 'ready';
    const crewIds = wData.crewIds ?? {};

    const stateOptions = Object.entries(WEAPON_STATES).map(([val, lbl]) =>
      `<option value="${val}"${wState === val ? ' selected' : ''}>${esc(lbl)}</option>`
    ).join('');

    const crewChips = combatants.map(c => {
      const inCrew    = !!crewIds[c.id];
      const canToggle = isMaster || c.ownerUid === myUid;
      return `<button class="chip ${inCrew ? 'chip--accent' : 'chip--iron'} w-chip" aria-pressed="${inCrew}"
                      data-action="toggle-crew" data-weapon="${esc(wId)}" data-combatant="${esc(c.id)}"${canToggle ? '' : ' disabled'}>
                <i></i>${esc(c.name)}
              </button>`;
    }).join('');

    return `<div class="weapon-card" data-state="${esc(wState)}">
      <div class="wh">
        <b>${esc(w.label)}</b>
        <select class="select w-state" data-action="weapon-state" data-weapon="${esc(wId)}">${stateOptions}</select>
      </div>
      <span class="stats">${esc(w.stats)}</span>
      <div class="w-crew">${crewChips || '<span class="ship-note">Nessun personaggio in sessione.</span>'}</div>
    </div>`;
  }).join('');

  const hpControls = isMaster
    ? `<div class="ship-hp-ctrl">
         <button class="btn btn--ghost btn--sm" data-action="ship-hp" data-delta="-10">−10</button>
         <button class="btn btn--ghost btn--sm" data-action="ship-hp" data-delta="10">+10</button>
       </div>`
    : '';

  return `<div class="ship-main">

    <section class="ship-panel-section ship-head">
      <div>
        <h2 class="t-display t-title">Damselfly</h2>
        <span class="sub">Veliero volante · classe libellula</span>
      </div>
      <div class="ship-hp">
        <h4 class="rule-head">Integrità dello scafo</h4>
        <div class="row">
          <div class="hpbar hpbar--big grow" data-level="${pct > 0.5 ? 'ok' : pct > 0.25 ? 'mid' : 'low'}">
            <i class="trail" style="transform:scaleX(${pct});"></i>
            <i class="fill" style="transform:scaleX(${pct});"></i>
          </div>
          <span class="hp-text">${hp}<span class="t-mut">/${hpMax}</span></span>
        </div>
        ${hpControls}
      </div>
    </section>

    <div class="ship-grid">

      <section class="ship-panel-section">
          <h3 class="rule-head">Ponti</h3>
        <p class="ship-note">${hint}</p>
        ${decksHtml}
        ${reserveHtml}
      </section>

      <section class="ship-panel-section">
          <h3 class="rule-head">Armi</h3>
        <div class="ship-weapons">${weaponCardsHtml}</div>
        <p class="ship-note" style="margin:14px 0 0;">Lo stato delle armi e l'equipaggio assegnato sono sincronizzati in tempo reale per tutta la compagnia. Solo il master e il proprietario del personaggio possono spostarlo.</p>
      </section>

    </div>
  </div>`;
}
