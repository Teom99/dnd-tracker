import { ref, set, get, remove } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { CharacterLibrary }      from '../data/CharacterLibrary.js';
import * as UI                   from '../ui/UI.js';
import { state }                 from '../utils/state.js';
import { esc }                   from './core.js';
import { openLibrarySheet }      from './sheet.js';
import { icon }                  from '../ui/icons.js';
import { splitSessions, filterLibrary, libraryMeta, lastSeenLabel } from '../logic/homeView.js';
import { captureFocusState, restoreFocusState } from '../utils/domPreserve.js';

export function updateHomeAuthUI(user) {
  const authPanel   = document.getElementById('auth-panel');
  const homeCards   = document.getElementById('home-cards');
  const userInfoBar = document.getElementById('user-info-bar');
  const displayName = document.getElementById('user-display-name');
  const upgradeBtn  = document.getElementById('btn-upgrade-google');
  const signOutBtn  = document.getElementById('btn-sign-out');
  const libSection  = document.getElementById('character-library-section');

  if (!user) {
    authPanel?.classList.remove('hidden');
    homeCards?.classList.add('hidden');
    userInfoBar?.classList.add('hidden');
    libSection?.classList.add('hidden');
    return;
  }

  authPanel?.classList.add('hidden');
  homeCards?.classList.remove('hidden');
  userInfoBar?.classList.remove('hidden');

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

let _libEntries = [];   // ultima libreria letta: il filtro ridisegna senza rileggere da Firebase
let _libDeleting = null;  // id della carta che sta chiedendo conferma di eliminazione
let _libJoinOpen = null;  // id della carta con il campo codice aperto

function _libCard(id, c) {
  const rawThumb = c.avatarThumb;
  const avatarSrc = typeof rawThumb === 'string' && rawThumb.startsWith('data:image/') ? rawThumb : null;
  const isCreature = c.type === 'creature';
  const avatar = avatarSrc
    ? `<img src="${esc(avatarSrc)}" class="lib-avatar" alt="">`
    : `<span class="lib-avatar${isCreature ? ' lib-avatar--creature' : ''}" aria-hidden="true">${esc(String(c.name ?? '?').trim().charAt(0).toUpperCase() || '?')}</span>`;
  const name = esc(c.name);
  const confirming = _libDeleting === id;
  return `
  <div class="lib-card" data-id="${esc(id)}">
    ${avatar}
    <div>
      <div class="lib-name">${name}</div>
      <div class="lib-meta">${esc(libraryMeta(c))}</div>
    </div>
    <button type="button" class="btn btn--ghost btn--sm btn--icon" data-action="ask-delete" data-id="${esc(id)}" aria-label="Elimina ${name}" title="Elimina">${icon('trash')}</button>
    ${confirming ? `
    <div class="lib-confirm">
      <span>Eliminare ${name}? I dati della scheda saranno persi.</span>
      <button type="button" class="btn btn--sm" data-action="delete-char" data-id="${esc(id)}">Elimina</button>
      <button type="button" class="btn btn--ghost btn--sm" data-action="cancel-delete" data-id="${esc(id)}">Annulla</button>
    </div>` : `
    <div class="lib-actions">
      <button type="button" class="btn btn--sm" data-action="open-sheet" data-id="${esc(id)}">${icon('scroll')} Apri scheda</button>
      ${isCreature ? '' : `<button type="button" class="btn btn--sm" data-action="open-join" data-id="${esc(id)}">${icon('footprints')} Entra</button>`}
    </div>
    ${!isCreature && _libJoinOpen === id ? `
    <form class="lib-join char-lib-join" data-id="${esc(id)}" data-name="${name}">
      <input type="text" class="input" placeholder="Codice sessione" maxlength="8" aria-label="Codice sessione" autocomplete="off" autocapitalize="characters">
      <button type="submit" class="btn btn--sm">Entra</button>
      <button type="button" class="btn btn--ghost btn--sm btn--icon" data-action="close-join" aria-label="Chiudi" title="Chiudi">${icon('close')}</button>
    </form>` : ''}`}
  </div>`;
}

function _renderLibrary() {
  const list = document.getElementById('character-library-list');
  if (!list) return;
  const filter = state.libFilter ?? 'all';
  document.querySelectorAll('#lib-filter [data-filter]').forEach(b => {
    b.setAttribute('aria-selected', String(b.dataset.filter === filter));
    b.tabIndex = b.dataset.filter === filter ? 0 : -1;   // roving tabindex: Tab entra nel gruppo, le frecce si spostano
  });

  const shown = filterLibrary(_libEntries, filter);
  const snap = captureFocusState(list);
  if (_libEntries.length === 0) {
    list.innerHTML = `<div class="lib-empty" style="grid-column:1/-1">Nessun personaggio.
      <button type="button" class="btn btn--sm" data-action="new-player">${icon('plus')} Crea il tuo primo personaggio</button></div>`;
  } else if (shown.length === 0) {
    list.innerHTML = `<div class="lib-empty" style="grid-column:1/-1">Niente in questa categoria.</div>`;
  } else {
    list.innerHTML = shown.map(([id, c]) => _libCard(id, c)).join('');
  }
  restoreFocusState(list, snap);
}

export async function loadCharacterLibrary() {
  const section = document.getElementById('character-library-section');
  const list    = document.getElementById('character-library-list');
  if (!section || !list || !state.library) return;

  let chars = {};
  try {
    chars = await state.library.getAll();
  } catch {
    list.innerHTML = '<p class="lib-empty" style="grid-column:1/-1">Errore di permessi — aggiungi le regole Firebase per "characters".</p>';
    section.classList.remove('hidden');
    return;
  }
  _libEntries = Object.entries(chars ?? {});
  _libDeleting = null;
  if (_libJoinOpen && !_libEntries.some(([id]) => id === _libJoinOpen)) _libJoinOpen = null;   // il campo codice resta aperto (e scritto) se la scheda c'è ancora
  _renderLibrary();
  section.classList.remove('hidden');
  _bindLibrary(list);
}

function _bindLibrary(list) {
  if (list._libBound) return;
  list._libBound = true;

  document.getElementById('lib-filter')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    state.libFilter = b.dataset.filter;
    _libDeleting = null; _libJoinOpen = null;
    _renderLibrary();
  });

  document.getElementById('lib-filter')?.addEventListener('keydown', (e) => {
    const tabs = [...document.querySelectorAll('#lib-filter [data-filter]')];
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const next = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    state.libFilter = tabs[next].dataset.filter;
    _libDeleting = null; _libJoinOpen = null;
    _renderLibrary();
    document.querySelector(`#lib-filter [data-filter="${state.libFilter}"]`)?.focus();
  });

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    switch (btn.dataset.action) {
      case 'open-sheet':    openLibrarySheet(id); return;
      case 'new-player':    document.getElementById('btn-create-player')?.click(); return;
      case 'open-join':     _libJoinOpen = id; _libDeleting = null; _renderLibrary(); list.querySelector('.lib-join input')?.focus(); return;
      case 'close-join':    _libJoinOpen = null; _renderLibrary(); return;
      case 'ask-delete':    _libDeleting = id; _libJoinOpen = null; _renderLibrary(); return;
      case 'cancel-delete': _libDeleting = null; _renderLibrary(); return;
      case 'delete-char':   deleteLibraryChar(id); return;
    }
  });

  list.addEventListener('submit', (e) => {
    const form = e.target.closest('.char-lib-join');
    if (!form) return;
    e.preventDefault();
    const input  = form.querySelector('input');
    const button = form.querySelector('[type="submit"]');
    const code   = input.value.trim().toUpperCase();
    if (!code) { input.focus(); return; }
    // Disabilita subito per evitare un doppio click che scateni due ingressi
    // concorrenti (in caso di errore, loadCharacterLibrary() li riabilita).
    input.disabled = true;
    button.disabled = true;
    document.dispatchEvent(new CustomEvent('dnd:join-with-character', {
      detail: { code, charId: form.dataset.id, name: form.dataset.name }
    }));
  });
}

