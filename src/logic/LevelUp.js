const ORDINAL_MAP = { '1st':1,'2nd':2,'3rd':3,'4th':4,'5th':5,'6th':6,'7th':7,'8th':8,'9th':9 };
const SPELL_SLOT_COLS = new Set(Object.keys(ORDINAL_MAP));
const SKIP_COLS = new Set(['Level', 'Features', 'Proficiency Bonus', ...SPELL_SLOT_COLS]);

export class LevelUp {
  static #cache = null;

  static async load() {
    if (LevelUp.#cache) return LevelUp.#cache;
    const res = await fetch('./json/classes.json');
    LevelUp.#cache = await res.json();
    return LevelUp.#cache;
  }

  static getChanges(classesData, className, fromLevel, toLevel) {
    const cls = classesData[className];
    if (!cls) return null;
    const table = LevelUp.#findTable(cls);
    if (!table) return null;

    const oldRow = LevelUp.#rowAt(table, fromLevel);
    const newRow = LevelUp.#rowAt(table, toLevel);

    const statChanges = [];
    const spellSlots  = {};

    for (const col of Object.keys(newRow)) {
      if (col === 'Features') continue;
      const oldVal = String(oldRow[col] ?? '—');
      const newVal = String(newRow[col] ?? '—');
      if (oldVal === newVal) continue;

      if (SPELL_SLOT_COLS.has(col)) {
        const newMax = parseInt(newVal) || 0;
        if (newMax > 0) spellSlots[String(ORDINAL_MAP[col])] = newMax;
      } else if (col === 'Proficiency Bonus') {
        statChanges.push({ label: 'Bonus Competenza', old: oldVal, new: newVal });
      } else {
        statChanges.push({ label: col, old: oldVal, new: newVal });
      }
    }

    return {
      statChanges,
      spellSlots,
      profBonus: LevelUp.#parseProfBonus(newRow['Proficiency Bonus'] ?? '+2'),
      features:  LevelUp.#featuresAt(table, cls, toLevel),
      hitDie:    LevelUp.#extractHitDie(cls),
    };
  }

  static getCreationData(classesData, className, startingLevel) {
    const cls = classesData[className];
    if (!cls) return null;
    const table = LevelUp.#findTable(cls);
    if (!table) return null;

    const snap       = LevelUp.#rowAt(table, startingLevel);
    const profBonus  = LevelUp.#parseProfBonus(snap['Proficiency Bonus'] ?? '+2');
    const hitDie     = LevelUp.#extractHitDie(cls);

    const spellSlots = {};
    for (const col of Object.keys(snap)) {
      if (!SPELL_SLOT_COLS.has(col)) continue;
      const val = parseInt(snap[col]) || 0;
      if (val > 0) spellSlots[String(ORDINAL_MAP[col])] = val;
    }

    const specialStats = [];
    for (const col of Object.keys(snap)) {
      if (SKIP_COLS.has(col)) continue;
      specialStats.push({ label: col, value: String(snap[col] ?? '—') });
    }

    const allFeatures = [];
    for (let lv = 1; lv <= startingLevel; lv++) {
      allFeatures.push(...LevelUp.#featuresAt(table, cls, lv));
    }

    return { allFeatures, profBonus, spellSlots, specialStats, hitDie };
  }

  static classNames(classesData) {
    return Object.keys(classesData).sort();
  }

  static resolveClassName(classesData, input) {
    if (!input) return null;
    const keys = Object.keys(classesData);
    const low  = input.toLowerCase().trim();
    const exact = keys.find(k => k.toLowerCase() === low);
    if (exact) return exact;
    const starts = keys.find(k => k.toLowerCase().startsWith(low));
    if (starts) return starts;
    const contains = keys.find(k => k.toLowerCase().includes(low) || low.includes(k.toLowerCase()));
    return contains ?? null;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  static #findTable(cls) {
    for (const v of Object.values(cls['Class Features'] ?? {})) {
      if (v?.table) return v.table;
    }
    return null;
  }

  static #rowAt(table, level) {
    const levels = table['Level'] ?? [];
    const idx = levels.findIndex(l => parseInt(l) === level);
    if (idx === -1) return {};
    const row = {};
    for (const [col, vals] of Object.entries(table)) {
      if (col === 'Level') continue;
      row[col] = vals[idx] ?? '—';
    }
    return row;
  }

  static #featuresAt(table, cls, level) {
    const levels   = table['Level']    ?? [];
    const featsCol = table['Features'] ?? [];
    const idx = levels.findIndex(l => parseInt(l) === level);
    if (idx === -1 || idx >= featsCol.length) return [];
    const raw = featsCol[idx];
    if (!raw || raw === '-') return [];
    return raw.split(',').map(n => n.trim()).filter(Boolean).map(name => ({
      name,
      description: LevelUp.#getFeatureDescription(cls, name),
      level,
    }));
  }

  static #getFeatureDescription(cls, featureName) {
    const feat = cls['Class Features']?.[featureName];
    if (!feat) return '';
    if (typeof feat === 'string') return feat;
    if (typeof feat === 'object') {
      const c = feat.content;
      if (typeof c === 'string') return c;
      if (Array.isArray(c)) return c.join('\n');
    }
    return '';
  }

  static #parseProfBonus(str) {
    return parseInt(String(str).replace('+', '')) || 2;
  }

  static #extractHitDie(cls) {
    const hp  = cls['Class Features']?.['Hit Points'];
    const arr = Array.isArray(hp?.content) ? hp.content
              : hp?.content ? [hp.content]
              : [];
    for (const s of arr) {
      const m = String(s).match(/(d\d+)/);
      if (m) return m[1];
    }
    return 'd8';
  }
}
