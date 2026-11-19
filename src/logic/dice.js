// Logica pura dei dadi: vassoio (pool), tiro, messaggio, validazione del tiro letto da Firebase
// e traiettoria di lancio per l'animazione. Nessun DOM, nessun Firebase — test in test/dice.html.

export const DIE_SIDES = [4, 6, 8, 10, 12, 20, 100];
export const MAX_DICE = 20;          // dadi totali in un tiro (oltre, l'animazione diventa illeggibile)
export const MAX_MOD  = 99;
export const ADV_MODES = ['normal', 'adv', 'dis'];

const isSide = (s) => DIE_SIDES.includes(s);
const clampMod = (m) => Math.max(-MAX_MOD, Math.min(MAX_MOD, Math.trunc(Number(m) || 0)));

export const emptyPool = () => ({});

export function poolCount(pool) {
  return Object.values(pool || {}).reduce((a, n) => a + n, 0);
}

export function addDie(pool, sides) {
  if (!isSide(sides) || poolCount(pool) >= MAX_DICE) return { ...pool };
  return { ...pool, [sides]: (pool[sides] || 0) + 1 };
}

export function removeDie(pool, sides) {
  const next = { ...pool };
  if (!next[sides]) return next;
  if (next[sides] <= 1) delete next[sides]; else next[sides] -= 1;
  return next;
}

// Vantaggio/svantaggio hanno senso solo con un d20 singolo nel vassoio
export const advApplies = (pool) => (pool?.[20] || 0) === 1;

const signed = (m) => (m > 0 ? ` + ${m}` : m < 0 ? ` − ${-m}` : '');

// "2d6 + 1d20 + 3" — dadi in ordine crescente di facce
export function poolLabel(pool, mod = 0) {
  const parts = DIE_SIDES.filter(s => pool?.[s]).map(s => `${pool[s]}d${s}`);
  if (!parts.length) return '';
  return parts.join(' + ') + signed(clampMod(mod));
}

// rng: () => [0, 1). Ritorna { dice: [{ s, v, drop? }], mod, adv, total }
export function rollPool(pool, mod = 0, adv = 'normal', rng = Math.random) {
  const die = (s) => 1 + Math.floor(rng() * s);
  const dice = [];
  const useAdv = adv !== 'normal' && advApplies(pool);
  for (const s of DIE_SIDES) {
    for (let i = 0; i < (pool?.[s] || 0); i++) {
      if (s === 20 && useAdv) {
        const a = die(20), b = die(20);
        const keepFirst = adv === 'adv' ? a >= b : a <= b;
        dice.push({ s, v: a, ...(keepFirst ? {} : { drop: true }) });
        dice.push({ s, v: b, ...(keepFirst ? { drop: true } : {}) });
      } else {
        dice.push({ s, v: die(s) });
      }
    }
  }
  const m = clampMod(mod);
  const total = dice.filter(d => !d.drop).reduce((a, d) => a + d.v, 0) + m;
  return { dice, mod: m, adv: useAdv ? adv : 'normal', total };
}

// 'crit' (20 naturale tenuto) · 'fumble' (1 naturale tenuto) · null — solo per un d20 singolo
export function critKind(roll) {
  const kept = (roll?.dice || []).filter(d => !d.drop);
  if (kept.length !== 1 || kept[0].s !== 20) return null;
  if (kept[0].v === 20) return 'crit';
  if (kept[0].v === 1) return 'fumble';
  return null;
}

// Etichetta della formula ricostruita dal tiro (i d20 scartati non contano due volte)
export function rollFormula(roll) {
  const pool = {};
  for (const d of roll?.dice || []) if (!d.drop) pool[d.s] = (pool[d.s] || 0) + 1;
  const base = poolLabel(pool, roll?.mod || 0);
  const tag = roll?.adv === 'adv' ? ' (vantaggio)' : roll?.adv === 'dis' ? ' (svantaggio)' : '';
  return base + tag;
}

export function rollMessage(actor, roll) {
  const who = actor || 'Qualcuno';
  const ck = critKind(roll);
  const tail = ck === 'crit' ? ' — 20 naturale!' : ck === 'fumble' ? ' — 1 naturale' : '';
  return `${who} tira ${rollFormula(roll)}: ${roll.total}${tail}`;
}

// Il tiro arriva da Firebase, dove qualunque utente autenticato può scrivere: si ricostruisce
// solo da campi validi, e il totale si ricalcola (mai fidarsi di quello scritto).
export function sanitizeRoll(raw) {
  if (!raw || !Array.isArray(raw.dice) || !raw.dice.length) return null;
  const dice = [];
  for (const d of raw.dice.slice(0, MAX_DICE * 2)) {
    const s = Number(d?.s), v = Number(d?.v);
    if (!isSide(s) || !Number.isInteger(v) || v < 1 || v > s) return null;
    dice.push({ s, v, ...(d.drop === true ? { drop: true } : {}) });
  }
  const mod = clampMod(raw.mod);
  const adv = ADV_MODES.includes(raw.adv) ? raw.adv : 'normal';
  const total = dice.filter(d => !d.drop).reduce((a, d) => a + d.v, 0) + mod;
  return { dice, mod, adv, total, ...(isDiceColor(raw.color) ? { color: raw.color } : {}) };
}

