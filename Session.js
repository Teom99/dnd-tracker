import { ref, set, get, onValue, runTransaction, push, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
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
    // Timeout 3s: evita che la pagina resti vuota se Firebase Auth è lento
    const ready = this._auth.authStateReady?.() ?? Promise.resolve();
    await Promise.race([ready, new Promise(r => setTimeout(r, 3000))]);
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
    if (!this._auth.currentUser) await signInAnonymously(this._auth);
    const uid  = this._auth.currentUser.uid;
    const code = this._generateCode();

    await set(ref(this._db, `sessions/${code}`), {
      masterUid:     uid,
      round:         1,
      currentTurnId: null,
      combatants:    {},
      logs:          {}
    });

    this.code      = code;
    this.masterUid = uid;
    localStorage.setItem('dnd_session_code', code);
    return code;
  }

  async join(code) {
    if (!this._auth.currentUser) await signInAnonymously(this._auth);
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

  // Avanza turno in modo atomico: legge currentTurnId e round dal nodo Firebase
  // e li aggiorna in un'unica transazione, evitando race condition.
  async nextTurnAtomic(aliveIds) {
    if (aliveIds.length === 0) return;
    await runTransaction(ref(this._db, `sessions/${this.code}`), (session) => {
      if (session == null) return session;
      const currentId    = session.currentTurnId ?? null;
      const currentIndex = aliveIds.indexOf(currentId);
      if (currentIndex === -1) {
        session.currentTurnId = aliveIds[0];
        return session;
      }
      const nextIndex = (currentIndex + 1) % aliveIds.length;
      if (nextIndex === 0) session.round = (session.round ?? 1) + 1;
      session.currentTurnId = aliveIds[nextIndex];
      return session;
    });
  }

  async setGridPosition(combatantId, col, row) {
    await set(ref(this._db, `sessions/${this.code}/grid/${combatantId}`), { col, row });
  }

  async clearGridPosition(combatantId) {
    await set(ref(this._db, `sessions/${this.code}/grid/${combatantId}`), null);
  }

  async addLogEvent(message, type = 'info', meta = {}) {
    if (!this.code) return;
    const newRef = push(ref(this._db, `sessions/${this.code}/logs`));
    await set(newRef, {
      message,
      type,
      actor: meta.actor ?? null,
      target: meta.target ?? null,
      amount: Number.isFinite(meta.amount) ? meta.amount : null,
      createdByUid: this.currentUid,
      timestamp: serverTimestamp(),
      clientTimestamp: Date.now()
    });
  }

  // Helper per messaggi azione comuni (danno/cura/etc.)
  async addActionLog({ actor, target, action, amount, type = 'info' }) {
    if (!actor || !action) return;
    const hasTarget = Boolean(target);
    const hasAmount = Number.isFinite(amount);
    const verb = action.trim();
    const amountPart = hasAmount
      ? (type === 'heal' ? ` curandolo di ${amount}` : ` infliggendogli ${amount} danni`)
      : '';
    const message = hasTarget
      ? `${actor} ${verb} ${target}${amountPart}`
      : `${actor} ${verb}${amountPart}`;

    await this.addLogEvent(message, type, { actor, target: target ?? null, amount: hasAmount ? amount : null });
  }

  async clearLogs() {
    if (!this.code) return;
    await set(ref(this._db, `sessions/${this.code}/logs`), null);
  }

  _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
}
