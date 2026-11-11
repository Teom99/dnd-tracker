// Traiettoria: freccia da chi attacca a un bersaglio (un combattente o una cella)
// con la distanza in metri. Logica pura: cosa disegnare e quanto è lunga.
import { footprintOf, squareDistance } from './gridMath.js';

const isInt = (v) => Number.isInteger(v);

// Estremi in coordinate griglia con il lato del footprint, oppure null se la
// traiettoria non si può disegnare (attaccante o bersaglio rimosso o tolto
// dalla mappa, dato incompleto). Null = non si disegna e non genera errori.
export function trajectoryEndpoints(traj, gridPos, combatants) {
  if (!traj || !gridPos || !combatants) return null;
  const fromC = combatants[traj.fromId];
  const fromP = gridPos[traj.fromId];
  if (!fromC || !fromP || !isInt(fromP.col) || !isInt(fromP.row)) return null;
  const from = { col: fromP.col, row: fromP.row, n: footprintOf(fromC.size) };

  if (traj.toId != null) {
    const toC = combatants[traj.toId];
    const toP = gridPos[traj.toId];
    if (!toC || !toP || !isInt(toP.col) || !isInt(toP.row)) return null;
    return { from, to: { col: toP.col, row: toP.row, n: footprintOf(toC.size) } };
  }
  if (isInt(traj.toCol) && isInt(traj.toRow)) {
    return { from, to: { col: traj.toCol, row: traj.toRow, n: 1 } };
  }
  return null;
}

export function trajectoryDistance({ from, to }) {
  return squareDistance(from.col, from.row, from.n, to.col, to.row, to.n);
}

// Quali pulsanti di rimozione mostrare: "la mia" a chi ne ha una; "tutte" al master
// non appena c'è almeno una traiettoria che non è sua (altrimenti non potrebbe toglierla).
export function trajectoryClearButtons(trajectories, myUid, isMaster) {
  const t = trajectories || {};
  return {
    mine: !!t[myUid],
    all:  !!isMaster && Object.keys(t).some(uid => uid !== myUid),
  };
}
