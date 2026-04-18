import { initializeApp }      from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase, ref, set, get, remove } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { getAuth }            from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

import { FIREBASE_CONFIG }   from './config.js';
import { Session }           from './Session.js';
import { Combatant }         from './Combatant.js';
import { CombatTracker }     from './CombatTracker.js';
import { CharacterSheet }    from './CharacterSheet.js';
import { CharacterLibrary }  from './CharacterLibrary.js';
import * as UI               from './UI.js';
import * as SheetUI          from './SheetUI.js';
import * as GridUI           from './GridUI.js';

// --- Firebase init ---
const app  = initializeApp(FIREBASE_CONFIG);
const db   = getDatabase(app);
const auth = getAuth(app);

// --- App state ---
const session = new Session(db, auth);
let combatantManager        = null;
let tracker                 = null;
let myUid                   = null;
let myCombatantId           = null;
let myCurrentCharId         = null;
let _snapshot               = null;
let _sheet                  = null;
let _sheetData              = null;
let _acMap                  = {};
let _library                = null;
let _selectedJoinCharId     = null;
let _selectedCreatureCharId = null;
let _sheetReturnView        = 'view-combat';
let _selectedGridTokenId    = null;

// ─── HOME: Auth ───────────────────────────────────────────────────────────────

document.getElementById('btn-google-signin').addEventListener('click', async () => {
  const btn = document.getElementById('btn-google-signin');
  btn.disabled = true;
  btn.textContent = 'Accesso in corso...';
  try {
    await session.signInWithGoogle();
    _updateHomeAuthUI(auth.currentUser);
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
    await session.signInAnonymous();
    _updateHomeAuthUI(auth.currentUser);
  } catch (err) {
    UI.showError('Errore: ' + err.message);
  }
});

document.getElementById('btn-sign-out').addEventListener('click', async () => {
  await session.signOut();
  _library = null;
  _updateHomeAuthUI(null);
});

