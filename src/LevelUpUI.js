import { LevelUp } from './LevelUp.js';

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function dieAvg(hitDie) {
  const sides = parseInt(hitDie.replace('d', '')) || 8;
  return Math.floor(sides / 2) + 1;
}

export class LevelUpUI {
  static #onConfirmCb = null;

  // ─── Level-up flow ────────────────────────────────────────────────────────────

  static openLevelUp(changes, fromLevel, className, onConfirm) {
    const toLevel = fromLevel + 1;
    const conMod  = changes.conMod ?? 0;
    const avg     = dieAvg(changes.hitDie) + conMod;
    const hpSugg  = Math.max(1, avg);

    const statsHtml = changes.statChanges.length > 0
      ? `<div class="lu-section">
           <h4 class="lu-section-title">Variazioni</h4>
           ${changes.statChanges.map(s =>
             `<div class="lu-stat-row"><span class="lu-stat-label">${esc(s.label)}</span>
              <span class="lu-stat-change">${esc(s.old)} → <strong>${esc(s.new)}</strong></span></div>`
           ).join('')}
         </div>` : '';

    const slotsHtml = Object.keys(changes.spellSlots).length > 0
      ? `<div class="lu-section">
           <h4 class="lu-section-title">Slot Incantesimo (nuovi massimi)</h4>
           ${Object.entries(changes.spellSlots).map(([lv, max]) =>
             `<div class="lu-stat-row"><span class="lu-stat-label">Slot ${lv}°</span>
              <strong>${max}</strong></div>`
           ).join('')}
         </div>` : '';

    const featHtml = changes.features.length > 0
      ? `<div class="lu-section">
           <h4 class="lu-section-title">Nuove Capacità</h4>
           ${LevelUpUI.#featuresForm(changes.features)}
         </div>` : '';

    document.getElementById('levelup-modal-title').textContent =
      `⬆ Level Up: ${className} ${fromLevel} → ${toLevel}`;

    document.getElementById('levelup-modal-body').innerHTML = `
      ${statsHtml}
      ${slotsHtml}
      <div class="lu-section">
        <h4 class="lu-section-title">Punti Vita guadagnati</h4>
        <div class="lu-hp-row">
          <span class="lu-hint">${changes.hitDie} + COS (media: ${hpSugg})</span>
          <input type="number" id="lu-hp-input" class="lu-hp-input" min="1" value="${hpSugg}">
        </div>
      </div>
      ${featHtml}`;

    document.getElementById('btn-levelup-confirm').textContent = 'Conferma Level Up';
    LevelUpUI.#onConfirmCb = () => {
      const hpGained = parseInt(document.getElementById('lu-hp-input')?.value) || hpSugg;
      const features = LevelUpUI.#readFeatures();
      onConfirm({ hpGained, features, profBonus: changes.profBonus, spellSlots: changes.spellSlots });
    };
    LevelUpUI.#show();
  }

  // ─── Creation flow ────────────────────────────────────────────────────────────

  static openCreation(classesData, onConfirm) {
    const classes = Object.keys(classesData).sort();

    document.getElementById('levelup-modal-title').textContent = 'Crea Personaggio';
    document.getElementById('levelup-modal-body').innerHTML = `
      <div class="lu-section">
        <div class="field-row"><label>Nome</label>
          <input type="text" id="lu-char-name" placeholder="Nome personaggio" maxlength="40">
        </div>
        <div class="field-row"><label>Classe</label>
          <select id="lu-class-select" class="input-select">
            <option value="">— Scegli classe —</option>
            ${classes.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
          </select>
        </div>
        <div class="field-row"><label>Sottoclasse <small>(opzionale)</small></label>
          <input type="text" id="lu-subclass-input" placeholder="es. Berserker, Evocation…" maxlength="30">
        </div>
        <div class="field-row"><label>Livello iniziale</label>
          <select id="lu-level-select" class="input-select">
            ${Array.from({length:20},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}
          </select>
        </div>
      </div>`;

    document.getElementById('btn-levelup-confirm').textContent = 'Avanti →';
    LevelUpUI.#onConfirmCb = () => {
      const name     = document.getElementById('lu-char-name')?.value.trim();
      const cls      = document.getElementById('lu-class-select')?.value;
      const subclass = document.getElementById('lu-subclass-input')?.value.trim();
      const level    = parseInt(document.getElementById('lu-level-select')?.value) || 1;
      if (!name) { document.getElementById('lu-char-name')?.focus(); return; }
      if (!cls)  { document.getElementById('lu-class-select')?.focus(); return; }

      const data = LevelUp.getCreationData(classesData, cls, level);
      if (!data) return;

      LevelUpUI.#openCreationStep2({ name, cls, subclass, level, data, onConfirm });
    };

    LevelUpUI.#show();
  }

  static #openCreationStep2({ name, cls, subclass, level, data, onConfirm }) {
    const dieSize = parseInt(data.hitDie.replace('d','')) || 8;
    const avgPerLevel = Math.floor(dieSize / 2) + 1;
    const hpSugg  = dieSize + (avgPerLevel * (level - 1));

    const slotsHtml = Object.keys(data.spellSlots).length > 0
      ? `<div class="lu-section">
           <h4 class="lu-section-title">Slot Incantesimo al livello ${level}</h4>
           ${Object.entries(data.spellSlots).map(([lv, max]) =>
             `<div class="lu-stat-row"><span class="lu-stat-label">Slot ${lv}°</span>
              <strong>${max}</strong></div>`
           ).join('')}
         </div>` : '';

    const statsHtml = data.specialStats.length > 0
      ? `<div class="lu-section">
           <h4 class="lu-section-title">Statistiche di Classe al livello ${level}</h4>
           ${data.specialStats.map(s =>
             `<div class="lu-stat-row"><span class="lu-stat-label">${esc(s.label)}</span>
              <strong>${esc(s.value)}</strong></div>`
           ).join('')}
         </div>` : '';

    const featHtml = data.allFeatures.length > 0
      ? `<div class="lu-section">
           <h4 class="lu-section-title">Capacità di Classe (livelli 1–${level})</h4>
           ${LevelUpUI.#featuresForm(data.allFeatures)}
         </div>` : '';

    document.getElementById('levelup-modal-title').textContent =
      `${cls}${subclass ? ' · ' + subclass : ''} — Livello ${level}`;

    document.getElementById('levelup-modal-body').innerHTML = `
      <div class="lu-section">
        <div class="lu-stat-row">
          <span class="lu-stat-label">Bonus Competenza</span>
          <strong>+${data.profBonus}</strong>
        </div>
      </div>
      ${slotsHtml}
      ${statsHtml}
      <div class="lu-section">
        <h4 class="lu-section-title">HP Massimi</h4>
        <div class="lu-hp-row">
          <span class="lu-hint">${data.hitDie} (lv1 max) + media lv2+ (suggerito: ${hpSugg})</span>
          <input type="number" id="lu-hp-input" class="lu-hp-input" min="1" value="${hpSugg}">
        </div>
      </div>
      ${featHtml}`;

    document.getElementById('btn-levelup-confirm').textContent = 'Crea Personaggio';
    LevelUpUI.#onConfirmCb = () => {
      const hpMax    = parseInt(document.getElementById('lu-hp-input')?.value) || hpSugg;
      const features = LevelUpUI.#readFeatures();
      onConfirm({
        name, className: cls, subclass, level, hpMax,
        profBonus:   data.profBonus,
        spellSlots:  data.spellSlots,
        hitDiceType: data.hitDie,
        features,
        stats: data.specialStats,
      });
    };
  }

  static close() {
    const modal = document.getElementById('levelup-modal');
    if (modal) modal.classList.add('hidden');
    LevelUpUI.#onConfirmCb = null;
  }

  static bindConfirm() {
    const btn = document.getElementById('btn-levelup-confirm');
    if (!btn || btn._luBound) return;
    btn._luBound = true;
    btn.addEventListener('click', () => LevelUpUI.#onConfirmCb?.());
  }

  static bindCancel() {
    const btn = document.getElementById('btn-levelup-cancel');
    if (!btn || btn._luBound) return;
    btn._luBound = true;
    btn.addEventListener('click', () => LevelUpUI.close());
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  static #show() {
    document.getElementById('levelup-modal')?.classList.remove('hidden');
  }

  static #featuresForm(features) {
    return features.map((f, i) => `
      <div class="lu-feature-card">
        <div class="lu-feature-header">
          <span class="lu-feature-level">Lv.${f.level}</span>
          <input type="text" class="lu-feature-name" data-feat-idx="${i}" value="${esc(f.name)}" placeholder="Nome">
        </div>
        <textarea class="lu-feature-desc" data-feat-idx="${i}" rows="3" placeholder="Descrizione (opz.)">${esc(f.description)}</textarea>
      </div>`).join('');
  }

  static #readFeatures() {
    const cards = document.querySelectorAll('#levelup-modal-body .lu-feature-card');
    const result = [];
    cards.forEach((card, i) => {
      const name = card.querySelector('.lu-feature-name')?.value.trim() ?? '';
      const desc = card.querySelector('.lu-feature-desc')?.value.trim() ?? '';
      if (name) result.push({ name, description: desc });
    });
    return result;
  }
}
