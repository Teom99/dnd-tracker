import * as CombatChrome from '../ui/CombatChrome.js';
import { Combatant }    from '../data/Combatant.js';
import { CombatTracker } from '../logic/CombatTracker.js';
import * as UI           from '../ui/UI.js';
import { closeAllSheets } from '../ui/dialogs.js';
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
  closeAllSheets();
  document.dispatchEvent(new CustomEvent('dnd:reset-draw-history'));   // la pila undo vive in logic/grid.js (niente import circolare)
  state.gridEditMode = false;
  state.drawMode     = false;
  state.shipPanelOpen = false;
  document.querySelector('.combat-shell')?.classList.remove('hidden');
  document.getElementById('ship-panel')?.classList.add('hidden');
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
  state.trajectoryFrom         = null;
  CombatChrome.reset();
  const gridContainer = document.getElementById('grid-container');
  if (gridContainer) gridContainer.innerHTML = '';
  GridUI.clearCursors();
  setJoinBusy(false);
  UI.resetScene();
  document.querySelectorAll('.btn-rejoin').forEach(b => { b.disabled = false; });
  document.body.classList.remove('in-combat', 'has-sheet', 'sheet-only');
  UI.showView('view-home');
  document.dispatchEvent(new CustomEvent('dnd:home-refresh'));   // l'elenco "Riprendi" va riletto: ora include la sessione appena lasciata
  if (errorMessage) UI.showError(errorMessage);
}

// Bottone di ingresso della home: il testo sta in .lbl per non perdere l'icona.
export function setJoinBusy(busy) {
  const btn = document.getElementById('btn-join-submit');
  if (!btn) return;
  btn.disabled = busy;
  const lbl = btn.querySelector('.lbl');
  if (lbl) lbl.textContent = busy ? 'Caricamento…' : 'Varca la soglia';
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
  // Le traiettorie che partivano da lui o lo avevano per bersaglio non hanno più senso
  for (const [uid, t] of Object.entries(state.snapshot?.trajectories ?? {})) {
    if (t?.fromId === id || t?.toId === id) await state.session.clearTrajectory(uid);
  }
}

export function closeConditionModal() {
  document.getElementById('condition-modal').classList.add('hidden');
}
