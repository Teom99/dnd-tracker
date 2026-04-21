import * as SheetUI      from './SheetUI.js';
import * as UI           from './UI.js';
import { CharacterSheet } from './CharacterSheet.js';
import { state }          from './state.js';
import { openConditionModal, removeCombatant } from './core.js';

export async function onDeathSave(type, count) {
  if (!state.sheet) return;
  await state.sheet.setField(`deathSaves/${type}`, count);
  if (type === 'successes' && count >= 3) {
    await state.combatantManager.updateHp(state.myCombatantId, 1);
    await state.sheet.setField('deathSaves/successes', 0);
    await state.sheet.setField('deathSaves/failures', 0);
  }
}

export function setupSheetListener() {
  if (!state.sheet) return;
  let populated = false;
  let prevAc    = undefined;
  let prevHpMax = undefined;
  state.sheet.listen((snap) => {
    state.sheetData = snap.val() || {};

    // Sincronizza AC al combattente solo se effettivamente cambiata
    const ac = state.sheetData.armorClass ?? null;
    if (ac !== null && ac !== prevAc && state.myCombatantId) {
      prevAc = ac;
      state.acMap[state.myUid] = ac;
      state.combatantManager.setArmorClass(state.myCombatantId, ac);
    }

    // Sincronizza hpMax al combattente solo se cambiato e > 0
    const hpMax = state.sheetData.hpMax ?? null;
    if (hpMax !== null && hpMax > 0 && hpMax !== prevHpMax && state.myCombatantId) {
      prevHpMax = hpMax;
      state.combatantManager.setMaxHp(state.myCombatantId, hpMax);
    }

    // Re-render lista combattenti subito per aggiornare death saves senza aspettare il prossimo snapshot sessione
    const combatView = document.getElementById('view-combat');
    if (combatView && !combatView.classList.contains('hidden') && state.snapshot) {
      _renderCombatantLists();
    }

    if (!populated) {
      populated = true;
      SheetUI.populateSheet(state.sheetData);
      bindSheetEvents();
    }
    SheetUI.updateComputedValues(state.sheetData);
    SheetUI.renderSaveChecks(state.sheetData.savingThrows);
    SheetUI.renderSkillProfs(state.sheetData.skills);
    SheetUI.renderDeathSaves(state.sheetData.deathSaves);
    SheetUI.renderSpellSlots(state.sheetData.spellSlots, (lvl, count) => state.sheet.setSpellSlotsUsed(lvl, count), (lvl, val) => state.sheet.setSpellSlotsMax(lvl, val));
    SheetUI.renderAttacks(state.sheetData.attacks, state.sheetData, (id) => state.sheet.removeAttack(id));
    SheetUI.renderCantrips(state.sheetData.cantrips, (id) => state.sheet.removeCantrip(id));
    SheetUI.renderSpellsByLevel(state.sheetData.spells, (lvl, id) => state.sheet.removeSpell(lvl, id), (lvl, id) => state.sheet.toggleSpellPrepared(lvl, id), (lvl, name) => state.sheet.addSpell(lvl, name));
    SheetUI.renderInventory(state.sheetData.inventory);
  });
}

function _renderCombatantLists() {
  const sorted2    = state.tracker.sortedCombatants(state.snapshot.combatants);
  const creatures2 = sorted2.filter(c => c.type === 'creature');
  const players2   = sorted2.filter(c => c.type === 'player');
  const cb = _makeCallbacks();
  UI.renderCombatantList(creatures2, state.snapshot.currentTurnId ?? null, state.myUid, state.session.masterUid, cb, state.acMap, null,                               'creature-list', 'empty-creatures-msg', sorted2);
  UI.renderCombatantList(players2,   state.snapshot.currentTurnId ?? null, state.myUid, state.session.masterUid, cb, state.acMap, state.sheetData?.deathSaves ?? null, 'player-list',   'empty-players-msg', sorted2);
}

function _makeCallbacks() {
  return {
    onEndTurn:          async ()                          => { const s = state.tracker.sortedCombatants(state.snapshot.combatants); await state.tracker.nextTurn(s); },
    onRemove:           (id)                              => removeCombatant(id),
    onInitiativeChange: (id, val)                         => state.combatantManager.setInitiative(id, val),
    onOpenConditions:   (id)                              => openConditionModal(id, state.snapshot.combatants?.[id]?.conditions),
    onSetAction:        (id, text)                        => state.combatantManager.setAction(id, text),
    onApplyToTarget:    async (sourceId, targetId, delta) => {
      const actor  = state.snapshot.combatants?.[sourceId]?.name ?? 'Qualcuno';
      const target = state.snapshot.combatants?.[targetId]?.name ?? 'bersaglio';
      const amount = Math.abs(delta);
      await state.combatantManager.updateHp(targetId, delta);
      await state.session.addActionLog({ actor, target, action: delta < 0 ? 'ha colpito' : 'ha curato', amount, type: delta < 0 ? 'damage' : 'heal' });
    },
    onToggleHealthHint: (id, current)                     => state.combatantManager.setHealthHint(id, !current),
    onSetMaxHp:         (id, val)                         => state.combatantManager.setMaxHp(id, val),
    onOpenSheet:        ()                                => openCharacterSheet(),
    onDeathSave:        async (type, count)               => onDeathSave(type, count),
  };
}

export function makeCallbacks() {
  return _makeCallbacks();
}

