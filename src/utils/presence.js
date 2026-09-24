// Colore deterministico per giocatore (hash sull'uid su una palette fissa).
// Usato per i lock delle Cronache e per i cursori live sulla griglia — un
// solo posto per garantire che lo stesso giocatore abbia sempre lo stesso
// colore ovunque nell'app.
const PLAYER_COLORS = ['#ff6b6b','#4ecdc4','#45b7d1','#96e6a1','#ffd93d','#ff9a3c','#c779d0','#6bcb77'];

export function playerColor(uid) {
  let h = 0;
  for (const c of uid) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return PLAYER_COLORS[Math.abs(h) % PLAYER_COLORS.length];
}
