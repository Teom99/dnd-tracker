import * as GridUI from '../ui/GridUI.js';
import { state }   from '../utils/state.js';
import { playerColor } from '../utils/presence.js';
import { esc }     from '../views/core.js';
import { icon }    from '../ui/icons.js';
import { attr }    from '../utils/sanitize.js';
import * as CombatChrome from '../ui/CombatChrome.js';
import { readDensity } from './combatChrome.js';

// ─── Undo/redo del disegno sulla mappa (locale a questo client, non condiviso
// e non persistito — si perde al reload, come il resto dello stato locale
// della griglia). Ogni voce è l'elenco [{key, before, after}] di una singola
// pennellata/secchiello/pulisci-tutto fatta DA QUESTO giocatore; undo/redo di
// un'altra persona non è possibile e non invalida questa pila.
const UNDO_LIMIT = 50;
let _undoStack = [];
let _redoStack = [];

// All'uscita dalla sessione (evento di exitToHome): l'annulla di una sessione non deve scrivere nella paint della successiva
document.addEventListener('dnd:reset-draw-history', () => { _undoStack = []; _redoStack = []; });

function recordPaintChange(changes) {
  if (!changes || !changes.length) return;
  _undoStack.push(changes);
  if (_undoStack.length > UNDO_LIMIT) _undoStack.shift();
  _redoStack = []; // una nuova azione invalida i redo pendenti
  updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('btn-draw-undo');
  const redoBtn = document.getElementById('btn-draw-redo');
  if (undoBtn) undoBtn.disabled = _undoStack.length === 0;
  if (redoBtn) redoBtn.disabled = _redoStack.length === 0;
}

export async function undoPaint() {
  const entry = _undoStack.pop();
  if (!entry) return;
  _redoStack.push(entry);
  const map = {};
  for (const { key, before } of entry) map[key] = before;
  await state.session.setPaintMap(map);
  updateUndoRedoButtons();
}

export async function redoPaint() {
  const entry = _redoStack.pop();
  if (!entry) return;
  _undoStack.push(entry);
  const map = {};
  for (const { key, after } of entry) map[key] = after;
  await state.session.setPaintMap(map);
  updateUndoRedoButtons();
}

