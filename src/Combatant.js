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

  async add(name, initiative, hpMax, type, ownerUid, charId = null, armorClass = null, monsterApiIndex = null, size = 'medium') {
    const newRef = push(this._ref());
    const data = {
      name,
      initiative: parseInt(initiative) || 0,
      hpMax:      parseInt(hpMax)      || 1,
      hpCurrent:  parseInt(hpMax)      || 1,
      type,
      conditions: {},
      ownerUid,
      faction: 'evil',
      charId: charId ?? null,
      size: size || 'medium',
    };
    if (armorClass !== null && armorClass !== '') data.armorClass = parseInt(armorClass) || 0;
    if (monsterApiIndex) data.monsterApiIndex = monsterApiIndex;
    await set(newRef, data);
    return newRef.key;
  }

  async updateHp(id, delta) {
    await runTransaction(
      ref(this._db, `sessions/${this._code}/combatants/${id}`),
      (current) => {
        if (current == null) return current;
        const hpMax = current.hpMax ?? 1;
        if (delta < 0) {
          const dmg      = -delta;
          const temp     = current.tempHp ?? 0;
          const absorbed = Math.min(temp, dmg);
          current.tempHp    = temp - absorbed;
          current.hpCurrent = Math.max(0, (current.hpCurrent ?? hpMax) - (dmg - absorbed));
        } else {
          current.hpCurrent = Math.max(0, Math.min(hpMax, (current.hpCurrent ?? hpMax) + delta));
        }
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

  async setShowAC(id, visible) {
    await set(ref(this._db, `sessions/${this._code}/combatants/${id}/showAC`), visible);
  }

  async setArmorClass(id, ac) {
    await set(ref(this._db, `sessions/${this._code}/combatants/${id}/armorClass`), parseInt(ac) || 0);
  }

  async setSize(id, size) {
    const valid = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];
    const s = valid.includes(size) ? size : 'medium';
    await set(ref(this._db, `sessions/${this._code}/combatants/${id}/size`), s);
  }

  async setLevel(id, level) {
    await set(ref(this._db, `sessions/${this._code}/combatants/${id}/level`), parseInt(level) || 1);
  }

  async setSpeed(id, speed) {
    await set(ref(this._db, `sessions/${this._code}/combatants/${id}/speed`), Math.max(0, parseInt(speed) || 0));
  }

  async setName(id, name) {
    await set(ref(this._db, `sessions/${this._code}/combatants/${id}/name`), name || '');
  }

  async setFaction(id, faction) {
    await set(ref(this._db, `sessions/${this._code}/combatants/${id}/faction`), faction || 'evil');
  }

  async setAction(id, text) {
    await set(ref(this._db, `sessions/${this._code}/combatants/${id}/currentAction`), text || null);
  }

  async setTempHp(id, val) {
    const hp = Math.max(0, parseInt(val) || 0);
    await runTransaction(
      ref(this._db, `sessions/${this._code}/combatants/${id}`),
      (current) => {
        if (current == null) return current;
        current.tempHp = hp;
        return current;
      }
    );
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