export function initSheet(uid, charId) {
  if (!charId) return;
  state.myCurrentCharId = charId;
  state.sheet = new CharacterSheet(state.db, uid, charId);
  document.body.classList.add('has-sheet');
  setupSheetListener();
}

export function isSheetEmbedded() {
  return window.matchMedia('(min-width: 1100px)').matches && document.body.classList.contains('has-sheet');
}

export function openCharacterSheet() {
  if (!state.sheet) return;
  state.sheetReturnView = 'view-combat';
  SheetUI.populateSheet(state.sheetData);
  SheetUI.renderSpellSlots(state.sheetData?.spellSlots, (lvl, count) => state.sheet.setSpellSlotsUsed(lvl, count), (lvl, val) => state.sheet.setSpellSlotsMax(lvl, val));
  SheetUI.renderAttacks(state.sheetData?.attacks, state.sheetData, (id) => state.sheet.removeAttack(id));
  SheetUI.renderCantrips(state.sheetData?.cantrips, (id) => state.sheet.removeCantrip(id));
  SheetUI.renderSpellsByLevel(state.sheetData?.spells, (lvl, id) => state.sheet.removeSpell(lvl, id), (lvl, id) => state.sheet.toggleSpellPrepared(lvl, id), (lvl, name) => state.sheet.addSpell(lvl, name));
  SheetUI.renderInventory(state.sheetData?.inventory);
  bindSheetEvents();
  if (!isSheetEmbedded()) {
    document.body.classList.add('sheet-only');
    UI.showView('view-combat');
  }
}

export async function openLibrarySheet(charId) {
  try {
    const uid = state.auth.currentUser?.uid;
    if (!uid) return;
    state.myCurrentCharId = charId;
    state.sheet = new CharacterSheet(state.db, uid, charId);
    state.sheetData = (await state.library.getOne(charId)) || {};
    setupSheetListener();
    state.sheetReturnView = 'view-home';
    document.body.classList.add('has-sheet', 'sheet-only');
    SheetUI.populateSheet(state.sheetData);
    SheetUI.renderSpellSlots(state.sheetData?.spellSlots, (lvl, count) => state.sheet.setSpellSlotsUsed(lvl, count), (lvl, val) => state.sheet.setSpellSlotsMax(lvl, val));
    SheetUI.renderAttacks(state.sheetData?.attacks, state.sheetData, (id) => state.sheet.removeAttack(id));
    SheetUI.renderCantrips(state.sheetData?.cantrips, (id) => state.sheet.removeCantrip(id));
    SheetUI.renderSpellsByLevel(state.sheetData?.spells, (lvl, id) => state.sheet.removeSpell(lvl, id), (lvl, id) => state.sheet.toggleSpellPrepared(lvl, id), (lvl, name) => state.sheet.addSpell(lvl, name));
    SheetUI.renderInventory(state.sheetData?.inventory);
    bindSheetEvents();
    UI.showView('view-combat');
  } catch (err) {
    UI.showError('Errore apertura scheda: ' + err.message);
  }
}

export function bindSheetEvents() {
  const view = document.getElementById('view-character');

  view.querySelectorAll('[data-path]').forEach(el => {
    if (el._sheetBound) return;
    el._sheetBound = true;
    const save = () => {
      const path  = el.dataset.path;
      const value = el.dataset.number !== undefined ? (parseInt(el.value) || 0) : el.value;
      state.sheet.setField(path, value);
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
      state.sheet.setSkill(skill, (current + 1) % 3);
    });
  });

  view.querySelectorAll('.save-check').forEach(btn => {
    if (btn._sheetBound) return;
    btn._sheetBound = true;
    btn.addEventListener('click', () => state.sheet.toggleSavingThrow(btn.dataset.ability));
  });

  SheetUI.bindDeathSaves((type, count) => {
    state.sheet.setField(`deathSaves/${type}`, count);
  });

  const attackForm = document.getElementById('form-add-attack');
  if (attackForm && !attackForm._sheetBound) {
    attackForm._sheetBound = true;
    attackForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('attack-name')?.value.trim();
      if (!name) return;
      await state.sheet.addAttack({
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
      if (name) { await state.sheet.addCantrip(name); document.getElementById('cantrip-name').value = ''; }
    });
  }

  const itemForm = document.getElementById('form-add-item');
  if (itemForm && !itemForm._sheetBound) {
    itemForm._sheetBound = true;
    itemForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameEl = document.getElementById('item-name');
      const qtyEl  = document.getElementById('item-qty');
      const noteEl = document.getElementById('item-notes');
      
      const name = nameEl?.value.trim();
      if (!name) return;
      
      try {
        const qty = qtyEl?.value;
        const notes = noteEl?.value.trim() || '';
        await state.sheet.addInventoryItem(name, qty, notes);
        if (nameEl) nameEl.value = '';
        if (qtyEl)  qtyEl.value  = '1';
        if (noteEl) noteEl.value = '';
        nameEl?.focus();
      } catch (err) {
        UI.showError('Errore aggiunta oggetto: ' + err.message);
      }
    });
  }

  const inventoryList = document.getElementById('inventory-list');
  if (inventoryList && !inventoryList._sheetBound) {
    inventoryList._sheetBound = true;
    inventoryList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="remove-item"]');
      if (btn) state.sheet.removeInventoryItem(btn.dataset.id);
    });
  }
}
