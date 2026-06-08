# Ship Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere al combat tracker un pannello interattivo per la nave Damselfly: mappa SVG per deck con posizionamento token, HP nave, stato armi, tutto sincronizzato su Firebase.

**Architecture:** Nuovo tab/pannello nel combat view (sostituisce la lista combattenti quando aperto). `src/Ship.js` gestisce il CRUD Firebase seguendo il pattern di `Combatant.js`. `src/ShipUI.js` genera HTML+SVG seguendo il pattern di `GridUI.js`. Lo stato locale del deck (quale deck è visibile) è mantenuto in `state` sul client, non su Firebase.

**Tech Stack:** Firebase Realtime Database (set/runTransaction/remove), ES6 modules, SVG inline generato da JS, event delegation su `#ship-panel`.

---

## File Changes

| File | Azione |
|---|---|
| `src/state.js` | Modificare — aggiungere campi `ship`, `shipData`, `localDeck`, `shipPanelOpen`, `_selectedShipToken` |
| `src/Ship.js` | Creare — Firebase CRUD per nodo `sessions/{code}/ship` |
| `src/ShipUI.js` | Creare — funzioni `renderShipPanel` e `renderShipSvg` |
| `src/Session.js` | Modificare — `create()` inizializza il nodo `ship` |
| `src/sheet.js` | Modificare — `onRemove` callback rimuove anche il token dalla nave |
| `index.html` | Modificare — aggiungere `#btn-toggle-ship` e `#ship-panel` nel combat view |
| `app.js` | Modificare — import, init Ship, listener, handlers, `_renderShipPanel()`, `_bindShipEvents()` |
| `style.css` | Modificare — stili pannello nave |

---

## Task 1: Aggiungere campi ship a `src/state.js`

**Files:**
- Modify: `src/state.js`

- [ ] **Step 1: Aggiungere i nuovi campi al singleton state**

Aprire `src/state.js` e aggiungere alla fine dell'oggetto (prima della chiusura `}`):

```js
export const state = {
  db:                     null,
  auth:                   null,
  session:                null,
  combatantManager:       null,
  tracker:                null,
  myUid:                  null,
  myCombatantId:          null,
  myCurrentCharId:        null,
  snapshot:               null,
  sheet:                  null,
  sheetData:              null,
  acMap:                  {},
  lastKnownHp:            null,
  library:                null,
  selectedJoinCharId:     null,
  selectedCreatureCharId: null,
  sheetReturnView:        'view-combat',
  selectedGridTokenId:    null,
  ship:                   null,
  shipData:               null,
  localDeck:              'main',
  shipPanelOpen:          false,
  _selectedShipToken:     null,
};
```

- [ ] **Step 2: Commit**

```bash
git add src/state.js
git commit -m "feat: add ship fields to state"
```

---

## Task 2: Creare `src/Ship.js`

**Files:**
- Create: `src/Ship.js`

- [ ] **Step 1: Creare il file con la classe Ship**

```js
import {
  ref, set, get, remove, runTransaction
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

export class Ship {
  constructor(db, sessionCode) {
    this._db   = db;
    this._code = sessionCode;
  }

  _ref(path = '') {
    const base = `sessions/${this._code}/ship`;
    return ref(this._db, path ? `${base}/${path}` : base);
  }

  async init() {
    const snap = await get(this._ref());
    if (snap.exists()) return;
    await set(this._ref(), {
      hp:      200,
      hpMax:   200,
      weapons: {
        ballista: { state: 'ready' },
        mangonel: { state: 'ready' },
      },
    });
  }

  async updateHp(delta) {
    await runTransaction(this._ref(), (current) => {
      if (current == null) return current;
      const hpMax = current.hpMax ?? 200;
      current.hp = Math.max(0, Math.min(hpMax, (current.hp ?? hpMax) + delta));
      return current;
    });
  }

  async setHpMax(val) {
    const hp = Math.max(1, parseInt(val) || 1);
    await set(this._ref('hpMax'), hp);
    await runTransaction(this._ref('hp'), (current) => Math.min(current ?? 0, hp));
  }

  async setWeaponState(weaponId, state) {
    await set(this._ref(`weapons/${weaponId}/state`), state);
  }

  async toggleCrewMember(weaponId, combatantId) {
    await runTransaction(
      this._ref(`weapons/${weaponId}/crewIds/${combatantId}`),
      (current) => (current ? null : true)
    );
  }

  async setTokenPosition(combatantId, deck, col, row) {
    await set(this._ref(`tokens/${combatantId}`), { deck, col, row });
  }

  async removeToken(combatantId) {
    await remove(this._ref(`tokens/${combatantId}`));
  }

  async setRoomOverride(deck, roomId, field, value) {
    await set(this._ref(`rooms/${deck}/${roomId}/${field}`), value || null);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/Ship.js
git commit -m "feat: add Ship Firebase CRUD class"
```

