import { captureFocusState, restoreFocusState } from '../utils/domPreserve.js';

const XP_THRESHOLDS = [0,300,900,2700,6500,14000,23000,34000,48000,64000,
                        85000,100000,120000,140000,165000,195000,225000,265000,305000,355000];

// Scene panel: hide localmente senza cancellare la scena Firebase
let _sceneHidden  = false;
let _prevSceneUrl = null;

export const CONDITIONS = [
  { name: 'Avvelenato',   color: 'var(--gold)' },
  { name: 'Stordito',     color: '#d97706' },
  { name: 'Spaventato',   color: '#dc2626' },
  { name: 'Bloccato',     color: '#ea580c' },
  { name: 'Accecato',     color: '#6b7280' },
  { name: 'Assordato',    color: '#6b7280' },
  { name: 'Prono',        color: '#9ca3af' },
  { name: 'Invisibile',   color: '#0891b2' },
  { name: 'Incapacitato', color: '#d97706' },
  { name: 'Paralizzato',  color: 'var(--gold)' },
  { name: 'Pietrificato', color: 'var(--gold)' },
  { name: 'Affascinato',  color: '#ec4899' },
  { name: 'Esausto',      color: '#dc2626' },
  { name: 'Nascosto',     color: '#0891b2' },
  { name: 'Concentrato',  color: '#e484ff' }
];

export function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(viewId)?.classList.remove('hidden');
}