document.getElementById('btn-upgrade-google').addEventListener('click', async () => {
  const btn = document.getElementById('btn-upgrade-google');
  btn.disabled = true;
  try {
    await session.signInWithGoogle();
    _updateHomeAuthUI(auth.currentUser);
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
  await _library.create(name.trim(), 'player');
  _loadCharacterLibrary();
  _populateJoinPicker();
});

document.getElementById('btn-create-creature').addEventListener('click', async () => {
  const name = prompt('Nome della creatura:');
  if (!name?.trim()) return;
  await _library.create(name.trim(), 'creature');
  _loadCharacterLibrary();
});

// ─── HOME: Crea sessione (master) ─────────────────────────────────────────────

document.getElementById('btn-create-session').addEventListener('click', async () => {
  try {
    const code = await session.create();
    myUid = session.currentUid;
    _initCombatManagers(code);
    await _saveUserSession(myUid, code, null, null, 'master', null);
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

  const submitBtn = e.target.querySelector('[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Caricamento...';

  try {
    myUid = await session.join(code);
    _initCombatManagers(code);

    // Determina charId: usa quello selezionato dal picker, o crea voce nuova in libreria
    let charId = _selectedJoinCharId ?? null;
    if (!charId) {
      if (!_library && auth.currentUser) _library = new CharacterLibrary(db, auth.currentUser.uid);
      if (_library) charId = await _library.create(name, 'player');
    }

    _initSheet(myUid, charId);

    const existing = await combatantManager.findByOwner(myUid);
    let savedCharName = name;
    if (existing) {
      const rejoin = confirm(
        `Sei già presente in questa sessione con il personaggio "${existing.name}".\n\n` +
        `OK → Rientra con "${existing.name}"\n` +
        `Annulla → Rimuovi il vecchio e crea "${name}"`
      );
      if (rejoin) {
        myCombatantId = existing.id;
        savedCharName = existing.name;
        // Ripristina il charId del combattente esistente se diverso
        const existingCharId = existing.charId ?? charId;
        if (existingCharId !== charId) {
          myCurrentCharId = existingCharId;
          _sheet = new CharacterSheet(db, myUid, existingCharId);
          _setupSheetListener();
        }
        charId = existingCharId;
      } else {
        await combatantManager.remove(existing.id);
        myCombatantId = await combatantManager.add(name, initiative, hp, 'player', myUid, charId);
      }
    } else {
      myCombatantId = await combatantManager.add(name, initiative, hp, 'player', myUid, charId);
    }

    _selectedJoinCharId = null;
    localStorage.setItem('dnd_combatant_id', myCombatantId);
    await _saveUserSession(myUid, code, myCombatantId, savedCharName, 'player', charId);
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

  const charId = _selectedCreatureCharId ?? null;
  await combatantManager.add(name, initiative, hp, 'creature', myUid, charId);
  _selectedCreatureCharId = null;
  document.querySelectorAll('#creature-library-list .char-pick-btn').forEach(b => b.classList.remove('selected'));
  e.target.reset();
  document.getElementById('input-creature-name').focus();
});

// ─── COMBAT: Turno, Reset, Copia, Esci ───────────────────────────────────────

document.getElementById('btn-next-turn').addEventListener('click', async () => {
  if (!_snapshot) return;
  const sorted = tracker.sortedCombatants(_snapshot.combatants);
  await tracker.nextTurn(sorted, _snapshot.currentTurnId, _snapshot.round);
});

document.getElementById('btn-reset').addEventListener('click', async () => {
  if (!confirm('Sei sicuro di voler resettare l\'incontro?\nTutti i combattenti verranno rimossi.')) return;
  await combatantManager.removeAll();
  await tracker.reset();
});

document.getElementById('btn-copy-code').addEventListener('click', () => {
  navigator.clipboard.writeText(session.code).then(() => {
    const btn = document.getElementById('btn-copy-code');
    btn.textContent = '✓ Copiato';
    setTimeout(() => (btn.textContent = '📋 Copia'), 2000);
  });
});

document.getElementById('btn-exit-session').addEventListener('click', () => {
  if (!confirm('Sei sicuro di voler uscire dalla sessione?')) return;
  _exitToHome();
});

// ─── SCHEDA: Torna indietro ───────────────────────────────────────────────────

document.getElementById('btn-back-to-combat').addEventListener('click', () => {
  UI.showView(_sheetReturnView);
  if (_sheetReturnView === 'view-home') _loadCharacterLibrary();
});

// ─── MODAL Condizioni ─────────────────────────────────────────────────────────

document.getElementById('btn-close-modal').addEventListener('click', closeConditionModal);
document.getElementById('condition-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('condition-modal')) closeConditionModal();
});

function closeConditionModal() {
  document.getElementById('condition-modal').classList.add('hidden');
}

// ─── Core helpers ─────────────────────────────────────────────────────────────

function _exitToHome(errorMessage) {
  localStorage.removeItem('dnd_session_code');
  localStorage.removeItem('dnd_combatant_id');
  myCombatantId           = null;
  myUid                   = null;
  myCurrentCharId         = null;
  _snapshot               = null;
  _sheetData              = null;
  _acMap                  = {};
  _selectedCreatureCharId = null;
  _sheetReturnView        = 'view-combat';
  _selectedGridTokenId    = null;
  const gridContainer = document.getElementById('grid-container');
  if (gridContainer) gridContainer.innerHTML = '';
  const submitBtn = document.querySelector('#form-join [type="submit"]');
  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Entra nella Sessione'; }
  UI.showView('view-home');
  if (errorMessage) UI.showError(errorMessage);
}

function _initCombatManagers(code) {
  combatantManager = new Combatant(db, code);
  tracker          = new CombatTracker(session);
}

function _enterCombatView(code, isMaster) {
  UI.renderSessionCode(code);
  UI.renderMasterPanel(isMaster);
  if (isMaster) _populateCreaturePicker();
  _sheetReturnView = 'view-combat';
  _startListening();
  UI.showView('view-combat');
}

function _startListening() {
  session.listen((snap) => {
    const data = snap.val();
    if (!data) return;
    _snapshot = data;

    const combatants = data.combatants || {};
    if (!session.isMaster && myCombatantId && !combatants[myCombatantId]) {
      _exitToHome('Il tuo personaggio è stato rimosso dalla sessione.');
      return;
    }

    const sorted = tracker.sortedCombatants(data.combatants);
    UI.renderRound(data.round ?? 1);
    UI.renderCombatantList(sorted, data.currentTurnId ?? null, myUid, session.masterUid, {
      onRemove:           (id)           => _removeCombatant(id),
      onInitiativeChange: (id, val)      => combatantManager.setInitiative(id, val),
      onOpenConditions:   (id)           => _openConditionModal(id, data.combatants?.[id]?.conditions),
      onSetAction:          (id, text)        => combatantManager.setAction(id, text),
      onApplyToTarget:      (targetId, delta) => combatantManager.updateHp(targetId, delta),
      onToggleHealthHint:   (id, current)     => combatantManager.setHealthHint(id, !current),
      onOpenSheet:          ()               => _openCharacterSheet(),
    }, _acMap);

    _renderGrid(data.grid || {}, data.combatants || {}, data.currentTurnId ?? null);
  });
}

function _setupSheetListener() {
  if (!_sheet) return;
  _sheet.listen((snap) => {
    _sheetData = snap.val() || {};
    const ac = _sheetData.armorClass ?? null;
    if (ac !== null && myCombatantId) {
      _acMap[myUid] = ac;
      combatantManager.setArmorClass(myCombatantId, ac);
    }
    const sheetView = document.getElementById('view-character');
    if (sheetView && !sheetView.classList.contains('hidden')) {
      SheetUI.updateComputedValues(_sheetData);
      SheetUI.renderSaveChecks(_sheetData.savingThrows);
      SheetUI.renderSkillProfs(_sheetData.skills);
      SheetUI.renderDeathSaves(_sheetData.deathSaves);
      SheetUI.renderSpellSlots(_sheetData.spellSlots, (lvl) => _sheet.useSpellSlot(lvl), (lvl) => _sheet.restoreSpellSlot(lvl));
      SheetUI.renderAttacks(_sheetData.attacks, _sheetData, (id) => _sheet.removeAttack(id));
      SheetUI.renderCantrips(_sheetData.cantrips, (id) => _sheet.removeCantrip(id));
      SheetUI.renderSpellsByLevel(_sheetData.spells, (lvl, id) => _sheet.removeSpell(lvl, id), (lvl, id) => _sheet.toggleSpellPrepared(lvl, id), (lvl, name) => _sheet.addSpell(lvl, name));
      SheetUI.renderInventory(_sheetData.inventory, (id) => _sheet.removeInventoryItem(id));
    }
  });
}

function _initSheet(uid, charId) {
  if (!charId) return;
  myCurrentCharId = charId;
  _sheet = new CharacterSheet(db, uid, charId);
  _setupSheetListener();
}

function _openCharacterSheet() {
  if (!_sheet) return;
  _sheetReturnView = 'view-combat';
  const backBtn = document.getElementById('btn-back-to-combat');
  if (backBtn) backBtn.textContent = '← Combattimento';
  SheetUI.populateSheet(_sheetData);
  SheetUI.renderSpellSlots(_sheetData?.spellSlots, (lvl) => _sheet.useSpellSlot(lvl), (lvl) => _sheet.restoreSpellSlot(lvl));
  SheetUI.renderAttacks(_sheetData?.attacks, _sheetData, (id) => _sheet.removeAttack(id));
  SheetUI.renderCantrips(_sheetData?.cantrips, (id) => _sheet.removeCantrip(id));
  SheetUI.renderSpellsByLevel(_sheetData?.spells, (lvl, id) => _sheet.removeSpell(lvl, id), (lvl, id) => _sheet.toggleSpellPrepared(lvl, id), (lvl, name) => _sheet.addSpell(lvl, name));
  SheetUI.renderInventory(_sheetData?.inventory, (id) => _sheet.removeInventoryItem(id));
  _bindSheetEvents();
  UI.showView('view-character');
}

async function _openLibrarySheet(charId) {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    myCurrentCharId = charId;
    _sheet = new CharacterSheet(db, uid, charId);
    _sheetData = (await _library.getOne(charId)) || {};
    _setupSheetListener();
    _sheetReturnView = 'view-home';
    const backBtn = document.getElementById('btn-back-to-combat');
    if (backBtn) backBtn.textContent = '← Libreria';
    SheetUI.populateSheet(_sheetData);
    SheetUI.renderSpellSlots(_sheetData?.spellSlots, (lvl) => _sheet.useSpellSlot(lvl), (lvl) => _sheet.restoreSpellSlot(lvl));
    SheetUI.renderAttacks(_sheetData?.attacks, _sheetData, (id) => _sheet.removeAttack(id));
    SheetUI.renderCantrips(_sheetData?.cantrips, (id) => _sheet.removeCantrip(id));
    SheetUI.renderSpellsByLevel(_sheetData?.spells, (lvl, id) => _sheet.removeSpell(lvl, id), (lvl, id) => _sheet.toggleSpellPrepared(lvl, id), (lvl, name) => _sheet.addSpell(lvl, name));
    SheetUI.renderInventory(_sheetData?.inventory, (id) => _sheet.removeInventoryItem(id));
    _bindSheetEvents();
    UI.showView('view-character');
  } catch (err) {
    UI.showError('Errore apertura scheda: ' + err.message);
  }
}

function _bindSheetEvents() {
  const view = document.getElementById('view-character');

  view.querySelectorAll('[data-path]').forEach(el => {
    if (el._sheetBound) return;
    el._sheetBound = true;
    const save = () => {
      const path  = el.dataset.path;
      const value = el.dataset.number !== undefined ? (parseInt(el.value) || 0) : el.value;
      _sheet.setField(path, value);
    };
    el.addEventListener('blur',   save);
    el.addEventListener('change', save);
  });

  view.querySelectorAll('.skill-prof').forEach(btn => {
    if (btn._sheetBound) return;
    btn._sheetBound = true;
    btn.addEventListener('click', () => {
      const skill   = btn.dataset.skill;
      const current = parseInt(btn.dataset.level ?? '0');
      _sheet.setSkill(skill, (current + 1) % 3);
    });
  });

  view.querySelectorAll('.save-check').forEach(btn => {
    if (btn._sheetBound) return;
    btn._sheetBound = true;
    btn.addEventListener('click', () => _sheet.toggleSavingThrow(btn.dataset.ability));
  });

  SheetUI.bindDeathSaves((type, count) => {
    _sheet.setField(`deathSaves/${type}`, count);
  });

  const attackForm = document.getElementById('form-add-attack');
  if (attackForm && !attackForm._sheetBound) {
    attackForm._sheetBound = true;
    attackForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('attack-name')?.value.trim();
      if (!name) return;
      await _sheet.addAttack({
        name,
        damageFormula:       document.getElementById('attack-formula')?.value.trim(),
        damageType:          document.getElementById('attack-type')?.value.trim(),
        ability:             document.getElementById('attack-ability')?.value,
        proficient:          document.getElementById('attack-proficient')?.checked,
        attackBonusOverride: document.getElementById('attack-bonus-override')?.value.trim() || null,
        damageBonusOverride: document.getElementById('attack-dmg-override')?.value.trim() || null,
      });
      attackForm.reset();
    });
  }

  const cantripForm = document.getElementById('form-add-cantrip');
  if (cantripForm && !cantripForm._sheetBound) {
    cantripForm._sheetBound = true;
    cantripForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('cantrip-name')?.value.trim();
      if (name) { await _sheet.addCantrip(name); document.getElementById('cantrip-name').value = ''; }
    });
  }

  const itemForm = document.getElementById('form-add-item');
  if (itemForm && !itemForm._sheetBound) {
    itemForm._sheetBound = true;
    itemForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('item-name')?.value.trim();
      if (!name) return;
      await _sheet.addInventoryItem(
        name,
        document.getElementById('item-qty')?.value,
        document.getElementById('item-notes')?.value.trim()
      );
      itemForm.reset();
      document.getElementById('item-qty').value = '1';
    });
  }
}

