// ─── Calculation helpers ───────────────────────────────────────────────────

const SKILL_ABILITY = {
  acrobatics: 'dex', animalHandling: 'wis', arcana: 'int', athletics: 'str',
  deception: 'cha', history: 'int', insight: 'wis', intimidation: 'cha',
  investigation: 'int', medicine: 'wis', nature: 'int', perception: 'wis',
  performance: 'cha', persuasion: 'cha', religion: 'int', sleightOfHand: 'dex',
  stealth: 'dex', survival: 'wis',
};

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const SPELL_LEVELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

function abilityScore(data, ab) { return data?.abilities?.[ab] ?? 10; }
function mod(score)              { return Math.floor((score - 10) / 2); }
function profBonus(data)         { return data?.proficiencyBonus ?? 2; }
function signed(n)               { return n >= 0 ? `+${n}` : `${n}`; }

function abilityMod(data, ab)    { return mod(abilityScore(data, ab)); }

function skillTotal(data, skillKey) {
  const ab   = SKILL_ABILITY[skillKey];
  const base = abilityMod(data, ab);
  const prof = data?.skills?.[skillKey] ?? 0;
  const pb   = profBonus(data);
  return base + (prof === 1 ? pb : prof === 2 ? pb * 2 : 0);
}

function saveTotal(data, ab) {
  const base = abilityMod(data, ab);
  const prof = data?.savingThrows?.[ab] ? profBonus(data) : 0;
  return base + prof;
}

function spellcastingMod(data) {
  const ab = data?.spellcastingAbility;
  if (!ab) return null;
  return abilityMod(data, ab);
}

function attackBonusCalc(attack, data) {
  if (attack.attackBonusOverride) return attack.attackBonusOverride;
  if (attack.ability === 'manual') return '—';
  const pb   = profBonus(data);
  const abMod = abilityMod(data, attack.ability);
  const total = abMod + (attack.proficient ? pb : 0);
  return signed(total);
}

function damageBonusCalc(attack, data) {
  if (attack.damageBonusOverride) return attack.damageBonusOverride;
  if (attack.ability === 'manual') return '';
  return signed(abilityMod(data, attack.ability));
}

// ─── Populate all static inputs from Firebase data ────────────────────────

export function populateSheet(data) {
  const d = data || {};

  // Fill all [data-path] inputs / textareas / selects
  document.querySelectorAll('#view-character [data-path]').forEach(el => {
    const path  = el.dataset.path;
    const value = getNestedValue(d, path);
    if (el.tagName === 'SELECT') {
      el.value = value ?? '';
    } else if (el.tagName === 'TEXTAREA') {
      el.value = value ?? '';
    } else {
      el.value = value ?? '';
    }
  });

  updateComputedValues(data);
  renderDeathSaves(d.deathSaves);
  renderSaveChecks(d.savingThrows);
  renderSkillProfs(d.skills);
}

// ─── Update only computed/derived display elements ─────────────────────────

export function updateComputedValues(data) {
  const d = data || {};

  // Ability modifiers
  ABILITIES.forEach(ab => {
    const el = document.getElementById(`mod-${ab}`);
    if (el) el.textContent = signed(abilityMod(d, ab));
  });

  // Saving throws
  ABILITIES.forEach(ab => {
    const el = document.getElementById(`save-${ab}`);
    if (el) el.textContent = signed(saveTotal(d, ab));
  });

  // Skills
  Object.keys(SKILL_ABILITY).forEach(sk => {
    const el = document.getElementById(`skill-${sk}`);
    if (el) el.textContent = signed(skillTotal(d, sk));
  });

  // Passive perception
  const pp = document.getElementById('passive-perception');
  if (pp) pp.textContent = String(10 + skillTotal(d, 'perception'));

  // Spell stats
  const castMod  = spellcastingMod(d);
  const extraMod = d.spellBonusModifier ?? 0;
  const dcEl     = document.getElementById('spell-save-dc');
  const abEl     = document.getElementById('spell-attack-bonus');
  if (dcEl) dcEl.textContent = castMod !== null ? String(8 + profBonus(d) + castMod + extraMod) : '—';
  if (abEl) abEl.textContent = castMod !== null ? signed(profBonus(d) + castMod + extraMod)     : '—';
}

// ─── Death saves ────────────────────────────────────────────────────────────