export function showError(message, targetId = 'error-message') {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

export function showNotification(message, type = 'info') {
  // Crea un elemento di notifica temporaneo
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  // Stili inline per posizionamento
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'damage' ? '#8b2020' : type === 'heal' ? '#2d6b3a' : '#4a4a4a'};
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 1000;
    font-family: 'Cinzel', serif;
    font-size: 14px;
    max-width: 300px;
    word-wrap: break-word;
    animation: slideIn 0.3s ease-out;
  `;
  
  document.body.appendChild(notification);
  
  // Rimuovi dopo 3 secondi
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

export function renderScenePanel(sceneImageUrl, sceneImageName, isMaster) {
  const section   = document.getElementById('scene-section');
  const img       = document.getElementById('scene-image');
  const imgLink   = document.getElementById('scene-image-link');
  const clearBtn  = document.getElementById('btn-clear-scene');
  const changeBtn = document.getElementById('btn-change-scene');
  if (!section) return;

  // Nuova scena → resetta la visibilità locale
  if (sceneImageUrl !== _prevSceneUrl) {
    _sceneHidden  = false;
    _prevSceneUrl = sceneImageUrl;
  }

  if (!sceneImageUrl || _sceneHidden) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  img.src  = sceneImageUrl;
  img.alt  = sceneImageName || 'Scena';
  imgLink.href = sceneImageUrl;

  clearBtn.classList.toggle('hidden', !isMaster);
  changeBtn.classList.remove('hidden');
}

export function hideSceneLocally() {
  _sceneHidden = true;
  document.getElementById('scene-section')?.classList.add('hidden');
}

export function renderSessionNotes(notesObj, canEdit, expandedIds, noteLocks = {}, myUid = null) {
  const container = document.getElementById('session-notes-list');
  if (!container) return;

  const notes = Object.entries(notesObj ?? {})
    .map(([id, n]) => ({ id, ...n }))
    .sort((a, b) => b.date - a.date);

  if (notes.length === 0) {
    const active = document.activeElement;
    const isEditingNote = active?.classList.contains('note-textarea') ||
                          active?.classList.contains('note-title-input');
    if (!isEditingNote) container.innerHTML = '';
    return;
  }

  notes.forEach(note => {
    const isExpanded      = expandedIds.has(note.id);
    const dateVal         = new Date(note.date).toISOString().slice(0, 10);
    const lock            = noteLocks[note.id] ?? null;
    const isLockedByOther = lock && lock.uid !== myUid;
    const isEditingByMe   = lock && lock.uid === myUid;
    const disabled        = Boolean(isLockedByOther);

    let el = container.querySelector(`.note-entry[data-note-id="${note.id}"]`);
    if (!el) {
      el = document.createElement('div');
      el.className = 'note-entry';
      el.dataset.noteId = note.id;
      container.appendChild(el);
    }

    // Classe e colore del lock (non tocca mai gli input/textarea sottostanti)
    el.className = 'note-entry' + (isLockedByOther ? ' note-locked' : isEditingByMe ? ' note-editing-self' : '');
    if (lock) el.style.setProperty('--lock-color', lock.color);
    else      el.style.removeProperty('--lock-color');

    // Presence tag ("✏️ Nome" di chi sta editando)
    let tagEl = el.querySelector('.note-presence-tag');
    if (lock) {
      const tagText = `✏️ ${escapeHtml(lock.name)}`;
      if (!tagEl) {
        tagEl = document.createElement('div');
        tagEl.className = 'note-presence-tag';
        el.insertAdjacentElement('afterbegin', tagEl);
      }
      if (tagEl.innerHTML !== tagText) tagEl.innerHTML = tagText;
    } else if (tagEl) {
      tagEl.remove();
    }

    // Header: chevron, titolo, data, elimina — i nodi esistenti vengono SEMPRE
    // riusati (mai ricreati), così focus/cursore/scroll non saltano mai, a
    // prescindere dal fatto che l'utente ci abbia cliccato dentro o no.
    let headerEl = el.querySelector('.note-header');
    if (!headerEl) {
      headerEl = document.createElement('div');
      headerEl.className = 'note-header';
      headerEl.dataset.action = 'toggle';
      headerEl.dataset.noteId = note.id;
      el.appendChild(headerEl);
    }

    let chevronEl = headerEl.querySelector('.note-chevron');
    if (!chevronEl) {
      chevronEl = document.createElement('span');
      chevronEl.className = 'note-chevron';
      headerEl.appendChild(chevronEl);
    }
    const chevronText = isExpanded ? '▼' : '▶';
    if (chevronEl.textContent !== chevronText) chevronEl.textContent = chevronText;

    let titleEl = headerEl.querySelector('.note-title-input');
    if (!titleEl) {
      titleEl = document.createElement('input');
      titleEl.className = 'note-title-input';
      titleEl.dataset.noteId = note.id;
      titleEl.title = 'Modifica titolo';
      headerEl.appendChild(titleEl);
    }
    if (document.activeElement !== titleEl && titleEl.value !== (note.title ?? '')) {
      titleEl.value = note.title ?? '';
    }
    titleEl.disabled = disabled;

    let dateEl = headerEl.querySelector('.note-date-input');
    if (!dateEl) {
      dateEl = document.createElement('input');
      dateEl.type = 'date';
      dateEl.className = 'note-date-input';
      dateEl.dataset.noteId = note.id;
      headerEl.appendChild(dateEl);
    }
    if (document.activeElement !== dateEl && dateEl.value !== dateVal) {
      dateEl.value = dateVal;
    }
    dateEl.disabled = disabled;

    let delBtn = headerEl.querySelector('.note-delete-btn');
    if (canEdit && !delBtn) {
      delBtn = document.createElement('button');
      delBtn.className = 'btn-remove-sm note-delete-btn';
      delBtn.dataset.action = 'delete';
      delBtn.dataset.noteId = note.id;
      delBtn.title = 'Elimina';
      delBtn.textContent = '×';
      headerEl.appendChild(delBtn);
    } else if (!canEdit && delBtn) {
      delBtn.remove();
    }

    // Body: textarea contenuto — stesso principio, mai ricreata
    let bodyEl = el.querySelector('.note-body');
    if (isExpanded) {
      if (!bodyEl) {
        bodyEl = document.createElement('div');
        bodyEl.className = 'note-body';
        const textarea = document.createElement('textarea');
        textarea.className = 'note-textarea';
        textarea.dataset.noteId = note.id;
        textarea.placeholder = 'Scrivi qui cosa è successo in questa sessione...';
        textarea.rows = 6;
        bodyEl.appendChild(textarea);
        el.appendChild(bodyEl);
      }
      const textarea = bodyEl.querySelector('.note-textarea');
      if (textarea) {
        if (document.activeElement !== textarea && textarea.value !== (note.content ?? '')) {
          textarea.value = note.content ?? '';
        }
        textarea.disabled = disabled;
      }
    } else if (bodyEl) {
      bodyEl.remove();
    }
  });

  // Rimuovi note eliminate dal DOM
  container.querySelectorAll('.note-entry[data-note-id]').forEach(el => {
    if (!notesObj?.[el.dataset.noteId]) el.remove();
  });
}

let lastLogId = null;

export function renderLogs(logsObj) {
  const logContainer = document.getElementById('event-log');
  if (!logContainer) return;
  
  // Rendi vuoto il container per riscriverlo
  logContainer.innerHTML = '';
  
  if (!logsObj) return;

  // Ordina i log per timestamp decrescente (più recenti in alto)
  const logsArray = Object.values(logsObj).sort((a, b) => b.timestamp - a.timestamp);
  
  // Teniamo solo gli ultimi 100 per non appesantire il DOM
  const recentLogs = logsArray.slice(0, 100);

  // L'ID del log più recente in assoluto
  const currentNewestId = recentLogs.length > 0 ? `${recentLogs[0].timestamp}-${recentLogs[0].message}` : null;

  recentLogs.forEach((log, index) => {
    const entry = document.createElement('div');
    const logId = `${log.timestamp}-${log.message}`;
    
    // Animate only if it's the newest AND it's different from the last time we rendered
    const isNew = index === 0 && logId !== lastLogId;
    
    entry.className = `log-entry${log.type === 'turn' ? ' log-entry--turn' : ''}${isNew ? ' anim-in' : ''}`;

    const d  = new Date(log.timestamp);
    const ts = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    entry.innerHTML = `<time>${ts}</time><div>${escapeHtml(log.message)}</div>`;
    logContainer.appendChild(entry);
  });

  lastLogId = currentNewestId;
}

export function renderSessionCode(code) {
  const el = document.getElementById('session-code-display');
  if (el) el.textContent = code;
}

export function renderRound(round, currentCombatantName = null) {
  const el = document.getElementById('round-display');
  if (el) el.textContent = `Round ${round}`;
  const banner = document.getElementById('turn-banner');
  if (banner) {
    let nameEl = banner.querySelector('b');
    if (currentCombatantName) {
      if (!nameEl) { nameEl = document.createElement('b'); banner.appendChild(nameEl); }
      nameEl.textContent = currentCombatantName;
    } else if (nameEl) {
      nameEl.remove();
    }
  }
}

export function renderMasterPanel(isMaster) {
  document.getElementById('master-add-form')?.classList.toggle('hidden', !isMaster);
  document.getElementById('master-controls')?.classList.toggle('hidden', !isMaster);
  document.getElementById('player-pet-form')?.classList.toggle('hidden', isMaster);
}

// Stato modulo: flag anti-blur, tracking turno attivo per-lista, selezioni bersagli
let _rendering = false;
const _lastActiveTurn  = {};
const _selectedTargets = new Map(); // combatantId (owner) → Set<targetId>

// Flash danno/cura: confronta l'HP col render precedente per decidere se una
// card deve lampeggiare. Persistito qui (non nel DOM) così il flash sopravvive
// anche a un rebuild della lista innescato da un update non correlato.
const _prevHp  = new Map(); // combatantId → ultimo hpCurrent visto
const _hpFlash = new Map(); // combatantId → { dir: 'dmg'|'heal', until: timestamp }
const HP_FLASH_MS = 2500;   // deve combaciare con la durata di dmg-flash/heal-pulse in base.css

export function renderCombatantList(combatants, currentTurnId, myUid, masterUid, callbacks, acMap = {}, myDeathSaves = null, progressionData = {}, listId = 'combatant-list', emptyMsgId = 'empty-list-msg', allCombatants = null, selectedDockId = null) {
  const list     = document.getElementById(listId);
  const emptyMsg = document.getElementById(emptyMsgId);
  if (!list) return;

  const listIsMaster = myUid === masterUid;

  // allCombatants: full sorted list used for target options and global turn numbering
  const fullList = allCombatants ?? combatants;

  // ── Salva scroll, focus e stato action panel prima di distruggere il DOM ──
  const savedScrollY = window.scrollY;
  const focusSnap     = captureFocusState(list);

  // Snapshot quantità di ogni card (il bersaglio è ora in _selectedTargets, persiste da solo)
  const savedPanelState = {};
  list.querySelectorAll('[data-combatant-id]').forEach(card => {
    const cid = card.dataset.combatantId;
    savedPanelState[cid] = { amount: card.querySelector('.attack-amount')?.value ?? '' };
  });

  // ── Rebuild ───────────────────────────────────────────────────────────────
  _rendering = true;
  list.innerHTML = '';
  _rendering = false;

  if (combatants.length === 0) {
    emptyMsg?.classList.remove('hidden');
    window.scrollTo(0, savedScrollY);
    return;
  }
  emptyMsg?.classList.add('hidden');

  // scrollIntoView solo quando il turno attivo cambia
  const turnChanged = currentTurnId !== _lastActiveTurn[listId];
  if (turnChanged) _lastActiveTurn[listId] = currentTurnId;

  combatants.forEach((c) => {
    const isActive      = c.id === currentTurnId;
    const isKO          = c.hpCurrent === 0;
    const canEdit       = myUid === c.ownerUid || myUid === masterUid;
    const isMaster      = myUid === masterUid;
    const isCreature    = c.type === 'creature';
    const isPet         = c.type === 'pet';
    const isOwnCard     = myUid === c.ownerUid && c.type === 'player';
    const isOwnPet      = myUid === c.ownerUid && isPet;
    const hpPercent     = c.hpMax > 0 ? (c.hpCurrent / c.hpMax) * 100 : 0;
    const conditions    = c.conditions ? Object.keys(c.conditions) : [];
    const hpClass       = hpPercent <= 25 ? 'hp-critical' : hpPercent <= 50 ? 'hp-low' : '';
    const showFullHp    = isMaster || isOwnCard || !isCreature;
    const showHint      = !isOwnCard && !isMaster && isCreature && c.showHealthHint;
    const canEditMaxHp  = isOwnCard || isOwnPet || (isMaster && (isCreature || isPet));
    const canEditAc     = isOwnPet || (isMaster && isCreature);
    const ac            = isPet ? (c.armorClass ?? null) : (acMap[c.ownerUid] ?? c.armorClass ?? null);
    const acVisible     = !isCreature || isMaster || (c.showAC === true);
    const tempHp        = c.tempHp ?? 0;
    const tempHpPercent = c.hpMax > 0 ? Math.min(100, (tempHp / c.hpMax) * 100) : 0;
    const successes     = isOwnCard && isKO ? (myDeathSaves?.successes ?? 0) : 0;
    const failures      = isOwnCard && isKO ? (myDeathSaves?.failures  ?? 0) : 0;
    const turnNumber    = fullList.findIndex(x => x.id === c.id) + 1;

    // Pulisce bersagli non più validi dalla selezione persistente
    const validIds = new Set(fullList.filter(x => x.hpCurrent > 0 || x.type === 'player' || x.type === 'pet').map(x => x.id));
    validIds.add(c.id);
    const ownerSel = _selectedTargets.get(c.id);
    if (ownerSel) for (const tid of [...ownerSel]) { if (!validIds.has(tid)) ownerSel.delete(tid); }
    const isSel = (targetId) => _selectedTargets.get(c.id)?.has(targetId) ?? false;

    const targetChips = [
      `<button class="target-chip${isSel(c.id) ? ' selected' : ''}" data-action="toggle-target" data-target-id="${c.id}">👤 Sé stesso</button>`,
      ...fullList
        .filter(x => x.id !== c.id && (x.hpCurrent > 0 || x.type === 'player' || x.type === 'pet'))
        .map(x => {
          const prefix = x.type === 'player' ? '👤' : x.type === 'pet' ? '🐾' : '👹';
          return `<button class="target-chip${isSel(x.id) ? ' selected' : ''}" data-action="toggle-target" data-target-id="${x.id}">${prefix} ${escapeHtml(x.name)}</button>`;
        })
    ].join('');

    const li = document.createElement('li');
    const isAlly = !isCreature || c.faction === 'good';
    const hpPct  = c.hpMax > 0 ? Math.min(1, Math.max(0, c.hpCurrent / c.hpMax)) : 0;

    // Flash danno/cura: solo se avevamo già visto questa card in precedenza
    // (evita che tutte le card lampeggino al primo caricamento della pagina)
    const prevHp = _prevHp.get(c.id);
    if (prevHp !== undefined && prevHp !== c.hpCurrent) {
      _hpFlash.set(c.id, { dir: c.hpCurrent < prevHp ? 'dmg' : 'heal', until: Date.now() + HP_FLASH_MS });
    }
    _prevHp.set(c.id, c.hpCurrent);
    const flash = _hpFlash.get(c.id);
    const flashClass = flash && flash.until > Date.now() ? (flash.dir === 'dmg' ? 'anim-dmg' : 'anim-heal') : '';

    li.className = ['fight-card', isActive ? 'is-active' : '', isKO ? 'is-down' : '', flashClass,
      (listIsMaster && c.id === selectedDockId) ? 'dock-selected' : '']
      .filter(Boolean).join(' ');
    li.dataset.combatantId = c.id;

    // ─ XP / level-up (solo player): la barra è la cornice del ritratto (.fc-pframe)
    let xpSectionHtml = '';
    let xpPct         = 0;
    let xpTitle       = '';
    let levelUpReady  = false;
    if (c.type === 'player') {
      const { mode = 'xp', xp = {}, levelUpGranted = {} } = progressionData;
      const combXp = xp[c.id] ?? 0;
      const level  = c.level ?? 1;
      levelUpReady = mode === 'xp'
        ? (level < 20 && combXp >= XP_THRESHOLDS[level])
        : (levelUpGranted[c.id] === true);

      if (mode === 'xp') {
        if (level >= 20) {
          xpPct   = 1;
          xpTitle = `XP: ${combXp.toLocaleString('it')} — Livello massimo`;
        } else {
          const hi = XP_THRESHOLDS[level] ?? XP_THRESHOLDS[19];
          xpPct    = Math.min(1, Math.max(0, combXp / hi)) || 0;
          xpTitle  = `XP: ${combXp.toLocaleString('it')} / ${hi.toLocaleString('it')} per Lv.${level + 1}`;
        }
      }

      if (levelUpReady && isOwnCard) {
        xpSectionHtml += `<button class="btn btn--primary btn--sm" data-id="${c.id}" data-action="levelup">⬆ Sali di livello</button>`;
      }

      if (isMaster && mode === 'milestone' && !levelUpGranted[c.id]) {
        xpSectionHtml += `<button class="btn btn--sm" data-id="${c.id}" data-action="grant-levelup">🎖 Concedi Level-up</button>`;
      }
    }

    const subtitleParts = [
      isCreature ? 'Creatura' : isPet ? 'Famiglio' : 'PG',
      (c.type === 'player' && c.level) ? `Lv.${c.level}` : null,
      (acVisible && ac !== null) ? (canEditAc
        ? `<button class="ac-edit-btn" data-id="${c.id}" data-action="edit-ac" title="Modifica CA">CA ${ac}</button>`
        : `CA ${ac}`)
        : null,
    ].filter(Boolean).join(' · ');

    const portraitIcon     = isCreature ? '👹' : isPet ? '🐾' : '⚔';
    const canUploadAvatar  = canEdit && c.charId;
    const rawThumb         = c.avatarThumb;
    const avatarSrc        = typeof rawThumb === 'string' && rawThumb.startsWith('data:image/') ? rawThumb : null;
    const portraitContent  = avatarSrc ? `<img src="${escapeHtml(avatarSrc)}" class="fc-avatar" alt="">` : portraitIcon;
    const uploadAttrs      = canUploadAvatar ? ` data-action="upload-avatar" data-id="${c.id}" data-char-id="${c.charId}" data-owner-uid="${c.ownerUid}"` : '';
    const uploadClass      = canUploadAvatar ? ' fc-portrait--upload' : '';

    const portraitHtml  = c.type === 'player'
      ? `<div class="fc-pframe${levelUpReady ? ' lvlup' : ''}" style="--xp:${(levelUpReady ? 1 : xpPct).toFixed(3)};"${xpTitle ? ` title="${xpTitle}"` : ''}>
           <div class="fc-portrait${uploadClass}" style="display:flex;align-items:center;justify-content:center;color:var(--accent);"${uploadAttrs}>${portraitContent}</div>
         </div>`
      : `<div class="fc-portrait${uploadClass}" style="display:flex;align-items:center;justify-content:center;border:1px solid ${isAlly ? 'rgba(76,165,122,.3)' : 'rgba(168,66,58,.3)'};color:${isAlly ? 'var(--accent)' : '#c25b50'};"${uploadAttrs}>${portraitContent}</div>`;

    li.innerHTML = `
      <div class="fc-top">
        ${portraitHtml}
        <div class="fc-name">
          <b>${escapeHtml(c.name)}</b>
          <span>${subtitleParts}</span>
        </div>
        <div class="fc-init">
          ${canEdit
            ? `<button class="fc-init-b" data-id="${c.id}" data-action="edit-initiative">${c.initiative}</button>`
            : `<b>${c.initiative}</b>`}
          <span>init</span>
        </div>
        ${canEdit
          ? `<button class="btn btn--ghost btn--sm btn--icon" data-id="${c.id}" data-action="remove" aria-label="Rimuovi">✕</button>`
          : `<span></span>`}
      </div>

      ${showFullHp ? `
        <div class="hpbar ${isAlly ? 'hpbar--ally' : ''}${tempHp > 0 ? ' hpbar--temp' : ''}">
          <i class="trail" style="transform:scaleX(${hpPct.toFixed(4)});"></i>
          <i class="fill"  style="transform:scaleX(${hpPct.toFixed(4)});"></i>
        </div>
        <div class="fc-hp">
          <span class="hp-text ${hpClass}">${c.hpCurrent} / ${canEditMaxHp
            ? `<button class="hp-max-btn" data-id="${c.id}" data-action="edit-hp-max" title="Modifica HP max">${c.hpMax}</button>`
            : c.hpMax}</span>
          ${tempHp > 0 ? `<span class="chip chip--iron" style="font-size:9px;padding:1px 6px;">THP ${tempHp}</span>` : ''}
          ${canEdit ? `<button class="btn btn--ghost btn--sm" data-id="${c.id}" data-action="edit-temp-hp" data-temp-hp="${tempHp}" style="margin-left:auto;font-size:9px;padding:2px 6px;">+THP</button>` : ''}
        </div>
        ${isMaster && isCreature ? `
          <div class="fc-controls" style="gap:5px;margin-top:1px;">
            <button class="btn btn--ghost btn--sm ${c.showHealthHint ? 'hint-active' : ''}" data-id="${c.id}" data-action="toggle-health-hint" style="font-size:9px;">👁 Mostra HP</button>
            ${ac !== null ? `<button class="btn btn--ghost btn--sm ${c.showAC === true ? 'hint-active' : ''}" data-id="${c.id}" data-action="toggle-show-ac" style="font-size:9px;">🛡 Mostra CA</button>` : ''}
          </div>
        ` : ''}
      ` : showHint ? `
        <p class="fc-action-note hint-${healthHintKey(hpPercent)}">${healthHintText(hpPercent)}</p>
      ` : ''}

      ${conditions.length > 0 ? `
        <div class="fc-conds">
          ${conditions.map(cond => {
            const meta = CONDITIONS.find(x => x.name === cond);
            return `<span class="chip" style="--c:${meta?.color ?? 'var(--mut)'};">${cond}</span>`;
          }).join('')}
        </div>
      ` : ''}

      ${xpSectionHtml}

      ${canEdit && !isMaster ? `
        <input type="text" class="action-input input input--sm" data-id="${c.id}"
          placeholder="Arma o incantesimo (es. Ascia da guerra)"
          value="${escapeHtml(c.currentAction || '')}"
          autocomplete="off" style="width:100%;">
        <div class="target-chips" data-id="${c.id}">${targetChips}</div>
        ${isActive ? `
        <div class="fc-controls">
          <input type="number" class="attack-amount input input--num" data-id="${c.id}" placeholder="0" min="1" max="9999">
          <button class="btn btn--danger btn--sm" data-id="${c.id}" data-action="apply-damage">🗡 Danno</button>
          <button class="btn btn--sm" data-id="${c.id}" data-action="apply-heal" style="color:var(--heal);">✚ Cura</button>
        </div>
        ` : ''}
      ` : c.currentAction ? `
        <p class="fc-action-note">⚔ ${escapeHtml(c.currentAction)}</p>
      ` : ''}

      ${isOwnCard && isKO ? `
        <div class="death-pips">
          <span>Successi</span>
          <div class="pips ok">${[0,1,2].map(i => `<button class="${i < successes ? 'on' : ''}" data-action="death-save" data-type="successes" data-index="${i}"></button>`).join('')}</div>
          <span>Fallimenti</span>
          <div class="pips ko">${[0,1,2].map(i => `<button class="${i < failures ? 'on' : ''}" data-action="death-save" data-type="failures" data-index="${i}"></button>`).join('')}</div>
        </div>
      ` : ''}

      <div class="fc-controls">
        ${canEdit ? `<button class="btn btn--ghost btn--sm insp-btn${c.inspiration ? ' active' : ''}" data-id="${c.id}" data-action="toggle-inspiration" title="${c.inspiration ? 'Rimuovi ispirazione' : 'Concedi ispirazione'}">✦ Ispirazione</button>` : ''}
        ${canEdit ? `<button class="btn btn--ghost btn--sm" data-id="${c.id}" data-action="open-conditions" style="font-size:9.5px;">${conditions.length > 0 ? '✎ Condizioni' : '+ Condizioni'}</button>` : ''}
        ${isMaster && isCreature ? `
          <div class="faction-switch">
            <button class="faction-btn evil ${(c.faction || 'evil') === 'evil' ? 'active' : ''}" data-id="${c.id}" data-action="set-faction" data-faction="evil">Avv.</button>
            <button class="faction-btn good ${c.faction === 'good' ? 'active' : ''}" data-id="${c.id}" data-action="set-faction" data-faction="good">Alleato</button>
          </div>
        ` : ''}
        ${isMaster && isCreature && c.monsterApiIndex ? `<button class="btn btn--ghost btn--sm" data-id="${c.id}" data-api-index="${c.monsterApiIndex}" data-action="view-stat-block" style="font-size:9.5px;">📖 Dati</button>` : ''}
        ${isOwnCard ? `<button class="btn btn--ghost btn--sm" data-id="${c.id}" data-action="open-sheet" style="font-size:9.5px;">📜 Scheda</button>` : ''}
        ${isActive && (isOwnCard || isOwnPet) ? `<button class="btn btn--primary btn--sm" data-id="${c.id}" data-action="end-turn" style="margin-left:auto;">✓ Fine Turno</button>` : ''}
      </div>
    `;

    // ── Ripristina quantità (il bersaglio persiste in _selectedTargets) ────────
    const saved = savedPanelState[c.id];
    if (saved?.amount) {
      const amountInput = li.querySelector('.attack-amount');
      if (amountInput) amountInput.value = saved.amount;
    }

    list.appendChild(li);

    // Salva l'azione dichiarata su blur — skip durante re-render per non triggerare Firebase
    const actionInput = li.querySelector('.action-input');
    if (actionInput) {
      actionInput.addEventListener('blur',    () => { if (_rendering) return; callbacks.onSetAction(c.id, actionInput.value.trim()); });
      actionInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') actionInput.blur(); });
    }

    // scrollIntoView solo al cambio di turno, non ad ogni re-render
    if (isActive && turnChanged) li.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  // ── Ripristina editor inline pendente (iniziativa/HP max/HP temp/CA) ───────
  // Questi bottoni si trasformano in <input> al click, fuori dal normale ciclo
  // di render: il rebuild li rimpiazza sempre col bottone di default, quindi
  // vanno ricreati esplicitamente prima di poter ripristinare focus/cursore.
  if (_activeInlineEdit) {
    const { id, field } = _activeInlineEdit;
    const actionByField = { initiative: 'edit-initiative', hpMax: 'edit-hp-max', tempHp: 'edit-temp-hp', ac: 'edit-ac' };
    const btn = list.querySelector(`[data-id="${id}"][data-action="${actionByField[field]}"]`);
    if (btn) {
      if      (field === 'initiative') openInitiativeEdit(btn, id, callbacks.onInitiativeChange, true);
      else if (field === 'hpMax')      openHpMaxEdit(btn, id, callbacks.onSetMaxHp, true);
      else if (field === 'tempHp')     openTempHpEdit(btn, id, callbacks.onSetTempHp, true);
      else if (field === 'ac')         openAcEdit(btn, id, callbacks.onSetAc, true);
    }
  }

  // ── Ripristina scroll e focus ─────────────────────────────────────────────
  window.scrollTo(0, savedScrollY);
  restoreFocusState(list, focusSnap);

  list.onclick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) {
      // Click sul corpo della carta (master): seleziona il soggetto del dock
      if (listIsMaster && !e.target.closest('input, select, button')) {
        const card = e.target.closest('.fight-card');
        if (card?.dataset.combatantId) {
          const cid = card.dataset.combatantId;
          document.dispatchEvent(new CustomEvent('dnd:dock-select', { detail: { id: cid === selectedDockId ? null : cid } }));
        }
      }
      return;
    }
    const id     = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'upload-avatar') {
      const charId   = btn.dataset.charId;
      const ownerUid = btn.dataset.ownerUid;
      if (charId && ownerUid) callbacks.onUploadAvatar?.(id, charId, ownerUid);
      return;
    }
    if (action === 'toggle-target') {
      const ownerId  = btn.closest('.target-chips')?.dataset.id;
      const targetId = btn.dataset.targetId;
      if (!ownerId || !targetId) return;
      if (!_selectedTargets.has(ownerId)) _selectedTargets.set(ownerId, new Set());
      const sel = _selectedTargets.get(ownerId);
      if (sel.has(targetId)) sel.delete(targetId); else sel.add(targetId);
      btn.classList.toggle('selected');
      return;
    }
    if (action === 'apply-damage' || action === 'apply-heal') {
      const sel   = _selectedTargets.get(id);
      const input = list.querySelector(`.attack-amount[data-id="${id}"]`);
      const actionInput = list.querySelector(`.action-input[data-id="${id}"]`);
      const amt   = parseInt(input?.value);
      const actionText = actionInput?.value.trim() || null;
      
      if (!sel || sel.size === 0) { _flashError(btn, 'Scegli un bersaglio'); return; }
      if (!amt || amt <= 0)       { _flashError(btn, 'Inserisci una quantità'); return; }
      sel.forEach(targetId => callbacks.onApplyToTarget(id, targetId, action === 'apply-damage' ? -amt : amt, actionText));
      _selectedTargets.delete(id);
      if (input) input.value = '';
      return;
    }
    if (action === 'toggle-health-hint') {
      const c = list.querySelector(`[data-id="${id}"][data-action="toggle-health-hint"]`);
      callbacks.onToggleHealthHint(id, c?.classList.contains('hint-active'));
      return;
    }
    if (action === 'toggle-show-ac') {
      callbacks.onToggleShowAC?.(id, btn.classList.contains('hint-active'));
      return;
    }
    if (action === 'toggle-inspiration') {
      callbacks.onToggleInspiration?.(id, btn.classList.contains('active'));
      return;
    }
    if (action === 'end-turn')        { callbacks.onEndTurn?.(); return; }
    if (action === 'death-save') {
      const type   = btn.dataset.type;
      const index  = parseInt(btn.dataset.index);
      const filled = btn.classList.contains('on');
      callbacks.onDeathSave?.(type, filled ? index : index + 1);
      return;
    }
    if (action === 'remove')          { callbacks.onRemove(id); return; }
    if (action === 'set-faction') {
      const faction = btn.dataset.faction;
      callbacks.onSetFaction(id, faction);
      return;
    }
    if (action === 'open-conditions') { callbacks.onOpenConditions(id); return; }
    if (action === 'edit-initiative') { openInitiativeEdit(btn, id, callbacks.onInitiativeChange); return; }
    if (action === 'edit-hp-max')     { openHpMaxEdit(btn, id, callbacks.onSetMaxHp); return; }
    if (action === 'edit-ac')         { openAcEdit(btn, id, callbacks.onSetAc); return; }
    if (action === 'edit-temp-hp')    { openTempHpEdit(btn, id, callbacks.onSetTempHp); return; }
    if (action === 'open-sheet')      { callbacks.onOpenSheet?.(); return; }
    if (action === 'levelup')         { callbacks.onLevelUp?.(id); return; }
    if (action === 'grant-levelup')   { callbacks.onGrantLevelUp?.(id); return; }
  };
}

function _flashError(btn, message) {
  const original = btn.textContent;
  btn.textContent = message;
  btn.style.opacity = '0.7';
  setTimeout(() => { btn.textContent = original; btn.style.opacity = ''; }, 2000);
}

// Editor inline (iniziativa/HP max/HP temp/CA): tiene traccia di quale campo è
// in editing e col suo valore corrente, così un rebuild della lista (innescato
// da un update Firebase non correlato, es. un altro giocatore che agisce)
// può ricreare l'editor com'era invece di perderlo — vedi renderCombatantList.
let _activeInlineEdit = null; // { id, field, value }

function _openInlineNumberEdit(btn, id, field, initialValue, { min, max, placeholder, className = 'hp-max-edit-input', beforeReplace, onConfirm }, restoring = false) {
  const input = document.createElement('input');
  input.type      = 'number';
  input.className = className;
  input.dataset.id        = id;
  input.dataset.editField = field;
  if (min !== undefined)   input.min = min;
  if (max !== undefined)   input.max = max;
  if (placeholder)         input.placeholder = placeholder;

  input.value = (restoring && _activeInlineEdit?.id === id && _activeInlineEdit?.field === field)
    ? _activeInlineEdit.value
    : String(initialValue);

  input.addEventListener('input', () => { _activeInlineEdit = { id, field, value: input.value }; });

  const confirm = () => {
    const val = input.value === '' ? NaN : parseInt(input.value);
    _activeInlineEdit = null;
    beforeReplace(val, isNaN(val));
    input.replaceWith(btn);
    if (!isNaN(val)) onConfirm(val);
  };

  input.onblur    = confirm;
  input.onkeydown = (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { _activeInlineEdit = null; input.value = String(initialValue); input.blur(); }
  };

  btn.replaceWith(input);
  if (restoring) {
    // Focus/cursore vengono ripristinati subito dopo da restoreFocusState
    // in renderCombatantList (stesso meccanismo usato per gli altri input).
  } else {
    _activeInlineEdit = { id, field, value: input.value };
    input.focus();
    input.select();
  }
  return input;
}

function openInitiativeEdit(btn, id, onInitiativeChange, restoring = false) {
  const original = parseInt(btn.textContent.trim());
  return _openInlineNumberEdit(btn, id, 'initiative', original, {
    beforeReplace: (val, invalid) => { btn.textContent = invalid ? String(original) : String(val); },
    onConfirm:     (val) => { if (val !== original) onInitiativeChange(id, val); },
  }, restoring);
}

function openHpMaxEdit(btn, id, onSetMaxHp, restoring = false) {
  const original = parseInt(btn.textContent.trim());
  return _openInlineNumberEdit(btn, id, 'hpMax', original, {
    min: 1, max: 9999,
    beforeReplace: (val, invalid) => { btn.textContent = invalid ? String(original) : String(val); },
    onConfirm:     (val) => { if (val !== original) onSetMaxHp(id, val); },
  }, restoring);
}

function openTempHpEdit(btn, id, onSetTempHp, restoring = false) {
  const original = parseInt(btn.dataset.tempHp ?? '0') || 0;
  return _openInlineNumberEdit(btn, id, 'tempHp', original, {
    min: 0, max: 9999, placeholder: '0 = rimuovi',
    beforeReplace: (val, invalid) => {
      const v = invalid ? original : Math.max(0, val);
      btn.dataset.tempHp = v;
      btn.textContent    = v > 0 ? `THP: ${v}` : '+ HP Temp.';
      btn.classList.toggle('active', v > 0);
    },
    onConfirm: (val) => { const v = Math.max(0, val); if (v !== original) onSetTempHp(id, v); },
  }, restoring);
}

function openAcEdit(btn, id, onSetAc, restoring = false) {
  const original = parseInt(btn.textContent.replace('CA ', '').trim());
  return _openInlineNumberEdit(btn, id, 'ac', original, {
    min: 0, max: 30,
    beforeReplace: (val, invalid) => { btn.textContent = invalid ? `CA ${original}` : `CA ${val}`; },
    onConfirm:     (val) => { if (val !== original) onSetAc(id, val); },
  }, restoring);
}

export function renderConditionModal(combatantId, activeConditions, onToggle) {
  const modal         = document.getElementById('condition-modal');
  const conditionList = document.getElementById('condition-list');

  conditionList.innerHTML = CONDITIONS.map(cond => `
    <button
      class="condition-option ${activeConditions.includes(cond.name) ? 'active' : ''}"
      data-condition="${cond.name}"
      style="--c:${cond.color}"
    >${cond.name}</button>
  `).join('');

  conditionList.onclick = (e) => {
    const btn = e.target.closest('[data-condition]');
    if (!btn) return;
    btn.classList.toggle('active');
    onToggle(combatantId, btn.dataset.condition);
  };

  modal.classList.remove('hidden');
}

function healthHintKey(percent) {
  if (percent === 100) return 'full';
  if (percent >= 75)   return 'good';
  if (percent >= 50)   return 'hurt';
  if (percent >= 25)   return 'bad';
  if (percent > 0)     return 'critical';
  return 'ko';
}

function healthHintText(percent) {
  if (percent === 100) return '⚔ Nel pieno delle forze';
  if (percent >= 75)   return '⚔ Leggermente ferito';
  if (percent >= 50)   return '⚔ Ferito';
  if (percent >= 20)   return '⚔ Gravemente ferito';
  if (percent > 0)     return '⚔ In fin di vita';
  return '☠ A terra';
}

function hpBarColor(percent) {
  if (percent > 50) return 'var(--green)';
  if (percent > 25) return 'var(--hp-low)';
  return 'var(--red-bright)';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderPlayerDock(combatant, isActive, progressionData = {}, deathSaves = null) {
  const dock = document.getElementById('my-dock');
  if (!dock) return;
  if (!combatant) { dock.innerHTML = ''; return; }

  const c      = combatant;
  const isKO   = c.hpCurrent === 0;
  const hpPct  = c.hpMax > 0 ? Math.min(1, Math.max(0, c.hpCurrent / c.hpMax)) : 0;
  const tempHp = c.tempHp ?? 0;
  const conditions = c.conditions ? Object.keys(c.conditions) : [];
  const condChips  = conditions.map(cond => {
    const meta = CONDITIONS.find(x => x.name === cond);
    return `<span class="chip" style="--c:${meta?.color ?? 'var(--mut)'};">${cond}</span>`;
  }).join('');

  const { mode = 'xp', xp = {}, levelUpGranted = {} } = progressionData;
  const combXp = xp[c.id] ?? 0;
  const level  = c.level ?? 1;
  const levelUpReady = mode === 'xp'
    ? (level < 20 && combXp >= XP_THRESHOLDS[level])
    : (levelUpGranted[c.id] === true);
  let xpPct = 0;
  let xpText = '';
  if (mode === 'xp') {
    if (level >= 20) {
      xpPct  = 1;
      xpText = `XP ${combXp.toLocaleString('it')} · liv. max`;
    } else {
      const hi = XP_THRESHOLDS[level] ?? XP_THRESHOLDS[19];
      xpPct  = Math.min(1, Math.max(0, combXp / hi)) || 0;
      xpText = `XP ${combXp.toLocaleString('it')} / ${hi.toLocaleString('it')}`;
    }
  }

  const successes = isKO ? (deathSaves?.successes ?? 0) : 0;
  const failures  = isKO ? (deathSaves?.failures  ?? 0) : 0;

  const dockRawThumb = c.avatarThumb;
  const dockAvatar   = typeof dockRawThumb === 'string' && dockRawThumb.startsWith('data:image/') ? dockRawThumb : null;
  const dockPortrait = dockAvatar
    ? `<img src="${escapeHtml(dockAvatar)}" class="fc-avatar" alt="">`
    : (c.type === 'pet' ? '🐾' : '⚔');

  dock.innerHTML = `
    <div class="fc-pframe dock-pframe${levelUpReady ? ' lvlup' : ''}" style="--xp:${(levelUpReady ? 1 : xpPct).toFixed(3)};"${xpText ? ` title="${xpText}"` : ''}>
      <div class="dock-portrait">${dockPortrait}</div>
    </div>
    <div class="dock-id">
      <b>${escapeHtml(c.name)}</b>
      <span>${level ? `Lv.${level}` : ''}${c.armorClass ? ` · CA ${c.armorClass}` : ''}</span>
    </div>
    <div class="dock-vitals">
      <div style="display:flex;align-items:center;gap:6px;">
        <div class="hpbar hpbar--ally" style="flex:1;height:8px;">
          <i class="trail" style="transform:scaleX(${hpPct.toFixed(4)});"></i>
          <i class="fill"  style="transform:scaleX(${hpPct.toFixed(4)});"></i>
        </div>
        <span style="font-size:12px;font-weight:700;color:var(--bone);font-variant-numeric:tabular-nums;">${c.hpCurrent}<span style="color:var(--mut);font-weight:400">/${c.hpMax}</span></span>
        ${tempHp > 0 ? `<span class="chip chip--iron" style="font-size:9px;padding:1px 5px;">+${tempHp}</span>` : ''}
      </div>
      ${mode === 'xp' && level < 20 ? `<div class="xp-bar-track" style="margin-top:2px;"><div class="xp-bar-fill" style="width:${Math.round(xpPct * 100)}%"></div></div>` : ''}
      ${xpText ? `<span class="dock-xp">${xpText}</span>` : ''}
      ${isKO ? `<div class="death-pips" style="margin-top:3px;">
        <span>S</span>
        <div class="pips ok">${[0,1,2].map(i => `<button class="${i < successes ? 'on' : ''}" data-action="death-save" data-type="successes" data-index="${i}" data-dock="1"></button>`).join('')}</div>
        <span>F</span>
        <div class="pips ko">${[0,1,2].map(i => `<button class="${i < failures ? 'on' : ''}" data-action="death-save" data-type="failures" data-index="${i}" data-dock="1"></button>`).join('')}</div>
      </div>` : (conditions.length ? `<div class="dock-conds">${condChips}</div>` : '')}
    </div>
    <div class="dock-actions">
      ${isActive ? `<button class="btn btn--danger btn--sm" data-action="dock-attack">⚔ Attacca</button>` : ''}
      ${isActive ? `<button class="btn btn--sm" data-action="dock-heal" style="color:var(--heal);">✚ Cura</button>` : ''}
      <button class="btn btn--ghost btn--sm" data-action="dock-conditions">✦ Cond.</button>
      <button class="btn btn--ghost btn--sm" data-action="dock-sheet">📜 Scheda</button>
      ${isActive ? `<button class="btn btn--primary btn--sm" data-action="dock-end-turn">✓ Fine</button>` : ''}
    </div>`;
}

export function renderMasterDock(combatant) {
  const dock = document.getElementById('my-dock');
  if (!dock) return;
  if (!combatant) {
    dock.innerHTML = `<span class="dock-hint">Seleziona un token sulla griglia per agire.</span>`;
    return;
  }

  const c     = combatant;
  const isKO  = c.hpCurrent === 0;
  const hpPct = c.hpMax > 0 ? Math.min(1, Math.max(0, c.hpCurrent / c.hpMax)) : 0;
  const tempHp = c.tempHp ?? 0;
  const conditions = c.conditions ? Object.keys(c.conditions) : [];
  const condChips  = conditions.map(cond => {
    const meta = CONDITIONS.find(x => x.name === cond);
    return `<span class="chip" style="--c:${meta?.color ?? 'var(--mut)'};">${cond}</span>`;
  }).join('');

  const icon = c.type === 'pet' ? '🐾' : c.type === 'creature' ? '👹' : '⚔';
  const kind = c.type === 'creature' ? 'Creatura' : c.type === 'pet' ? 'Famiglio' : 'PG';
  const subtitle = [kind, c.armorClass ? `CA ${c.armorClass}` : null].filter(Boolean).join(' · ');
  const masterRawThumb = c.avatarThumb;
  const masterAvatar   = typeof masterRawThumb === 'string' && masterRawThumb.startsWith('data:image/') ? masterRawThumb : null;
  const masterPortrait = masterAvatar
    ? `<img src="${escapeHtml(masterAvatar)}" class="fc-avatar" alt="">`
    : icon;

  dock.innerHTML = `
    <div class="dock-portrait${isKO ? ' is-down' : ''}">${isKO ? '💀' : masterPortrait}</div>
    <div class="dock-id">
      <b>${escapeHtml(c.name)}</b>
      <span>${subtitle}</span>
    </div>
    <div class="dock-vitals">
      <div style="display:flex;align-items:center;gap:6px;">
        <div class="hpbar hpbar--ally" style="flex:1;height:8px;">
          <i class="trail" style="transform:scaleX(${hpPct.toFixed(4)});"></i>
          <i class="fill"  style="transform:scaleX(${hpPct.toFixed(4)});"></i>
        </div>
        <span style="font-size:12px;font-weight:700;color:var(--bone);font-variant-numeric:tabular-nums;">${c.hpCurrent}<span style="color:var(--mut);font-weight:400">/${c.hpMax}</span></span>
        ${tempHp > 0 ? `<span class="chip chip--iron" style="font-size:9px;padding:1px 5px;">+${tempHp}</span>` : ''}
      </div>
      ${conditions.length ? `<div class="dock-conds">${condChips}</div>` : ''}
    </div>
    <div class="dock-actions">
      <button class="btn btn--danger btn--sm" data-action="dock-attack">⚔ Attacca</button>
      <button class="btn btn--sm" data-action="dock-heal" style="color:var(--heal);">✚ Cura</button>
      <button class="btn btn--ghost btn--sm" data-action="dock-conditions">✦ Cond.</button>
    </div>`;
}

// ─── Modale azione dock (attacca / cura) ─────────────────────────────────────
let _dockActionMode = 'damage';
let _dockActionMyId = null;
let _dockActionCb   = null;
const _dockActionSel = new Set();

export function openDockActionModal(mode, myId, combatants, callbacks) {
  const modal = document.getElementById('dock-action-modal');
  if (!modal) return;

  _dockActionMode = mode;
  _dockActionMyId = myId;
  _dockActionCb   = callbacks;
  _dockActionSel.clear();

  const isDmg      = mode === 'damage';
  const confirmBtn = document.getElementById('btn-dock-action-confirm');
  document.getElementById('dock-action-title').textContent = isDmg ? '⚔ Attacca' : '✚ Cura';
  confirmBtn.textContent = isDmg ? '⚔ Conferma' : '✚ Conferma';
  confirmBtn.className   = 'btn grow ' + (isDmg ? 'btn--danger' : 'btn--primary');

  const me    = combatants.find(c => c.id === myId);
  const valid = combatants.filter(x => x.hpCurrent > 0 || x.type === 'player' || x.type === 'pet');
  const chip  = (id, label) => `<button class="target-chip" data-target-id="${id}">${label}</button>`;
  const chips = [chip(myId, '👤 Sé stesso')];
  valid.filter(x => x.id !== myId).forEach(x => {
    const prefix = x.type === 'player' ? '👤' : x.type === 'pet' ? '🐾' : '👹';
    chips.push(chip(x.id, `${prefix} ${escapeHtml(x.name)}`));
  });
  document.getElementById('dock-action-targets').innerHTML = chips.join('');
  document.getElementById('dock-action-text').value   = me?.currentAction || '';
  document.getElementById('dock-action-amount').value = '';

  if (!modal._bound) {
    modal._bound = true;
    document.getElementById('dock-action-targets').addEventListener('click', (e) => {
      const c = e.target.closest('.target-chip');
      if (!c) return;
      const tid = c.dataset.targetId;
      if (_dockActionSel.has(tid)) _dockActionSel.delete(tid); else _dockActionSel.add(tid);
      c.classList.toggle('selected');
    });
    document.getElementById('btn-dock-action-cancel').addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
    confirmBtn.addEventListener('click', () => {
      const amt        = parseInt(document.getElementById('dock-action-amount').value);
      const actionText = document.getElementById('dock-action-text').value.trim() || null;
      if (_dockActionSel.size === 0) { _flashError(confirmBtn, 'Scegli un bersaglio'); return; }
      if (!amt || amt <= 0)          { _flashError(confirmBtn, 'Inserisci una quantità'); return; }
      const delta = _dockActionMode === 'damage' ? -amt : amt;
      _dockActionSel.forEach(tid => _dockActionCb?.onApplyToTarget(_dockActionMyId, tid, delta, actionText));
      modal.classList.add('hidden');
    });
  }

  modal.classList.remove('hidden');
  setTimeout(() => document.getElementById('dock-action-amount')?.focus(), 50);
}
