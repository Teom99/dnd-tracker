import { initializeApp }      from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase, ref, get, remove } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { getAuth }            from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

import { FIREBASE_CONFIG, DISCORD_WEBHOOK_URL } from './config.js';
import { getMonsterList, getMonster, getSpellList, getConditionDescriptions } from './src/DndApi.js';
import { Session }           from './src/Session.js';
import { CharacterLibrary }  from './src/CharacterLibrary.js';
import * as UI               from './src/UI.js';
import * as GridUI           from './src/GridUI.js';
import { state }             from './src/state.js';
import { initCombatManagers, exitToHome, esc, closeConditionModal } from './src/core.js';
import { CharacterSheet } from './src/CharacterSheet.js';
import { renderGrid }        from './src/grid.js';
import { initSheet, setupSheetListener, makeCallbacks } from './src/sheet.js';
import { LevelUp }   from './src/LevelUp.js';
import { LevelUpUI } from './src/LevelUpUI.js';
import { Ship }    from './src/Ship.js';
import * as ShipUI from './src/ShipUI.js';
import { updateHomeAuthUI, loadCharacterLibrary, populateJoinPicker, populateCreaturePicker, saveUserSession, loadUserSessions } from './src/home.js';

// --- Firebase init ---
const firebaseApp = initializeApp(FIREBASE_CONFIG);
const db          = getDatabase(firebaseApp);
const auth        = getAuth(firebaseApp);

// --- Inject Firebase instances into shared state ---
state.db   = db;
state.auth = auth;
state.session = new Session(db, auth);

// ─── HOME: Auth ───────────────────────────────────────────────────────────────

document.getElementById('btn-google-signin').addEventListener('click', async () => {
  const btn = document.getElementById('btn-google-signin');
  btn.disabled = true;
  btn.textContent = 'Accesso in corso...';
  try {
    await state.session.signInWithGoogle();
    updateHomeAuthUI(auth.currentUser);
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      UI.showError('Errore accesso Google: ' + err.message);
    }
    btn.disabled = false;
    btn.innerHTML = `<svg class="google-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Accedi con Google`;
  }
});

document.getElementById('btn-anon-signin').addEventListener('click', async () => {
  try {
    await state.session.signInAnonymous();
    updateHomeAuthUI(auth.currentUser);
  } catch (err) {
    UI.showError('Errore: ' + err.message);
  }
});

document.getElementById('btn-sign-out').addEventListener('click', async () => {
  await state.session.signOut();
  state.library = null;
  updateHomeAuthUI(null);
});

document.getElementById('btn-upgrade-google').addEventListener('click', async () => {
  const btn = document.getElementById('btn-upgrade-google');
  btn.disabled = true;
  try {
    await state.session.signInWithGoogle();
    updateHomeAuthUI(auth.currentUser);
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      UI.showError('Errore accesso Google: ' + err.message);
    }
    btn.disabled = false;
  }
});

// ─── HOME: Libreria personaggi ────────────────────────────────────────────────

document.getElementById('btn-create-player').addEventListener('click', async () => {
  if (!state.library) return;
  const classesData = await LevelUp.load();
  LevelUpUI.openCreation(classesData, async (confirmed) => {
    await state.library.createWithData(confirmed.name, 'player', confirmed);
    LevelUpUI.close();
    loadCharacterLibrary();
    populateJoinPicker();
  });
});

document.getElementById('btn-create-creature').addEventListener('click', async () => {
  const name = prompt('Nome della creatura:');
  if (!name?.trim()) return;
  await state.library.create(name.trim(), 'creature');
  loadCharacterLibrary();
});

// ─── HOME: Crea sessione (master) ─────────────────────────────────────────────

document.getElementById('btn-create-session').addEventListener('click', async () => {
  try {
    const progressionMode = document.getElementById('select-progression-mode')?.value ?? 'xp';
    const code = await state.session.create({ progressionMode });
    state.myUid = state.session.currentUid;
    initCombatManagers(code);
    await saveUserSession(state.myUid, code, null, null, 'master', null);
    _enterCombatView(code, true);
  } catch (err) {
    UI.showError('Errore nella creazione della sessione: ' + err.message);
  }
});

// ─── HOME: Entra nella sessione (giocatore) ───────────────────────────────────

