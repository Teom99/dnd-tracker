import {
  ref, set, get, push, remove, onValue
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { CharacterSheet } from './CharacterSheet.js';

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

  async createWithData(name, type, initialData) {
    const charId = await this.create(name, type);
    const sheet  = new CharacterSheet(this._db, this._uid, charId);
    await sheet.setField('characterName', name);
    await sheet.setField('class', initialData.className ?? '');
    if (initialData.subclass) await sheet.setField('subclass', initialData.subclass);
    await sheet.setField('level', initialData.level ?? 1);
    await sheet.setField('hpMax', initialData.hpMax ?? 1);
    await sheet.setField('proficiencyBonus', initialData.profBonus ?? 2);
    if (initialData.hitDiceType) await sheet.setField('hitDiceType', initialData.hitDiceType);
    for (const [slot, max] of Object.entries(initialData.spellSlots ?? {}))
      await sheet.setField(`spellSlots/${slot}/max`, max);
    for (const { name: fn, description: fd, level: fl } of initialData.features ?? [])
      await sheet.addClassFeature(fn, fd, fl);
    for (const { label, value } of initialData.stats ?? [])
      await sheet.addClassStat(label, value);
    return charId;
  }
}