export function renderGrid(gridPos, combatants, currentTurnId, sortedCombatants, gridConfig, walls) {
  const container = document.getElementById('grid-container');
  if (!container) return;

  // Registra il callback usato da zoom e ResizeObserver
  GridUI.setReRenderCallback(() => {
    if (state.snapshot) {
      const sorted = state.tracker.sortedCombatants(state.snapshot.combatants);
      renderGrid(state.snapshot.grid || {}, state.snapshot.combatants || {}, state.snapshot.currentTurnId ?? null, sorted, state.snapshot.gridConfig || null, state.snapshot.walls || {});
    }
  });

  const comb = combatants || {};
  const myOwnedIds = new Set(
    state.myUid
      ? Object.entries(comb).filter(([, c]) => c.ownerUid === state.myUid).map(([id]) => id)
      : []
  );

  const reRender = () => {
    if (state.snapshot) {
      const sorted = state.tracker.sortedCombatants(state.snapshot.combatants);
      renderGrid(state.snapshot.grid || {}, state.snapshot.combatants || {}, state.snapshot.currentTurnId ?? null, sorted, state.snapshot.gridConfig || null, state.snapshot.walls || {});
    }
  };

  const selectToken = (id) => {
    state.selectedGridTokenId = id;
    reRender();
  };

  // Tabella iniziativa: per il master seleziona il soggetto del dock (nessun
  // movimento sulla griglia); per il player resta la selezione/movimento griglia.
  const isMaster = state.session.isMaster;
  GridUI.renderInitiativeList(
    document.getElementById('grid-initiative-list'),
    sortedCombatants,
    gridPos,
    state.myCombatantId,
    isMaster ? state.selectedDockId : state.selectedGridTokenId,
    currentTurnId,
    isMaster,
    (id) => {
      // Comportamento di sempre (master: soggetto del dock; giocatore: selezione/movimento)...
      if (isMaster) document.dispatchEvent(new CustomEvent('dnd:dock-select', { detail: { id } }));
      else selectToken(id);
      // ...e in più si apre (o si chiude) il dettaglio del combattente
      if (id) CombatChrome.set({ drawer: 'detail', detailId: id, initSheetOpen: false });
      else CombatChrome.set({ drawer: state.ui.drawer === 'detail' ? null : state.ui.drawer, detailId: null });
    },
    comb,
    {
      density:      readDensity(),
      myUid:        state.myUid,
      masterUid:    state.session.masterUid,
      acMap:        state.acMap,
      myDeathSaves: state.sheetData?.deathSaves ?? null,
    }
  );

  GridUI.renderGrid(
    container,
    gridPos,
    combatants,
    state.myCombatantId,
    myOwnedIds,
    state.session.isMaster,
    state.selectedGridTokenId,
    currentTurnId,
    gridConfig,
    walls,
    state.gridEditMode,
    selectToken,
    (id, col, row) => state.session.setGridPosition(id, col, row),
    (cellKey, value) => state.session.setWall(cellKey, value),
    state.snapshot?.template ?? null,
    state.templatePlacingShape,
    state.templateOrigin,
    (col, row) => { state.templateOrigin = { col, row }; reRender(); document.dispatchEvent(new CustomEvent('dnd:grid-mode-changed')); },
    (shape, originCol, originRow, size, angleDeg) => {
      state.session.setTemplate(shape, originCol, originRow, size, angleDeg, state.myUid);
      state.templatePlacingShape = null;
      state.templateOrigin       = null;
      reRender();
      // La guida a passi e i bottoni dell'area si riallineano subito (il listener di sessione
      // scatta prima che queste due righe azzerino lo stato)
      document.dispatchEvent(new CustomEvent('dnd:grid-mode-changed'));
    },
    state.snapshot?.paint ?? {},
    state.drawMode,
    state.drawColor,
    (cellKey, color) => state.session.setPaintCell(cellKey, color),
    (col, row) => {
      if (!state.myUid) return;
      // Scritture non awaited (girano a ogni movimento del mouse): il .catch
      // evita che un eventuale permission-denied — es. la regola "presence"
      // non ancora applicata in Console — riempia la console di unhandled
      // rejection. I cursori sono puramente estetici: se non si possono
      // scrivere, si perdono in silenzio senza toccare il resto.
      if (col === null) {
        state.session.clearCursorPosition(state.myUid).catch(() => {});
        return;
      }
      const myName = isMaster
        ? (state.session.displayName || 'Master')
        : (state.sheetData?.characterName || state.session.displayName || 'Giocatore');
      state.session.setCursorPosition(state.myUid, col, row, myName, playerColor(state.myUid)).catch(() => {});
    },
    state.drawTool,
    (cellKeys, color) => state.session.setPaintCells(cellKeys, color),
    state.drawSize,
    state.drawShape,
    (changes) => recordPaintChange(changes),
    state.drawFill,
    state.snapshot?.trajectories ?? {},
    state.trajectoryFrom,
    state.ui.tool === 'traj',
    (pick) => {
      // Primo tocco: chi attacca (serve un segnalino). Secondo: il bersaglio, segnalino o casella.
      if (!state.trajectoryFrom) {
        if (pick.tokenId) { state.trajectoryFrom = pick.tokenId; reRender(); document.dispatchEvent(new CustomEvent('dnd:grid-mode-changed')); }
        return;
      }
      if (pick.tokenId === state.trajectoryFrom) {          // ritocco sul punto di partenza: annulla
        state.trajectoryFrom = null; reRender(); document.dispatchEvent(new CustomEvent('dnd:grid-mode-changed'));
        return;
      }
      const data = { fromId: state.trajectoryFrom };
      if (pick.tokenId) data.toId = pick.tokenId; else { data.toCol = pick.col; data.toRow = pick.row; }
      state.session.setTrajectory(state.myUid, data);
      state.trajectoryFrom = null;
      reRender();
      document.dispatchEvent(new CustomEvent('dnd:grid-mode-changed'));
    }
  );
  renderTokenBar(gridPos, combatants);
  updateTokenSizeControl(combatants);
  updateUndoRedoButtons();
}