document.getElementById('form-join').addEventListener('submit', async (e) => {
  e.preventDefault();

  const code       = document.getElementById('input-session-code').value.trim().toUpperCase();
  const name       = document.getElementById('input-pg-name').value.trim();
  const initiative = document.getElementById('input-pg-initiative').value || '0';

  if (!code || !name) {
    UI.showError('Inserisci codice sessione e nome personaggio.');
    return;
  }

  const submitBtn = e.target.querySelector('[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Caricamento...';

  try {
    state.myUid = await state.session.join(code);
    initCombatManagers(code);

    let charId = state.selectedJoinCharId ?? null;
    if (!charId) {
      if (!state.library && auth.currentUser) state.library = new CharacterLibrary(db, auth.currentUser.uid);
      if (state.library) charId = await state.library.create(name, 'player');
    }

    initSheet(state.myUid, charId);

    const existing = await state.combatantManager.findByOwner(state.myUid);
    let savedCharName = name;
    if (existing) {
      const rejoin = confirm(
        `Sei già presente in questa sessione con il personaggio "${existing.name}".\n\n` +
        `OK → Rientra con "${existing.name}"\n` +
        `Annulla → Rimuovi il vecchio e crea "${name}"`
      );
      if (rejoin) {
        state.myCombatantId = existing.id;
        savedCharName = existing.name;
        const existingCharId = existing.charId ?? charId;
        if (existingCharId !== charId) {
          state.myCurrentCharId = existingCharId;
          state.sheet = new CharacterSheet(db, state.myUid, existingCharId);
          setupSheetListener();
        }
        charId = existingCharId;
      } else {
        await state.combatantManager.remove(existing.id);
        state.myCombatantId = await state.combatantManager.add(name, initiative, 1, 'player', state.myUid, charId);
      }
    } else {
      state.myCombatantId = await state.combatantManager.add(name, initiative, 1, 'player', state.myUid, charId);
    }

    state.selectedJoinCharId = null;
    localStorage.setItem('dnd_combatant_id', state.myCombatantId);
    await saveUserSession(state.myUid, code, state.myCombatantId, savedCharName, 'player', charId);
    state.lastKnownHp = null;
    _enterCombatView(code, false);
  } catch (err) {
    UI.showError(err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Entra nella Sessione';
  }
});

// ─── COMBAT: Aggiungi creatura (solo master) ──────────────────────────────────

document.getElementById('form-add-creature').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name       = document.getElementById('input-creature-name').value.trim();
  const hp         = document.getElementById('input-creature-hp').value;
  const initiative = document.getElementById('input-creature-initiative').value || '0';
  const ac       = document.getElementById('input-creature-ac').value || null;
  const apiIndex = document.getElementById('input-creature-api-index').value || null;
  const size     = document.getElementById('input-creature-size').value || 'medium';

  if (!name || !hp) return;

  const charId = state.selectedCreatureCharId ?? null;
  await state.combatantManager.add(name, initiative, hp, 'creature', state.myUid, charId, ac, apiIndex, size);
  document.getElementById('input-creature-api-index').value = '';
  state.selectedCreatureCharId = null;
  document.querySelectorAll('#creature-library-list .char-pick-btn').forEach(b => b.classList.remove('selected'));
  e.target.reset();
  document.getElementById('input-creature-name').focus();
});

// ─── COMBAT: Aggiungi compagno (player only) ──────────────────────────────────

document.getElementById('form-add-pet').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name       = document.getElementById('input-pet-name').value.trim();
  const hp         = document.getElementById('input-pet-hp').value;
  const initiative = document.getElementById('input-pet-initiative').value || '0';
  const ac         = document.getElementById('input-pet-ac').value || null;

  if (!name || !hp) return;

  await state.combatantManager.add(name, initiative, hp, 'pet', state.myUid, null, ac, null);
  e.target.reset();
  document.getElementById('input-pet-name').focus();
});

// ─── D&D API: Monster Search + Stat Block ─────────────────────────────────────

let _monsterList    = null;
let _currentMonster = null;

async function _ensureMonsterList() {
  if (!_monsterList) _monsterList = await getMonsterList();
  return _monsterList;
}

function _mod(score) {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function _renderMonsterStatBlock(data) {
  _currentMonster = data;
  document.getElementById('monster-sb-name').textContent = data.name ?? '';

  const AB  = ['strength','dexterity','constitution','intelligence','wisdom','charisma'];
  const ABL = ['FOR','DES','COS','INT','SAG','CAR'];

  const acStr    = (data.armor_class ?? []).map(a => a.type === 'natural' || a.type === 'armor' ? `${a.value}` : `${a.value} (${a.type})`).join(', ') || '—';
  const speedStr = Object.entries(data.speed ?? {}).map(([k,v]) => k === 'walk' ? v : `${k} ${v}`).join(', ') || '—';

  const savingThrows = (data.proficiencies ?? [])
    .filter(p => p.proficiency.index.startsWith('saving-throw'))
    .map(p => `${p.proficiency.name.replace('Saving Throw: ','')} +${p.value}`)
    .join(', ');

  const skills = (data.proficiencies ?? [])
    .filter(p => p.proficiency.index.startsWith('skill'))
    .map(p => `${p.proficiency.name.replace('Skill: ','')} +${p.value}`)
    .join(', ');

  const renderList = (arr) => Array.isArray(arr) && arr.length
    ? arr.map(x => typeof x === 'string' ? x : x.name).join(', ')
    : null;

  function prop(label, value) {
    return value ? `<div class="sb-prop"><span class="sb-label">${label}</span> ${value}</div>` : '';
  }

  const specialHtml = (data.special_abilities ?? []).map(a =>
    `<p class="sb-action"><strong><em>${a.name}.</em></strong> ${a.desc ?? ''}</p>`
  ).join('');

  const actionsHtml = (data.actions ?? []).map(a => {
    let extra = '';
    if (a.attack_bonus !== undefined) extra += ` <em>Attacco:</em> +${a.attack_bonus} al colpo,`;
    const dmg = (a.damage ?? []).map(d => [d.damage_dice, d.damage_type?.name].filter(Boolean).join(' ')).join(' + ');
    if (dmg) extra += ` <em>Danni:</em> ${dmg}.`;
    return `<p class="sb-action"><strong>${a.name}.</strong> ${a.desc ?? ''}${extra}</p>`;
  }).join('');

  const legendaryHtml = (data.legendary_actions ?? []).length ? `
    <div class="sb-section-title">Azioni Leggendarie</div>
    ${(data.legendary_actions ?? []).map(a =>
      `<p class="sb-action"><strong>${a.name}.</strong> ${a.desc ?? ''}</p>`
    ).join('')}` : '';

  const reactionsHtml = (data.reactions ?? []).length ? `
    <div class="sb-section-title">Reazioni</div>
    ${(data.reactions ?? []).map(a =>
      `<p class="sb-action"><strong>${a.name}.</strong> ${a.desc ?? ''}</p>`
    ).join('')}` : '';

  const sensesStr = Object.entries(data.senses ?? {})
    .map(([k,v]) => `${k.replace(/_/g,' ')} ${v}`).join(', ') || '—';

  document.getElementById('monster-sb-body').innerHTML = `
    <div class="sb-meta">${[data.size, data.type, data.alignment].filter(Boolean).join(' • ')}</div>
    <div class="sb-divider"></div>
    ${prop('Classe Armatura', acStr)}
    ${prop('Punti Ferita', `${data.hit_points}${data.hit_points_roll ? ` (${data.hit_points_roll})` : ''}`)}
    ${prop('Velocità', speedStr)}
    <div class="sb-divider"></div>
    <div class="sb-abilities">
      ${AB.map((ab,i) => `<div class="sb-ability"><div class="sb-ab-name">${ABL[i]}</div><div class="sb-ab-score">${data[ab] ?? '—'}</div><div class="sb-ab-mod">${_mod(data[ab] ?? 10)}</div></div>`).join('')}
    </div>
    <div class="sb-divider"></div>
    ${prop('Tiri Salvezza', savingThrows)}
    ${prop('Abilità', skills)}
    ${prop('Immunità ai Danni', renderList(data.damage_immunities))}
    ${prop('Resistenze ai Danni', renderList(data.damage_resistances))}
    ${prop('Vulnerabilità', renderList(data.damage_vulnerabilities))}
    ${prop('Immunità alle Condizioni', renderList(data.condition_immunities))}
    ${prop('Sensi', sensesStr)}
    ${prop('Lingue', data.languages || '—')}
    ${prop('Grado di Sfida', `${data.challenge_rating} (${(data.xp ?? 0).toLocaleString('it-IT')} PE)`)}
    ${specialHtml ? `<div class="sb-divider"></div><div class="sb-section-title">Capacità Speciali</div>${specialHtml}` : ''}
    ${actionsHtml ? `<div class="sb-divider"></div><div class="sb-section-title">Azioni</div>${actionsHtml}` : ''}
    ${reactionsHtml}
    ${legendaryHtml}
  `;

  document.getElementById('monster-stat-block-modal').classList.remove('hidden');
}

// Bottoni del modal
document.getElementById('btn-monster-add').addEventListener('click', () => {
  if (!_currentMonster) return;
  const d = _currentMonster;
  document.getElementById('input-creature-name').value       = d.name ?? '';
  document.getElementById('input-creature-hp').value         = d.hit_points ?? '';
  document.getElementById('input-creature-ac').value         = d.armor_class?.[0]?.value ?? '';
  document.getElementById('input-creature-initiative').value = _mod(d.dexterity ?? 10);
  document.getElementById('input-creature-api-index').value  = d.index ?? '';
  document.getElementById('monster-stat-block-modal').classList.add('hidden');
});
document.getElementById('btn-monster-sb-close').addEventListener('click', () => {
  document.getElementById('monster-stat-block-modal').classList.add('hidden');
});
document.getElementById('monster-stat-block-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('monster-stat-block-modal'))
    document.getElementById('monster-stat-block-modal').classList.add('hidden');
});

