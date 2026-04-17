import { initializeApp }  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase }    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { getAuth }        from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

import { FIREBASE_CONFIG } from './config.js';
import { Session }         from './Session.js';
import { Combatant }       from './Combatant.js';
import { CombatTracker }   from './CombatTracker.js';
import * as UI             from './UI.js';

// --- Firebase init ---
const app  = initializeApp(FIREBASE_CONFIG);
const db   = getDatabase(app);
const auth = getAuth(app);

// --- App state ---
const session = new Session(db, auth);
let combatantManager = null;
let tracker          = null;
let myUid            = null;
let myCombatantId    = null;
let _snapshot        = null;   // ultimo snapshot Firebase ricevuto dal listener

// ─── HOME: Crea sessione (master) ────────────────────────────────────────────

document.getElementById('btn-create-session').addEventListener('click', async () => {
  try {
    const code = await session.create();
    myUid = session.currentUid;
    _initCombatManagers(code);
    _enterCombatView(code, true);
  } catch (err) {
    UI.showError('Errore nella creazione della sessione: ' + err.message);
  }
});

// ─── HOME: Entra nella sessione (giocatore) ───────────────────────────────────

document.getElementById('form-join').addEventListener('submit', async (e) => {
  e.preventDefault();

  const code       = document.getElementById('input-session-code').value.trim().toUpperCase();
  const name       = document.getElementById('input-pg-name').value.trim();
  const hp         = document.getElementById('input-pg-hp').value;
  const initiative = document.getElementById('input-pg-initiative').value || '0';

  if (!code || !name || !hp) {
    UI.showError('Inserisci codice sessione, nome personaggio e HP massimi.');
    return;
  }

  // Disabilita il bottone per evitare doppio invio
  const submitBtn = e.target.querySelector('[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Caricamento...';

  try {
    myUid = await session.join(code);
    _initCombatManagers(code);

    myCombatantId = await combatantManager.add(name, initiative, hp, 'player', myUid);
    localStorage.setItem('dnd_combatant_id', myCombatantId);

    _enterCombatView(code, false);
  } catch (err) {
    UI.showError(err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Entra nella Sessione';
  }
});

// ─── COMBAT: Aggiungi creatura (solo master) ──────────────────────────────────

document.getElementById('form-add-creature').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name       = document.getElementById('input-creature-name').value.trim();
  const hp         = document.getElementById('input-creature-hp').value;
  const initiative = document.getElementById('input-creature-initiative').value || '0';

  if (!name || !hp) return;

  await combatantManager.add(name, initiative, hp, 'creature', myUid);
  e.target.reset();
  document.getElementById('input-creature-name').focus();
});

// ─── COMBAT: Avanza turno (solo master) ───────────────────────────────────────

document.getElementById('btn-next-turn').addEventListener('click', async () => {
  if (!_snapshot) return;
  const sorted = tracker.sortedCombatants(_snapshot.combatants);
  await tracker.nextTurn(sorted, _snapshot.currentTurnId, _snapshot.round);
});

// ─── COMBAT: Reset incontro (solo master) ─────────────────────────────────────

document.getElementById('btn-reset').addEventListener('click', async () => {
  if (!confirm('Sei sicuro di voler resettare l\'incontro?\nTutti i combattenti verranno rimossi.')) return;
  await combatantManager.removeAll();
  await tracker.reset();
});

// ─── COMBAT: Copia codice sessione ────────────────────────────────────────────

document.getElementById('btn-copy-code').addEventListener('click', () => {
  navigator.clipboard.writeText(session.code).then(() => {
    const btn = document.getElementById('btn-copy-code');
    btn.textContent = '✓ Copiato';
    setTimeout(() => (btn.textContent = '📋 Copia'), 2000);
  });
});

// ─── MODAL Condizioni: chiudi ─────────────────────────────────────────────────

document.getElementById('btn-close-modal').addEventListener('click', closeConditionModal);
document.getElementById('condition-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('condition-modal')) closeConditionModal();
});

function closeConditionModal() {
  document.getElementById('condition-modal').classList.add('hidden');
}

function _exitToHome(errorMessage) {
  localStorage.removeItem('dnd_session_code');
  localStorage.removeItem('dnd_combatant_id');
  myCombatantId = null;
  myUid         = null;
  _snapshot     = null;
  UI.showView('view-home');
  if (errorMessage) UI.showError(errorMessage);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _initCombatManagers(code) {
  combatantManager = new Combatant(db, code);
  tracker          = new CombatTracker(session);
}

function _enterCombatView(code, isMaster) {
  UI.renderSessionCode(code);
  UI.renderMasterPanel(isMaster);
  _startListening();
  UI.showView('view-combat');
}

function _startListening() {
  session.listen((snap) => {
    const data = snap.val();
    if (!data) return;
    _snapshot = data;

    // Se il proprio combattente è stato rimosso, torna alla home
    const combatants = data.combatants || {};
    if (!session.isMaster && myCombatantId && !combatants[myCombatantId]) {
      _exitToHome('Il tuo personaggio è stato rimosso dalla sessione.');
      return;
    }

    const sorted = tracker.sortedCombatants(data.combatants);
    UI.renderRound(data.round ?? 1);
    UI.renderCombatantList(sorted, data.currentTurnId ?? null, myUid, session.masterUid, {
      onRemove:           (id)           => combatantManager.remove(id),
      onInitiativeChange: (id, val)      => combatantManager.setInitiative(id, val),
      onOpenConditions:   (id)           => _openConditionModal(id, data.combatants?.[id]?.conditions),
      onSetAction:          (id, text)        => combatantManager.setAction(id, text),
      onApplyToTarget:      (targetId, delta) => combatantManager.updateHp(targetId, delta),
      onToggleHealthHint:   (id, current)     => combatantManager.setHealthHint(id, !current),
    });
  });
}

function _openConditionModal(combatantId, conditionsObj) {
  const active = conditionsObj ? Object.keys(conditionsObj) : [];
  UI.renderConditionModal(
    combatantId,
    active,
    (id, cond) => combatantManager.toggleCondition(id, cond)
  );
}

// ─── Auto-restore sessione dopo refresh ───────────────────────────────────────

(async () => {
  const savedCode         = localStorage.getItem('dnd_session_code');
  const savedCombatantId  = localStorage.getItem('dnd_combatant_id');
  if (!savedCode) return;

  try {
    const uid = await session.restore(savedCode);
    if (!uid) {
      localStorage.removeItem('dnd_session_code');
      localStorage.removeItem('dnd_combatant_id');
      return;
    }

    // Un giocatore senza combatant ID salvato non può essere ripristinato correttamente
    if (!session.isMaster && !savedCombatantId) {
      localStorage.removeItem('dnd_session_code');
      return;
    }

    myUid         = uid;
    myCombatantId = savedCombatantId;
    _initCombatManagers(savedCode);
    _enterCombatView(savedCode, session.isMaster);
  } catch {
    localStorage.removeItem('dnd_session_code');
    localStorage.removeItem('dnd_combatant_id');
  }
})();
