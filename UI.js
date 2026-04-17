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

export function renderCombatantList(combatants, currentTurnId, myUid, masterUid, callbacks) {
  const list     = document.getElementById('combatant-list');
  const emptyMsg = document.getElementById('empty-list-msg');

  list.innerHTML = '';

  if (combatants.length === 0) {
    emptyMsg?.classList.remove('hidden');
    return;
  }
  emptyMsg?.classList.add('hidden');

  combatants.forEach((c, i) => {
    const isActive    = c.id === currentTurnId;
    const isKO        = c.hpCurrent === 0;
    const canEdit     = myUid === c.ownerUid || myUid === masterUid;
    const hpPercent   = c.hpMax > 0 ? (c.hpCurrent / c.hpMax) * 100 : 0;
    const conditions  = c.conditions ? Object.keys(c.conditions) : [];
    const hpTextClass = hpPercent <= 25 ? 'hp-critical' : hpPercent <= 50 ? 'hp-low' : '';

    const li = document.createElement('li');
    li.className = [
      'combatant-card',
      isActive ? 'active-turn' : '',
      isKO     ? 'knocked-out' : '',
    ].filter(Boolean).join(' ');

    li.innerHTML = `
      <div class="card-header">
        <span class="turn-number">${i + 1}</span>
        <div class="card-name-block">
          <span class="combatant-name">${escapeHtml(c.name)}${isKO ? ' ☠' : ''}</span>
          <span class="type-badge ${c.type}">${c.type === 'player' ? 'PG' : 'CR'}</span>
        </div>
        <div class="initiative-block">
          ${canEdit
            ? `<button class="initiative-value editable" data-id="${c.id}" data-action="edit-initiative" title="Modifica iniziativa">${c.initiative}</button>`
            : `<span class="initiative-value">${c.initiative}</span>`
          }
        </div>
        ${canEdit ? `<button class="btn-remove" data-id="${c.id}" data-action="remove" aria-label="Rimuovi">×</button>` : ''}
      </div>

      <div class="hp-row">
        <div class="hp-bar-container" title="${c.hpCurrent}/${c.hpMax} HP">
          <div class="hp-bar" style="width:${hpPercent}%;background:${hpBarColor(hpPercent)}"></div>
        </div>
        <span class="hp-text ${hpTextClass}">${c.hpCurrent} / ${c.hpMax} HP</span>
      </div>

      ${canEdit ? `
        <div class="hp-controls">
          <input type="number" class="hp-input" data-id="${c.id}" placeholder="Quantità" min="1" max="9999">
          <button class="btn-damage" data-id="${c.id}" data-action="damage">− Danno</button>
          <button class="btn-heal"   data-id="${c.id}" data-action="heal">+ Cura</button>
        </div>
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
    `;

    list.appendChild(li);

    if (isActive) {
      li.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });

  list.onclick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id     = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'damage' || action === 'heal') {
      const input = list.querySelector(`.hp-input[data-id="${id}"]`);
      const amt   = parseInt(input?.value);
      if (!amt || amt <= 0) return;
      callbacks.onHpChange(id, action === 'damage' ? -amt : amt);
      if (input) input.value = '';
      return;
    }
    if (action === 'remove')          { callbacks.onRemove(id); return; }
    if (action === 'open-conditions') { callbacks.onOpenConditions(id); return; }
    if (action === 'edit-initiative') { openInitiativeEdit(btn, id, callbacks.onInitiativeChange); return; }
  };
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

  input.onblur   = confirm;
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
