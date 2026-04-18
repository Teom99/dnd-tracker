import {
  ref, set, get, push, remove, onValue
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

export class CharacterLibrary {
  constructor(db, uid) {
    this._db  = db;
    this._uid = uid;
  }

  _ref(path = '') {
    const base = `characters/${this._uid}`;
    return ref(this._db, path ? `${base}/${path}` : base);
  }

  async create(name, type = 'player') {
    const newRef = push(this._ref());
    await set(newRef, { name: name.trim(), type });
    return newRef.key;
  }

  async delete(charId) {
    await remove(this._ref(charId));
  }

  async getAll() {
    const snap = await get(this._ref());
    return snap.val() ?? {};
  }

  listen(callback) {
    return onValue(this._ref(), callback);
  }

  async getOne(charId) {
    const snap = await get(this._ref(charId));
    return snap.val();
  }
}