// La conferma sta nella carta (niente confirm() del browser): arriva qui solo dopo "Elimina".
export async function deleteLibraryChar(charId) {
  await state.library.delete(charId);
  if (state.selectedJoinCharId === charId) state.selectedJoinCharId = null;
  loadCharacterLibrary();
  populateJoinPicker();
}

export async function populateJoinPicker() {
  const picker = document.getElementById('join-char-picker');
  const list   = document.getElementById('join-char-list');
  if (!picker || !list || !state.library) return;

  let chars = {};
  try { chars = await state.library.getAll(); } catch { return; }
  // Esclude solo le creature (non richiede type === 'player' esplicito): una
  // scheda con campo type mancante/corrotto resta comunque selezionabile.
  const players = filterLibrary(Object.entries(chars ?? {}), 'player');

  if (players.length === 0) {
    picker.classList.add('hidden');
    return;
  }

  list.innerHTML = players.map(([id, c]) => `
    <button type="button" class="pick-chip" data-id="${esc(id)}" data-name="${esc(c.name)}">${icon('shield')} ${esc(c.name)}</button>
  `).join('') + `<button type="button" class="pick-chip" data-new="1">${icon('plus')} Nuovo personaggio</button>`;

  list.onclick = (e) => {
    const btn = e.target.closest('.pick-chip');
    if (!btn) return;
    list.querySelectorAll('.pick-chip').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    const nameInput = document.getElementById('input-pg-name');
    if (btn.dataset.new) {
      state.selectedJoinCharId = null;
      nameInput.value = '';
      nameInput.focus();
      return;
    }
    state.selectedJoinCharId = btn.dataset.id;
    nameInput.value = btn.dataset.name;
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
    <button type="button" class="char-pick-btn" data-id="${esc(id)}" data-name="${esc(c.name)}">${esc(c.name)}</button>
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

function _sessionButtons(s, { primary }) {
  const code = esc(s.code);
  return `
    <button type="button" class="btn-notes-session btn btn--ghost btn--sm btn--icon" data-code="${code}" aria-label="Cronache della sessione ${code}" title="Cronache della campagna">${icon('scroll')}</button>
    <button type="button" class="btn-rejoin btn btn--sm${primary ? ' btn--primary' : ''}"
            data-code="${code}"
            data-combatant-id="${esc(s.combatantId ?? '')}"
            data-role="${esc(s.role)}"
            data-char-id="${esc(s.charId ?? '')}">${icon('back')} Rientra</button>
    <button type="button" class="btn-delete-session btn btn--ghost btn--sm btn--icon" data-code="${code}" aria-label="Rimuovi la sessione ${code}" title="Rimuovi dall'elenco">${icon('close')}</button>`;
}

function _roleTag(s) {
  return s.role === 'master'
    ? `<span class="role">${icon('crown', { size: 14 })}Master</span>`
    : `<span class="role">${icon('shield', { size: 14 })}Giocatore</span>`;
}

export async function loadUserSessions(uid) {
  const resumeSection = document.getElementById('home-resume');
  const resumeCard    = document.getElementById('home-resume-card');
  const section = document.getElementById('user-sessions-section');
  const list    = document.getElementById('user-sessions-list');
  if (!section || !list || !resumeSection || !resumeCard) return;

  const hideAll = () => {
    section.classList.add('hidden'); resumeSection.classList.add('hidden');
    _setJoinPrimary(true);
  };

  let snap;
  try { snap = await get(ref(state.db, `userSessions/${uid}`)); }
  catch { hideAll(); return; }   // rete o permessi: la home resta usabile, con "Varca la soglia" come bottone principale
  if (!snap.exists()) { hideAll(); return; }

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

  if (active.length === 0) { hideAll(); return; }

  const { resume, others } = splitSessions(active);
  const seen = lastSeenLabel(resume.lastSeen);
  resumeCard.innerHTML = `
    <div class="resume">
      <div class="resume-code">${esc(resume.code)}</div>
      <div class="resume-who">
        <div class="resume-name">${esc(resume.characterName ?? (resume.role === 'master' ? 'Master' : 'Giocatore'))}${_roleTag(resume)}</div>
        ${seen ? `<div class="resume-meta">ultimo accesso: ${esc(seen)}</div>` : ''}
      </div>
      <div class="resume-actions">${_sessionButtons(resume, { primary: true })}</div>
    </div>`;
  resumeSection.classList.remove('hidden');
  _setJoinPrimary(false);

  list.innerHTML = others.map(s => `
    <div class="sess">
      <div>
        <span class="sess-code">${esc(s.code)}</span>${_roleTag(s)}
        ${s.characterName ? `<span class="sess-char">${esc(s.characterName)}</span>` : ''}
      </div>
      <div class="sess-actions">${_sessionButtons(s, { primary: false })}</div>
    </div>`).join('');
  section.classList.toggle('hidden', others.length === 0);

  const onClick = async (e) => {
    const notesBtn = e.target.closest('.btn-notes-session');
    if (notesBtn) {
      const code = notesBtn.dataset.code;
      const snap = await get(ref(state.db, `sessions/${code}/sessionNotes`));
      _openNotesArchiveModal(code, snap.val());
      return;
    }
    const rejoinBtn = e.target.closest('.btn-rejoin');
    if (rejoinBtn) {
      // Un solo rientro alla volta: un doppio clic lanciava due restore/initSheet in parallelo.
      if (rejoinBtn.disabled) return;
      document.querySelectorAll('.btn-rejoin').forEach(b => { b.disabled = true; });
      // Se il rientro fallisce si resta in home: i bottoni tornano attivi (exitToHome li riattiva negli altri casi).
      setTimeout(() => {
        if (!document.getElementById('view-home')?.classList.contains('hidden'))
          document.querySelectorAll('.btn-rejoin').forEach(b => { b.disabled = false; });
      }, 8000);
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
  list.onclick = onClick;
  resumeCard.onclick = onClick;
}

// Un solo bottone pieno nella home: "Rientra" se c'è una sessione da riprendere, altrimenti "Varca la soglia".
function _setJoinPrimary(on) {
  document.getElementById('btn-join-submit')?.classList.toggle('btn--primary', on);
}

function _openNotesArchiveModal(code, notesObj) {
  const modal  = document.getElementById('notes-archive-modal');
  const listEl = document.getElementById('notes-archive-list');
  document.getElementById('notes-archive-title').textContent = `Cronache — ${code}`;

  const notes = Object.values(notesObj ?? {}).sort((a, b) => b.date - a.date);

  listEl.innerHTML = notes.length === 0
    ? '<p class="empty-msg">Nessuna nota per questa campagna.</p>'
    : notes.map(n => `
        <div class="archive-note-entry">
          <div class="archive-note-header">
            <strong class="archive-note-title">${esc(n.title ?? '')}</strong>
            <span class="archive-note-date">${new Date(n.date).toLocaleDateString('it-IT', { day:'numeric', month:'short', year:'numeric' })}</span>
          </div>
          ${n.content
            ? `<p class="archive-note-content">${esc(n.content)}</p>`
            : '<p class="archive-note-empty">Nessun testo</p>'}
        </div>`).join('');

  modal.classList.remove('hidden');
}

async function deleteUserSession(uid, code) {
  await remove(ref(state.db, `userSessions/${uid}/${code}`));
  loadUserSessions(uid);
}
