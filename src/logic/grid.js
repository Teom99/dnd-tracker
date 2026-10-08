import * as GridUI from '../ui/GridUI.js';
import { state }   from '../utils/state.js';
import { playerColor } from '../utils/presence.js';

// ─── Undo/redo del disegno sulla mappa (locale a questo client, non condiviso
// e non persistito — si perde al reload, come il resto dello stato locale
// della griglia). Ogni voce è l'elenco [{key, before, after}] di una singola
// pennellata/secchiello/pulisci-tutto fatta DA QUESTO giocatore; undo/redo di
// un'altra persona non è possibile e non invalida questa pila.
const UNDO_LIMIT = 50;
let _undoStack = [];
let _redoStack = [];

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
    isMaster
      ? (id) => document.dispatchEvent(new CustomEvent('dnd:dock-select', { detail: { id } }))
      : selectToken,
    comb
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
    (col, row) => { state.templateOrigin = { col, row }; reRender(); },
    (shape, originCol, originRow, size, angleDeg) => {
      state.session.setTemplate(shape, originCol, originRow, size, angleDeg, state.myUid);
      state.templatePlacingShape = null;
      state.templateOrigin       = null;
      reRender();
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
    (changes) => recordPaintChange(changes)
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

// Attiva/disattiva lo strumento secchiello (riempimento ad area). Resta dentro
// la modalità disegno già attiva; non tocca drawMode/gridEditMode/template.
export function toggleDrawTool() {
  state.drawTool = state.drawTool === 'bucket' ? 'brush' : 'bucket';
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

  const entries = Object.entries(comb).filter(([id, c]) => {
    if (state.session.isMaster) return c.type === 'creature';
    return myOwnedIds.has(id);
  });

  if (entries.length === 0) { bar.innerHTML = ''; return; }

  bar.innerHTML = entries.map(([id, c]) => {
    const placed   = pos[id] != null;
    const selected = id === state.selectedGridTokenId;
    const ko       = c.hpCurrent === 0;
    return `<button
      class="grid-token-chip${selected ? ' selected' : ''}${ko ? ' ko' : ''}"
      data-token-id="${id}"
      title="${placed ? 'Rimuovi dalla griglia' : 'Posiziona sulla griglia'}"
    >${(c.name || '?').slice(0, 2).toUpperCase()}${ko ? ' 💀' : ''}${placed ? '' : ' +'}</button>`;
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