export function renderDeathSaves(deathSaves) {
  const successes = deathSaves?.successes ?? 0;
  const failures  = deathSaves?.failures  ?? 0;
  ['successes', 'failures'].forEach(type => {
    const count = type === 'successes' ? successes : failures;
    document.querySelectorAll(`.death-pip[data-type="${type}"]`).forEach((btn, i) => {
      btn.textContent = i < count ? '●' : '○';
      btn.classList.toggle('filled', i < count);
    });
  });
}

// ─── Saving throw checkmarks ────────────────────────────────────────────────

export function renderSaveChecks(savingThrows) {
  document.querySelectorAll('.save-check').forEach(btn => {
    const ab      = btn.dataset.ability;
    const active  = !!(savingThrows?.[ab]);
    btn.textContent = active ? '●' : '○';
    btn.classList.toggle('active', active);
  });
}

// ─── Skill proficiency icons ────────────────────────────────────────────────

export function renderSkillProfs(skills) {
  const ICONS = ['○', '◑', '●'];
  document.querySelectorAll('.skill-prof').forEach(btn => {
    const level = skills?.[btn.dataset.skill] ?? 0;
    btn.textContent = ICONS[level] ?? '○';
    btn.dataset.level = level;
    btn.classList.toggle('active',     level >= 1);
    btn.classList.toggle('expertise',  level === 2);
  });
}

// ─── Attacks ────────────────────────────────────────────────────────────────

export function renderAttacks(attacks, data, onRemove) {
  const container = document.getElementById('attacks-list');
  if (!container) return;
  const entries = Object.entries(attacks || {});
  if (entries.length === 0) {
    container.innerHTML = '<p class="empty-hint">Nessun attacco configurato.</p>';
    return;
  }
  container.innerHTML = entries.map(([id, atk]) => {
    const atkBonus = attackBonusCalc(atk, data);
    const dmgBonus = damageBonusCalc(atk, data);
    const dmgStr   = dmgBonus ? `${escapeHtml(atk.damageFormula || '')}${dmgBonus}` : escapeHtml(atk.damageFormula || '—');
    return `
      <div class="attack-entry" data-id="${id}">
        <div class="attack-row-main">
          <span class="attack-entry-name">${escapeHtml(atk.name)}</span>
          <span class="attack-stat">${atkBonus}</span>
          <span class="attack-damage">${dmgStr} ${escapeHtml(atk.damageType || '')}</span>
          <button class="btn-remove-sm" data-action="remove-attack" data-id="${id}" aria-label="Rimuovi">×</button>
        </div>
      </div>`;
  }).join('');

  container.onclick = (e) => {
    const btn = e.target.closest('[data-action="remove-attack"]');
    if (btn) onRemove(btn.dataset.id);
  };
}

// ─── Spell Slots ─────────────────────────────────────────────────────────────

export function renderSpellSlots(slots, onSetUsed, onSetMax) {
  const container = document.getElementById('spell-slots-list');
  if (!container) return;
  container.innerHTML = SPELL_LEVELS.map(lvl => {
    const s    = slots?.[lvl] || {};
    const max  = s.max  ?? 0;
    const used = s.used ?? 0;
    const pips = max > 0
      ? Array.from({ length: max }, (_, i) => {
          const isUsed = i < used;
          return `<button class="slot-pip ${isUsed ? 'used' : 'available'}" data-level="${lvl}" data-index="${i}" title="${isUsed ? 'Usato — clicca per recuperare' : 'Disponibile — clicca per usare'}"></button>`;
        }).join('')
      : '<span class="slot-none">—</span>';
    return `
      <div class="slot-row" data-level="${lvl}">
        <span class="slot-level">${lvl}°</span>
        <div class="slot-pips">${pips}</div>
        <input type="number" class="slot-max-input" data-level="${lvl}" min="0" max="9" value="${max}" title="Numero massimo di slot">
      </div>`;
  }).join('');

  container.onclick = (e) => {
    const pip = e.target.closest('.slot-pip');
    if (!pip) return;
    const lvl   = pip.dataset.level;
    const index = parseInt(pip.dataset.index);
    const isUsed = pip.classList.contains('used');
    onSetUsed(lvl, isUsed ? index : index + 1);
  };

  container.querySelectorAll('.slot-max-input').forEach(input => {
    input.addEventListener('change', () => {
      const val = Math.max(0, Math.min(9, parseInt(input.value) || 0));
      input.value = val;
      onSetMax(input.dataset.level, val);
    });
  });
}

// ─── Cantrips ────────────────────────────────────────────────────────────────