// Bottone "📖 Visualizza Dati" nelle card creature (master-only, riapre il stat block)
document.getElementById('creature-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action="view-stat-block"]');
  if (!btn) return;
  const idx = btn.dataset.apiIndex;
  if (!idx) return;
  btn.textContent = '⏳';
  try {
    const data = await getMonster(idx);
    _renderMonsterStatBlock(data);
  } catch { /* API non raggiungibile */ }
  finally { btn.textContent = '📖 Visualizza Dati'; }
});

{
  const searchInput   = document.getElementById('input-monster-search');
  const suggestionBox = document.getElementById('monster-suggestions');

  searchInput.addEventListener('focus', () => _ensureMonsterList().catch(() => {}));

  searchInput.addEventListener('input', async () => {
    const q = searchInput.value.trim().toLowerCase();
    suggestionBox.innerHTML = '';
    if (q.length < 2) { suggestionBox.classList.add('hidden'); return; }

    const list    = await _ensureMonsterList().catch(() => []);
    const matches = list.filter(m => m.name.toLowerCase().includes(q)).slice(0, 8);
    if (!matches.length) { suggestionBox.classList.add('hidden'); return; }

    matches.forEach(m => {
      const li       = document.createElement('li');
      li.className   = 'api-suggestion-item';
      li.textContent = m.name;
      li.addEventListener('mousedown', async (ev) => {
        ev.preventDefault();
        suggestionBox.classList.add('hidden');
        searchInput.value  = '';
        li.textContent     = '⏳ Caricamento...';
        try {
          const data = await getMonster(m.index);
          _renderMonsterStatBlock(data);
        } catch { li.textContent = m.name; }
      });
      suggestionBox.appendChild(li);
    });
    suggestionBox.classList.remove('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#monster-api-search')) suggestionBox.classList.add('hidden');
  });
}

// ─── D&D API: Spell Autocomplete (custom floating dropdown) ──────────────────

