import {
  ref, set, get, push, remove, onValue, runTransaction
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

export class CharacterSheet {
  constructor(db, uid, charId) {
    this._db     = db;
    this._uid    = uid;
    this._charId = charId;
  }

  _ref(path = '') {
    const base = `characters/${this._uid}/${this._charId}`;
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

  async setSpellSlotsUsed(level, count) {
    await runTransaction(this._ref(`spellSlots/${level}`), (current) => {
      const node = current ?? {};
      const max  = node.max ?? 0;
      return { ...node, used: Math.max(0, Math.min(max, count)) };
    });
  }

  async setSpellSlotsMax(level, max) {
    await runTransaction(this._ref(`spellSlots/${level}`), (current) => {
      const node    = current ?? {};
      const newMax  = Math.max(0, Math.min(9, max));
      const newUsed = Math.min(node.used ?? 0, newMax);
      return { ...node, max: newMax, used: newUsed };
    });
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

  async addClassFeature(name, description, level) {
    const newRef = push(this._ref('classFeatures'));
    await set(newRef, { name: name.trim(), description: (description ?? '').trim(), level: level ?? 1 });
    return newRef.key;
  }

  async updateClassFeature(id, name, description) {
    await set(this._ref(`classFeatures/${id}`), { name: name.trim(), description: (description ?? '').trim() });
  }

  async removeClassFeature(id) {
    await remove(this._ref(`classFeatures/${id}`));
  }

  async addClassStat(label, value) {
    const newRef = push(this._ref('classStats'));
    await set(newRef, { label: label.trim(), value: String(value ?? '') });
    return newRef.key;
  }

  async removeClassStat(id) {
    await remove(this._ref(`classStats/${id}`));
  }
}
