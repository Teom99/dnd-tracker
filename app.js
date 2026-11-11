import { initializeApp }      from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase, ref, get, remove } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { getAuth }            from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

import { FIREBASE_CONFIG, DISCORD_WEBHOOK_URL } from './config.js';
import { getMonsterList, getMonster, getSpellList, getConditionDescriptions } from './src/utils/DndApi.js';
import { Session }           from './src/data/Session.js';
import { CharacterLibrary }  from './src/data/CharacterLibrary.js';
import * as UI               from './src/ui/UI.js';
import * as GridUI           from './src/ui/GridUI.js';
import { state }             from './src/utils/state.js';
import { initCombatManagers, exitToHome, esc, closeConditionModal, detachSessionListeners, setJoinBusy } from './src/views/core.js';
import { renderGrid, toggleTemplatePlacement, clearTemplate, toggleDrawMode, setDrawColor, clearPaint, setDrawTool, toggleDrawFill, setDrawSize, setDrawShape, undoPaint, redoPaint } from './src/logic/grid.js';
import { initSheet, makeCallbacks } from './src/views/sheet.js';
import { LevelUp }   from './src/logic/LevelUp.js';
import { LevelUpUI } from './src/ui/LevelUpUI.js';
import { Ship }    from './src/data/Ship.js';
import * as ShipUI from './src/ui/ShipUI.js';
import { captureFocusState, restoreFocusState } from './src/utils/domPreserve.js';
import { playerColor } from './src/utils/presence.js';
import { initTheme, toggleTheme } from './src/utils/theme.js';
import { icon } from './src/ui/icons.js';
import { num, attr } from './src/utils/sanitize.js';
import { askConfirm, askText, askChoice } from './src/ui/dialogs.js';
import * as CombatChrome from './src/ui/CombatChrome.js';
import { toolTransition, toolFromState, nextInTurnOrder } from './src/logic/combatChrome.js';
import { trajectoryClearButtons } from './src/logic/trajectory.js';
import { updateHomeAuthUI, loadCharacterLibrary, populateJoinPicker, populateCreaturePicker, saveUserSession, loadUserSessions } from './src/views/home.js';

// --- Tema chiaro/notte ---
// Il bottone mostra il tema a cui si passa: sole in notte, luna in chiaro.
function _syncThemeButtons() {
  const night = document.documentElement.dataset.theme === 'night';
  const label = night ? 'Tema chiaro' : 'Tema notte';
  const ico   = icon(night ? 'sun' : 'crescent');
  const home   = document.getElementById('btn-theme-toggle-home');
  const auth   = document.getElementById('btn-theme-toggle-auth');   // schermata di accesso (la topbar della home ha il suo, ma nascosto finché non si è dentro)
  const combat = document.getElementById('btn-theme-toggle-combat');
  home.innerHTML   = ico;
  auth.innerHTML   = ico;
  combat.innerHTML = `${ico}<span class="lbl">${label}</span>`;
  for (const b of [home, auth, combat]) { b.setAttribute('aria-label', label); b.title = label; }
}
document.getElementById('btn-theme-toggle-home').addEventListener('click', toggleTheme);
document.getElementById('btn-theme-toggle-auth').addEventListener('click', toggleTheme);
document.getElementById('btn-theme-toggle-combat').addEventListener('click', toggleTheme);
initTheme();
CombatChrome.init();
// data-theme cambia anche senza click (cambio tema di sistema): si osserva l'attributo
new MutationObserver(_syncThemeButtons).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
_syncThemeButtons();

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
  const name = await askText({ title: 'Nuova creatura', label: 'Nome della creatura', confirmLabel: 'Aggiungi' });
  if (!name) return;
  await state.library.create(name, 'creature');
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

// Logica condivisa di ingresso in sessione: usata sia dal form "Entra nella
// sessione" (con eventuale personaggio scelto dal picker) sia dal tasto
// "Entra" diretto sotto ogni personaggio in libreria (dnd:join-with-character).
//
// _joinInProgress blocca chiamate concorrenti (es. doppio click su un tasto
// senza feedback immediato): due chiamate sovrapposte possono entrambe trovare
// lo stesso combattente esistente, aprire ciascuna il proprio confirm() (che
// blocca l'intero thread JS, quindi i due dialoghi si accodano invece di
// escludersi a vicenda), e finire per scrivere risultati incoerenti tra loro
// sullo stesso record — causa concreta di un personaggio corrotto in sessione.
let _joinInProgress = false;

async function _joinSessionAsCharacter(code, name, charId, initiative = '0') {
  if (_joinInProgress) return;
  _joinInProgress = true;
  try {
    await _doJoinSessionAsCharacter(code, name, charId, initiative);
  } finally {
    _joinInProgress = false;
  }
}