// Dove si posano i dadi: righe centrate, coordinate in frazioni del palco (0..1)
export function restSlots(n, perRow = 6) {
  const rows = Math.ceil(n / perRow);
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / perRow);
    const inRow = Math.min(perRow, n - r * perRow);
    const c = i - r * perRow;
    out.push({
      x: 0.5 + (c - (inRow - 1) / 2) * 0.11,
      y: 0.46 + (r - (rows - 1) / 2) * 0.16,
    });
  }
  return out;
}

// Lancio "fisico": parte da fuori bordo in basso a destra, vola verso il punto di riposo con
// rimbalzi decrescenti (altezza z), rotazione che rallenta, schiacciamento all'impatto.
// Ritorna keyframe astratti: t (0..1), x/y (frazioni del palco), z (altezza 0..1), rot (gradi), sq (scala y).
export function throwKeyframes(rest, rng = Math.random) {
  const sx = 1.08 + rng() * 0.08, sy = 0.78 + rng() * 0.3;
  const spin = (rng() < 0.5 ? -1 : 1) * (540 + rng() * 540);
  const bounces = [
    { t: 0.34, h: 0.0 }, { t: 0.56, h: 0.0 }, { t: 0.74, h: 0.0 }, { t: 0.86, h: 0.0 },
  ];
  const peaks = [{ t: 0.17, h: 0.55 }, { t: 0.45, h: 0.26 }, { t: 0.65, h: 0.11 }, { t: 0.80, h: 0.04 }];
  const pts = [{ t: 0, h: 0.35 }];
  for (let i = 0; i < bounces.length; i++) { pts.push(peaks[i]); pts.push(bounces[i]); }
  pts.push({ t: 1, h: 0 });
  // Avanzamento orizzontale con attrito: veloce all'inizio, quasi fermo alla fine
  const ease = (t) => 1 - Math.pow(1 - t, 2.6);
  const rotEase = (t) => 1 - Math.pow(1 - t, 3);
  return pts.map(({ t, h }, i) => {
    const p = ease(t);
    const impact = h === 0 && t > 0 && t < 1;
    return {
      t,
      x: sx + (rest.x - sx) * p,
      y: sy + (rest.y - sy) * p,
      z: h,
      rot: spin * (1 - rotEase(t)),
      sq: impact ? 0.82 + i * 0.02 : 1,
    };
  });
}

// ── Colore dei dadi: uno per giocatore, esclusivo nella sessione ──
// sessions/{code}/diceColors/{uid} = { color, name }. Palette fissa: è un dato (come la palette del
// disegno sulla mappa), non un colore di tema; il JS non accetta altri valori da Firebase.
export const DICE_COLORS = [
  '#9a2a1c', '#c4622d', '#b8892b', '#5f7a2e', '#2f6b52',
  '#2f5f7d', '#3b4f8f', '#6b3f8f', '#8f3b6b', '#3a3430',
];
const HEX_RE = /^#[0-9a-f]{6}$/;
export const isDiceColor = (c) => typeof c === 'string' && HEX_RE.test(c) && DICE_COLORS.includes(c);

// Chi ha già preso questo colore (uid), escluso `exceptUid`; null se è libero
export function colorOwner(colors, color, exceptUid = null) {
  for (const [uid, v] of Object.entries(colors || {})) {
    if (uid !== exceptUid && v?.color === color) return uid;
  }
  return null;
}

export const myDiceColor = (colors, uid) => (isDiceColor(colors?.[uid]?.color) ? colors[uid].color : null);

// Updater per runTransaction su diceColors: undefined = annulla (colore già di un altro).
// color null = libera il proprio colore.
export function applyDiceColorClaim(current, uid, color, name) {
  const next = { ...(current || {}) };
  if (color === null) { delete next[uid]; return next; }
  if (!isDiceColor(color) || colorOwner(current, color, uid)) return undefined;
  next[uid] = { color, name: String(name || '').slice(0, 40) };
  return next;
}

// Inchiostro leggibile sopra il colore del dado (luminanza relativa)
export function inkFor(hex) {
  if (!HEX_RE.test(hex || '')) return null;
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  // Si sceglie l'inchiostro col contrasto WCAG più alto: il pareggio cade a luminanza ≈ 0,18
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (L + 0.05) / 0.058 >= 0.93 / (L + 0.05) ? '#1a1410' : '#fbf1dc';
}

// uid → colore dei dadi (solo valori validi): lo usano i cursori live sulla griglia
export function diceColorMap(colors) {
  const out = {};
  for (const uid of Object.keys(colors || {})) {
    const c = myDiceColor(colors, uid);
    if (c) out[uid] = c;
  }
  return out;
}
