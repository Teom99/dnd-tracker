// Logica pura della scheda personaggio (nessun DOM): progresso XP, "livello pronto",
// sottotitolo, scheda scelta, e la regola dell'XP unica tra scheda e combattimento.
// Si testa in test/sheetView.html.

export const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
                              85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

const clampXp = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0) ? v : 0;
const levelOf = (l) => (typeof l === 'number' && Number.isFinite(l) && l >= 1) ? Math.floor(l) : 1;

// Quanto manca al prossimo livello: pct tra 0 e 1, soglia, e se si è al massimo.
export function xpProgress(level, xp) {
  const lv = levelOf(level);
  if (lv >= 20) return { pct: 1, hi: null, max: true };
  const hi = XP_THRESHOLDS[lv];
  return { pct: Math.min(1, clampXp(xp) / hi), hi, max: false };
}

// Il livello è pronto: in modalità XP quando si raggiunge la soglia, in milestone quando il master l'ha concesso.
export function levelUpReady({ level, xp, mode, granted } = {}) {
  const lv = levelOf(level);
  if (lv >= 20) return false;
  return mode === 'xp' ? clampXp(xp) >= XP_THRESHOLDS[lv] : granted === true;
}

// "Mezzelfo · Ladra Lv.4 · Furfante arcano · Criminale · Caotico neutrale" ('—' se non c'è niente).
// Il livello da solo non basta: ha senso accanto a una classe.
export function sheetSubtitle(d) {
  const t = (v) => String(v ?? '').trim();
  const cls = t(d?.class) ? [t(d.class), d.level ? `Lv.${d.level}` : null].filter(Boolean).join(' ') : '';
  const bits = [d?.race, cls, d?.subclass, d?.background, d?.alignment].map(t).filter(Boolean);
  return bits.length ? bits.join(' · ') : '—';
}

// UN SOLO XP corrente per scheda e combattimento: in sessione vale quello assegnato dal master
// (sessions/{code}/xp/{combatantId}); fuori sessione, o finché il master non ne ha assegnati, quello della scheda.
export function effectiveXp({ inSession, sessionXp, sheetXp } = {}) {
  if (inSession && sessionXp != null) return clampXp(sessionXp);
  return clampXp(sheetXp);
}

// Come tenere allineata la scheda alla sessione (lo fa il client del proprietario: le rules non
// permettono al master di scrivere sul personaggio di un altro).
// Vince sempre il valore più alto: l'XP non scende mai, né sulla scheda né in sessione.
//  'seed'   → la sessione non ha XP, o ne ha meno della scheda: si alza la sessione (Session.raiseXpTo)
//  'mirror' → la sessione ha più XP della scheda: si riporta sulla scheda
//  null     → niente da fare (anche con dati sporchi: nessuna scrittura)
export function xpSyncAction({ sessionXp, sheetXp } = {}) {
  if (sessionXp == null) return clampXp(sheetXp) > 0 ? 'seed' : null;
  if (typeof sessionXp !== 'number' || !Number.isFinite(sessionXp)) return null;
  const s = clampXp(sessionXp), c = clampXp(sheetXp);
  return s > c ? 'mirror' : s < c ? 'seed' : null;
}

// Scheda scelta (combattimento, incantesimi, zaino, capacità, personaggio): per client, ricordata.
export const SHEET_TABS = ['combat', 'spells', 'bag', 'features', 'character'];
const TAB_KEY = 'dnd-sheet-tab';

export function readSheetTab() {
  try {
    const v = localStorage.getItem(TAB_KEY);
    return SHEET_TABS.includes(v) ? v : 'combat';
  } catch { return 'combat'; }
}

export function saveSheetTab(tab) {
  if (!SHEET_TABS.includes(tab)) return;
  try { localStorage.setItem(TAB_KEY, tab); } catch { /* storage non disponibile */ }
}

// La scheda aperta appartiene al combattente del giocatore? (un rientro da una voce vecchia senza charId
// lascia aperta la scheda di un altro personaggio: non va sincronizzata né seminata col suo XP)
export function sheetMatchesCombatant({ combatantCharId, sheetCharId } = {}) {
  return !!combatantCharId && !!sheetCharId && combatantCharId === sheetCharId;
}