async function _doJoinSessionAsCharacter(code, name, charId, initiative = '0') {
  // join() sovrascrive il rientro automatico: se l'ingresso viene annullato si rimette com'era
  const prev = { code: localStorage.getItem('dnd_session_code'), combatant: localStorage.getItem('dnd_combatant_id') };
  state.myUid = await state.session.join(code);
  initCombatManagers(code);

  let createdCharId = null;   // scheda nuova creata da questa chiamata: se si annulla l'ingresso, si toglie
  if (!charId) {
    if (!state.library && auth.currentUser) state.library = new CharacterLibrary(db, auth.currentUser.uid);
    if (state.library) charId = createdCharId = await state.library.create(name, 'player');
  }

  const existing = await state.combatantManager.findByOwner(state.myUid);
  let savedCharName = name;
  if (existing) {
    const existingName = existing.name || 'il tuo personaggio';
    const choice = await askChoice({
      title: 'Sei già in questa sessione',
      text: `Sei già presente con il personaggio "${existingName}".`,
      primaryLabel: `Rientra con "${existingName}"`,
      secondaryLabel: `Sostituisci con "${name}"`,
    });
    if (choice === null) {
      if (createdCharId) { try { await state.library.delete(createdCharId); } catch { /* resta una scheda in più */ } }
      for (const [key, v] of [['dnd_session_code', prev.code], ['dnd_combatant_id', prev.combatant]]) {
        if (v == null) localStorage.removeItem(key); else localStorage.setItem(key, v);
      }
      state.session.code = null;
      const cancelled = new Error('Ingresso annullato.');
      cancelled.cancelled = true;
      throw cancelled;
    }
    if (choice === 'primary') {
      state.myCombatantId = existing.id;
      if (createdCharId && existing.charId && existing.charId !== createdCharId) {
        // la scheda appena creata per questo ingresso resterebbe orfana in libreria
        try { await state.library.delete(createdCharId); } catch { /* resta una scheda in più */ }
      }
      savedCharName = existing.name || name;
      if (!existing.name) await state.combatantManager.setName(existing.id, name);
      charId = existing.charId ?? charId;
    } else {
      await state.combatantManager.remove(existing.id);
      state.myCombatantId = await state.combatantManager.add(name, initiative, null, 'player', state.myUid, charId);
    }
  } else {
    state.myCombatantId = await state.combatantManager.add(name, initiative, null, 'player', state.myUid, charId);
  }

  // Avviato solo ora che myCombatantId e charId sono definitivi: la primissima
  // sincronizzazione HP max/avatar/nome dalla scheda (dentro setupSheetListener,
  // condizionata su state.myCombatantId) deve trovarlo già valorizzato, altrimenti
  // viene scartata silenziosamente e il combattente resta bloccato ai placeholder
  // (hpMax 1, nessun avatar) finché la scheda non cambia di nuovo per altri motivi.
  initSheet(state.myUid, charId);

  state.selectedJoinCharId = null;
  localStorage.setItem('dnd_combatant_id', state.myCombatantId);
  await saveUserSession(state.myUid, code, state.myCombatantId, savedCharName, 'player', charId);
  state.lastKnownHp = null;
  state.seenLogIds  = null;
  _enterCombatView(code, false);
}

document.getElementById('form-join').addEventListener('submit', async (e) => {
  e.preventDefault();

  const code       = document.getElementById('input-session-code').value.trim().toUpperCase();
  const name       = document.getElementById('input-pg-name').value.trim();
  const initiative = document.getElementById('input-pg-initiative').value || '0';

  if (!code || !name) {
    UI.showError('Inserisci codice sessione e nome personaggio.');
    return;
  }

  setJoinBusy(true);

  try {
    await _joinSessionAsCharacter(code, name, state.selectedJoinCharId ?? null, initiative);
  } catch (err) {
    if (!err.cancelled) UI.showError(err.message);
    setJoinBusy(false);
  }
});

// Tasto "Entra" diretto sotto ogni personaggio della libreria (bypassa il
// form/picker principale — usa il charId della card, nessuna ambiguità).
document.addEventListener('dnd:join-with-character', async (e) => {
  const { code, charId, name } = e.detail;
  if (!code || !charId) return;
  try {
    await _joinSessionAsCharacter(code, name, charId);
  } catch (err) {
    if (!err.cancelled) UI.showError(err.message);
    // riattiva campo e tasto della carta SENZA ricaricare la libreria: il codice digitato resta lì
    const form = [...document.querySelectorAll('.char-lib-join')].find(f => f.dataset.id === charId);
    form?.querySelectorAll('input, button').forEach(el => { el.disabled = false; });
    if (!form) loadCharacterLibrary();
  }
});

// ─── COMBAT: Aggiungi creatura (solo master) ──────────────────────────────────

document.getElementById('btn-open-add-creature').addEventListener('click', () => {
  document.getElementById('add-creature-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('input-monster-search')?.focus(), 50);
});

function _closeAddCreatureModal() {
  document.getElementById('add-creature-modal').classList.add('hidden');
}

document.getElementById('btn-add-creature-cancel').addEventListener('click', _closeAddCreatureModal);
document.getElementById('add-creature-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('add-creature-modal')) _closeAddCreatureModal();
});

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
  _closeAddCreatureModal();
});

// ─── COMBAT: Aggiungi compagno (player only) ──────────────────────────────────

const _addPetModal = document.getElementById('add-pet-modal');
function _closeAddPetModal() { _addPetModal.classList.add('hidden'); }
document.getElementById('btn-open-add-pet').addEventListener('click', () => {
  _addPetModal.classList.remove('hidden');
  setTimeout(() => document.getElementById('input-pet-name')?.focus(), 50);
});
document.getElementById('btn-add-pet-cancel').addEventListener('click', _closeAddPetModal);
_addPetModal.addEventListener('click', (e) => { if (e.target === _addPetModal) _closeAddPetModal(); });

document.getElementById('form-add-pet').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name       = document.getElementById('input-pet-name').value.trim();
  const hp         = document.getElementById('input-pet-hp').value;
  const initiative = document.getElementById('input-pet-initiative').value || '0';
  const ac         = document.getElementById('input-pet-ac').value || null;

  if (!name || !hp) return;

  await state.combatantManager.add(name, initiative, hp, 'pet', state.myUid, null, ac, null);
  e.target.reset();
  _closeAddPetModal();
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