function _openConditionModal(combatantId, conditionsObj) {
  const active = conditionsObj ? Object.keys(conditionsObj) : [];
  UI.renderConditionModal(
    combatantId,
    active,
    (id, cond) => combatantManager.toggleCondition(id, cond)
  );
}

async function _removeCombatant(id) {
  await session.clearGridPosition(id);
  await combatantManager.remove(id);
}

function _renderGrid(gridPos, combatants, currentTurnId) {
  const container = document.getElementById('grid-container');
  if (!container) return;
  GridUI.renderGrid(
    container,
    gridPos,
    combatants,
    myCombatantId,
    session.isMaster,
    _selectedGridTokenId,
    currentTurnId,
    (id) => {
      _selectedGridTokenId = id;
      if (_snapshot) _renderGrid(_snapshot.grid || {}, _snapshot.combatants || {}, _snapshot.currentTurnId ?? null);
    },
    (id, col, row) => session.setGridPosition(id, col, row)
  );
}

function _updateHomeAuthUI(user) {
  const authPanel   = document.getElementById('auth-panel');
  const homeCards   = document.getElementById('home-cards');
  const userInfoBar = document.getElementById('user-info-bar');
  const displayName = document.getElementById('user-display-name');
  const upgradeBtn  = document.getElementById('btn-upgrade-google');
  const signOutBtn  = document.getElementById('btn-sign-out');
  const libSection  = document.getElementById('character-library-section');
  const prevSection = document.getElementById('character-preview-section');

  if (!user) {
    authPanel?.classList.remove('hidden');
    homeCards?.classList.add('hidden');
    userInfoBar?.classList.add('hidden');
    libSection?.classList.add('hidden');
    prevSection?.classList.add('hidden');
    return;
  }

  authPanel?.classList.add('hidden');
  homeCards?.classList.remove('hidden');
  userInfoBar?.classList.remove('hidden');
  prevSection?.classList.add('hidden');

  if (session.isGoogleUser) {
    if (displayName) displayName.textContent = session.displayName ?? '';
    upgradeBtn?.classList.add('hidden');
    signOutBtn?.classList.remove('hidden');
  } else {
    if (displayName) displayName.textContent = 'Ospite';
    upgradeBtn?.classList.remove('hidden');
    signOutBtn?.classList.add('hidden');
  }

  _library = new CharacterLibrary(db, user.uid);
  _loadUserSessions(user.uid);
  _loadCharacterLibrary();
  _populateJoinPicker();
}

