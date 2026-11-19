import * as CombatChrome from '../ui/CombatChrome.js';
import { Combatant }    from '../data/Combatant.js';
import { CombatTracker } from '../logic/CombatTracker.js';
import * as UI           from '../ui/UI.js';
import { closeAllSheets } from '../ui/dialogs.js';
import * as GridUI       from '../ui/GridUI.js';
import * as DiceUI       from '../ui/DiceUI.js';
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
  state.lastHpAction           = null;
  refreshUndoHpButton();
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
  DiceUI.stop();   // il palco sta su <body>: un tiro in volo non deve finire sulla home
  DiceUI.setColors({}, null);
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

// ── Annulla ultimo danno/cura ──────────────────────────────────────────────
// Locale a ciascun client (come l'undo del disegno): si annulla solo l'ultima applicazione fatta da
// sé, su tutti i bersagli che aveva colpito. L'annullamento è relativo (applyHpRevert): restituisce
// il cambio reale e lascia intatti i colpi che altri hanno dato dopo. Un solo livello, niente redo.

function _hpActionSummary(a) {
  const names = a.entries.map(e => e.name).join(', ');
  return `${Math.abs(a.delta)} ${a.delta < 0 ? 'danni a' : 'PF di cura a'} ${names}`;
}

export function rememberHpAction(action) {
  state.lastHpAction = action?.entries?.length ? action : null;
  refreshUndoHpButton();
  if (!state.lastHpAction) return;
  UI.showNotification(`Applicati ${_hpActionSummary(state.lastHpAction)}`, state.lastHpAction.delta < 0 ? 'damage' : 'heal',
    state.lastHpAction.delta < 0 ? 'sword' : 'heal',
    { action: { label: 'Annulla', onClick: undoLastHpAction }, duration: 8000 });
}

export function refreshUndoHpButton() {
  const btn = document.getElementById('btn-undo-hp');
  if (!btn) return;
  const a = state.lastHpAction;
  btn.classList.toggle('hidden', !a);
  btn.title = a ? `Annulla: ${_hpActionSummary(a)}` : '';
}

let _undoing = false;
export async function undoLastHpAction() {
  const a = state.lastHpAction;
  if (!a || _undoing || !state.combatantManager) return;
  _undoing = true;
  state.lastHpAction = null;   // subito: un secondo clic (toast + menu) non annulla due volte
  refreshUndoHpButton();
  try {
    const done = [];
    for (const e of a.entries) {
      if (await state.combatantManager.revertHp(e.id, e.change)) done.push(e.name);
    }
    if (!done.length) { UI.showNotification('Niente da annullare: i bersagli non sono più in sessione.', 'info', 'undo'); return; }
    const what = a.delta < 0 ? 'il danno' : 'la cura';
    await state.session.addLogEvent(`${a.actorName} ha annullato ${what} su ${done.join(', ')}`, 'undo', { actor: a.actorName });
    UI.showNotification(`Annullato: ${what} su ${done.join(', ')}`, 'info', 'undo');
  } catch (err) {
    state.lastHpAction = a;   // non è andato: si può riprovare
    refreshUndoHpButton();
    UI.showError('Annullamento non riuscito: ' + (err?.message ?? err), 'error-message-combat');
  } finally {
    _undoing = false;
  }
}
