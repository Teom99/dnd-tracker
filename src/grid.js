import * as GridUI from './GridUI.js';
import { state }   from './state.js';

export function renderGrid(gridPos, combatants, currentTurnId, sortedCombatants, gridConfig, walls) {
  const container = document.getElementById('grid-container');
  if (!container) return;

  // Registra il callback usato da zoom e ResizeObserver
  GridUI.setReRenderCallback(() => {
    if (state.snapshot) {
      const sorted = state.tracker.sortedCombatants(state.snapshot.combatants);
      renderGrid(state.snapshot.grid || {}, state.snapshot.combatants || {}, state.snapshot.currentTurnId ?? null, sorted, state.snapshot.gridConfig || null, state.snapshot.walls || {});
    }
  });

  const comb = combatants || {};
  const myOwnedIds = new Set(
    state.myUid
      ? Object.entries(comb).filter(([, c]) => c.ownerUid === state.myUid).map(([id]) => id)
      : []
  );

  const reRender = () => {
    if (state.snapshot) {
      const sorted = state.tracker.sortedCombatants(state.snapshot.combatants);
      renderGrid(state.snapshot.grid || {}, state.snapshot.combatants || {}, state.snapshot.currentTurnId ?? null, sorted, state.snapshot.gridConfig || null, state.snapshot.walls || {});
    }
  };

  const selectToken = (id) => {
    state.selectedGridTokenId = id;
    reRender();
  };

  // Tabella iniziativa: per il master seleziona il soggetto del dock (nessun
  // movimento sulla griglia); per il player resta la selezione/movimento griglia.
  const isMaster = state.session.isMaster;
  GridUI.renderInitiativeList(
    document.getElementById('grid-initiative-list'),
    sortedCombatants,
    gridPos,
    state.myCombatantId,
    isMaster ? state.selectedDockId : state.selectedGridTokenId,
    currentTurnId,
    isMaster,
    isMaster
      ? (id) => document.dispatchEvent(new CustomEvent('dnd:dock-select', { detail: { id } }))
      : selectToken,
    comb
  );

  GridUI.renderGrid(
    container,
    gridPos,
    combatants,
    state.myCombatantId,
    myOwnedIds,
    state.session.isMaster,
    state.selectedGridTokenId,
    currentTurnId,
    gridConfig,
    walls,
    state.gridEditMode,
    selectToken,
    (id, col, row) => state.session.setGridPosition(id, col, row),
    (cellKey, value) => state.session.setWall(cellKey, value)
  );
  renderTokenBar(gridPos, combatants);
  updateTokenSizeControl(combatants);
}

// Riflette la taglia del token selezionato sul controllo del master.
// Chiamata a ogni render (snapshot e cambi di selezione locali) per aggiornare subito.
function updateTokenSizeControl(combatants) {
  if (!state.session.isMaster) return;
  const sizeSel = document.getElementById('select-token-size');
  if (!sizeSel) return;
  const sel = state.selectedGridTokenId;
  const selComb = sel ? (combatants || {})[sel] : null;
  sizeSel.disabled = !selComb;
  if (selComb) sizeSel.value = selComb.size || 'medium';
}

export function renderTokenBar(gridPos, combatants) {
  const bar = document.getElementById('grid-token-bar');
  if (!bar) return;
  const pos  = gridPos   || {};
  const comb = combatants || {};

  const myOwnedIds = new Set(
    state.myUid
      ? Object.entries(comb).filter(([, c]) => c.ownerUid === state.myUid).map(([id]) => id)
      : []
  );

  const entries = Object.entries(comb).filter(([id, c]) => {
    if (state.session.isMaster) return c.type === 'creature';
    return myOwnedIds.has(id);
  });

  if (entries.length === 0) { bar.innerHTML = ''; return; }

  bar.innerHTML = entries.map(([id, c]) => {
    const placed   = pos[id] != null;
    const selected = id === state.selectedGridTokenId;
    const ko       = c.hpCurrent === 0;
    return `<button
      class="grid-token-chip${selected ? ' selected' : ''}${ko ? ' ko' : ''}"
      data-token-id="${id}"
      title="${placed ? 'Riposiziona' : 'Posiziona sulla griglia'}"
    >${(c.name || '?').slice(0, 2).toUpperCase()}${ko ? ' 💀' : ''}${placed ? '' : ' +'}</button>`;
  }).join('');

  bar.onclick = (e) => {
    const btn = e.target.closest('[data-token-id]');
    if (!btn) return;
    const id = btn.dataset.tokenId;
    state.selectedGridTokenId = state.selectedGridTokenId === id ? null : id;
    if (state.snapshot) {
      const sorted = state.tracker.sortedCombatants(state.snapshot.combatants);
      renderGrid(state.snapshot.grid || {}, state.snapshot.combatants || {}, state.snapshot.currentTurnId ?? null, sorted, state.snapshot.gridConfig || null, state.snapshot.walls || {});
    }
  };
}