async function _loadCharacterLibrary() {
  const section = document.getElementById('character-library-section');
  const list    = document.getElementById('character-library-list');
  if (!section || !list || !_library) return;

  let chars = {};
  try {
    chars = await _library.getAll();
  } catch {
    list.innerHTML = '<p class="empty-hint">Errore di permessi — aggiungi le regole Firebase per "characters".</p>';
    section.classList.remove('hidden');
    return;
  }
  const entries = Object.entries(chars);

  if (entries.length === 0) {
    list.innerHTML = '<p class="empty-hint">Nessun personaggio. Creane uno!</p>';
  } else {
    list.innerHTML = entries.map(([id, c]) => `
      <div class="char-lib-entry">
        <div class="char-lib-info">
          <span class="char-lib-name">${_esc(c.name)}</span>
          <span class="char-lib-badge ${c.type === 'player' ? 'badge-player' : 'badge-creature'}">${c.type === 'player' ? 'PG' : 'Creatura'}</span>
        </div>
        <div class="char-lib-actions">
          <button class="btn-secondary btn-sm" data-action="open-sheet" data-id="${id}">📜 Apri</button>
          <button class="btn-remove-sm" data-action="delete-char" data-id="${id}" aria-label="Elimina">×</button>
        </div>
      </div>
    `).join('');
  }

  section.classList.remove('hidden');

  list.onclick = (e) => {
    const openBtn = e.target.closest('[data-action="open-sheet"]');
    if (openBtn) { _openLibrarySheet(openBtn.dataset.id); return; }
    const delBtn = e.target.closest('[data-action="delete-char"]');
    if (delBtn) { _deleteLibraryChar(delBtn.dataset.id); }
  };
}

