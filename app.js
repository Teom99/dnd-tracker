import { initializeApp }      from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase, ref, get, remove } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { getAuth }            from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

import { FIREBASE_CONFIG }   from './config.js';
import { Session }           from './src/Session.js';
import { CharacterLibrary }  from './src/CharacterLibrary.js';
import * as UI               from './src/UI.js';
import { state }             from './src/state.js';
import { initCombatManagers, exitToHome, closeConditionModal } from './src/core.js';
import { CharacterSheet } from './src/CharacterSheet.js';
import { renderGrid }        from './src/grid.js';
import { initSheet, setupSheetListener, makeCallbacks } from './src/sheet.js';
import { updateHomeAuthUI, loadCharacterLibrary, populateJoinPicker, populateCreaturePicker, saveUserSession, loadUserSessions } from './src/home.js';

// --- Firebase init ---
const firebaseApp = initializeApp(FIREBASE_CONFIG);
const db          = getDatabase(firebaseApp);
const auth        = getAuth(firebaseApp);

// --- Inject Firebase instances into shared state ---
state.db   = db;
state.auth = auth;
state.session = new Session(db, auth);

// ─── HOME: Auth ───────────────────────────────────────────────────────────────

document.getElementById('btn-google-signin').addEventListener('click', async () => {
  const btn = document.getElementById('btn-google-signin');
  btn.disabled = true;
  btn.textContent = 'Accesso in corso...';
  try {
    await state.session.signInWithGoogle();
    updateHomeAuthUI(auth.currentUser);
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      UI.showError('Errore accesso Google: ' + err.message);
    }
    btn.disabled = false;
    btn.innerHTML = `<svg class="google-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Accedi con Google`;
  }
});

document.getElementById('btn-anon-signin').addEventListener('click', async () => {
  try {
    await state.session.signInAnonymous();
    updateHomeAuthUI(auth.currentUser);
  } catch (err) {
    UI.showError('Errore: ' + err.message);
  }
});

document.getElementById('btn-sign-out').addEventListener('click', async () => {
  await state.session.signOut();
  state.library = null;
  updateHomeAuthUI(null);
});

document.getElementById('btn-upgrade-google').addEventListener('click', async () => {
  const btn = document.getElementById('btn-upgrade-google');
  btn.disabled = true;
  try {
    await state.session.signInWithGoogle();
    updateHomeAuthUI(auth.currentUser);
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      UI.showError('Errore accesso Google: ' + err.message);
    }
    btn.disabled = false;
  }
});

// ─── HOME: Libreria personaggi ────────────────────────────────────────────────

document.getElementById('btn-create-player').addEventListener('click', async () => {
  const name = prompt('Nome del personaggio:');
  if (!name?.trim()) return;
  await state.library.create(name.trim(), 'player');
  loadCharacterLibrary();
  populateJoinPicker();
});

document.getElementById('btn-create-creature').addEventListener('click', async () => {
  const name = prompt('Nome della creatura:');
  if (!name?.trim()) return;
  await state.library.create(name.trim(), 'creature');
  loadCharacterLibrary();
});

// ─── HOME: Crea sessione (master) ─────────────────────────────────────────────

