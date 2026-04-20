import { ref, set, get, remove } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { CharacterLibrary }      from './CharacterLibrary.js';
import * as UI                   from './UI.js';
import { state }                 from './state.js';
import { esc }                   from './core.js';
import { openLibrarySheet }      from './sheet.js';

export function updateHomeAuthUI(user) {
  const authPanel   = document.getElementById('auth-panel');
  const homeCards   = document.getElementById('home-cards');
  const userInfoBar = document.getElementById('user-info-bar');
  const displayName = document.getElementById('user-display-name');
  const upgradeBtn  = document.getElementById('btn-upgrade-google');
  const signOutBtn  = document.getElementById('btn-sign-out');
  const libSection  = document.getElementById('character-library-section');
  const prevSection = document.getElementById('character-preview-section');

  if (!user) {
    authPanel?.classList.remove('hidden');
    homeCards?.classList.add('hidden');
    userInfoBar?.classList.add('hidden');
    libSection?.classList.add('hidden');
    prevSection?.classList.add('hidden');
    return;
  }

  authPanel?.classList.add('hidden');
  homeCards?.classList.remove('hidden');
  userInfoBar?.classList.remove('hidden');
  prevSection?.classList.add('hidden');

  if (state.session.isGoogleUser) {
    if (displayName) displayName.textContent = state.session.displayName ?? '';
    upgradeBtn?.classList.add('hidden');
    signOutBtn?.classList.remove('hidden');
  } else {
    if (displayName) displayName.textContent = 'Ospite';
    upgradeBtn?.classList.remove('hidden');
    signOutBtn?.classList.add('hidden');
  }

  state.library = new CharacterLibrary(state.db, user.uid);
  loadUserSessions(user.uid);
  loadCharacterLibrary();
  populateJoinPicker();
}

export async function loadCharacterLibrary() {
  const section = document.getElementById('character-library-section');
  const list    = document.getElementById('character-library-list');
  if (!section || !list || !state.library) return;

  let chars = {};
  try {
    chars = await state.library.getAll();
  } catch {
    list.innerHTML = '<p class="empty-hint">Errore di permessi — aggiungi le regole Firebase per "characters".</p>';
    section.classList.remove('hidden');
    return;
  }
  const entries = Object.entries(chars);

  if (entries.length === 0) {
    list.innerHTML = '<p class="empty-hint">Nessun personaggio. Creane uno!</p>';
  } else {
    list.innerHTML = entries.map(([id, c]) => `
      <div class="char-lib-entry">
        <div class="char-lib-info">
          <span class="char-lib-name">${esc(c.name)}</span>
          <span class="char-lib-badge ${c.type === 'player' ? 'badge-player' : 'badge-creature'}">${c.type === 'player' ? 'PG' : 'Creatura'}</span>
        </div>
        <div class="char-lib-actions">
          <button class="btn-secondary btn-sm" data-action="open-sheet" data-id="${id}">📜 Apri</button>
          <button class="btn-remove-sm" data-action="delete-char" data-id="${id}" aria-label="Elimina">×</button>
        </div>
      </div>
    `).join('');
  }

  section.classList.remove('hidden');

  list.onclick = (e) => {
    const openBtn = e.target.closest('[data-action="open-sheet"]');
    if (openBtn) { openLibrarySheet(openBtn.dataset.id); return; }
    const delBtn = e.target.closest('[data-action="delete-char"]');
    if (delBtn) { deleteLibraryChar(delBtn.dataset.id); }
  };
}

export async function deleteLibraryChar(charId) {
  if (!confirm('Eliminare questo personaggio? I dati della scheda saranno persi.')) return;
  await state.library.delete(charId);
  loadCharacterLibrary();
  populateJoinPicker();
}