// Dock giocatore — azioni rapide (condizioni, scheda, fine turno, death saves)
function _onDockClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === 'dock-more') { CombatChrome.set({ moreOpen: !state.ui.moreOpen, spellsOpen: false }); return; }
  if (btn.closest('#dock-more')) CombatChrome.set({ moreOpen: false });
  const cb = makeCallbacks();
  // Per il master il soggetto del dock è la creatura/PG selezionato da carte o iniziativa; per il player è il proprio combattente
  const subjectId = state.session?.isMaster ? state.selectedDockId : state.myCombatantId;
  if (!subjectId) return;
  if (action === 'dock-conditions') { cb.onOpenConditions?.(subjectId); return; }
  if (action === 'dock-spells') {
    const open = !state.ui.spellsOpen;
    if (open) UI.renderSpellsPopover(state.sheet ? (state.sheetData || {}) : null);
    CombatChrome.set({ spellsOpen: open });
    return;
  }
  if (action === 'view-stat-block') {
    const idx = btn.dataset.apiIndex;
    if (idx) getMonster(idx).then(_renderMonsterStatBlock).catch(() => { /* API non raggiungibile */ });
    return;
  }
  if (action === 'dock-sheet')      { cb.onOpenSheet?.(); return; }
  if (action === 'dock-end-turn')   { cb.onEndTurn?.(); return; }
  if (action === 'dock-attack' || action === 'dock-heal') {
    const combatants = Object.entries(state.snapshot?.combatants ?? {})
      .map(([id, c]) => ({ id, ...c }));
    UI.openDockActionModal(action === 'dock-attack' ? 'damage' : 'heal', subjectId, combatants, cb);
    return;
  }
  if (action === 'death-save') {
    const type  = btn.dataset.type;
    const index = parseInt(btn.dataset.index);
    const on    = btn.classList.contains('on');
    cb.onDeathSave?.(type, on ? index : index + 1);
    return;
  }
}
document.getElementById('my-dock')?.addEventListener('click', _onDockClick);
document.getElementById('dock-more')?.addEventListener('click', _onDockClick);

// Popover incantesimi: i rombi degli slot (stessa scrittura della scheda) e i comandi del popover
document.getElementById('spells-pop')?.addEventListener('click', (e) => {
  const dia = e.target.closest('[data-slot-level]');
  if (dia) {
    const lvl  = dia.dataset.slotLevel;
    const slot = state.sheetData?.spellSlots?.[lvl] || {};
    const max  = slot.max ?? 0, used = slot.used ?? 0;
    const next = dia.classList.contains('free') ? used + 1 : used - 1;   // rombo pieno = libero → lo uso
    state.sheet?.setSpellSlotsUsed(lvl, Math.max(0, Math.min(max, next)));
    return;
  }
  if (e.target.closest('#btn-spells-close')) { CombatChrome.set({ spellsOpen: false }); return; }
  if (e.target.closest('#btn-spells-sheet')) { CombatChrome.set({ spellsOpen: false }); makeCallbacks().onOpenSheet?.(); }
});

// Dock master: mostra il combattente selezionato (da carte o tabella iniziativa)
function _refreshMasterDock() {
  if (!state.session?.isMaster) return;
  const id  = state.selectedDockId;
  const raw = id ? state.snapshot?.combatants?.[id] : null;
  UI.renderMasterDock(raw ? { ...raw, id } : null);
}

// Imposta il soggetto del dock (indipendente dalla selezione/movimento griglia)
function _setDockSubject(id) {
  state.selectedDockId = id;
  _refreshMasterDock();
  _renderCombatLists();        // aggiorna l'evidenziazione delle carte
  _rerenderGridFromSnapshot(); // aggiorna l'evidenziazione della tabella iniziativa
}

document.addEventListener('dnd:dock-select', (e) => _setDockSubject(e.detail?.id ?? null));

// Dalla riga dell'iniziativa: modifica rapida del numero e stella dell'ispirazione
document.addEventListener('dnd:initiative-change', (e) => {
  makeCallbacks().onInitiativeChange?.(e.detail.id, e.detail.value);
});
document.addEventListener('dnd:toggle-inspiration', (e) => {
  makeCallbacks().onToggleInspiration?.(e.detail.id, e.detail.current);
});
document.addEventListener('dnd:rerender-grid', () => _rerenderGridFromSnapshot());
document.addEventListener('dnd:grid-mode-changed', () => _syncGridModeUI());

// Bottone "Scheda mostro" nelle card creature (master-only, riapre il stat block)
document.getElementById('creature-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action="view-stat-block"]');
  if (!btn) return;
  const idx = btn.dataset.apiIndex;
  if (!idx) return;
  btn.disabled = true;   // in attesa della risposta dell'API
  try {
    const data = await getMonster(idx);
    _renderMonsterStatBlock(data);
  } catch { /* API non raggiungibile */ }
  finally { btn.disabled = false; }
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
        li.textContent     = 'Caricamento…';
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
    `background:var(--c-paper)`, `border:1px solid var(--c-rule)`,
    `border-radius:0 0 var(--r) var(--r)`,
    'max-height:220px', 'overflow-y:auto',
    `box-shadow:0 4px 14px var(--c-shadow)`, 'margin:0', 'padding:0',
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
  const advanced = await state.tracker.nextTurn(sorted, currentId);
  if (advanced && nextActive) {
    await state.session.addLogEvent(`È il turno di ${nextActive.name}!`, 'turn', { actor: nextActive.name });
  }
});

