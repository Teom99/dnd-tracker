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

  GridUI.renderInitiativeList(
    document.getElementById('grid-initiative-list'),
    sortedCombatants,
    gridPos,
    state.myCombatantId,
    state.selectedGridTokenId,
    currentTurnId,
    state.session.isMaster,
    (id) => { state.selectedGridTokenId = id; reRender(); document.dispatchEvent(new CustomEvent('dnd:selection-changed')); },
    comb,
    () => document.dispatchEvent(new CustomEvent('dnd:add-combatant'))
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
    (id) => { state.selectedGridTokenId = id; reRender(); document.dispatchEvent(new CustomEvent('dnd:selection-changed')); },
    (id, col, row) => state.session.setGridPosition(id, col, row),
    (cellKey, value) => state.session.setWall(cellKey, value)
  );
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
