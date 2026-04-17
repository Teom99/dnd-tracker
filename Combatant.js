import {
  ref, set, get, push, remove, runTransaction
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

export class Combatant {
  constructor(db, sessionCode) {
    this._db   = db;
    this._code = sessionCode;
  }

  _ref(path = '') {
    const base = `sessions/${this._code}/combatants`;
    return ref(this._db, path ? `${base}/${path}` : base);
  }

  async add(name, initiative, hpMax, type, ownerUid) {
    const newRef = push(this._ref());
    await set(newRef, {
      name,
      initiative: parseInt(initiative) || 0,
      hpMax:      parseInt(hpMax)      || 1,
      hpCurrent:  parseInt(hpMax)      || 1,
      type,
      conditions: {},
      ownerUid
    });
    return newRef.key;
  }

  async updateHp(id, delta) {
    const hpMaxSnap = await get(ref(this._db, `sessions/${this._code}/combatants/${id}/hpMax`));
    const hpMax = hpMaxSnap.val() ?? 0;

    await runTransaction(
      ref(this._db, `sessions/${this._code}/combatants/${id}/hpCurrent`),
      (current) => Math.max(0, Math.min(hpMax, (current ?? 0) + delta))
    );
  }

  async setInitiative(id, initiative) {
    await set(ref(this._db, `sessions/${this._code}/combatants/${id}/initiative`), parseInt(initiative) || 0);
  }

  async toggleCondition(id, condition) {
    await runTransaction(
      ref(this._db, `sessions/${this._code}/combatants/${id}/conditions/${condition}`),
      (current) => (current ? null : true)
    );
  }

  async setHealthHint(id, visible) {
    await set(ref(this._db, `sessions/${this._code}/combatants/${id}/showHealthHint`), visible);
  }

  async setArmorClass(id, ac) {
    await set(ref(this._db, `sessions/${this._code}/combatants/${id}/armorClass`), parseInt(ac) || 0);
  }

  async setAction(id, text) {
    await set(ref(this._db, `sessions/${this._code}/combatants/${id}/currentAction`), text || null);
  }

  async remove(id) {
    await remove(this._ref(id));
  }

  async removeAll() {
    await set(this._ref(), {});
  }
}