---

## Task 3: Creare `src/ShipUI.js`

**Files:**
- Create: `src/ShipUI.js`

- [ ] **Step 1: Creare il file con le funzioni di rendering**

```js
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
      return `<span class="ship-crew-chip${inCrew ? ' in-crew' : ''}${canToggle ? ' toggleable' : ''}"
                    data-action="toggle-crew" data-weapon="${esc(wId)}" data-combatant="${esc(c.id)}">${esc(c.name)}</span>`;
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

  const deckCfg       = DAMSELFLY_CONFIG[localDeck];
  const roomOverrides = roomsData[localDeck] ?? {};
  const svgHtml       = renderShipSvg(localDeck, deckCfg, roomOverrides, tokens, combatants, selectedTokenId, myUid, isMaster);

  const hpControls = isMaster
    ? `<div class="ship-hp-controls">
         <button class="btn-secondary btn-sm" data-action="ship-hp" data-delta="-10">−10</button>
         <button class="btn-secondary btn-sm" data-action="ship-hp" data-delta="10">+10</button>
       </div>`
    : '';

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
```

- [ ] **Step 2: Commit**

```bash
git add src/ShipUI.js
git commit -m "feat: add ShipUI rendering functions (SVG schematic + panel HTML)"
```

---

## Task 4: Modificare `src/Session.js` — inizializzare ship su create

**Files:**
- Modify: `src/Session.js:50-57`

- [ ] **Step 1: Aggiungere il nodo ship alla creazione sessione**

Nel metodo `create()`, sostituire il blocco `await set(ref(this._db, \`sessions/${code}\`), { ... })` con:

```js
await set(ref(this._db, `sessions/${code}`), {
  masterUid:       uid,
  round:           1,
  currentTurnId:   null,
  combatants:      {},
  logs:            {},
  progressionMode: options.progressionMode ?? 'xp',
  ship: {
    hp:      200,
    hpMax:   200,
    weapons: {
      ballista: { state: 'ready' },
      mangonel: { state: 'ready' },
    },
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/Session.js
git commit -m "feat: initialize ship node on session create"
```

---

## Task 5: Modificare `src/sheet.js` — removeToken su onRemove

**Files:**
- Modify: `src/sheet.js:205`

- [ ] **Step 1: Aggiornare `onRemove` per pulire anche il token nave**

Trovare la riga con `onRemove` nella funzione `_makeCallbacks()`:

```js
onRemove:           (id)                              => removeCombatant(id),
```

Sostituirla con:

```js
onRemove: async (id) => {
  await removeCombatant(id);
  await state.ship?.removeToken(id);
},
```

- [ ] **Step 2: Commit**

```bash
git add src/sheet.js
git commit -m "feat: remove ship token when combatant is removed"
```

---

## Task 6: Modificare `index.html` — aggiungere bottone e pannello nave

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Aggiungere `#btn-toggle-ship` nell'header combat**

Trovare nel `<header class="combat-header">` la riga con `#btn-exit-session`:

```html
        <button id="btn-exit-session" class="btn-exit-session" title="Esci dalla sessione">← Esci</button>
```

Aggiungere il bottone nave subito prima di `btn-exit-session`:

```html
        <button id="btn-toggle-ship" class="btn-secondary btn-sm" title="Apri pannello nave">🚢 Nave</button>
        <button id="btn-exit-session" class="btn-exit-session" title="Esci dalla sessione">← Esci</button>
```

- [ ] **Step 2: Aggiungere `#ship-panel` come sibling a `.combat-cols`**

Trovare la riga `<div class="combat-cols">` e aggiungere subito prima di essa:

```html
    <!-- Pannello nave (visibile al posto della lista combattenti) -->
    <div id="ship-panel" class="hidden"></div>
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add ship toggle button and panel div to combat view"
```

---

## Task 7: Modificare `app.js` — integrazione completa

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Aggiungere imports**

All'inizio di `app.js`, aggiungere dopo l'import di `LevelUpUI`:

```js
import { Ship }    from './src/Ship.js';
import * as ShipUI from './src/ShipUI.js';
```

- [ ] **Step 2: Aggiungere `_renderShipPanel` e `_bindShipEvents` come funzioni module-level**

Aggiungere queste due funzioni subito prima della funzione `_enterCombatView`:

```js
function _renderShipPanel() {
  const el = document.getElementById('ship-panel');
  if (!el || !state.shipPanelOpen) return;
  const combatants = Object.entries(state.snapshot?.combatants ?? {})
    .map(([id, c]) => ({ id, ...c }));
  el.innerHTML = ShipUI.renderShipPanel(
    state.shipData,
    combatants,
    state.myUid,
    state.session.isMaster,
    state.localDeck,
    state._selectedShipToken
  );
}

function _bindShipEvents() {
  const el = document.getElementById('ship-panel');
  if (!el) return;

  el.addEventListener('click', async (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;

    if (action === 'ship-hp') {
      if (!state.session.isMaster) return;
      await state.ship.updateHp(parseInt(target.dataset.delta) || 0);
      return;
    }
    if (action === 'toggle-crew') {
      const cId = target.dataset.combatant;
      const c   = state.snapshot?.combatants?.[cId];
      if (!c) return;
      if (!state.session.isMaster && c.ownerUid !== state.myUid) return;
      await state.ship.toggleCrewMember(target.dataset.weapon, cId);
      return;
    }
    if (action === 'switch-deck') {
      state.localDeck = target.dataset.deck;
      state._selectedShipToken = null;
      _renderShipPanel();
      return;
    }
    if (action === 'select-token') {
      const cId = target.closest('[data-combatant]')?.dataset.combatant;
      if (!cId) return;
      const c = state.snapshot?.combatants?.[cId];
      if (!c) return;
      if (!state.session.isMaster && c.ownerUid !== state.myUid) return;
      state._selectedShipToken = state._selectedShipToken === cId ? null : cId;
      _renderShipPanel();
      return;
    }
    if (action === 'place-token') {
      if (!state._selectedShipToken) return;
      await state.ship.setTokenPosition(
        state._selectedShipToken,
        state.localDeck,
        parseInt(target.dataset.col),
        parseInt(target.dataset.row)
      );
      state._selectedShipToken = null;
      return;
    }
  });

  el.addEventListener('change', async (e) => {
    const target = e.target.closest('[data-action]');
    if (!target || target.dataset.action !== 'weapon-state') return;
    await state.ship.setWeaponState(target.dataset.weapon, target.value);
  });
}
```

- [ ] **Step 3: Aggiornare `_enterCombatView` per inizializzare la nave**

Trovare `function _enterCombatView(code, isMaster) {` e aggiungere dopo le righe esistenti, prima della chiamata a `_startListening()`:

```js
function _enterCombatView(code, isMaster) {
  UI.renderSessionCode(code);
  UI.renderMasterPanel(isMaster);
  if (isMaster) populateCreaturePicker();
  state.sheetReturnView    = 'view-combat';
  state.ship               = new Ship(db, code);
  state.shipData           = null;
  state.localDeck          = 'main';
  state.shipPanelOpen      = false;
  state._selectedShipToken = null;
  document.body.classList.add('in-combat');
  _startListening();
  _bindShipEvents();
  GridUI.initZoomControls();
  UI.showView('view-combat');
}
```

- [ ] **Step 4: Aggiornare `_startListening` per aggiornare `state.shipData` e ri-renderare il pannello**

Trovare la riga `_renderSessionNotes();` alla fine del listener `state.session.listen(...)` (ultima riga prima della chiusura `});`) e aggiungere prima di essa:

```js
    state.shipData = data.ship ?? null;
    if (state.shipPanelOpen) _renderShipPanel();

    _renderSessionNotes();
```

- [ ] **Step 5: Aggiungere handler per `#btn-toggle-ship`**

Aggiungere il seguente handler una sola volta, insieme agli altri event listener del combat view (ad esempio vicino a `btn-reset` o `btn-next-turn`):

```js
document.getElementById('btn-toggle-ship').addEventListener('click', () => {
  state.shipPanelOpen = !state.shipPanelOpen;
  document.querySelector('.combat-cols').classList.toggle('hidden', state.shipPanelOpen);
  document.getElementById('ship-panel').classList.toggle('hidden', !state.shipPanelOpen);
  if (state.shipPanelOpen) _renderShipPanel();
});
```

- [ ] **Step 6: Commit**

```bash
git add app.js
git commit -m "feat: integrate ship panel into combat view (init, listener, toggle, event binding)"
```

---

## Task 8: Aggiungere stili a `style.css`

**Files:**
- Modify: `style.css`

- [ ] **Step 1: Aggiungere gli stili del pannello nave in fondo al file**