{
  let _spellList        = null;
  let _activeSpellInput = null;

  // Preload in background: ready when the user opens the sheet
  getSpellList().then(list => { _spellList = list; }).catch(() => {});

  // Box flotante — stile completamente inline per evitare conflitti con .api-suggestions
  const _spellBox = document.createElement('ul');
  _spellBox.id = 'spell-suggestions';
  _spellBox.style.cssText = [
    'position:fixed', 'z-index:200', 'list-style:none', 'display:none',
    `background:var(--bg-card)`, `border:1px solid var(--border-warm)`,
    `border-radius:0 0 var(--radius) var(--radius)`,
    'max-height:220px', 'overflow-y:auto',
    `box-shadow:var(--shadow)`, 'margin:0', 'padding:0',
  ].join(';');
  document.body.appendChild(_spellBox);

  function _hideSpellBox() { _spellBox.style.display = 'none'; }
  function _showSpellBox()  { _spellBox.style.display = 'block'; }

  async function _showSpellSuggestions(input, q) {
    _activeSpellInput = input;
    _spellBox.innerHTML = '';
    if (q.length < 1) { _hideSpellBox(); return; }

    if (!_spellList) _spellList = await getSpellList().catch(() => []);
    const matches = _spellList.filter(s => s.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
    if (!matches.length) { _hideSpellBox(); return; }

    const rect = input.getBoundingClientRect();
    _spellBox.style.top   = `${rect.bottom + window.scrollY}px`;
    _spellBox.style.left  = `${rect.left}px`;
    _spellBox.style.width = `${rect.width}px`;
    _spellBox.style.right = 'auto';

    matches.forEach(s => {
      const li = document.createElement('li');
      li.className   = 'api-suggestion-item';
      li.textContent = s.name;
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (_activeSpellInput) _activeSpellInput.value = s.name;
        _hideSpellBox();
      });
      _spellBox.appendChild(li);
    });
    _showSpellBox();
  }

  // Event delegation su tutto il documento — funziona anche dopo re-render di SheetUI
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'cantrip-name' || el.closest('form[data-spell-level]')) {
      _showSpellSuggestions(el, el.value);
    }
  });

  document.addEventListener('focusout', (e) => {
    if (e.target === _activeSpellInput)
      setTimeout(() => _hideSpellBox(), 150);
  });

  document.addEventListener('click', (e) => {
    if (e.target !== _activeSpellInput && !_spellBox.contains(e.target))
      _hideSpellBox();
  });

  document.addEventListener('click', (e) => {
    if (e.target !== _activeSpellInput && !_spellBox.contains(e.target))
      _hideSpellBox();
  });
}

// ─── D&D API: Condition Descriptions (background) ────────────────────────────

let _conditionDescriptions = null;

setTimeout(async () => {
  try { _conditionDescriptions = await getConditionDescriptions(); }
  catch { /* graceful degradation */ }
}, 3000);

{
  const condList = document.getElementById('condition-list');
  const descEl   = document.getElementById('condition-api-desc');

  condList.addEventListener('mouseover', (e) => {
    const btn = e.target.closest('[data-condition]');
    if (!btn || !descEl) return;
    const desc = _conditionDescriptions?.get(btn.dataset.condition) ?? '';
    descEl.textContent  = desc;
    descEl.style.opacity = desc ? '1' : '0';
  });

  condList.addEventListener('mouseleave', (e) => {
    if (descEl?.contains(e.relatedTarget)) return;
    if (descEl) descEl.style.opacity = '0';
  });

  descEl?.addEventListener('mouseleave', (e) => {
    if (condList.contains(e.relatedTarget)) return;
    if (descEl) descEl.style.opacity = '0';
  });
}

// ─── COMBAT: Turno, Reset, Copia, Esci ───────────────────────────────────────

document.getElementById('btn-next-turn').addEventListener('click', async () => {
  if (!state.snapshot) return;
  const sorted = state.tracker.sortedCombatants(state.snapshot.combatants);
  const active = sorted.filter(c => c.hpCurrent > 0 || c.type === 'player');
  if (active.length === 0) return;
  const currentId  = state.snapshot.currentTurnId ?? null;
  const currentIdx = active.findIndex(c => c.id === currentId);
  const nextActive = currentIdx === -1 ? active[0] : active[(currentIdx + 1) % active.length];
  await state.tracker.nextTurn(sorted);
  if (nextActive) {
    await state.session.addLogEvent(`È il turno di ${nextActive.name}!`, 'turn', { actor: nextActive.name });
  }
});

document.getElementById('btn-reset').addEventListener('click', async () => {
  if (!confirm('Sei sicuro di voler resettare l\'incontro?\nTutti i combattenti verranno rimossi.')) return;
  await state.combatantManager.removeAll();
  await state.tracker.reset();
  await state.session.addLogEvent('Incontro resettato - tutti i combattenti rimossi', 'turn');
});

document.getElementById('btn-copy-code').addEventListener('click', () => {
  navigator.clipboard.writeText(state.session.code).then(() => {
    const btn = document.getElementById('btn-copy-code');
    btn.textContent = '✓ Copiato';
    setTimeout(() => (btn.textContent = '📋 Copia'), 2000);
  });
});

document.getElementById('btn-exit-session').addEventListener('click', () => {
  if (!confirm('Sei sicuro di voler uscire dalla sessione?')) return;
  exitToHome();
});

document.getElementById('btn-clear-log').addEventListener('click', () => {
  if (confirm('Sei sicuro di voler cancellare tutto il log degli eventi?')) {
    state.session.clearLogs();
  }
});

document.getElementById('btn-toggle-ship').addEventListener('click', () => {
  state.shipPanelOpen = !state.shipPanelOpen;
  // La nave si scambia con la griglia nello slot centrale della dashboard
  document.getElementById('grid-section').classList.toggle('hidden', state.shipPanelOpen);
  document.getElementById('ship-panel').classList.toggle('hidden', !state.shipPanelOpen);
  if (state.shipPanelOpen) _renderShipPanel();
});

// ─── SCENA: Upload immagine via Discord Webhook ───────────────────────────────

