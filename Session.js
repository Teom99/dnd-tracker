import { ref, set, get, onValue } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import {
  signInAnonymously, signInWithPopup, GoogleAuthProvider
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

export class Session {
  constructor(db, auth) {
    this._db       = db;
    this._auth     = auth;
    this._provider = new GoogleAuthProvider();
    this.code      = null;
    this.masterUid = null;
  }

  get isMaster()     { return this._auth.currentUser?.uid === this.masterUid; }
  get currentUid()   { return this._auth.currentUser?.uid ?? null; }
  get isGoogleUser() { return this._auth.currentUser?.providerData[0]?.providerId === 'google.com'; }
  get displayName()  { return this._auth.currentUser?.displayName ?? null; }

  // ─── Auth ────────────────────────────────────────────────────────────────────

  async ensureAuth() {
    await this._auth.authStateReady();
    return this._auth.currentUser;
  }

  async signInWithGoogle() {
    const { user } = await signInWithPopup(this._auth, this._provider);
    return user;
  }

  async signInAnonymous() {
    const { user } = await signInAnonymously(this._auth);
    return user;
  }

  async signOut() {
    await this._auth.signOut();
  }

  // ─── Session lifecycle ───────────────────────────────────────────────────────

  async create() {
    // Assume currentUser già autenticato (garantito da app.js prima di chiamare create)
    const uid  = this._auth.currentUser.uid;
    const code = this._generateCode();

    await set(ref(this._db, `sessions/${code}`), {
      masterUid:     uid,
      round:         1,
      currentTurnId: null,
      combatants:    {}
    });

    this.code      = code;
    this.masterUid = uid;
    localStorage.setItem('dnd_session_code', code);
    return code;
  }

  async join(code) {
    // Assume currentUser già autenticato
    const snap = await get(ref(this._db, `sessions/${code}`));
    if (!snap.exists()) throw new Error('Sessione non trovata. Controlla il codice.');

    this.code      = code;
    this.masterUid = snap.val().masterUid;
    localStorage.setItem('dnd_session_code', code);
    return this._auth.currentUser.uid;
  }

  async restore(code) {
    await this._auth.authStateReady();
    if (!this._auth.currentUser) return false;

    const snap = await get(ref(this._db, `sessions/${code}`));
    if (!snap.exists()) return false;

    this.code      = code;
    this.masterUid = snap.val().masterUid;
    return this._auth.currentUser.uid;
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