async function _deleteLibraryChar(charId) {
  if (!confirm('Eliminare questo personaggio? I dati della scheda saranno persi.')) return;
  await _library.delete(charId);
  _loadCharacterLibrary();
  _populateJoinPicker();
}

async function _populateJoinPicker() {
  const picker = document.getElementById('join-char-picker');
  const list   = document.getElementById('join-char-list');
  if (!picker || !list || !_library) return;

  let chars = {};
  try { chars = await _library.getAll(); } catch { return; }
  const players = Object.entries(chars).filter(([, c]) => c.type === 'player');

  if (players.length === 0) {
    picker.classList.add('hidden');
    return;
  }

  list.innerHTML = players.map(([id, c]) => `
    <button class="char-pick-btn" data-id="${id}" data-name="${_esc(c.name)}">${_esc(c.name)}</button>
  `).join('');

  list.onclick = (e) => {
    const btn = e.target.closest('.char-pick-btn');
    if (!btn) return;
    _selectedJoinCharId = btn.dataset.id;
    document.getElementById('input-pg-name').value = btn.dataset.name;
    list.querySelectorAll('.char-pick-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  };

  picker.classList.remove('hidden');
}

async function _populateCreaturePicker() {
  const picker = document.getElementById('creature-library-picker');
  const list   = document.getElementById('creature-library-list');
  if (!picker || !list || !_library) return;

  let chars = {};
  try { chars = await _library.getAll(); } catch { return; }
  const creatures = Object.entries(chars).filter(([, c]) => c.type === 'creature');

  if (creatures.length === 0) {
    picker.classList.add('hidden');
    return;
  }

  list.innerHTML = creatures.map(([id, c]) => `
    <button class="char-pick-btn" data-id="${id}" data-name="${_esc(c.name)}">${_esc(c.name)}</button>
  `).join('');

  list.onclick = (e) => {
    const btn = e.target.closest('.char-pick-btn');
    if (!btn) return;
    _selectedCreatureCharId = btn.dataset.id;
    document.getElementById('input-creature-name').value = btn.dataset.name;
    list.querySelectorAll('.char-pick-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  };

  picker.classList.remove('hidden');
}

async function _saveUserSession(uid, code, combatantId, characterName, role, charId = null) {
  await set(ref(db, `userSessions/${uid}/${code}`), {
    combatantId:   combatantId ?? null,
    characterName: characterName ?? null,
    role,
    charId:        charId ?? null,
    lastSeen:      Date.now(),
  });
}

async function _loadUserSessions(uid) {
  const section = document.getElementById('user-sessions-section');
  const list    = document.getElementById('user-sessions-list');
  if (!section || !list) return;

  const snap = await get(ref(db, `userSessions/${uid}`));
  if (!snap.exists()) { section.classList.add('hidden'); return; }

  const entries = Object.entries(snap.val());
  const active  = [];

  await Promise.all(entries.map(async ([code, data]) => {
    const sessionSnap = await get(ref(db, `sessions/${code}`));
    if (sessionSnap.exists()) {
      active.push({ code, ...data });
    } else {
      await remove(ref(db, `userSessions/${uid}/${code}`));
    }
  }));

  active.sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));

  if (active.length === 0) { section.classList.add('hidden'); return; }

  section.classList.remove('hidden');
  list.innerHTML = active.map(s => `
    <div class="session-entry">
      <div class="session-entry-info">
        <span class="session-entry-code">${s.code}</span>
        ${s.characterName ? `<span class="session-entry-char">— ${_esc(s.characterName)}</span>` : ''}
        <span class="session-entry-role">${s.role === 'master' ? '⚔ Master' : '🧙 PG'}</span>
      </div>
      <button class="btn-rejoin btn-secondary btn-sm"
              data-code="${s.code}"
              data-combatant-id="${s.combatantId ?? ''}"
              data-role="${s.role}"
              data-char-id="${s.charId ?? ''}">
        Rientra →
      </button>
    </div>
  `).join('');

  list.onclick = (e) => {
    const btn = e.target.closest('.btn-rejoin');
    if (!btn) return;
    _rejoinSession(btn.dataset.code, btn.dataset.combatantId || null, btn.dataset.role, btn.dataset.charId || null);
  };
}

async function _rejoinSession(code, savedCombatantId, role, savedCharId = null) {
  try {
    const uid = await session.restore(code);
    if (!uid) {
      UI.showError('La sessione non è più disponibile.');
      await remove(ref(db, `userSessions/${uid}/${code}`));
      await _loadUserSessions(myUid || auth.currentUser?.uid);
      return;
    }
    const isMaster = role === 'master';
    if (!isMaster && !savedCombatantId) {
      UI.showError('Non è possibile recuperare il personaggio.');
      return;
    }
    myUid         = uid;
    myCombatantId = savedCombatantId || null;
    localStorage.setItem('dnd_session_code', code);
    if (savedCombatantId) localStorage.setItem('dnd_combatant_id', savedCombatantId);
    _initCombatManagers(code);
    if (!isMaster) _initSheet(uid, savedCharId);
    _enterCombatView(code, isMaster);
  } catch (err) {
    UI.showError('Errore nel rientro: ' + err.message);
  }
}

function _esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Avvio ────────────────────────────────────────────────────────────────────

(async () => {
  try {
    await session.ensureAuth();
  } catch { /* nessun auth state — gestito come non autenticato */ }
  _updateHomeAuthUI(auth.currentUser);

  const savedCode        = localStorage.getItem('dnd_session_code');
  const savedCombatantId = localStorage.getItem('dnd_combatant_id');
  if (!savedCode) return;

  try {
    const uid = await session.restore(savedCode);
    if (!uid) {
      localStorage.removeItem('dnd_session_code');
      localStorage.removeItem('dnd_combatant_id');
      return;
    }

    if (!session.isMaster && !savedCombatantId) {
      localStorage.removeItem('dnd_session_code');
      return;
    }

    // Recupera charId dalla sessione salvata
    let savedCharId = null;
    const userSessionSnap = await get(ref(db, `userSessions/${uid}/${savedCode}`));
    if (userSessionSnap.exists()) savedCharId = userSessionSnap.val().charId ?? null;

    myUid         = uid;
    myCombatantId = savedCombatantId;
    _initCombatManagers(savedCode);
    if (!session.isMaster) _initSheet(uid, savedCharId);
    _enterCombatView(savedCode, session.isMaster);
  } catch {
    localStorage.removeItem('dnd_session_code');
    localStorage.removeItem('dnd_combatant_id');
  }
})();
