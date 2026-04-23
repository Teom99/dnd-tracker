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
    
    entry.className = `event-entry event-${log.type || 'info'} ${isNew ? 'animate-new' : ''}`;
    
    const d = new Date(log.timestamp);
    const timestamp = d.toLocaleTimeString('it-IT', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
    
    entry.innerHTML = `
      <div class="event-timestamp">${timestamp}</div>
      <div>${escapeHtml(log.message)}</div>
    `;
    logContainer.appendChild(entry);
  });

  lastLogId = currentNewestId;
}

export function renderSessionCode(code) {
  const el = document.getElementById('session-code-display');
  if (el) el.textContent = code;
}

export function renderRound(round) {
  const el = document.getElementById('round-display');
  if (el) el.textContent = `Round ${round}`;
}

export function renderMasterPanel(isMaster) {
  document.getElementById('master-add-form')?.classList.toggle('hidden', !isMaster);
  document.getElementById('master-controls')?.classList.toggle('hidden', !isMaster);
}

// Stato modulo: flag anti-blur, tracking turno attivo per-lista, selezioni bersagli
let _rendering = false;
const _lastActiveTurn  = {};
const _selectedTargets = new Map(); // combatantId (owner) → Set<targetId>

export function renderCombatantList(combatants, currentTurnId, myUid, masterUid, callbacks, acMap = {}, myDeathSaves = null, listId = 'combatant-list', emptyMsgId = 'empty-list-msg', allCombatants = null) {
  const list     = document.getElementById(listId);
  const emptyMsg = document.getElementById(emptyMsgId);
  if (!list) return;

  // allCombatants: full sorted list used for target options and global turn numbering
  const fullList = allCombatants ?? combatants;

  // ── Salva scroll, focus e stato action panel prima di distruggere il DOM ──
  const savedScrollY    = window.scrollY;
  const focused         = document.activeElement;
  const isInsideList    = list.contains(focused);
  const focusedCardId   = isInsideList ? focused.closest('[data-combatant-id]')?.dataset.combatantId : null;
  const focusedIsAction = isInsideList && focused.classList.contains('action-input');
  const focusedIsAmount = isInsideList && focused.classList.contains('attack-amount');
  const focusedValue    = (focusedIsAction || focusedIsAmount) ? focused.value : null;

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
    const isOwnCard     = myUid === c.ownerUid && !isCreature;
    const hpPercent     = c.hpMax > 0 ? (c.hpCurrent / c.hpMax) * 100 : 0;
    const conditions    = c.conditions ? Object.keys(c.conditions) : [];
    const hpClass       = hpPercent <= 25 ? 'hp-critical' : hpPercent <= 50 ? 'hp-low' : '';
    const showFullHp    = isOwnCard || (isMaster && isCreature) || (!isMaster && !isCreature);
    const showHint      = !isOwnCard && !isMaster && isCreature && c.showHealthHint;
    const canEditMaxHp  = isOwnCard || (isMaster && isCreature);
    const ac            = acMap[c.ownerUid] ?? c.armorClass ?? null;
    const successes     = isOwnCard && isKO ? (myDeathSaves?.successes ?? 0) : 0;
    const failures      = isOwnCard && isKO ? (myDeathSaves?.failures  ?? 0) : 0;
    const turnNumber    = fullList.findIndex(x => x.id === c.id) + 1;

    // Pulisce bersagli non più validi dalla selezione persistente
    const validIds = new Set(fullList.filter(x => x.hpCurrent > 0 || x.type === 'player').map(x => x.id));
    validIds.add(c.id);
    const ownerSel = _selectedTargets.get(c.id);
    if (ownerSel) for (const tid of [...ownerSel]) { if (!validIds.has(tid)) ownerSel.delete(tid); }
    const isSel = (targetId) => _selectedTargets.get(c.id)?.has(targetId) ?? false;

    const targetChips = [
      `<button class="target-chip${isSel(c.id) ? ' selected' : ''}" data-action="toggle-target" data-target-id="${c.id}">👤 Sé stesso</button>`,
      ...fullList
        .filter(x => x.id !== c.id && (x.hpCurrent > 0 || x.type === 'player'))
        .map(x => {
          const prefix = x.type === 'player' ? '👤' : '👹';
          return `<button class="target-chip${isSel(x.id) ? ' selected' : ''}" data-action="toggle-target" data-target-id="${x.id}">${prefix} ${escapeHtml(x.name)}</button>`;
        })
    ].join('');

    const li = document.createElement('li');
    li.className = ['combatant-card', isActive ? 'active-turn' : '', isKO ? 'knocked-out' : '']
      .filter(Boolean).join(' ');
    li.dataset.combatantId = c.id;

    li.innerHTML = `
      <div class="card-header">
        <span class="turn-number">${turnNumber}</span>
        <div class="card-name-block">
          <span class="combatant-name">${escapeHtml(c.name)}${isKO ? ' ☠' : ''}</span>
          <span class="type-badge ${c.type}">${c.type === 'player' ? 'PG' : 'CR'}</span>
          ${ac !== null ? `<span class="ac-badge">CA ${ac}</span>` : ''}
        </div>
        <div class="initiative-block">
          ${canEdit
            ? `<button class="initiative-value editable" data-id="${c.id}" data-action="edit-initiative" title="Modifica iniziativa">${c.initiative}</button>`
            : `<span class="initiative-value">${c.initiative}</span>`
          }
        </div>
        ${canEdit ? `<button class="btn-remove" data-id="${c.id}" data-action="remove" aria-label="Rimuovi">×</button>` : ''}
      </div>

      ${showFullHp ? `
        <div class="hp-section">
          <div class="hp-header">
            <span class="hp-label">HP</span>
            <span class="hp-numbers ${hpClass}">
              ${c.hpCurrent} /
              ${canEditMaxHp
                ? `<button class="hp-max-btn" data-id="${c.id}" data-action="edit-hp-max" title="Modifica HP massimi">${c.hpMax}</button>`
                : c.hpMax
              }
            </span>
          </div>
          <div class="hp-bar-container">
            <div class="hp-bar" style="width:${hpPercent}%;background:${hpBarColor(hpPercent)}"></div>
          </div>
          ${isMaster && isCreature ? `
            <button
              class="btn-health-hint ${c.showHealthHint ? 'hint-active' : ''}"
              data-id="${c.id}"
              data-action="toggle-health-hint"
              title="${c.showHealthHint ? 'I giocatori vedono lo stato di salute' : 'I giocatori non vedono lo stato di salute'}"
            >
              ${c.showHealthHint ? '👁 Stato salute visibile ai giocatori' : '👁 Stato di salute nascosto ai giocatori'}
            </button>
          ` : ''}
        </div>
      ` : showHint ? `
        <div class="health-hint hint-${healthHintKey(hpPercent)}">
          ${healthHintText(hpPercent)}
        </div>
      ` : ''}

      ${canEdit ? `
        <div class="action-panel">
          <div class="action-input-row">
            <span class="action-icon-label">⚔</span>
            <input
              type="text"
              class="action-input"
              data-id="${c.id}"
              placeholder="Arma o incantesimo (es. Ascia da guerra)"
              value="${escapeHtml(c.currentAction || '')}"
              autocomplete="off"
            >
          </div>
          <div class="attack-row">
            <div class="target-chips" data-id="${c.id}">
              ${targetChips}
            </div>
            <div class="attack-controls">
              <input
                type="number"
                class="attack-amount"
                data-id="${c.id}"
                placeholder="Inserisci quantità..."
                min="1"
                max="9999"
              >
              <div class="attack-buttons">
                <button class="btn-apply-damage" data-id="${c.id}" data-action="apply-damage">
                  🗡 Infliggi Danno
                </button>
                <button class="btn-apply-heal" data-id="${c.id}" data-action="apply-heal">
                  ✚ Applica Cura
                </button>
              </div>
            </div>
          </div>
        </div>
      ` : c.currentAction ? `
        <div class="action-display">⚔ ${escapeHtml(c.currentAction)}</div>
      ` : ''}

      ${conditions.length > 0 ? `
        <div class="active-conditions">
          ${conditions.map(cond => {
            const meta = CONDITIONS.find(x => x.name === cond);
            return `<span class="condition-badge" style="background:${meta?.color ?? '#666'}">${cond}</span>`;
          }).join('')}
        </div>
      ` : ''}

      ${canEdit ? `
        <button class="btn-conditions" data-id="${c.id}" data-action="open-conditions">
          ${conditions.length > 0 ? '✎ Modifica condizioni' : '+ Condizioni'}
        </button>
      ` : ''}

      ${isOwnCard ? `
        <button class="btn-sheet" data-id="${c.id}" data-action="open-sheet">📜 Scheda Personaggio</button>
      ` : ''}

      ${isOwnCard && isKO ? `
        <div class="death-saves-inline">
          <div class="ds-row">
            <span class="ds-label">Successi</span>
            ${[0,1,2].map(i => `<button class="ds-pip${i < successes ? ' filled' : ''}" data-action="death-save" data-type="successes" data-index="${i}">${i < successes ? '●' : '○'}</button>`).join('')}
          </div>
          <div class="ds-row">
            <span class="ds-label">Fallimenti</span>
            ${[0,1,2].map(i => `<button class="ds-pip${i < failures ? ' filled' : ''}" data-action="death-save" data-type="failures" data-index="${i}">${i < failures ? '●' : '○'}</button>`).join('')}
          </div>
        </div>
      ` : ''}

      ${isActive && isOwnCard ? `
        <button class="btn-end-turn" data-id="${c.id}" data-action="end-turn">✓ Fine Turno</button>
      ` : ''}
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

  // ── Ripristina scroll e focus ─────────────────────────────────────────────
  window.scrollTo(0, savedScrollY);

  if (focusedCardId) {
    const newCard = list.querySelector(`[data-combatant-id="${focusedCardId}"]`);
    if (newCard) {
      const sel = focusedIsAction ? '.action-input' : focusedIsAmount ? '.attack-amount' : null;
      if (sel) {
        const newInput = newCard.querySelector(sel);
        if (newInput) {
          newInput.focus({ preventScroll: true });
          if (focusedValue !== null) newInput.value = focusedValue;
        }
      }
    }
  }

  list.onclick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id     = btn.dataset.id;
    const action = btn.dataset.action;

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
    if (action === 'end-turn')        { callbacks.onEndTurn?.(); return; }
    if (action === 'death-save') {
      const type   = btn.dataset.type;
      const index  = parseInt(btn.dataset.index);
      const filled = btn.classList.contains('filled');
      callbacks.onDeathSave?.(type, filled ? index : index + 1);
      return;
    }
    if (action === 'remove')          { callbacks.onRemove(id); return; }
    if (action === 'open-conditions') { callbacks.onOpenConditions(id); return; }
    if (action === 'edit-initiative') { openInitiativeEdit(btn, id, callbacks.onInitiativeChange); return; }
    if (action === 'edit-hp-max')     { openHpMaxEdit(btn, id, callbacks.onSetMaxHp); return; }
    if (action === 'open-sheet')      { callbacks.onOpenSheet?.(); return; }
  };
}

function _flashError(btn, message) {
  const original = btn.textContent;
  btn.textContent = message;
  btn.style.opacity = '0.7';
  setTimeout(() => { btn.textContent = original; btn.style.opacity = ''; }, 2000);
}

function openInitiativeEdit(btn, id, onInitiativeChange) {
  const original = btn.textContent.trim();
  const input    = document.createElement('input');
  input.type      = 'number';
  input.value     = original;
  input.className = 'initiative-edit-input';

  const confirm = () => {
    const val = parseInt(input.value);
    btn.textContent = isNaN(val) ? original : String(val);
    input.replaceWith(btn);
    if (!isNaN(val) && val !== parseInt(original)) onInitiativeChange(id, val);
  };

  input.onblur    = confirm;
  input.onkeydown = (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = original; input.blur(); }
  };

  btn.replaceWith(input);
  input.focus();
  input.select();
}

function openHpMaxEdit(btn, id, onSetMaxHp) {
  const original = btn.textContent.trim();
  const input    = document.createElement('input');
  input.type      = 'number';
  input.value     = original;
  input.className = 'hp-max-edit-input';
  input.min       = '1';
  input.max       = '9999';

  const confirm = () => {
    const val = parseInt(input.value);
    btn.textContent = isNaN(val) ? original : String(val);
    input.replaceWith(btn);
    if (!isNaN(val) && val !== parseInt(original)) onSetMaxHp(id, val);
  };

  input.onblur    = confirm;
  input.onkeydown = (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = original; input.blur(); }
  };

  btn.replaceWith(input);
  input.focus();
  input.select();
}

export function renderConditionModal(combatantId, activeConditions, onToggle) {
  const modal         = document.getElementById('condition-modal');
  const conditionList = document.getElementById('condition-list');

  conditionList.innerHTML = CONDITIONS.map(cond => `
    <button
      class="condition-option ${activeConditions.includes(cond.name) ? 'active' : ''}"
      data-condition="${cond.name}"
      style="--cond-color:${cond.color}"
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
  if (percent >= 25)   return '⚔ Gravemente ferito';
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