// Attiva/disattiva la modalità di piazzamento di un template ad area.
// Ricliccare la stessa forma annulla il piazzamento in corso.
export function toggleTemplatePlacement(shape) {
  state.templatePlacingShape = state.templatePlacingShape === shape ? null : shape;
  state.templateOrigin       = null;
  state.gridEditMode         = false; // mutuamente esclusivo con modifica muri e disegno
  state.drawMode             = false;
  if (state.snapshot) {
    const sorted = state.tracker.sortedCombatants(state.snapshot.combatants);
    renderGrid(state.snapshot.grid || {}, state.snapshot.combatants || {}, state.snapshot.currentTurnId ?? null, sorted, state.snapshot.gridConfig || null, state.snapshot.walls || {});
  }
}

export function clearTemplate() {
  state.session.clearTemplate();
}

// Attiva/disattiva la modalità "disegna sulla mappa" (chiunque). Mutuamente
// esclusiva con modifica muri e piazzamento template.
export function toggleDrawMode() {
  state.drawMode = !state.drawMode;
  if (state.drawMode) {
    state.gridEditMode         = false;
    state.templatePlacingShape = null;
    state.templateOrigin       = null;
  }
  if (state.snapshot) {
    const sorted = state.tracker.sortedCombatants(state.snapshot.combatants);
    renderGrid(state.snapshot.grid || {}, state.snapshot.combatants || {}, state.snapshot.currentTurnId ?? null, sorted, state.snapshot.gridConfig || null, state.snapshot.walls || {});
  }
}

export function setDrawColor(color) {
  state.drawColor = color; // null = gomma
  if (state.snapshot) {
    const sorted = state.tracker.sortedCombatants(state.snapshot.combatants);
    renderGrid(state.snapshot.grid || {}, state.snapshot.combatants || {}, state.snapshot.currentTurnId ?? null, sorted, state.snapshot.gridConfig || null, state.snapshot.walls || {});
  }
}

export function clearPaint() {
  const current = state.snapshot?.paint || {};
  const changes = Object.keys(current).map(key => ({ key, before: current[key], after: null }));
  if (changes.length) recordPaintChange(changes);
  state.session.clearPaint();
}

// Seleziona lo strumento di disegno (secchiello o forma rect/square/circle);
// riselezionare quello attivo torna al pennello. Resta dentro la modalità
// disegno già attiva; non tocca drawMode/gridEditMode/template.
export function setDrawTool(tool) {
  state.drawTool = state.drawTool === tool ? 'brush' : tool;
  if (state.snapshot) {
    const sorted = state.tracker.sortedCombatants(state.snapshot.combatants);
    renderGrid(state.snapshot.grid || {}, state.snapshot.combatants || {}, state.snapshot.currentTurnId ?? null, sorted, state.snapshot.gridConfig || null, state.snapshot.walls || {});
  }
}

// Alterna contorno/pieno per le forme. Il contorno usa drawSize come spessore.
export function toggleDrawFill() {
  state.drawFill = state.drawFill === 'filled' ? 'outline' : 'filled';
  if (state.snapshot) {
    const sorted = state.tracker.sortedCombatants(state.snapshot.combatants);
    renderGrid(state.snapshot.grid || {}, state.snapshot.combatants || {}, state.snapshot.currentTurnId ?? null, sorted, state.snapshot.gridConfig || null, state.snapshot.walls || {});
  }
}