document.getElementById('btn-reset').addEventListener('click', async () => {
  if (!await askConfirm({ title: 'Resettare l\'incontro?', text: 'Tutti i combattenti verranno rimossi dall\'incontro.', confirmLabel: 'Resetta', danger: true })) return;
  await state.combatantManager.removeAll();
  // Senza questo, grid/ restava pieno di voci orfane: i combattenti erano
  // spariti ma le loro celle risultavano ancora occupate — e siccome il token
  // non viene più disegnato, erano celle occupate INVISIBILI che bloccavano
  // per sempre piazzamento e muri.
  await state.session.clearAllGridPositions();
  await state.tracker.reset();
  await state.session.addLogEvent('Incontro resettato - tutti i combattenti rimossi', 'turn');
});

document.getElementById('btn-rest-short').addEventListener('click', async () => {
  if (!await askConfirm({ title: 'Riposo breve', text: 'Tutti i giocatori (e i famigli) recuperano metà della loro vita massima.', confirmLabel: 'Riposo breve' })) return;
  await state.combatantManager.restParty('short');
  await state.session.addLogEvent('Riposo breve — il gruppo recupera metà della vita massima', 'heal');
});

document.getElementById('btn-rest-long').addEventListener('click', async () => {
  if (!await askConfirm({ title: 'Riposo lungo', text: 'Tutti i giocatori (e i famigli) recuperano tutta la vita e perdono gli HP temporanei.', confirmLabel: 'Riposo lungo' })) return;
  await state.combatantManager.restParty('long');
  await state.session.addLogEvent('Riposo lungo — il gruppo recupera tutta la vita', 'heal');
});

document.getElementById('btn-copy-code').addEventListener('click', () => {
  navigator.clipboard.writeText(state.session.code).then(() => {
    const lbl = document.querySelector('#btn-copy-code .lbl');
    if (!lbl) return;
    lbl.textContent = 'Codice copiato';
    setTimeout(() => (lbl.textContent = 'Copia codice'), 2000);
  });
});

document.getElementById('btn-exit-session').addEventListener('click', async () => {
  if (!await askConfirm({ title: 'Uscire dalla sessione?', text: 'Potrai rientrare dalla home con lo stesso codice.', confirmLabel: 'Esci' })) return;
  exitToHome();
});

document.getElementById('btn-clear-log').addEventListener('click', async () => {
  if (await askConfirm({ title: 'Svuotare il diario?', text: 'Le voci verranno cancellate per tutta la compagnia.', confirmLabel: 'Svuota', danger: true })) {
    state.session.clearLogs();
  }
});