export function renderCantrips(cantrips, onRemove) {
  const container = document.getElementById('cantrips-list');
  if (!container) return;
  const entries = Object.entries(cantrips || {});
  if (entries.length === 0) {
    container.innerHTML = '<p class="empty-hint">Nessun trucchetto.</p>';
    return;
  }
  container.innerHTML = entries.map(([id, name]) => `
    <div class="cantrip-entry">
      <span>${escapeHtml(name)}</span>
      <button class="btn-remove-sm" data-action="remove-cantrip" data-id="${id}" aria-label="Rimuovi">×</button>
    </div>`).join('');

  container.onclick = (e) => {
    const btn = e.target.closest('[data-action="remove-cantrip"]');
    if (btn) onRemove(btn.dataset.id);
  };
}

// ─── Spells by level ─────────────────────────────────────────────────────────

export function renderSpellsByLevel(spells, onRemove, onTogglePrepared, onAddSpell) {
  const container = document.getElementById('spells-by-level');
  if (!container) return;
  container.innerHTML = SPELL_LEVELS.map(lvl => {
    const levelSpells = spells?.[lvl] || {};
    const entries = Object.entries(levelSpells);
    const spellItems = entries.length === 0
      ? '<p class="empty-hint">Nessun incantesimo.</p>'
      : entries.map(([id, sp]) => `
          <div class="spell-entry">
            <button class="spell-prepared ${sp.prepared ? 'prepared' : ''}" data-action="toggle-prepared" data-level="${lvl}" data-id="${id}" title="${sp.prepared ? 'Preparato' : 'Non preparato'}">
              ${sp.prepared ? '★' : '☆'}
            </button>
            <span class="spell-name">${escapeHtml(sp.name)}</span>
            <button class="btn-remove-sm" data-action="remove-spell" data-level="${lvl}" data-id="${id}" aria-label="Rimuovi">×</button>
          </div>`).join('');
    return `
      <div class="spell-level-block">
        <div class="spell-level-header">${lvl}° livello</div>
        <div class="spell-level-entries" id="spell-level-${lvl}">${spellItems}</div>
        <form class="add-form-inline" data-spell-level="${lvl}" novalidate>
          <input type="text" placeholder="Nome incantesimo" maxlength="40">
          <button type="submit" class="btn-secondary btn-sm">+ Aggiungi</button>
        </form>
      </div>`;
  }).join('');

  container.onclick = (e) => {
    const toggle = e.target.closest('[data-action="toggle-prepared"]');
    if (toggle) { onTogglePrepared(toggle.dataset.level, toggle.dataset.id); return; }
    const remove = e.target.closest('[data-action="remove-spell"]');
    if (remove) { onRemove(remove.dataset.level, remove.dataset.id); return; }
  };

  container.querySelectorAll('form[data-spell-level]').forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input[type="text"]');
      const name = input?.value.trim();
      if (name) { onAddSpell(form.dataset.spellLevel, name); input.value = ''; }
    });
  });
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export function renderInventory(inventory, onRemove) {
  const container = document.getElementById('inventory-list');
  if (!container) return;
  const entries = Object.entries(inventory || {});
  if (entries.length === 0) {
    container.innerHTML = '<p class="empty-hint">Inventario vuoto.</p>';
    return;
  }
  container.innerHTML = entries.map(([id, item]) => `
    <div class="inventory-entry" data-id="${id}">
      <span class="item-qty">${item.quantity ?? 1}×</span>
      <span class="item-name">${escapeHtml(item.name)}</span>
      ${item.notes ? `<span class="item-notes">${escapeHtml(item.notes)}</span>` : ''}
      <button class="btn-remove-sm" data-action="remove-item" data-id="${id}" aria-label="Rimuovi">×</button>
    </div>`).join('');

  container.onclick = (e) => {
    const btn = e.target.closest('[data-action="remove-item"]');
    if (btn) onRemove(btn.dataset.id);
  };
}

// ─── Death save interaction ───────────────────────────────────────────────────

export function bindDeathSaves(onSet) {
  document.querySelectorAll('.death-pip').forEach(btn => {
    if (btn._sheetBound) return;
    btn._sheetBound = true;
    btn.addEventListener('click', () => {
      const type  = btn.dataset.type;
      const index = parseInt(btn.dataset.index);
      const filled = btn.classList.contains('filled');
      onSet(type, filled ? index : index + 1);
    });
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getNestedValue(obj, path) {
  return path.split('/').reduce((acc, key) => acc?.[key], obj);
}
