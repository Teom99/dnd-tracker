import { Combatant }    from '../data/Combatant.js';
import { CombatTracker } from '../logic/CombatTracker.js';
import * as UI           from '../ui/UI.js';
import * as GridUI       from '../ui/GridUI.js';
import { state }         from '../utils/state.js';

export function initCombatManagers(code) {
  state.combatantManager = new Combatant(state.db, code);
  state.tracker          = new CombatTracker(state.session);
}

// Stacca tutti i listener Firebase della sessione corrente. In tutto il
// progetto non esisteva un solo off(): _startListening era raggiungibile da
// quattro punti (crea / entra / rientra dalla lista / restore all'avvio) e
// ogni passaggio registrava un listener in più sullo stesso nodo — la pipeline
// di render girava N volte per snapshot e le notifiche arrivavano duplicate.
export function detachSessionListeners() {
  for (const off of state._sessionUnsubs) {
    try { off?.(); } catch { /* già staccato */ }
  }
  state._sessionUnsubs = [];
}

export function exitToHome(errorMessage) {
  detachSessionListeners();
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
  // Stato locale che prima sopravviveva all'uscita e si portava dietro nella
  // sessione successiva: seenLogIds faceva saltare i popup delle nuove voci,
  // e le selezioni/template puntavano a id della sessione precedente.
  state.seenLogIds             = null;
  state.selectedDockId         = null;
  state.templatePlacingShape   = null;
  state.templateOrigin         = null;
  const gridContainer = document.getElementById('grid-container');
  if (gridContainer) gridContainer.innerHTML = '';
  GridUI.clearCursors();
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