document.getElementById('btn-toggle-ship').addEventListener('click', () => {
  state.shipPanelOpen = !state.shipPanelOpen;
  document.querySelector('.combat-shell').classList.toggle('hidden', state.shipPanelOpen);
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
  _sceneDropText.textContent = 'Caricamento…';
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

// Scena in finestra: chiunque può caricarla, cambiarla ed eliminarla; chiudere vale solo per chi chiude.
document.getElementById('btn-clear-scene').addEventListener('click', async () => {
  if (!state.session) return;
  if (!await askConfirm({ title: 'Eliminare la scena?', text: 'La scena sparirà per tutta la compagnia.', confirmLabel: 'Elimina', danger: true })) return;
  await state.session.clearSceneImage();
});
document.getElementById('btn-close-scene').addEventListener('click', UI.closeSceneLocally);
document.getElementById('btn-view-scene').addEventListener('click', UI.openSceneLocally);
document.getElementById('scene-modal').addEventListener('click', (e) => { if (e.target.id === 'scene-modal') UI.closeSceneLocally(); });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const upload = document.getElementById('scene-upload-modal');
  if (!upload.classList.contains('hidden')) { _closeSceneModal(); return; }   // prima il caricamento, poi la scena
  UI.closeSceneLocally();
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
    if (await askConfirm({ title: 'Eliminare la nota?', text: 'La nota sparirà per tutta la compagnia.', confirmLabel: 'Elimina', danger: true })) {
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
  state.session.acquireNoteLock(noteId, state.myUid, name, playerColor(state.myUid));
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

function _renderXpAwardNote() {
  const amount = parseInt(document.getElementById('input-xp-amount')?.value) || 0;
  const count  = document.querySelectorAll('#xp-award-targets .xp-target.sel').length;
  const note   = document.getElementById('xp-award-note');
  if (!note) return;
  if (!amount || !count) { note.textContent = ''; return; }
  note.textContent = `${amount.toLocaleString('it')} xp a ciascuno · ${count} selezionat${count === 1 ? 'o' : 'i'} · modalità: XP`;
}

function _openXpAwardModal() {
  const snap = state.snapshot;
  if (!snap) return;
  const players = Object.entries(snap.combatants ?? {})
    .map(([id, c]) => ({ id, ...c }))
    .filter(c => c.type === 'player');
  const targetsEl = document.getElementById('xp-award-targets');
  targetsEl.innerHTML = players.map(c => {
    const xp  = num(snap.xp?.[c.id]);
    const lvl = num(c.level, 1);
    return `<div class="xp-target sel" data-id="${attr(c.id)}">
      <span class="box"></span>
      <span class="grow">${esc(c.name)} <span class="t-mono" style="color:var(--c-mute);font-size:11px;">Lv.${lvl}</span></span>
      <span class="t-mono">${xp.toLocaleString('it')} xp</span>
    </div>`;
  }).join('');
  document.getElementById('input-xp-amount').value = '';
  _renderXpAwardNote();
  document.getElementById('xp-award-modal').classList.remove('hidden');
}

document.getElementById('xp-award-section').addEventListener('click', _openXpAwardModal);

document.getElementById('xp-award-targets').addEventListener('click', (e) => {
  const row = e.target.closest('.xp-target');
  if (!row) return;
  row.classList.toggle('sel');
  _renderXpAwardNote();
});

document.getElementById('input-xp-amount').addEventListener('input', _renderXpAwardNote);

document.getElementById('xp-award-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('xp-award-modal'))
    document.getElementById('xp-award-modal').classList.add('hidden');
});

document.getElementById('btn-award-xp').addEventListener('click', async () => {
  const amount = parseInt(document.getElementById('input-xp-amount')?.value) || 0;
  if (!amount || !state.session) return;
  const selected = [...document.querySelectorAll('#xp-award-targets .xp-target.sel')];
  for (const row of selected) await state.session.addXp(row.dataset.id, amount);
  document.getElementById('xp-award-modal').classList.add('hidden');
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
  const focusSnap = captureFocusState(el);
  el.innerHTML = ShipUI.renderShipPanel(
    state.shipData,
    combatants,
    state.myUid,
    state.session.isMaster,
    state._selectedShipToken
  );
  restoreFocusState(el, focusSnap);
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
      if (!state._selectedShipToken || !target.dataset.deck) return;
      await state.ship.setTokenPosition(
        state._selectedShipToken,
        target.dataset.deck,
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
  state.shipPanelOpen      = false;
  state._selectedShipToken = null;
  document.body.classList.add('in-combat');
  document.body.classList.toggle('is-master', isMaster);
  _startListening();
  _bindShipEvents();
  GridUI.initGridControls(async () => {
    if (await askConfirm({ title: 'Svuotare la mappa?', text: 'Segnalini, muri e traiettorie vengono tolti per tutti. Il disegno resta.', confirmLabel: 'Svuota', danger: true })) state.session.resetGrid();
  });
  GridUI.setReRenderCallback(() => _rerenderGridFromSnapshot());
  const _btnGridReset = document.getElementById('btn-grid-reset');
  if (_btnGridReset) _btnGridReset.style.display = isMaster ? '' : 'none';
  _initGridMasterControls(isMaster);
  CombatChrome.apply();
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
    else { state.templatePlacingShape = null; state.templateOrigin = null; state.drawMode = false; } // mutuamente esclusivo col piazzamento template e col disegno
    _syncGridModeUI();
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
  const editBtn  = document.getElementById('btn-grid-edit');
  if (editBtn) {
    const lbl = editBtn.querySelector('.lbl');
    if (lbl) lbl.textContent = on ? 'Fine modifica mappa' : 'Muri e dimensioni mappa';
    editBtn.classList.toggle('active', on);
  }
  // Il testo di #grid-hint è gestito da GridUI.renderGrid (contestuale a modifica/selezione)
}

function _rerenderGridFromSnapshot() {
  if (!state.snapshot) return;
  const data   = state.snapshot;
  const sorted = state.tracker.sortedCombatants(data.combatants);
  renderGrid(data.grid || {}, data.combatants || {}, data.currentTurnId ?? null, sorted, data.gridConfig || null, data.walls || {});
}

// Tiene sincronizzati i tre pannelli mutuamente esclusivi della toolbar griglia
// (modifica muri / template / disegno) ad ogni cambio di modalità.
function _syncGridModeUI() {
  _applyGridEditUI();
  _applyTemplateControlsUI();
  _applyDrawControlsUI();
  // Una modalità può cambiare anche da codice esistente (es. area piazzata, modifica muri dal menu):
  // lo strumento mostrato segue sempre lo stato reale.
  _applyTrajControlsUI();
  const tool = toolFromState({
    gridEditMode: state.gridEditMode, drawMode: state.drawMode,
    templatePlacingShape: state.templatePlacingShape, currentTool: state.ui.tool,
  });
  if (tool !== state.ui.tool) state.ui.tool = tool;
  // Il primo punto della traiettoria vale solo mentre si usa lo strumento (anche se la modalità
  // cambia da un'altra via, es. "Muri e dimensioni" dal menu)
  if (state.ui.tool !== 'traj' && state.trajectoryFrom) { state.trajectoryFrom = null; _rerenderGridFromSnapshot(); }
  CombatChrome.apply();
}

function _applyTrajControlsUI() {
  const steps = document.getElementById('traj-steps');
  if (steps) steps.dataset.step = state.trajectoryFrom ? '2' : '1';
  const clear = trajectoryClearButtons(state.snapshot?.trajectories, state.myUid, !!state.session?.isMaster);
  const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
  show('btn-traj-cancel',    !!state.trajectoryFrom);
  show('btn-traj-clear',     clear.mine);
  show('btn-traj-clear-all', clear.all);
}
document.getElementById('btn-traj-cancel')?.addEventListener('click', () => {
  state.trajectoryFrom = null; _syncGridModeUI(); _rerenderGridFromSnapshot();
});
document.getElementById('btn-traj-clear')?.addEventListener('click', () => state.session.clearTrajectory(state.myUid));
document.getElementById('btn-traj-clear-all')?.addEventListener('click', () => state.session.clearAllTrajectories());

// Clic su uno dei quattro strumenti. Cambiando strumento si annulla ciò che
// il precedente aveva a metà (origine area, primo punto della traiettoria, ecc.).
function _selectTool(next) {
  const { tool, reset } = toolTransition(state.ui.tool, next);
  if (reset.includes('gridEditMode')) _applyGridDims();   // commit di eventuali dimensioni in sospeso
  for (const key of reset) {
    state[key] = (key === 'drawMode' || key === 'gridEditMode') ? false : null;
  }
  state.ui.tool = tool;
  if (tool === 'draw' && !state.drawMode) {
    toggleDrawMode();                                      // esclusivo con muri e area, come sempre
  }
  if (tool === 'area') {                                   // area: nessuna forma finché non se ne sceglie una
    state.drawMode = false;
    state.gridEditMode = false;
  }
  _syncGridModeUI();
  _rerenderGridFromSnapshot();
}
document.getElementById('grid-tools')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tool]');
  if (btn) _selectTool(btn.dataset.tool);
});
// "Adatta allo spazio": tiene le righe e sceglie le colonne in modo che la mappa riempia il rettangolo
document.getElementById('btn-grid-fit')?.addEventListener('click', async () => {
  const box = document.getElementById('grid-container')?.getBoundingClientRect();
  if (!box || !box.width || !box.height) return;
  const rows = Math.max(1, Math.min(60, state.snapshot?.gridConfig?.rows ?? 20));
  const cols = Math.max(1, Math.min(60, Math.round(rows * box.width / box.height)));
  // Restringere la mappa toglie segnalini e muri che non ci stanno più, per tutti: si chiede prima
  const cur = state.snapshot?.gridConfig?.cols ?? 20;
  const wouldDrop = cols < cur && (Object.keys(state.snapshot?.grid ?? {}).length > 0 || Object.keys(state.snapshot?.walls ?? {}).length > 0);
  if (wouldDrop && !await askConfirm({ title: 'Restringere la mappa?', text: `La mappa passa da ${cur} a ${cols} colonne: i segnalini e i muri fuori dai nuovi bordi verranno tolti, per tutti.`, confirmLabel: 'Restringi', danger: true })) return;
  state.session.setGridConfig(cols, rows);
});
document.getElementById('btn-walls-done')?.addEventListener('click', () => document.getElementById('btn-grid-edit')?.click());

// ─── TEMPLATE AD AREA (cerchio/cono/linea) ───────────────────────────────────

function _applyTemplateControlsUI() {
  document.querySelectorAll('#grid-template-controls button[data-shape]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.shape === state.templatePlacingShape);
  });
  // Passo corrente della guida: 1 forma · 2 origine · 3 orientamento e conferma
  const step = !state.templatePlacingShape ? 1 : !state.templateOrigin ? 2 : 3;
  const steps = document.getElementById('area-steps');
  if (steps) steps.dataset.step = String(step);
  const cancel = document.getElementById('btn-area-cancel');
  if (cancel) cancel.style.display = state.templatePlacingShape ? '' : 'none';
  const clearBtn = document.getElementById('btn-template-clear');
  if (!clearBtn) return;
  const t = state.snapshot?.template;
  const canClear = !!t && (state.session?.isMaster || t.ownerUid === state.myUid);
  clearBtn.style.display = canClear ? '' : 'none';
}