export async function populateJoinPicker() {
  const picker = document.getElementById('join-char-picker');
  const list   = document.getElementById('join-char-list');
  if (!picker || !list || !state.library) return;

  let chars = {};
  try { chars = await state.library.getAll(); } catch { return; }
  const players = Object.entries(chars).filter(([, c]) => c.type === 'player');

  if (players.length === 0) {
    picker.classList.add('hidden');
    return;
  }

  list.innerHTML = players.map(([id, c]) => `
    <button class="char-pick-btn" data-id="${id}" data-name="${esc(c.name)}">${esc(c.name)}</button>
  `).join('');

  list.onclick = (e) => {
    const btn = e.target.closest('.char-pick-btn');
    if (!btn) return;
    state.selectedJoinCharId = btn.dataset.id;
    document.getElementById('input-pg-name').value = btn.dataset.name;
    list.querySelectorAll('.char-pick-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  };

  picker.classList.remove('hidden');
}

export async function populateCreaturePicker() {
  const picker = document.getElementById('creature-library-picker');
  const list   = document.getElementById('creature-library-list');
  if (!picker || !list || !state.library) return;

  let chars = {};
  try { chars = await state.library.getAll(); } catch { return; }
  const creatures = Object.entries(chars).filter(([, c]) => c.type === 'creature');

  if (creatures.length === 0) {
    picker.classList.add('hidden');
    return;
  }

  list.innerHTML = creatures.map(([id, c]) => `
    <button class="char-pick-btn" data-id="${id}" data-name="${esc(c.name)}">${esc(c.name)}</button>
  `).join('');

  list.onclick = (e) => {
    const btn = e.target.closest('.char-pick-btn');
    if (!btn) return;
    state.selectedCreatureCharId = btn.dataset.id;
    document.getElementById('input-creature-name').value = btn.dataset.name;
    list.querySelectorAll('.char-pick-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  };

  picker.classList.remove('hidden');
}

export async function saveUserSession(uid, code, combatantId, characterName, role, charId = null) {
  await set(ref(state.db, `userSessions/${uid}/${code}`), {
    combatantId:   combatantId ?? null,
    characterName: characterName ?? null,
    role,
    charId:        charId ?? null,
    lastSeen:      Date.now(),
  });
}

export async function loadUserSessions(uid) {
  const section = document.getElementById('user-sessions-section');
  const list    = document.getElementById('user-sessions-list');
  if (!section || !list) return;

  const snap = await get(ref(state.db, `userSessions/${uid}`));
  if (!snap.exists()) { section.classList.add('hidden'); return; }

  const entries = Object.entries(snap.val());
  const active  = [];

  await Promise.all(entries.map(async ([code, data]) => {
    const sessionSnap = await get(ref(state.db, `sessions/${code}`));
    if (sessionSnap.exists()) {
      active.push({ code, ...data });
    } else {
      await remove(ref(state.db, `userSessions/${uid}/${code}`));
    }
  }));

  active.sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));

  if (active.length === 0) { section.classList.add('hidden'); return; }

  section.classList.remove('hidden');
  list.innerHTML = active.map(s => `
    <div class="session-entry">
      <div class="session-entry-info">
        <span class="session-entry-code">${s.code}</span>
        ${s.characterName ? `<span class="session-entry-char">— ${esc(s.characterName)}</span>` : ''}
        <span class="session-entry-role">${s.role === 'master' ? '⚔ Master' : '🧙 PG'}</span>
      </div>
      <div class="session-entry-actions">
        <button class="btn-rejoin btn-secondary btn-sm"
                data-code="${s.code}"
                data-combatant-id="${s.combatantId ?? ''}"
                data-role="${s.role}"
                data-char-id="${s.charId ?? ''}">
          Rientra →
        </button>
        <button class="btn-remove-sm btn-delete-session" data-code="${s.code}" aria-label="Rimuovi sessione">×</button>
      </div>
    </div>
  `).join('');

  list.onclick = (e) => {
    const rejoinBtn = e.target.closest('.btn-rejoin');
    if (rejoinBtn) {
      document.dispatchEvent(new CustomEvent('dnd:rejoin', { detail: {
        code:        rejoinBtn.dataset.code,
        combatantId: rejoinBtn.dataset.combatantId || null,
        role:        rejoinBtn.dataset.role,
        charId:      rejoinBtn.dataset.charId || null,
      }}));
      return;
    }
    const delBtn = e.target.closest('.btn-delete-session');
    if (delBtn) deleteUserSession(uid, delBtn.dataset.code);
  };
}

async function deleteUserSession(uid, code) {
  await remove(ref(state.db, `userSessions/${uid}/${code}`));
  loadUserSessions(uid);
}
