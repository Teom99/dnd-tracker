// Logica pura dell'interfaccia della schermata di combattimento: quale
// strumento della mappa è attivo, cosa va annullato cambiandolo, densità
// dell'iniziativa. Nessun accesso al DOM: si testa in test/combatChrome.html.

export const TOOLS = ['move', 'area', 'traj', 'draw', 'walls'];

// Cosa va azzerato in `state` uscendo da ciascuno strumento
const RESET_ON_EXIT = {
  move:  [],
  area:  ['templatePlacingShape', 'templateOrigin'],
  draw:  ['drawMode'],
  walls: ['gridEditMode'],
  traj:  ['trajectoryFrom'],
};

// Riclic sullo strumento attivo (diverso da "muovi") → torna a "muovi".
export function toolTransition(prev, next) {
  const tool = (next === prev && next !== 'move') ? 'move' : next;
  const reset = (tool !== prev) ? [...(RESET_ON_EXIT[prev] ?? [])] : [];
  return { tool, reset };
}

// Riallinea lo strumento mostrato quando una modalità cambia da codice
// esistente (es. piazzamento area concluso). `currentTool` serve a non
// perdere "area" quando la forma è già stata piazzata ma la riga opzioni
// dell'area deve restare aperta.
export function toolFromState({ gridEditMode, drawMode, templatePlacingShape, trajTool, currentTool } = {}) {
  if (gridEditMode) return 'walls';
  if (drawMode) return 'draw';
  if (templatePlacingShape || currentTool === 'area') return 'area';
  if (trajTool || currentTool === 'traj') return 'traj';
  return 'move';
}

// Il combattente aperto nel dettaglio può essere stato rimosso da un altro client
export function detailStillValid(detailId, combatants) {
  return !!detailId && !!combatants && Object.prototype.hasOwnProperty.call(combatants, detailId);
}

const DENSITY_KEY = 'dnd-init-density';
const DENSITIES = ['compact', 'details'];

export function readDensity() {
  try {
    const v = localStorage.getItem(DENSITY_KEY);
    return DENSITIES.includes(v) ? v : 'compact';
  } catch { return 'compact'; }
}

export function saveDensity(v) {
  if (!DENSITIES.includes(v)) return;
  try { localStorage.setItem(DENSITY_KEY, v); } catch { /* storage non disponibile */ }
}

// Chi viene dopo nell'ordine di turno, con le stesse regole di CombatTracker.nextTurn:
// i giocatori KO restano (tiri salvezza), le creature KO sono saltate.
// `sorted` è la lista ordinata per iniziativa. Null se non c'è un "poi".
export function nextInTurnOrder(sorted, currentId) {
  const active = (sorted || []).filter(c => c.hpCurrent > 0 || c.type === 'player');
  const i = active.findIndex(c => c.id === currentId);
  if (i === -1 || active.length < 2) return null;
  return active[(i + 1) % active.length];
}
