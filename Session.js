import { ref, set, get, onValue } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

export class Session {
  constructor(db, auth) {
    this._db   = db;
    this._auth = auth;
    this.code      = null;
    this.masterUid = null;
  }

  get isMaster() {
    return this._auth.currentUser?.uid === this.masterUid;
  }

  get currentUid() {
    return this._auth.currentUser?.uid ?? null;
  }

  async create() {
    const { user } = await signInAnonymously(this._auth);
    const code = this._generateCode();

    await set(ref(this._db, `sessions/${code}`), {
      masterUid:      user.uid,
      round:          1,
      currentTurnId:  null,
      combatants:     {}
    });

    this.code      = code;
    this.masterUid = user.uid;
    localStorage.setItem('dnd_session_code', code);
    return code;
  }

  async join(code) {
    const { user } = await signInAnonymously(this._auth);
    const snap = await get(ref(this._db, `sessions/${code}`));
    if (!snap.exists()) throw new Error('Sessione non trovata. Controlla il codice.');

    this.code      = code;
    this.masterUid = snap.val().masterUid;
    localStorage.setItem('dnd_session_code', code);
    return user.uid;
  }

  // Tenta di ripristinare una sessione salvata in localStorage (es. dopo un refresh).
  // Ritorna l'UID dell'utente se la sessione esiste ancora, altrimenti false.
  async restore(code) {
    const { user } = await signInAnonymously(this._auth);
    const snap = await get(ref(this._db, `sessions/${code}`));
    if (!snap.exists()) return false;

    this.code      = code;
    this.masterUid = snap.val().masterUid;
    return user.uid;
  }

  listen(callback) {
    return onValue(ref(this._db, `sessions/${this.code}`), callback);
  }

  async setRound(round) {
    await set(ref(this._db, `sessions/${this.code}/round`), round);
  }

  async setCurrentTurnId(id) {
    await set(ref(this._db, `sessions/${this.code}/currentTurnId`), id ?? null);
  }

  _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
}
