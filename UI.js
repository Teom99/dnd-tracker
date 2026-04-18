export const CONDITIONS = [
  { name: 'Avvelenato',   color: '#7c3aed' },
  { name: 'Stordito',     color: '#d97706' },
  { name: 'Spaventato',   color: '#dc2626' },
  { name: 'Bloccato',     color: '#ea580c' },
  { name: 'Accecato',     color: '#6b7280' },
  { name: 'Assordato',    color: '#6b7280' },
  { name: 'Prono',        color: '#9ca3af' },
  { name: 'Invisibile',   color: '#0891b2' },
  { name: 'Incapacitato', color: '#d97706' },
  { name: 'Paralizzato',  color: '#7c3aed' },
  { name: 'Pietrificato', color: '#7c3aed' },
  { name: 'Affascinato',  color: '#ec4899' },
  { name: 'Esausto',      color: '#dc2626' },
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

export function renderCombatantList(combatants, currentTurnId, myUid, masterUid, callbacks, acMap = {}) {
  const list     = document.getElementById('combatant-list');
  const emptyMsg = document.getElementById('empty-list-msg');

  list.innerHTML = '';

  if (combatants.length === 0) {
    emptyMsg?.classList.remove('hidden');
    return;
  }
  emptyMsg?.classList.add('hidden');

  combatants.forEach((c, i) => {
    const isActive      = c.id === currentTurnId;
    const isKO          = c.hpCurrent === 0;
    const canEdit       = myUid === c.ownerUid || myUid === masterUid;
    const isMaster      = myUid === masterUid;
    const isCreature    = c.type === 'creature';
    const isOwnCard     = myUid === c.ownerUid && !isCreature;
    const hpPercent     = c.hpMax > 0 ? (c.hpCurrent / c.hpMax) * 100 : 0;
    const conditions    = c.conditions ? Object.keys(c.conditions) : [];
    const hpClass       = hpPercent <= 25 ? 'hp-critical' : hpPercent <= 50 ? 'hp-low' : '';
    const showFullHp    = isOwnCard || (isMaster && isCreature);
    const showHint      = !isOwnCard && !isMaster && isCreature && c.showHealthHint;
    const canEditMaxHp  = isOwnCard || (isMaster && isCreature);
    const ac            = acMap[c.ownerUid] ?? c.armorClass ?? null;

    const targetOptions = [
      `<option value="">— Bersaglio —</option>`,
      `<option value="${c.id}">Sé stesso</option>`,
      ...combatants
        .filter(x => x.id !== c.id)
        .map(x => `<option value="${x.id}">${escapeHtml(x.name)}</option>`)
    ].join('');

    const li = document.createElement('li');
    li.className = ['combatant-card', isActive ? 'active-turn' : '', isKO ? 'knocked-out' : '']
      .filter(Boolean).join(' ');

    li.innerHTML = `
      <div class="card-header">
        <span class="turn-number">${i + 1}</span>
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
            <select class="target-select" data-id="${c.id}">
              ${targetOptions}
            </select>
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
    `;

    list.appendChild(li);

    // Salva l'azione dichiarata su blur (blur non fa bubble, quindi listener diretto)
    const actionInput = li.querySelector('.action-input');
    if (actionInput) {
      actionInput.addEventListener('blur',    () => callbacks.onSetAction(c.id, actionInput.value.trim()));
      actionInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') actionInput.blur(); });
    }

    if (isActive) li.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  list.onclick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id     = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'apply-damage' || action === 'apply-heal') {
      const targetId = list.querySelector(`.target-select[data-id="${id}"]`)?.value;
      const input    = list.querySelector(`.attack-amount[data-id="${id}"]`);
      const amt      = parseInt(input?.value);
      if (!targetId) { _flashError(btn, 'Scegli un bersaglio'); return; }
      if (!amt || amt <= 0) { _flashError(btn, 'Inserisci una quantità'); return; }
      callbacks.onApplyToTarget(targetId, action === 'apply-damage' ? -amt : amt);
      if (input) input.value = '';
      return;
    }
    if (action === 'toggle-health-hint') {
      const c = list.querySelector(`[data-id="${id}"][data-action="toggle-health-hint"]`);
      callbacks.onToggleHealthHint(id, c?.classList.contains('hint-active'));
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
  if (percent > 50) return '#4a7c59';
  if (percent > 25) return '#b5860d';
  return '#8b2020';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