document.getElementById('btn-area-cancel')?.addEventListener('click', () => {
  state.templatePlacingShape = null;
  state.templateOrigin = null;
  _syncGridModeUI();
  _rerenderGridFromSnapshot();
});

document.getElementById('grid-template-controls')?.addEventListener('click', (e) => {
  const shapeBtn = e.target.closest('[data-shape]');
  if (shapeBtn) {
    toggleTemplatePlacement(shapeBtn.dataset.shape);
    _syncGridModeUI();
    return;
  }
  if (e.target.closest('#btn-template-clear')) clearTemplate();
});

// ─── DISEGNO SULLA MAPPA (colorazione caselle) ───────────────────────────────

// Mentre il color picker nativo è aperto, document.activeElement su
// #input-draw-custom non è affidabile (su alcuni browser/OS, es. macOS, il
// pannello colore è una finestra separata e l'input perde il focus "visto"
// dal DOM pur restando in modifica) — un re-render concorrente (ad ogni
// snapshot Firebase, quindi ad ogni azione di qualsiasi giocatore) sovrascrive
// altrimenti .value col colore precedente mentre l'utente sta ancora
// scegliendo. Flag esplicito su focus/blur come difesa aggiuntiva.
let _customColorPicking = false;
let _lastBrushColor = state.drawColor || '#e74c3c'; // per tornare al pennello dopo la gomma