// Imposta il lato (1-4) del blocco N×N di pennello/gomma. Ignorato dal secchiello
// (il flood fill non ha una "dimensione").
export function setDrawSize(size) {
  state.drawSize = Math.max(1, Math.min(4, parseInt(size, 10) || 1));
  if (state.snapshot) {
    const sorted = state.tracker.sortedCombatants(state.snapshot.combatants);
    renderGrid(state.snapshot.grid || {}, state.snapshot.combatants || {}, state.snapshot.currentTurnId ?? null, sorted, state.snapshot.gridConfig || null, state.snapshot.walls || {});
  }
}

// Imposta la forma (quadrato/rotondo) del blocco pennello/gomma. Ignorata dal
// secchiello.
export function setDrawShape(shape) {
  state.drawShape = shape === 'round' ? 'round' : 'square';
  if (state.snapshot) {
    const sorted = state.tracker.sortedCombatants(state.snapshot.combatants);
    renderGrid(state.snapshot.grid || {}, state.snapshot.combatants || {}, state.snapshot.currentTurnId ?? null, sorted, state.snapshot.gridConfig || null, state.snapshot.walls || {});
  }
}

// Riflette la taglia del token selezionato sul controllo del master.
// Chiamata a ogni render (snapshot e cambi di selezione locali) per aggiornare subito.
function updateTokenSizeControl(combatants) {
  if (!state.session.isMaster) return;
  const sizeSel = document.getElementById('select-token-size');
  if (!sizeSel) return;
  const sel = state.selectedGridTokenId;
  const selComb = sel ? (combatants || {})[sel] : null;
  sizeSel.disabled = !selComb;
  if (selComb) sizeSel.value = selComb.size || 'medium';
}

export function renderTokenBar(gridPos, combatants) {
  const bar = document.getElementById('grid-token-bar');
  if (!bar) return;
  const pos  = gridPos   || {};
  const comb = combatants || {};

  const myOwnedIds = new Set(
    state.myUid
      ? Object.entries(comb).filter(([, c]) => c.ownerUid === state.myUid).map(([id]) => id)
      : []
  );

  // Il master vede tutti i segnalini (creature e giocatori), così può anche
  // togliere dalla mappa quelli dei giocatori; i giocatori solo i propri.
  const entries = Object.entries(comb).filter(([id]) => {
    if (state.session.isMaster) return true;
    return myOwnedIds.has(id);
  });

  if (entries.length === 0) { bar.innerHTML = ''; return; }

  bar.innerHTML = entries.map(([id, c]) => {
    const placed   = pos[id] != null;
    const selected = id === state.selectedGridTokenId;
    const ko       = c.hpCurrent === 0;
    const player   = c.type === 'player';
    return `<button
      class="grid-token-chip${selected ? ' selected' : ''}${ko ? ' ko' : ''}${player ? ' is-player' : ''}"
      data-token-id="${attr(id)}"
      title="${esc(c.name || '?')} — ${placed ? 'rimuovi dalla griglia' : 'posiziona sulla griglia'}"
    >${esc(String(c.name || '?').slice(0, 2).toUpperCase())}${ko ? ' ' + icon('skull', { size: 13 }) : ''}${placed ? '' : ' +'}</button>`;
  }).join('');

  bar.onclick = (e) => {
    const btn = e.target.closest('[data-token-id]');
    if (!btn) return;
    const id = btn.dataset.tokenId;
    if (pos[id] != null) {
      if (state.selectedGridTokenId === id) state.selectedGridTokenId = null;
      state.session.clearGridPosition(id);
      return;
    }
    state.selectedGridTokenId = state.selectedGridTokenId === id ? null : id;
    if (state.snapshot) {
      const sorted = state.tracker.sortedCombatants(state.snapshot.combatants);
      renderGrid(state.snapshot.grid || {}, state.snapshot.combatants || {}, state.snapshot.currentTurnId ?? null, sorted, state.snapshot.gridConfig || null, state.snapshot.walls || {});
    }
  };
}
