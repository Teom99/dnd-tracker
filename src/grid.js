import * as GridUI from './GridUI.js';
import { state }   from './state.js';

export function renderGrid(gridPos, combatants, currentTurnId, sortedCombatants) {
  const container = document.getElementById('grid-container');
  if (!container) return;

  GridUI.renderInitiativeList(
    document.getElementById('grid-initiative-list'),
    sortedCombatants,
    gridPos,
    state.myCombatantId,
    state.selectedGridTokenId,
    currentTurnId,
    state.session.isMaster,
    (id) => {
      state.selectedGridTokenId = id;
      if (state.snapshot) {
        const sorted = state.tracker.sortedCombatants(state.snapshot.combatants);
        renderGrid(state.snapshot.grid || {}, state.snapshot.combatants || {}, state.snapshot.currentTurnId ?? null, sorted);
      }
    }
  );

  GridUI.renderGrid(
    container,
    gridPos,
    combatants,
    state.myCombatantId,
    state.session.isMaster,
    state.selectedGridTokenId,
    currentTurnId,
    (id) => {
      state.selectedGridTokenId = id;
      if (state.snapshot) {
        const sorted = state.tracker.sortedCombatants(state.snapshot.combatants);
        renderGrid(state.snapshot.grid || {}, state.snapshot.combatants || {}, state.snapshot.currentTurnId ?? null, sorted);
      }
    },
    (id, col, row) => state.session.setGridPosition(id, col, row)
  );
  renderTokenBar(gridPos, combatants);
}

export function renderTokenBar(gridPos, combatants) {
  const bar = document.getElementById('grid-token-bar');
  if (!bar) return;
  const pos  = gridPos   || {};
  const comb = combatants || {};

  const entries = Object.entries(comb).filter(([id, c]) => {
    if (state.session.isMaster) return c.type === 'creature';
    return id === state.myCombatantId;
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
    >${(c.name || '?').slice(0, 2).toUpperCase()}${placed ? '' : ' +'}</button>`;
  }).join('');

  bar.onclick = (e) => {
    const btn = e.target.closest('[data-token-id]');
    if (!btn) return;
    const id = btn.dataset.tokenId;
    state.selectedGridTokenId = state.selectedGridTokenId === id ? null : id;
    if (state.snapshot) {
      const sorted = state.tracker.sortedCombatants(state.snapshot.combatants);
      renderGrid(state.snapshot.grid || {}, state.snapshot.combatants || {}, state.snapshot.currentTurnId ?? null, sorted);
    }
  };
}