async function _uploadToDiscord(file) {
  if (!DISCORD_WEBHOOK_URL) throw new Error('DISCORD_WEBHOOK_URL non configurato in config.js');
  const formData = new FormData();
  formData.append('file', file, file.name);
  const res = await fetch(DISCORD_WEBHOOK_URL + '?wait=true', { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`Discord upload error: ${res.status}`);
  const data = await res.json();
  if (!data.attachments?.length) throw new Error('Nessun allegato nella risposta Discord');
  return data.attachments[0].url;
}

const _expandedNoteIds    = new Set();
const _noteDebounceTimers = {};
let   _noteLocks          = {};

const _PLAYER_COLORS = ['#ff6b6b','#4ecdc4','#45b7d1','#96e6a1','#ffd93d','#ff9a3c','#c779d0','#6bcb77'];
function _playerColor(uid) {
  let h = 0;
  for (const c of uid) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return _PLAYER_COLORS[Math.abs(h) % _PLAYER_COLORS.length];
}

function _renderSessionNotes() {
  UI.renderSessionNotes(
    state.snapshot?.sessionNotes ?? {},
    true,
    _expandedNoteIds,
    _noteLocks,
    state.myUid
  );
}

const _inputSceneImage   = document.getElementById('input-scene-image');
const _btnUploadScene    = document.getElementById('btn-upload-scene');
const _btnChangeScene    = document.getElementById('btn-change-scene');
const _sceneUploadModal  = document.getElementById('scene-upload-modal');
const _sceneDropZone     = document.getElementById('scene-drop-zone');
const _sceneDropText     = document.getElementById('scene-drop-text');

function _openSceneModal()  { _sceneUploadModal.classList.remove('hidden'); }
function _closeSceneModal() { _sceneUploadModal.classList.add('hidden'); }

_btnUploadScene.addEventListener('click', _openSceneModal);
_btnChangeScene.addEventListener('click', _openSceneModal);
document.getElementById('btn-scene-cancel').addEventListener('click', _closeSceneModal);
_sceneUploadModal.addEventListener('click', (e) => { if (e.target === _sceneUploadModal) _closeSceneModal(); });

async function _handleSceneFile(file, name) {
  if (!state.session) return;
  _sceneDropZone.classList.add('uploading');
  _sceneDropText.textContent = '⏳ Caricamento...';
  try {
    const url = await _uploadToDiscord(file);
    await state.session.setSceneImage(url, name ?? file.name);
    _closeSceneModal();
  } catch (err) {
    console.error(err);
    const banner = document.getElementById('error-message-combat');
    banner.textContent = `Errore upload: ${err.message}`;
    banner.classList.remove('hidden');
    setTimeout(() => banner.classList.add('hidden'), 5000);
  } finally {
    _sceneDropZone.classList.remove('uploading');
    _sceneDropText.textContent = 'Trascina un\'immagine qui';
  }
}

// File picker
document.getElementById('btn-scene-pick-file').addEventListener('click', () => _inputSceneImage.click());
_inputSceneImage.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';
  await _handleSceneFile(file);
});

// Drag & drop
_sceneDropZone.addEventListener('dragover',  (e) => { e.preventDefault(); _sceneDropZone.classList.add('drag-over'); });
_sceneDropZone.addEventListener('dragleave', ()  => { _sceneDropZone.classList.remove('drag-over'); });
_sceneDropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  _sceneDropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file?.type.startsWith('image/')) await _handleSceneFile(file);
});

// Paste (scoped al modal aperto)
document.addEventListener('paste', async (e) => {
  if (_sceneUploadModal.classList.contains('hidden')) return;
  const imageItem = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'));
  if (!imageItem) return;
  await _handleSceneFile(imageItem.getAsFile(), 'scena-incollata.png');
});

document.getElementById('btn-clear-scene').addEventListener('click', async () => {
  if (state.session) await state.session.clearSceneImage();
});

// ─── CRONACHE: Note di sessione collaborative ─────────────────────────────────

document.getElementById('btn-add-session-note').addEventListener('click', async () => {
  if (!state.session) return;
  const newId = await state.session.addSessionNote();
  if (newId) {
    _expandedNoteIds.add(newId);
    // Firebase listener potrebbe aver già re-renderizzato prima che newId fosse in _expandedNoteIds;
    // forziamo subito un secondo render con la nota espansa.
    _renderSessionNotes();
    document.getElementById('session-notes-list')
      ?.querySelector(`[data-note-id="${newId}"] .note-textarea`)
      ?.focus();
  }
});

document.getElementById('session-notes-list').addEventListener('click', async (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  // Delete va controllato PRIMA di toggle: il bottone × è dentro l'header toggle
  const deleteEl = e.target.closest('[data-action="delete"]');
  if (deleteEl) {
    if (confirm('Eliminare questa nota di sessione?')) {
      _expandedNoteIds.delete(deleteEl.dataset.noteId);
      await state.session.deleteSessionNote(deleteEl.dataset.noteId);
    }
    return;
  }

  const toggleEl = e.target.closest('[data-action="toggle"]');
  if (toggleEl) {
    const id = toggleEl.dataset.noteId;
    _expandedNoteIds.has(id) ? _expandedNoteIds.delete(id) : _expandedNoteIds.add(id);
    _renderSessionNotes();
  }
});

document.getElementById('session-notes-list').addEventListener('input', (e) => {
  const noteId = e.target.dataset.noteId;
  if (!noteId || !state.session) return;

  if (e.target.classList.contains('note-textarea')) {
    clearTimeout(_noteDebounceTimers[noteId]);
    _noteDebounceTimers[noteId] = setTimeout(
      () => state.session.updateSessionNote(noteId, { content: e.target.value }),
      1200
    );
  }
  if (e.target.classList.contains('note-title-input')) {
    clearTimeout(_noteDebounceTimers[noteId + '_title']);
    _noteDebounceTimers[noteId + '_title'] = setTimeout(
      () => state.session.updateSessionNote(noteId, { title: e.target.value }),
      800
    );
  }
  if (e.target.classList.contains('note-date-input') && e.target.value) {
    state.session.updateSessionNote(noteId, { date: new Date(e.target.value).getTime() });
  }
});