function _applyDrawControlsUI() {
  const palette = document.getElementById('grid-draw-palette');

  document.querySelectorAll('#grid-draw-palette .draw-swatch:not(.draw-eraser)').forEach(sw => {
    sw.classList.toggle('active', state.drawColor === sw.dataset.color);
  });
  document.getElementById('btn-draw-eraser')?.classList.toggle('active', state.drawColor === null);

  const dot = document.getElementById('bucket-color-dot');
  if (dot) {
    dot.classList.toggle('is-eraser', state.drawColor === null);
    dot.style.background = state.drawColor || '';
  }

  const shapeTool = GridUI.isShapeTool(state.drawTool);
  document.querySelectorAll('#grid-draw-palette [data-draw-tool]').forEach(btn => {
    // il pennello è attivo solo con un colore: senza colore è la gomma
    const on = state.drawTool === btn.dataset.drawTool && (btn.dataset.drawTool !== 'brush' || state.drawColor !== null);
    btn.classList.toggle('active', on);
  });
  if (palette) {
    // quali gruppi di opzioni hanno senso per lo strumento scelto lo decide il CSS da questi attributi
    palette.dataset.tool  = state.drawTool;
    palette.dataset.shape = shapeTool ? '1' : '';
    palette.dataset.fill  = state.drawFill;
  }
  const fillBtn = document.getElementById('btn-draw-fill');
  if (fillBtn) {
    const filled = state.drawFill === 'filled';
    fillBtn.toggleAttribute('disabled', !shapeTool); // contorno/pieno vale solo per le forme
    fillBtn.classList.toggle('active', shapeTool && filled);
    fillBtn.innerHTML = icon(filled ? 'fill' : 'outline') + `<span class="lbl">${filled ? 'Piena' : 'Contorno'}</span>`;
    fillBtn.title = filled ? 'Forma piena (clicca per solo contorno)' : 'Solo contorno (clicca per forma piena)';
  }

  const sizeSel = document.getElementById('select-draw-size');
  if (sizeSel) {
    // la dimensione non si applica al secchiello né alle forme piene (per il contorno è lo spessore)
    sizeSel.disabled = state.drawTool === 'bucket' || (shapeTool && state.drawFill === 'filled');
    if (document.activeElement !== sizeSel) sizeSel.value = String(state.drawSize || 1);
  }

  const brushActive = state.drawTool === 'brush'; // la forma del pennello vale solo per il pennello
  document.getElementById('btn-draw-shape-square')?.classList.toggle('active', brushActive && state.drawShape !== 'round');
  document.getElementById('btn-draw-shape-round')?.classList.toggle('active', brushActive && state.drawShape === 'round');
  document.getElementById('btn-draw-shape-square')?.toggleAttribute('disabled', !brushActive);
  document.getElementById('btn-draw-shape-round')?.toggleAttribute('disabled', !brushActive);

  const customInput = document.getElementById('input-draw-custom');
  if (customInput && state.drawColor && !_customColorPicking && document.activeElement !== customInput) {
    customInput.value = state.drawColor;
  }
}


document.getElementById('grid-draw-palette')?.addEventListener('click', async (e) => {
  const toolBtn = e.target.closest('[data-draw-tool]');
  if (toolBtn) {
    setDrawTool(toolBtn.dataset.drawTool);
    // "Pennello" dopo la gomma torna all'ultimo colore usato
    if (toolBtn.dataset.drawTool === 'brush' && state.drawColor === null) setDrawColor(_lastBrushColor);
    _applyDrawControlsUI();
    return;
  }
  if (e.target.closest('#btn-draw-fill')) {
    toggleDrawFill();
    _applyDrawControlsUI();
    return;
  }
  const shapeBtn = e.target.closest('[data-draw-shape]');
  if (shapeBtn) {
    setDrawShape(shapeBtn.dataset.drawShape);
    _applyDrawControlsUI();
    return;
  }
  const swatch = e.target.closest('.draw-swatch:not(.draw-eraser)');
  if (swatch) {
    _lastBrushColor = swatch.dataset.color;
    setDrawColor(swatch.dataset.color);
    _applyDrawControlsUI();
    return;
  }
  if (e.target.closest('#btn-draw-eraser')) {
    setDrawColor(null);
    _applyDrawControlsUI();
    return;
  }
  if (e.target.closest('#btn-paint-clear')) {
    if (!await askConfirm({ title: 'Cancellare il disegno?', text: 'Tutto il disegno sulla mappa verrà cancellato, per tutti.', confirmLabel: 'Cancella', danger: true })) return;
    clearPaint();
    return;
  }
  if (e.target.closest('#btn-draw-undo')) {
    undoPaint();
    return;
  }
  if (e.target.closest('#btn-draw-redo')) {
    redoPaint();
    return;
  }
});

document.getElementById('input-draw-custom')?.addEventListener('focus', () => {
  _customColorPicking = true;
});
document.getElementById('input-draw-custom')?.addEventListener('blur', () => {
  _customColorPicking = false;
});
document.getElementById('input-draw-custom')?.addEventListener('input', (e) => {
  _lastBrushColor = e.target.value;
  setDrawColor(e.target.value);
  _applyDrawControlsUI();
});

document.getElementById('select-draw-size')?.addEventListener('change', (e) => {
  setDrawSize(e.target.value);
  _applyDrawControlsUI();
});

// Il dock (proprio personaggio o soggetto del master). Va ridisegnato anche quando cambia la
// scheda, non solo a ogni snapshot di sessione: i tiri salvezza contro la morte vivono nella scheda.
function _renderMyDock() {
  const data = state.snapshot;
  if (!data) return;
  if (state.session.isMaster) { _refreshMasterDock(); return; }
  if (!state.myCombatantId) { UI.renderPlayerDock(null, false); return; }
  const progressionData = {
    mode:           data.progressionMode ?? 'xp',
    xp:             data.xp ?? {},
    levelUpGranted: data.levelUpGranted ?? {},
  };
  const myRaw = data.combatants?.[state.myCombatantId];
  const myC   = myRaw ? { ...myRaw, id: state.myCombatantId } : null;
  UI.renderPlayerDock(myC, state.myCombatantId === data.currentTurnId, progressionData, state.sheetData?.deathSaves ?? null);
}
// Dalla scheda (src/views/sheet.js): ridisegna dock e riga dell'iniziativa con i dati nuovi
document.addEventListener('dnd:sheet-changed', () => {
  if (!state.snapshot) return;
  _renderMyDock();
  _rerenderGridFromSnapshot();
});

