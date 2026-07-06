import { ref, set, get, remove, onValue, onDisconnect, runTransaction, push, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
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

  async create(options = {}) {
    if (!this._auth.currentUser) await signInAnonymously(this._auth);
    const uid  = this._auth.currentUser.uid;
    const code = this._generateCode();

    await set(ref(this._db, `sessions/${code}`), {
      masterUid:       uid,
      round:           1,
      currentTurnId:   null,
      combatants:      {},
      logs:            {},
      progressionMode: options.progressionMode ?? 'xp',
      ship: {
        hp:      200,
        hpMax:   200,
        weapons: {
          ballista: { state: 'ready' },
          mangonel: { state: 'ready' },
        },
      },
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

  async clearAllGridPositions() {
    await set(ref(this._db, `sessions/${this.code}/grid`), null);
  }

  async setGridConfig(cols, rows) {
    const c = Math.max(1, Math.min(60, parseInt(cols) || 20));
    const r = Math.max(1, Math.min(60, parseInt(rows) || 20));
    await set(ref(this._db, `sessions/${this.code}/gridConfig`), { cols: c, rows: r });

    // Drop tokens whose footprint no longer fits, and out-of-bounds walls.
    const snap = await get(ref(this._db, `sessions/${this.code}`));
    const data = snap.val() || {};
    const sizeFootprint = { tiny: 1, small: 1, medium: 1, large: 2, huge: 3, gargantuan: 4 };

    const grid = data.grid || {};
    const combatants = data.combatants || {};
    for (const [id, p] of Object.entries(grid)) {
      const n = sizeFootprint[combatants[id]?.size] || 1;
      if (p == null || p.col == null || p.col < 0 || p.row < 0 ||
          p.col + n > c || p.row + n > r) {
        await set(ref(this._db, `sessions/${this.code}/grid/${id}`), null);
      }
    }

    const walls = data.walls || {};
    for (const key of Object.keys(walls)) {
      const [wc, wr] = key.split('_').map(Number);
      if (wc < 0 || wr < 0 || wc >= c || wr >= r) {
        await set(ref(this._db, `sessions/${this.code}/walls/${key}`), null);
      }
    }
  }

  async setWall(cellKey, on) {
    await set(ref(this._db, `sessions/${this.code}/walls/${cellKey}`), on ? true : null);
  }

  async clearWalls() {
    await set(ref(this._db, `sessions/${this.code}/walls`), null);
  }

  async resetGrid() {
    await set(ref(this._db, `sessions/${this.code}/grid`), null);
    await set(ref(this._db, `sessions/${this.code}/walls`), null);
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
  async addActionLog({ actor, target, action, amount, type = 'info', using = null }) {
    if (!actor || !action) return;
    const hasTarget = Boolean(target);
    const hasAmount = Number.isFinite(amount);
    const hasUsing  = Boolean(using);
    
    const verb = action.trim();
    const usingPart = hasUsing ? ` con ${using}` : '';
    const amountPart = hasAmount
      ? (type === 'heal' ? ` curandolo di ${amount}` : ` infliggendogli ${amount} danni`)
      : '';
      
    const message = hasTarget
      ? `${actor} ${verb} ${target}${usingPart}${amountPart}`
      : `${actor} ${verb}${usingPart}${amountPart}`;

    await this.addLogEvent(message, type, { actor, target: target ?? null, amount: hasAmount ? amount : null });
  }

  async clearLogs() {
    if (!this.code) return;
    await set(ref(this._db, `sessions/${this.code}/logs`), null);
  }

  async setSceneImage(url, name) {
    if (!this.code) return;
    await set(ref(this._db, `sessions/${this.code}/sceneImageUrl`), url);
    await set(ref(this._db, `sessions/${this.code}/sceneImageName`), name || '');
  }

  async clearSceneImage() {
    if (!this.code) return;
    await set(ref(this._db, `sessions/${this.code}/sceneImageUrl`), null);
    await set(ref(this._db, `sessions/${this.code}/sceneImageName`), null);
  }

  async addSessionNote() {
    if (!this.code) return null;
    const notesRef = ref(this._db, `sessions/${this.code}/sessionNotes`);
    const snap     = await get(notesRef);
    const count    = snap.val() ? Object.keys(snap.val()).length : 0;
    const noteRef  = push(notesRef);
    await set(noteRef, {
      title:     `Sessione ${count + 1}`,
      content:   '',
      date:      Date.now(),
      createdBy: this._auth.currentUser?.uid ?? '',
      createdAt: Date.now(),
    });
    return noteRef.key;
  }

  async updateSessionNote(noteId, fields) {
    if (!this.code) return;
    for (const [key, value] of Object.entries(fields)) {
      await set(ref(this._db, `sessions/${this.code}/sessionNotes/${noteId}/${key}`), value);
    }
  }

  async deleteSessionNote(noteId) {
    if (!this.code) return;
    await remove(ref(this._db, `sessions/${this.code}/sessionNotes/${noteId}`));
  }

  async setProgressionMode(mode) {
    await set(ref(this._db, `sessions/${this.code}/progressionMode`), mode);
  }

  async addXp(combatantId, amount) {
    await runTransaction(
      ref(this._db, `sessions/${this.code}/xp/${combatantId}`),
      (current) => (current ?? 0) + amount
    );
  }

  async grantLevelUp(combatantId) {
    await set(ref(this._db, `sessions/${this.code}/levelUpGranted/${combatantId}`), true);
  }

  async clearLevelUpGrant(combatantId) {
    await set(ref(this._db, `sessions/${this.code}/levelUpGranted/${combatantId}`), null);
  }

  async acquireNoteLock(noteId, uid, name, color) {
    if (!this.code) return;
    const r = ref(this._db, `sessions/${this.code}/noteLocks/${noteId}`);
    await set(r, { uid, name, color });
    onDisconnect(r).remove();
  }

  async releaseNoteLock(noteId) {
    if (!this.code) return;
    await set(ref(this._db, `sessions/${this.code}/noteLocks/${noteId}`), null);
  }

  listenNoteLocks(callback) {
    if (!this.code) return;
    onValue(ref(this._db, `sessions/${this.code}/noteLocks`), snap => {
      callback(snap.val() || {});
    });
  }

  _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
}