document.getElementById('session-notes-list').addEventListener('focusin', (e) => {
  const el = e.target.closest('.note-textarea, .note-title-input');
  if (!el || !state.session || !state.myUid) return;
  const noteId = el.dataset.noteId;
  const lock = _noteLocks[noteId];
  if (lock && lock.uid !== state.myUid) return;
  const name  = state.sheetData?.characterName || state.session.displayName || 'Giocatore';
  state.session.acquireNoteLock(noteId, state.myUid, name, _playerColor(state.myUid));
});

document.getElementById('session-notes-list').addEventListener('focusout', (e) => {
  const el = e.target.closest('.note-textarea, .note-title-input');
  if (!el || !state.session) return;
  const noteId    = el.dataset.noteId;
  const noteEntry = e.target.closest('.note-entry');
  // Rilascia solo se il focus esce dalla nota intera (es. da textarea a titolo = mantieni lock)
  if (noteEntry && noteEntry.contains(e.relatedTarget)) return;
  state.session.releaseNoteLock(noteId);
});

// Modal archivio note (aperto da home.js tramite evento)
document.getElementById('btn-notes-archive-close').addEventListener('click', () => {
  document.getElementById('notes-archive-modal').classList.add('hidden');
});
document.getElementById('notes-archive-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('notes-archive-modal'))
    document.getElementById('notes-archive-modal').classList.add('hidden');
});

// ─── PROGRESSIONE: Modalità e assegnazione XP ────────────────────────────────

document.getElementById('select-progression-mode-live').addEventListener('change', (e) => {
  if (state.session) state.session.setProgressionMode(e.target.value);
});

document.getElementById('btn-award-xp').addEventListener('click', async () => {
  const amount = parseInt(document.getElementById('input-xp-amount')?.value) || 0;
  if (!amount || !state.session) return;
  const checked = [...document.querySelectorAll('.xp-player-check:checked')];
  for (const cb of checked) await state.session.addXp(cb.dataset.id, amount);
  document.getElementById('input-xp-amount').value = '';
});

// ─── SCHEDA: Torna indietro ───────────────────────────────────────────────────

document.getElementById('btn-back-to-combat').addEventListener('click', () => {
  document.body.classList.remove('sheet-only');
  const embedded = window.matchMedia('(min-width: 1100px)').matches
    && document.body.classList.contains('has-sheet')
    && document.body.classList.contains('in-combat');
  if (embedded) return;
  if (state.sheetReturnView === 'view-home') {
    document.body.classList.remove('has-sheet');
    UI.showView('view-home');
    loadCharacterLibrary();
  } else {
    UI.showView('view-combat');
  }
});

// ─── MODAL Level Up ───────────────────────────────────────────────────────────

LevelUpUI.bindConfirm();
LevelUpUI.bindCancel();

// ─── MODAL Condizioni ─────────────────────────────────────────────────────────

document.getElementById('btn-close-modal').addEventListener('click', closeConditionModal);
document.getElementById('condition-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('condition-modal')) closeConditionModal();
});

// ─── Rejoin via evento custom da home.js ─────────────────────────────────────

document.addEventListener('dnd:rejoin', (e) => {
  const { code, combatantId, role, charId } = e.detail;
  _rejoinSession(code, combatantId, role, charId);
});

// ─── Core orchestration ───────────────────────────────────────────────────────

function _renderShipPanel() {
  const el = document.getElementById('ship-panel');
  if (!el || !state.shipPanelOpen) return;
  const combatants = Object.entries(state.snapshot?.combatants ?? {})
    .map(([id, c]) => ({ id, ...c }));
  el.innerHTML = ShipUI.renderShipPanel(
    state.shipData,
    combatants,
    state.myUid,
    state.session.isMaster,
    state.localDeck,
    state._selectedShipToken
  );
}

function _bindShipEvents() {
  const el = document.getElementById('ship-panel');
  if (!el || el._shipBound) return;
  el._shipBound = true;

  el.addEventListener('click', async (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;

    if (action === 'ship-hp') {
      if (!state.session.isMaster) return;
      await state.ship.updateHp(parseInt(target.dataset.delta) || 0);
      return;
    }
    if (action === 'toggle-crew') {
      const cId = target.dataset.combatant;
      const c   = state.snapshot?.combatants?.[cId];
      if (!c) return;
      if (!state.session.isMaster && c.ownerUid !== state.myUid) return;
      await state.ship.toggleCrewMember(target.dataset.weapon, cId);
      _renderShipPanel();
      return;
    }
    if (action === 'switch-deck') {
      state.localDeck = target.dataset.deck;
      state._selectedShipToken = null;
      _renderShipPanel();
      return;
    }
    if (action === 'select-token') {
      const cId = target.closest('[data-combatant]')?.dataset.combatant;
      if (!cId) return;
      const c = state.snapshot?.combatants?.[cId];
      if (!c) return;
      if (!state.session.isMaster && c.ownerUid !== state.myUid) return;
      state._selectedShipToken = state._selectedShipToken === cId ? null : cId;
      _renderShipPanel();
      return;
    }
    if (action === 'place-token') {
      if (!state._selectedShipToken) return;
      await state.ship.setTokenPosition(
        state._selectedShipToken,
        state.localDeck,
        parseInt(target.dataset.col),
        parseInt(target.dataset.row)
      );
      state._selectedShipToken = null;
      _renderShipPanel();
      return;
    }
  });

  el.addEventListener('change', async (e) => {
    const target = e.target.closest('[data-action]');
    if (!target || target.dataset.action !== 'weapon-state') return;
    await state.ship.setWeaponState(target.dataset.weapon, target.value);
  });
}

