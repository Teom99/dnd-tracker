import { Combatant }    from './Combatant.js';
import { CombatTracker } from './CombatTracker.js';
import * as UI           from './UI.js';
import { state }         from './state.js';

export function initCombatManagers(code) {
  state.combatantManager = new Combatant(state.db, code);
  state.tracker          = new CombatTracker(state.session);
}

export function exitToHome(errorMessage) {
  localStorage.removeItem('dnd_session_code');
  localStorage.removeItem('dnd_combatant_id');
  state.myCombatantId          = null;
  state.myUid                  = null;
  state.myCurrentCharId        = null;
  state.snapshot               = null;
  state.sheetData              = null;
  state.acMap                  = {};
  state.lastKnownHp            = null;
  state.selectedCreatureCharId = null;
  state.sheetReturnView        = 'view-combat';
  state.selectedGridTokenId    = null;
  const gridContainer = document.getElementById('grid-container');
  if (gridContainer) gridContainer.innerHTML = '';
  const submitBtn = document.querySelector('#form-join [type="submit"]');
  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Entra nella Sessione'; }
  document.body.classList.remove('in-combat', 'has-sheet', 'sheet-only');
  UI.showView('view-home');
  if (errorMessage) UI.showError(errorMessage);
}

export function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function openConditionModal(combatantId, conditionsObj) {
  const active = conditionsObj ? Object.keys(conditionsObj) : [];
  UI.renderConditionModal(
    combatantId,
    active,
    (id, cond) => state.combatantManager.toggleCondition(id, cond)
  );
}

export async function removeCombatant(id) {
  await state.session.clearGridPosition(id);
  await state.combatantManager.remove(id);
}

export function closeConditionModal() {
  document.getElementById('condition-modal').classList.add('hidden');
}
