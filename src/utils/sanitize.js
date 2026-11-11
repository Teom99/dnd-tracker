// Le security rules permettono a qualunque utente autenticato di scrivere sotto
// sessions/{code}: ogni valore che arriva dal database va trattato come ostile
// prima di finire in HTML o SVG.

// Numero finito, altrimenti il fallback (una stringa con markup non passa mai).
export function num(v, fallback = 0) {
  const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
  return Number.isFinite(n) ? n : fallback;
}

// Valore dentro un attributo HTML o un testo interpolato.
export function attr(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Un combattente letto da Firebase pronto per i renderer: id nella forma delle push-key
// (altrimenti scartato) e campi numerici davvero numerici. I campi di testo restano così
// come sono: li escapa il renderer che li stampa.
const SAFE_ID = /^[-\w]+$/;

export function safeCombatant(c) {
  if (!c || typeof c !== 'object' || typeof c.id !== 'string' || !SAFE_ID.test(c.id)) return null;
  const out = { ...c };
  out.initiative = num(c.initiative);
  out.hpCurrent  = num(c.hpCurrent);
  out.hpMax      = num(c.hpMax);
  if ('tempHp' in c)      out.tempHp = num(c.tempHp);
  if (c.armorClass != null) out.armorClass = num(c.armorClass, null);
  if ('level' in c)       out.level = num(c.level, 1);
  if ('speed' in c)       out.speed = num(c.speed);
  return out;
}

// Avatar: solo un data URL immagine "pulito". startsWith('data:image/') non basta: il resto della stringa
// può chiudere l'attributo (`"`) e aggiungere handler.
export function safeImageUrl(v) {
  return typeof v === 'string' && /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(v) ? v : null;
}
