import {
  ref, set, get, remove, runTransaction
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

export class Ship {
  constructor(db, sessionCode) {
    this._db   = db;
    this._code = sessionCode;
  }

  _ref(path = '') {
    const base = `sessions/${this._code}/ship`;
    return ref(this._db, path ? `${base}/${path}` : base);
  }

  async init() {
    const snap = await get(this._ref());
    if (snap.exists()) return;
    await set(this._ref(), {
      hp:      200,
      hpMax:   200,
      weapons: {
        ballista: { state: 'ready' },
        mangonel: { state: 'ready' },
      },
    });
  }

  async updateHp(delta) {
    await runTransaction(this._ref(), (current) => {
      if (current == null) return current;
      const hpMax = current.hpMax ?? 200;
      current.hp = Math.max(0, Math.min(hpMax, (current.hp ?? hpMax) + delta));
      return current;
    });
  }

  async setHpMax(val) {
    const hp = Math.max(1, parseInt(val) || 1);
    await set(this._ref('hpMax'), hp);
    await runTransaction(this._ref('hp'), (current) => Math.min(current ?? 0, hp));
  }

  async setWeaponState(weaponId, state) {
    await set(this._ref(`weapons/${weaponId}/state`), state);
  }

  async toggleCrewMember(weaponId, combatantId) {
    await runTransaction(
      this._ref(`weapons/${weaponId}/crewIds/${combatantId}`),
      (current) => (current ? null : true)
    );
  }

  async setTokenPosition(combatantId, deck, col, row) {
    await set(this._ref(`tokens/${combatantId}`), { deck, col, row });
  }

  async removeToken(combatantId) {
    await remove(this._ref(`tokens/${combatantId}`));
  }

  async setRoomOverride(deck, roomId, field, value) {
    await set(this._ref(`rooms/${deck}/${roomId}/${field}`), value || null);
  }
}