document.getElementById('btn-create-session').addEventListener('click', async () => {
  try {
    const code = await state.session.create();
    state.myUid = state.session.currentUid;
    initCombatManagers(code);
    await saveUserSession(state.myUid, code, null, null, 'master', null);
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
  const initiative = document.getElementById('input-pg-initiative').value || '0';

  if (!code || !name) {
    UI.showError('Inserisci codice sessione e nome personaggio.');
    return;
  }

  const submitBtn = e.target.querySelector('[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Caricamento...';

  try {
    state.myUid = await state.session.join(code);
    initCombatManagers(code);

    let charId = state.selectedJoinCharId ?? null;
    if (!charId) {
      if (!state.library && auth.currentUser) state.library = new CharacterLibrary(db, auth.currentUser.uid);
      if (state.library) charId = await state.library.create(name, 'player');
    }

    initSheet(state.myUid, charId);

    const existing = await state.combatantManager.findByOwner(state.myUid);
    let savedCharName = name;
    if (existing) {
      const rejoin = confirm(
        `Sei già presente in questa sessione con il personaggio "${existing.name}".\n\n` +
        `OK → Rientra con "${existing.name}"\n` +
        `Annulla → Rimuovi il vecchio e crea "${name}"`
      );
      if (rejoin) {
        state.myCombatantId = existing.id;
        savedCharName = existing.name;
        const existingCharId = existing.charId ?? charId;
        if (existingCharId !== charId) {
          state.myCurrentCharId = existingCharId;
          state.sheet = new CharacterSheet(db, state.myUid, existingCharId);
          setupSheetListener();
        }
        charId = existingCharId;
      } else {
        await state.combatantManager.remove(existing.id);
        state.myCombatantId = await state.combatantManager.add(name, initiative, 1, 'player', state.myUid, charId);
      }
    } else {
      state.myCombatantId = await state.combatantManager.add(name, initiative, 1, 'player', state.myUid, charId);
    }

    state.selectedJoinCharId = null;
    localStorage.setItem('dnd_combatant_id', state.myCombatantId);
    await saveUserSession(state.myUid, code, state.myCombatantId, savedCharName, 'player', charId);
    state.lastKnownHp = null;
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

  const charId = state.selectedCreatureCharId ?? null;
  await state.combatantManager.add(name, initiative, hp, 'creature', state.myUid, charId);
  state.selectedCreatureCharId = null;
  document.querySelectorAll('#creature-library-list .char-pick-btn').forEach(b => b.classList.remove('selected'));
  e.target.reset();
  document.getElementById('input-creature-name').focus();
});

// ─── COMBAT: Turno, Reset, Copia, Esci ───────────────────────────────────────

document.getElementById('btn-next-turn').addEventListener('click', async () => {
  if (!state.snapshot) return;
  const sorted = state.tracker.sortedCombatants(state.snapshot.combatants);
  const active = sorted.filter(c => c.hpCurrent > 0 || c.type === 'player');
  if (active.length === 0) return;
  const currentId  = state.snapshot.currentTurnId ?? null;
  const currentIdx = active.findIndex(c => c.id === currentId);
  const nextActive = currentIdx === -1 ? active[0] : active[(currentIdx + 1) % active.length];
  await state.tracker.nextTurn(sorted);
  if (nextActive) {
    await state.session.addLogEvent(`È il turno di ${nextActive.name}!`, 'turn', { actor: nextActive.name });
  }
});

document.getElementById('btn-reset').addEventListener('click', async () => {
  if (!confirm('Sei sicuro di voler resettare l\'incontro?\nTutti i combattenti verranno rimossi.')) return;
  await state.combatantManager.removeAll();
  await state.tracker.reset();
  await state.session.addLogEvent('Incontro resettato - tutti i combattenti rimossi', 'turn');
});

document.getElementById('btn-copy-code').addEventListener('click', () => {
  navigator.clipboard.writeText(state.session.code).then(() => {
    const btn = document.getElementById('btn-copy-code');
    btn.textContent = '✓ Copiato';
    setTimeout(() => (btn.textContent = '📋 Copia'), 2000);
  });
});

document.getElementById('btn-exit-session').addEventListener('click', () => {
  if (!confirm('Sei sicuro di voler uscire dalla sessione?')) return;
  exitToHome();
});

document.getElementById('btn-clear-log').addEventListener('click', () => {
  if (confirm('Sei sicuro di voler cancellare tutto il log degli eventi?')) {
    state.session.clearLogs();
  }
});

// ─── SCHEDA: Torna indietro ───────────────────────────────────────────────────

document.getElementById('btn-back-to-combat').addEventListener('click', () => {
  document.body.classList.remove('sheet-only');
  const embedded = window.matchMedia('(min-width: 1100px)').matches
    && document.body.classList.contains('has-sheet')
    && document.body.classList.contains('in-combat');
  if (embedded) return;
  if (state.sheetReturnView === 'view-home') {
    document.body.classList.remove('has-sheet');
    UI.showView('view-home');
    loadCharacterLibrary();
  } else {
    UI.showView('view-combat');
  }
});

// ─── MODAL Condizioni ─────────────────────────────────────────────────────────

document.getElementById('btn-close-modal').addEventListener('click', closeConditionModal);
document.getElementById('condition-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('condition-modal')) closeConditionModal();
});

// ─── Rejoin via evento custom da home.js ─────────────────────────────────────

document.addEventListener('dnd:rejoin', (e) => {
  const { code, combatantId, role, charId } = e.detail;
  _rejoinSession(code, combatantId, role, charId);
});

// ─── Core orchestration ───────────────────────────────────────────────────────

function _enterCombatView(code, isMaster) {
  UI.renderSessionCode(code);
  UI.renderMasterPanel(isMaster);
  if (isMaster) populateCreaturePicker();
  state.sheetReturnView = 'view-combat';
  document.body.classList.add('in-combat');
  _startListening();
  UI.showView('view-combat');
}

function _startListening() {
  state.session.listen((snap) => {
    const data = snap.val();
    if (!data) return;
    state.snapshot = data;

    UI.renderLogs(data.logs || {});

    const combatants = data.combatants || {};
    if (!state.session.isMaster && state.myCombatantId && !combatants[state.myCombatantId]) {
      exitToHome('Il tuo personaggio è stato rimosso dalla sessione.');
      return;
    }

    if (state.myCombatantId && combatants[state.myCombatantId]) {
      const currentHp = combatants[state.myCombatantId].hpCurrent;
      if (state.lastKnownHp !== null && state.lastKnownHp !== currentHp) {
        const delta  = currentHp - state.lastKnownHp;
        const amount = Math.abs(delta);
        if (delta < 0) {
          UI.showNotification(`🗡 Hai ricevuto ${amount} danni!`, 'damage');
        } else if (delta > 0) {
          UI.showNotification(`✚ Hai ricevuto ${amount} punti vita!`, 'heal');
        }
      }
      state.lastKnownHp = currentHp;
    }

    const sorted   = state.tracker.sortedCombatants(data.combatants);
    const creatures = sorted.filter(c => c.type === 'creature');
    const players   = sorted.filter(c => c.type === 'player');
    UI.renderRound(data.round ?? 1);
    const callbacks = makeCallbacks();
    UI.renderCombatantList(creatures, data.currentTurnId ?? null, state.myUid, state.session.masterUid, callbacks, state.acMap, null,                               'creature-list', 'empty-creatures-msg', sorted);
    UI.renderCombatantList(players,   data.currentTurnId ?? null, state.myUid, state.session.masterUid, callbacks, state.acMap, state.sheetData?.deathSaves ?? null, 'player-list',   'empty-players-msg', sorted);

    renderGrid(data.grid || {}, data.combatants || {}, data.currentTurnId ?? null, sorted);
  });
}

async function _rejoinSession(code, savedCombatantId, role, savedCharId = null) {
  try {
    const uid = await state.session.restore(code);
    if (!uid) {
      UI.showError('La sessione non è più disponibile.');
      await remove(ref(db, `userSessions/${uid}/${code}`));
      await loadUserSessions(state.myUid || auth.currentUser?.uid);
      return;
    }
    const isMaster = role === 'master';
    if (!isMaster && !savedCombatantId) {
      UI.showError('Non è possibile recuperare il personaggio.');
      return;
    }
    state.myUid         = uid;
    state.myCombatantId = savedCombatantId || null;
    state.lastKnownHp   = null;
    localStorage.setItem('dnd_session_code', code);
    if (savedCombatantId) localStorage.setItem('dnd_combatant_id', savedCombatantId);
    initCombatManagers(code);
    if (!isMaster) initSheet(uid, savedCharId);
    _enterCombatView(code, isMaster);
  } catch (err) {
    UI.showError('Errore nel rientro: ' + err.message);
  }
}

// ─── Avvio ────────────────────────────────────────────────────────────────────

(async () => {
  try {
    await state.session.ensureAuth();
  } catch { /* nessun auth state — gestito come non autenticato */ }
  updateHomeAuthUI(auth.currentUser);

  const savedCode        = localStorage.getItem('dnd_session_code');
  const savedCombatantId = localStorage.getItem('dnd_combatant_id');
  if (!savedCode) return;

  try {
    const uid = await state.session.restore(savedCode);
    if (!uid) {
      localStorage.removeItem('dnd_session_code');
      localStorage.removeItem('dnd_combatant_id');
      return;
    }

    if (!state.session.isMaster && !savedCombatantId) {
      localStorage.removeItem('dnd_session_code');
      return;
    }

    let savedCharId = null;
    const userSessionSnap = await get(ref(db, `userSessions/${uid}/${savedCode}`));
    if (userSessionSnap.exists()) savedCharId = userSessionSnap.val().charId ?? null;

    state.myUid         = uid;
    state.myCombatantId = savedCombatantId;
    initCombatManagers(savedCode);
    if (!state.session.isMaster) initSheet(uid, savedCharId);
    _enterCombatView(savedCode, state.session.isMaster);
  } catch {
    localStorage.removeItem('dnd_session_code');
    localStorage.removeItem('dnd_combatant_id');
  }
})();
