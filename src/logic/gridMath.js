// Geometria pura della griglia (nessun DOM): footprint dei token e distanza.
// 1 casella = 1 m, diagonali alternate 5-10-5 (variante DMG), bordo-a-bordo.

const SIZE_FOOTPRINT = { tiny: 1, small: 1, medium: 1, large: 2, huge: 3, gargantuan: 4 };
export function footprintOf(size) { return SIZE_FOOTPRINT[size] || 1; }

// Separazione su un asse tra due intervalli [a1,a2] e [b1,b2] (0 se si toccano/sovrappongono, +1 se adiacenti)
function axisDist(a1, a2, b1, b2) {
  return Math.max(0, Math.max(a1, b1) - Math.min(a2, b2));
}

// Distanza bordo-a-bordo tra due footprint quadrati, con diagonali alternate
// (variante DMG: ogni seconda diagonale costa doppio) → max + floor(min/2).
export function squareDistance(c1, r1, n1, c2, r2, n2) {
  const dc = axisDist(c1, c1 + n1 - 1, c2, c2 + n2 - 1);
  const dr = axisDist(r1, r1 + n1 - 1, r2, r2 + n2 - 1);
  return Math.max(dc, dr) + Math.floor(Math.min(dc, dr) / 2);
}

// Metri per le etichette. Non lancia mai: un valore non numerico (scritto a mano su Firebase)
// diventa 0m invece di rompere il render di tutti i client.
export function fmtM(d) {
  const n = Number.isFinite(d) ? d : 0;
  return n === Math.floor(n) ? `${n}m` : `${n.toFixed(1)}m`;
}

// L'area incantesimo letta da Firebase prima di disegnarla: forma nota, misure finite e sensate.
const TEMPLATE_SHAPES = ['circle', 'cone', 'line'];
export function validTemplate(t) {
  if (!t || typeof t !== 'object') return false;
  if (!TEMPLATE_SHAPES.includes(t.shape)) return false;
  if (!Number.isInteger(t.originCol) || !Number.isInteger(t.originRow)) return false;
  if (!Number.isFinite(t.size) || t.size <= 0 || t.size > 200) return false;
  if (t.shape !== 'circle' && !Number.isFinite(t.angleDeg)) return false;
  return true;
}