function _renderCombatLists() {
  const data = state.snapshot;
  if (!data) return;
  const sorted    = state.tracker.sortedCombatants(data.combatants);
  const creatures = sorted.filter(c => c.type === 'creature');
  const players   = sorted.filter(c => c.type === 'player' || c.type === 'pet');
  const callbacks = makeCallbacks();
  const progressionData = {
    mode:           data.progressionMode ?? 'xp',
    xp:             data.xp ?? {},
    levelUpGranted: data.levelUpGranted ?? {},
  };
  UI.renderCombatantList(creatures, data.currentTurnId ?? null, state.myUid, state.session.masterUid, callbacks, state.acMap, null,                               progressionData, 'creature-list', 'empty-creatures-msg', sorted, state.selectedDockId);
  UI.renderCombatantList(players,   data.currentTurnId ?? null, state.myUid, state.session.masterUid, callbacks, state.acMap, state.sheetData?.deathSaves ?? null, progressionData, 'player-list',   'empty-players-msg', sorted, state.selectedDockId);
}

function _startListening() {
  // Stacca sempre prima di riattaccare: questa funzione è raggiungibile da
  // quattro punti (crea / entra / rientra dalla lista / restore all'avvio) e
  // senza questo ogni passaggio lasciava attivo il listener precedente.
  // Farlo qui copre tutti e quattro i percorsi in una riga sola.
  detachSessionListeners();

  state._sessionUnsubs.push(state.session.listenNoteLocks(locks => {
    _noteLocks = locks;
    _renderSessionNotes();
  }));

  state._sessionUnsubs.push(state.session.listenCursors(cursors => {
    GridUI.setCursors(cursors, state.myUid);
  }));

  state._sessionUnsubs.push(state.session.listen((snap) => {
    const data = snap.val();
    if (!data) return;
    state.snapshot = data;

    UI.renderLogs(data.logs || {});

    // Popup di riepilogo attacco/cura, visibile a tutti: diff delle voci di
    // log non ancora viste da questo client (nessuna scrittura Firebase qui).
    const logs = data.logs || {};
    if (state.seenLogIds === null) {
      // Primo snapshot visto da questo client: registra lo storico senza notificare
      state.seenLogIds = new Set(Object.keys(logs));
    } else {
      for (const [logId, entry] of Object.entries(logs)) {
        if (state.seenLogIds.has(logId)) continue;
        state.seenLogIds.add(logId);
        if ((entry.type === 'damage' || entry.type === 'heal') && entry.actor && entry.target) {
          UI.showNotification(entry.message, entry.type, entry.type === 'damage' ? 'sword' : 'heal');
        }
      }
    }

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
          UI.showNotification(`Hai ricevuto ${amount} danni!`, 'damage', 'sword');
        } else if (delta > 0) {
          UI.showNotification(`Hai ricevuto ${amount} punti vita!`, 'heal', 'heal');
        }
      }
      state.lastKnownHp = currentHp;
    }

    const sorted   = state.tracker.sortedCombatants(data.combatants);
    const currentCombatant = sorted.find(c => c.id === data.currentTurnId);
    UI.renderRound(data.round ?? 1, currentCombatant?.name ?? null, nextInTurnOrder(sorted, data.currentTurnId)?.name ?? null);
    _renderCombatLists();

    _renderMyDock();

    renderGrid(data.grid || {}, data.combatants || {}, data.currentTurnId ?? null, sorted, data.gridConfig || null, data.walls || {});
    _syncGridModeUI();

    if (state.session.isMaster) {
      const cfg = data.gridConfig || { cols: 20, rows: 20 };
      const colsInput = document.getElementById('input-grid-cols');
      const rowsInput = document.getElementById('input-grid-rows');
      if (colsInput && document.activeElement !== colsInput) colsInput.value = cfg.cols;
      if (rowsInput && document.activeElement !== rowsInput) rowsInput.value = cfg.rows;
    }

    const isMaster = data.masterUid === state.myUid;
    UI.renderScene(data.sceneImageUrl ?? null, data.sceneImageName ?? null);

    // Progressione: aggiorna controlli master
    const selLive = document.getElementById('select-progression-mode-live');
    if (selLive) selLive.value = data.progressionMode ?? 'xp';
    document.getElementById('xp-award-section')?.classList.toggle('hidden', !isMaster || (data.progressionMode ?? 'xp') !== 'xp');

    state.shipData = data.ship ?? null;
    if (state.shipPanelOpen) _renderShipPanel();

    _renderSessionNotes();
    CombatChrome.apply();
    // La scheda (se aperta) rilegge XP, vita attuale e ispirazione: nessuna scrittura qui
    document.dispatchEvent(new CustomEvent('dnd:session-update'));
  }));
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
    // Il combattente può essere stato rimosso mentre eravamo via (reset
    // incontro, rimozione dal master): rientrare con quell'id lo farebbe
    // ricreare a pezzi dalla sincronizzazione della scheda.
    if (!isMaster && !(await get(ref(db, `sessions/${code}/combatants/${savedCombatantId}`))).exists()) {
      UI.showError('Il tuo personaggio non è più in questa sessione. Rientra con il codice per ricrearlo.');
      await remove(ref(db, `userSessions/${uid}/${code}`));
      await loadUserSessions(uid);
      return;
    }
    state.myUid         = uid;
    state.myCombatantId = savedCombatantId || null;
    state.lastKnownHp   = null;
    state.seenLogIds    = null;
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

    if (!state.session.isMaster &&
        !(await get(ref(db, `sessions/${savedCode}/combatants/${savedCombatantId}`))).exists()) {
      localStorage.removeItem('dnd_session_code');
      localStorage.removeItem('dnd_combatant_id');
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
