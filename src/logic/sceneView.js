// Scena condivisa: quando si apre da sola e quali URL si accettano. Pura, testata in test/sceneView.html.

// Solo https e data:image: la scrittura su sessions/{code} è aperta a ogni utente autenticato, quindi
// l'URL letto da Firebase non è fidato (javascript:, http:, data:text/html…).
export function safeSceneUrl(url) {
  if (typeof url !== 'string') return null;
  const u = url.trim();
  if (/^https:\/\/[^\s"'<>]+$/i.test(u)) return u;
  if (/^data:image\/(png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=]+$/i.test(u)) return u;
  return null;
}

// 'open'  → la scena è cambiata dopo il primo snapshot: si apre a chi non l'ha già vista
// 'close' → la scena non c'è più: si chiude e "Rivedi scena" sparisce
// 'none'  → niente (primo snapshot con scena già presente, o stesso URL)
export function sceneAction({ prevUrl, nextUrl, firstSnapshot }) {
  const next = safeSceneUrl(nextUrl);
  if (!next) return 'close';
  if (firstSnapshot) return 'none';
  return next !== safeSceneUrl(prevUrl) ? 'open' : 'none';
}
