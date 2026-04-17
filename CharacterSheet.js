import {
  ref, set, get, push, remove, onValue, runTransaction
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

export class CharacterSheet {
  constructor(db, uid) {
    this._db  = db;
    this._uid = uid;
  }

  _ref(path = '') {
    const base = `sheets/${this._uid}`;
    return ref(this._db, path ? `${base}/${path}` : base);
  }

  listen(callback) {
    return onValue(this._ref(), callback);
  }

  async setField(path, value) {
    await set(this._ref(path), value === '' ? null : value);
  }

  async setAbility(name, score) {
    await set(this._ref(`abilities/${name}`), parseInt(score) || 10);
  }

  async setSkill(name, level) {
    await set(this._ref(`skills/${name}`), parseInt(level) || 0);
  }

  async toggleSavingThrow(ability) {
    await runTransaction(
      this._ref(`savingThrows/${ability}`),
      (current) => !current
    );
  }

  async useSpellSlot(level) {
    const maxSnap = await get(this._ref(`spellSlots/${level}/max`));
    const max = maxSnap.val() ?? 0;
    await runTransaction(
      this._ref(`spellSlots/${level}/used`),
      (current) => Math.min(max, (current ?? 0) + 1)
    );
  }

  async restoreSpellSlot(level) {
    await runTransaction(
      this._ref(`spellSlots/${level}/used`),
      (current) => Math.max(0, (current ?? 0) - 1)
    );
  }

  async addCantrip(name) {
    const newRef = push(this._ref('cantrips'));
    await set(newRef, name.trim());
    return newRef.key;
  }

  async removeCantrip(id) {
    await remove(this._ref(`cantrips/${id}`));
  }

  async addSpell(level, name, prepared = false) {
    const newRef = push(this._ref(`spells/${level}`));
    await set(newRef, { name: name.trim(), prepared });
    return newRef.key;
  }

  async removeSpell(level, id) {
    await remove(this._ref(`spells/${level}/${id}`));
  }

  async toggleSpellPrepared(level, id) {
    await runTransaction(
      this._ref(`spells/${level}/${id}/prepared`),
      (current) => !current
    );
  }

  async addInventoryItem(name, qty = 1, notes = '') {
    const newRef = push(this._ref('inventory'));
    await set(newRef, { name: name.trim(), quantity: parseInt(qty) || 1, notes: notes.trim() });
    return newRef.key;
  }

  async removeInventoryItem(id) {
    await remove(this._ref(`inventory/${id}`));
  }

  async addAttack(attackData) {
    const newRef = push(this._ref('attacks'));
    await set(newRef, {
      name:                attackData.name.trim(),
      damageFormula:       attackData.damageFormula?.trim() || '',
      damageType:          attackData.damageType?.trim() || '',
      ability:             attackData.ability || 'str',
      proficient:          !!attackData.proficient,
      attackBonusOverride: attackData.attackBonusOverride?.trim() || null,
      damageBonusOverride: attackData.damageBonusOverride?.trim() || null,
    });
    return newRef.key;
  }

  async removeAttack(id) {
    await remove(this._ref(`attacks/${id}`));
  }
}