```css
/* ═══════════════════════════════════════════════
   SHIP PANEL
═══════════════════════════════════════════════ */

#ship-panel {
  padding: 0.5rem 1rem 1rem;
}

.ship-panel-inner {
  max-width: 700px;
  margin: 0 auto;
}

/* Header: nome + HP */
.ship-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.ship-name {
  font-family: 'Cinzel', serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--gold, #c9a84c);
  white-space: nowrap;
}

.ship-hp-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  flex-wrap: wrap;
}

.ship-hp-bar-track {
  flex: 1;
  min-width: 80px;
  height: 8px;
  background: rgba(255,255,255,0.08);
  border-radius: 4px;
  overflow: hidden;
}

.ship-hp-bar-fill {
  height: 100%;
  background: var(--hp-color, #e53935);
  border-radius: 4px;
  transition: width 0.4s ease;
}

.ship-hp-label {
  font-size: 0.82rem;
  color: var(--text-muted, #aaa);
  white-space: nowrap;
}

.ship-hp-controls {
  display: flex;
  gap: 0.25rem;
}

/* Weapons */
.ship-weapons {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.ship-weapon-card {
  flex: 1;
  min-width: 200px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
}

.ship-weapon-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}

.ship-weapon-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary, #e8d5b7);
}

.ship-weapon-state {
  font-size: 0.78rem;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 4px;
  color: var(--text-primary, #e8d5b7);
  padding: 2px 6px;
  cursor: pointer;
}

.ship-crew-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  min-height: 24px;
}

.ship-crew-chip {
  font-size: 0.72rem;
  padding: 2px 8px;
  border-radius: 12px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--text-muted, #aaa);
  transition: background 0.15s, color 0.15s;
}

.ship-crew-chip.in-crew {
  background: rgba(201, 168, 76, 0.2);
  border-color: var(--gold, #c9a84c);
  color: var(--gold, #c9a84c);
}

.ship-crew-chip.toggleable {
  cursor: pointer;
}

.ship-crew-chip.toggleable:hover {
  background: rgba(255,255,255,0.1);
}

.ship-crew-empty {
  font-size: 0.72rem;
  color: var(--text-muted, #888);
  font-style: italic;
}

/* Deck tabs */
.ship-deck-tabs {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
}

.ship-deck-tab {
  flex: 1;
  padding: 5px 10px;
  font-size: 0.78rem;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px;
  color: var(--text-muted, #aaa);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.ship-deck-tab:hover {
  background: rgba(255,255,255,0.1);
  color: var(--text-primary, #e8d5b7);
}

.ship-deck-tab.active {
  background: rgba(201, 168, 76, 0.18);
  border-color: var(--gold, #c9a84c);
  color: var(--gold, #c9a84c);
  font-weight: 600;
}

/* SVG container */
.ship-svg-container {
  overflow-x: auto;
  overflow-y: auto;
  max-height: 420px;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  background: #1a1a2e;
}

/* Token selected pulse */
.ship-svg-container circle.selected-pulse {
  animation: ship-token-pulse 1s ease-in-out infinite alternate;
}

@keyframes ship-token-pulse {
  from { stroke-opacity: 0.6; }
  to   { stroke-opacity: 1; }
}
```

- [ ] **Step 2: Commit**

```bash
git add style.css
git commit -m "feat: add ship panel CSS styles"
```

---

## Verifica post-implementazione

Aprire il sito localmente e verificare in sequenza:

1. **Init sessione:** Master crea una nuova sessione → aprire Firebase Console e verificare che `sessions/{code}/ship` contenga `hp:200, hpMax:200, weapons.ballista.state:'ready', weapons.mangonel.state:'ready'`

2. **Toggle pannello:** Click su "🚢 Nave" → il pannello si apre, la lista combattenti scompare. Click di nuovo → torna la lista.

3. **HP nave:** Master vede i bottoni −10/+10. Click su −10 → barra HP si aggiorna in real-time su tutti i client. Player non vede i bottoni.

4. **Weapon state:** Tutti possono cambiare il dropdown Ballista da "Pronta" a "Sparata" → cambia su Firebase e si aggiorna per tutti.

5. **Crew assignment:** Player A clicca sul chip del proprio nome sotto la Ballista → chip diventa dorato. Master può cliccare chip di qualsiasi personaggio.

6. **Deck switcher:** Click su "Top Deck" → mappa cambia. Un altro client rimane su "Main Deck" → i deck sono indipendenti per client.

7. **Posizionamento token:** Click su token proprio (cerchio con iniziale) → bordo diventa giallo (selezionato). Click su cella vuota → token si sposta. Tutti i client vedono il token nella nuova posizione.

8. **Token non proprio:** Player A non può selezionare il token di Player B. Master può selezionare tutti.

9. **Rimozione combattente:** Master rimuove un combattente dalla lista → il suo token scompare dalla mappa nave.

10. **Sessione legacy:** Aprire una sessione esistente (senza nodo `ship`) → `Ship.init()` viene chiamato solo da `create()`, quindi le sessioni legacy non avranno il pannello pre-inizializzato. Il rendering gestisce `shipData = null` mostrando i default (200/200 PF, armi ready). Verificare che non ci siano crash.