function _enterCombatView(code, isMaster) {
  UI.renderSessionCode(code);
  UI.renderMasterPanel(isMaster);
  if (isMaster) populateCreaturePicker();
  state.sheetReturnView    = 'view-combat';
  state.ship               = new Ship(db, code);
  state.shipData           = null;
  state.localDeck          = 'main';
  state.shipPanelOpen      = false;
  state._selectedShipToken = null;
  document.getElementById('grid-section')?.classList.remove('hidden');
  document.getElementById('ship-panel')?.classList.add('hidden');
  document.body.classList.add('in-combat');
  _startListening();
  _bindShipEvents();
  GridUI.initGridControls(() => state.session.resetGrid());
  const _btnGridReset = document.getElementById('btn-grid-reset');
  if (_btnGridReset) _btnGridReset.style.display = isMaster ? '' : 'none';
  _initGridMasterControls(isMaster);
  UI.showView('view-combat');
}

let _gridMasterBound = false;
function _initGridMasterControls(isMaster) {
  const wrap    = document.getElementById('grid-master-controls');
  const editBtn = document.getElementById('btn-grid-edit');
  if (wrap)    wrap.style.display    = isMaster ? 'flex' : 'none';
  if (editBtn) editBtn.style.display = isMaster ? '' : 'none';
  if (!isMaster) { state.gridEditMode = false; _applyGridEditUI(); return; }
  if (_gridMasterBound) { _applyGridEditUI(); return; }
  _gridMasterBound = true;

  editBtn?.addEventListener('click', () => {
    const turningOff = state.gridEditMode;
    state.gridEditMode = !state.gridEditMode;
    if (turningOff) _applyGridDims();   // commit eventuali dimensioni in sospeso
    _applyGridEditUI();
    _rerenderGridFromSnapshot();
  });

  // Le dimensioni si applicano al blur / Enter (change), senza tasto dedicato
  ['input-grid-cols', 'input-grid-rows'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', _applyGridDims);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); _applyGridDims(); el.blur(); }
    });
  });

  document.getElementById('select-token-size')?.addEventListener('change', (e) => {
    const id = state.selectedGridTokenId;
    if (id) state.combatantManager.setSize(id, e.target.value);
  });

  _applyGridEditUI();
}

function _applyGridDims() {
  const cols = document.getElementById('input-grid-cols')?.value;
  const rows = document.getElementById('input-grid-rows')?.value;
  if (cols != null && cols !== '' && rows != null && rows !== '') {
    state.session.setGridConfig(cols, rows);
  }
}

function _applyGridEditUI() {
  const on       = state.gridEditMode;
  const editCtrl = document.getElementById('grid-edit-controls');
  const editBtn  = document.getElementById('btn-grid-edit');
  const hint     = document.getElementById('grid-hint');
  if (editCtrl) editCtrl.style.display = on ? 'flex' : 'none';
  if (editBtn) {
    editBtn.textContent = on ? '✓ Fine modifica' : '✏️ Modifica griglia';
    editBtn.classList.toggle('active', on);
  }
  if (hint) {
    hint.textContent = on
      ? '✏️ Modifica: imposta le dimensioni e clicca le caselle vuote per i muri'
      : '1 casella = 1 m · Seleziona un token, poi tocca la destinazione';
  }
}

function _rerenderGridFromSnapshot() {
  if (!state.snapshot) return;
  const data   = state.snapshot;
  const sorted = state.tracker.sortedCombatants(data.combatants);
  renderGrid(data.grid || {}, data.combatants || {}, data.currentTurnId ?? null, sorted, data.gridConfig || null, data.walls || {});
}

// ─── Pannello dettaglio (dashboard): selezione griglia/rail, fallback sul turno attivo ───
let _lastTurnIdSeen = null;

function _renderDetailPanel(data, sorted, callbacks, progressionData) {
  const detailId   = state.selectedGridTokenId ?? data.currentTurnId ?? null;
  const detailComb = detailId ? sorted.filter(c => c.id === detailId) : [];
  UI.renderCombatantList(detailComb, data.currentTurnId ?? null, state.myUid, state.session.masterUid, callbacks, state.acMap, state.sheetData?.deathSaves ?? null, progressionData, 'detail-list', 'empty-detail-msg', sorted);
}

// Selezione cambiata da griglia/rail/token-bar: ri-renderizza solo il dettaglio
document.addEventListener('dnd:selection-changed', () => {
  const data = state.snapshot;
  if (!data) return;
  const sorted    = state.tracker.sortedCombatants(data.combatants);
  const callbacks = makeCallbacks();
  const progressionData = {
    mode:           data.progressionMode ?? 'xp',
    xp:             data.xp ?? {},
    levelUpGranted: data.levelUpGranted ?? {},
  };
  _renderDetailPanel(data, sorted, callbacks, progressionData);
});

// Modal "Aggiungi alla battaglia" (aperto dal rail dei turni)
document.getElementById('btn-add-combatant-close')?.addEventListener('click', () =>
  document.getElementById('add-combatant-modal')?.classList.add('hidden'));
document.addEventListener('dnd:add-combatant', () =>
  document.getElementById('add-combatant-modal')?.classList.remove('hidden'));

