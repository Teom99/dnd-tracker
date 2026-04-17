import { initializeApp }  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase }    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { getAuth }        from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

import { FIREBASE_CONFIG } from './config.js';
import { Session }         from './Session.js';
import { Combatant }       from './Combatant.js';
import { CombatTracker }   from './CombatTracker.js';
import { CharacterSheet }  from './CharacterSheet.js';
import * as UI             from './UI.js';
import * as SheetUI        from './SheetUI.js';

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
let _sheet           = null;   // CharacterSheet instance (solo per giocatori)
let _sheetData       = null;   // ultimo snapshot sheets/{uid}
let _acMap           = {};     // { uid: armorClass } — alimentato da _sheetData dei propri PG

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
    _initSheet(myUid);

    // Controlla se esiste già un PG di questo utente nella sessione
    const existing = await combatantManager.findByOwner(myUid);
    if (existing) {
      const rejoin = confirm(
        `Sei già presente in questa sessione con il personaggio "${existing.name}".\n\n` +
        `OK → Rientra con "${existing.name}"\n` +
        `Annulla → Rimuovi il vecchio e crea "${name}"`
      );
      if (rejoin) {
        myCombatantId = existing.id;
      } else {
        await combatantManager.remove(existing.id);
        myCombatantId = await combatantManager.add(name, initiative, hp, 'player', myUid);
      }
    } else {
      myCombatantId = await combatantManager.add(name, initiative, hp, 'player', myUid);
    }

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

// ─── COMBAT: Esci dalla sessione ─────────────────────────────────────────────

document.getElementById('btn-exit-session').addEventListener('click', () => {
  if (!confirm('Sei sicuro di voler uscire dalla sessione?')) return;
  _exitToHome();
});

// ─── SCHEDA: Torna al combattimento ──────────────────────────────────────────

document.getElementById('btn-back-to-combat').addEventListener('click', () => {
  UI.showView('view-combat');
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
  _sheetData    = null;
  _acMap        = {};
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
      onOpenSheet:          ()               => _openCharacterSheet(),
    }, _acMap);
  });
}

function _initSheet(uid) {
  _sheet = new CharacterSheet(db, uid);
  _sheet.listen((snap) => {
    _sheetData = snap.val() || {};
    // Sync AC to combat card display
    const ac = _sheetData.armorClass ?? null;
    if (ac !== null) {
      _acMap[uid] = ac;
      // Also sync to the combatant node so others can see it
      if (myCombatantId) combatantManager.setArmorClass(myCombatantId, ac);
    }
    // If sheet view is open, update computed values
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

function _openCharacterSheet() {
  if (!_sheet) return;
  SheetUI.populateSheet(_sheetData);
  SheetUI.renderSpellSlots(_sheetData?.spellSlots, (lvl) => _sheet.useSpellSlot(lvl), (lvl) => _sheet.restoreSpellSlot(lvl));
  SheetUI.renderAttacks(_sheetData?.attacks, _sheetData, (id) => _sheet.removeAttack(id));
  SheetUI.renderCantrips(_sheetData?.cantrips, (id) => _sheet.removeCantrip(id));
  SheetUI.renderSpellsByLevel(_sheetData?.spells, (lvl, id) => _sheet.removeSpell(lvl, id), (lvl, id) => _sheet.toggleSpellPrepared(lvl, id), (lvl, name) => _sheet.addSpell(lvl, name));
  SheetUI.renderInventory(_sheetData?.inventory, (id) => _sheet.removeInventoryItem(id));
  _bindSheetEvents();
  UI.showView('view-character');
}

function _bindSheetEvents() {
  const view = document.getElementById('view-character');

  // Generic blur-save for all [data-path] inputs/textareas/selects
  view.querySelectorAll('[data-path]').forEach(el => {
    if (el._sheetBound) return;
    el._sheetBound = true;
    const save = () => {
      const path  = el.dataset.path;
      const value = el.dataset.number !== undefined ? (parseInt(el.value) || 0) : el.value;
      _sheet.setField(path, value);
    };
    el.addEventListener('blur',    save);
    el.addEventListener('change',  save);
  });

  // Spell slot max inputs (blur handled above via data-path)

  // Skill proficiency cycle buttons
  view.querySelectorAll('.skill-prof').forEach(btn => {
    if (btn._sheetBound) return;
    btn._sheetBound = true;
    btn.addEventListener('click', () => {
      const skill = btn.dataset.skill;
      const current = parseInt(btn.dataset.level ?? '0');
      _sheet.setSkill(skill, (current + 1) % 3);
    });
  });

  // Saving throw toggle
  view.querySelectorAll('.save-check').forEach(btn => {
    if (btn._sheetBound) return;
    btn._sheetBound = true;
    btn.addEventListener('click', () => _sheet.toggleSavingThrow(btn.dataset.ability));
  });

  // Death save pips
  SheetUI.bindDeathSaves((type, count) => {
    _sheet.setField(`deathSaves/${type}`, count);
  });

  // Add attack form
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

  // Add cantrip form
  const cantripForm = document.getElementById('form-add-cantrip');
  if (cantripForm && !cantripForm._sheetBound) {
    cantripForm._sheetBound = true;
    cantripForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('cantrip-name')?.value.trim();
      if (name) { await _sheet.addCantrip(name); document.getElementById('cantrip-name').value = ''; }
    });
  }

  // Add inventory item form
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
    if (!session.isMaster) _initSheet(uid);
    _enterCombatView(savedCode, session.isMaster);
  } catch {
    localStorage.removeItem('dnd_session_code');
    localStorage.removeItem('dnd_combatant_id');
  }
})();
