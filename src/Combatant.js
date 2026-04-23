import {
  ref, set, get, push, remove, runTransaction, query, orderByChild, equalTo
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

  async add(name, initiative, hpMax, type, ownerUid, charId = null) {
    const newRef = push(this._ref());
    await set(newRef, {
      name,
      initiative: parseInt(initiative) || 0,
      hpMax:      parseInt(hpMax)      || 1,
      hpCurrent:  parseInt(hpMax)      || 1,
      type,
      conditions: {},
      ownerUid,
      charId: charId ?? null,
    });
    return newRef.key;
  }

  async updateHp(id, delta) {
    await runTransaction(
      ref(this._db, `sessions/${this._code}/combatants/${id}`),
      (current) => {
        if (current == null) return current; // abort se il nodo non esiste
        const hpMax = current.hpMax ?? 1;
        current.hpCurrent = Math.max(0, Math.min(hpMax, (current.hpCurrent ?? hpMax) + delta));
        return current;
      }
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

  async setLevel(id, level) {
    await set(ref(this._db, `sessions/${this._code}/combatants/${id}/level`), parseInt(level) || 1);
  }

  async setAction(id, text) {
    await set(ref(this._db, `sessions/${this._code}/combatants/${id}/currentAction`), text || null);
  }

  async setMaxHp(id, val) {
    const hp = Math.max(1, parseInt(val) || 1);
    await set(ref(this._db, `sessions/${this._code}/combatants/${id}/hpMax`), hp);
    // Cap current HP to new max
    await runTransaction(
      ref(this._db, `sessions/${this._code}/combatants/${id}/hpCurrent`),
      (current) => Math.min(current ?? 0, hp)
    );
  }

  async findByOwner(uid) {
    const q    = query(this._ref(), orderByChild('ownerUid'), equalTo(uid));
    const snap = await get(q);
    if (!snap.exists()) return null;
    const entries = Object.entries(snap.val());
    // Restituisce solo i PG (non creature), prende il primo trovato
    const pg = entries.find(([, v]) => v.type === 'player');
    if (!pg) return null;
    return { id: pg[0], ...pg[1] };
  }

  async remove(id) {
    await remove(this._ref(id));
  }

  async removeAll() {
    await set(this._ref(), {});
  }
}