function _startListening() {
  state.session.listenNoteLocks(locks => {
    _noteLocks = locks;
    _renderSessionNotes();
  });

  state.session.listen((snap) => {
    const data = snap.val();
    if (!data) return;
    state.snapshot = data;

    UI.renderLogs(data.logs || {});

    const combatants = data.combatants || {};
    if (!state.session.isMaster && state.myCombatantId && !combatants[state.myCombatantId]) {
      exitToHome('Il tuo personaggio è stato rimosso dalla sessione.');
      return;
    }

    if (state.myCombatantId && combatants[state.myCombatantId]) {
      const currentHp = combatants[state.myCombatantId].hpCurrent;
      if (state.lastKnownHp !== null && state.lastKnownHp !== currentHp) {
        const delta  = currentHp - state.lastKnownHp;
        const amount = Math.abs(delta);
        if (delta < 0) {
          UI.showNotification(`🗡 Hai ricevuto ${amount} danni!`, 'damage');
        } else if (delta > 0) {
          UI.showNotification(`✚ Hai ricevuto ${amount} punti vita!`, 'heal');
        }
      }
      state.lastKnownHp = currentHp;
    }

    // Al cambio turno la selezione torna sul combattente attivo
    if (data.currentTurnId !== _lastTurnIdSeen) {
      _lastTurnIdSeen = data.currentTurnId ?? null;
      state.selectedGridTokenId = null;
    }

    const sorted   = state.tracker.sortedCombatants(data.combatants);
    const creatures = sorted.filter(c => c.type === 'creature');
    const players   = sorted.filter(c => c.type === 'player' || c.type === 'pet');
    UI.renderRound(data.round ?? 1);
    const callbacks = makeCallbacks();
    const progressionData = {
      mode:           data.progressionMode ?? 'xp',
      xp:             data.xp ?? {},
      levelUpGranted: data.levelUpGranted ?? {},
    };
    UI.renderCombatantList(creatures, data.currentTurnId ?? null, state.myUid, state.session.masterUid, callbacks, state.acMap, null,                               progressionData, 'creature-list', 'empty-creatures-msg', sorted);
    UI.renderCombatantList(players,   data.currentTurnId ?? null, state.myUid, state.session.masterUid, callbacks, state.acMap, state.sheetData?.deathSaves ?? null, progressionData, 'player-list',   'empty-players-msg', sorted);

    _renderDetailPanel(data, sorted, callbacks, progressionData);

    renderGrid(data.grid || {}, data.combatants || {}, data.currentTurnId ?? null, sorted, data.gridConfig || null, data.walls || {});

    if (state.session.isMaster) {
      const cfg = data.gridConfig || { cols: 20, rows: 20 };
      const colsInput = document.getElementById('input-grid-cols');
      const rowsInput = document.getElementById('input-grid-rows');
      if (colsInput && document.activeElement !== colsInput) colsInput.value = cfg.cols;
      if (rowsInput && document.activeElement !== rowsInput) rowsInput.value = cfg.rows;
    }

    const isMaster = data.masterUid === state.myUid;
    UI.renderScenePanel(data.sceneImageUrl ?? null, data.sceneImageName ?? null, isMaster);

    // Progressione: aggiorna controlli master
    const selLive = document.getElementById('select-progression-mode-live');
    if (selLive) selLive.value = data.progressionMode ?? 'xp';
    document.getElementById('btn-award-xp-open')?.classList.toggle('hidden', (data.progressionMode ?? 'xp') !== 'xp');
    const onlyPlayers = sorted.filter(c => c.type === 'player');
    const xpPlayersEl = document.getElementById('xp-award-players');
    if (xpPlayersEl && isMaster) {
      xpPlayersEl.innerHTML = onlyPlayers.map(c => {
        const xp  = data.xp?.[c.id] ?? 0;
        const lvl = c.level ?? 1;
        return `<label class="xp-player-row">
          <input type="checkbox" class="xp-player-check" data-id="${c.id}" checked>
          ${esc(c.name)} <span class="xp-player-meta">Lv.${lvl} — ${xp.toLocaleString('it')} XP</span>
        </label>`;
      }).join('');
    }

    state.shipData = data.ship ?? null;
    if (state.shipPanelOpen) _renderShipPanel();

    _renderSessionNotes();
  });
}

async function _rejoinSession(code, savedCombatantId, role, savedCharId = null) {
  try {
    const uid = await state.session.restore(code);
    if (!uid) {
      UI.showError('La sessione non è più disponibile.');
      await remove(ref(db, `userSessions/${uid}/${code}`));
      await loadUserSessions(state.myUid || auth.currentUser?.uid);
      return;
    }
    const isMaster = role === 'master';
    if (!isMaster && !savedCombatantId) {
      UI.showError('Non è possibile recuperare il personaggio.');
      return;
    }
    state.myUid         = uid;
    state.myCombatantId = savedCombatantId || null;
    state.lastKnownHp   = null;
    localStorage.setItem('dnd_session_code', code);
    if (savedCombatantId) localStorage.setItem('dnd_combatant_id', savedCombatantId);
    initCombatManagers(code);
    if (!isMaster) initSheet(uid, savedCharId);
    _enterCombatView(code, isMaster);
  } catch (err) {
    UI.showError('Errore nel rientro: ' + err.message);
  }
}

// ─── Avvio ────────────────────────────────────────────────────────────────────

(async () => {
  try {
    await state.session.ensureAuth();
  } catch { /* nessun auth state — gestito come non autenticato */ }
  updateHomeAuthUI(auth.currentUser);

  const savedCode        = localStorage.getItem('dnd_session_code');
  const savedCombatantId = localStorage.getItem('dnd_combatant_id');
  if (!savedCode) return;

  try {
    const uid = await state.session.restore(savedCode);
    if (!uid) {
      localStorage.removeItem('dnd_session_code');
      localStorage.removeItem('dnd_combatant_id');
      return;
    }

    if (!state.session.isMaster && !savedCombatantId) {
      localStorage.removeItem('dnd_session_code');
      return;
    }

    let savedCharId = null;
    const userSessionSnap = await get(ref(db, `userSessions/${uid}/${savedCode}`));
    if (userSessionSnap.exists()) savedCharId = userSessionSnap.val().charId ?? null;

    state.myUid         = uid;
    state.myCombatantId = savedCombatantId;
    initCombatManagers(savedCode);
    if (!state.session.isMaster) initSheet(uid, savedCharId);
    _enterCombatView(savedCode, state.session.isMaster);
  } catch {
    localStorage.removeItem('dnd_session_code');
    localStorage.removeItem('dnd_combatant_id');
  }
})();
