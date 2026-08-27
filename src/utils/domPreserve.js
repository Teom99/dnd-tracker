// Preserva focus, valore, posizione del cursore e scroll di un campo mentre il
// suo contenitore viene ricostruito (es. da un re-render innescato da un update
// Firebase non correlato, come un altro giocatore che muove un token).
//
// Uso tipico:
//   const snap = captureFocusState(container);
//   container.innerHTML = ...;       // rebuild
//   restoreFocusState(container, snap);

export function captureFocusState(root) {
  const el = document.activeElement;
  if (!root || !el || !root.contains(el) || el === root) return null;

  const selector = _buildSelector(el);
  if (!selector) return null;

  return {
    selector,
    value:      'value' in el ? el.value : undefined,
    selStart:   typeof el.selectionStart === 'number' ? el.selectionStart : null,
    selEnd:     typeof el.selectionEnd   === 'number' ? el.selectionEnd   : null,
    scrollTop:  el.scrollTop,
  };
}

export function restoreFocusState(root, snapshot) {
  if (!root || !snapshot) return;
  const el = root.querySelector(snapshot.selector);
  if (!el) return;

  if (snapshot.value !== undefined && 'value' in el) el.value = snapshot.value;
  el.focus({ preventScroll: true });
  if (snapshot.selStart !== null && typeof el.setSelectionRange === 'function') {
    try { el.setSelectionRange(snapshot.selStart, snapshot.selEnd); } catch { /* input type non testuale */ }
  }
  if (typeof snapshot.scrollTop === 'number') el.scrollTop = snapshot.scrollTop;
}

// Scorciatoia per il caso comune "cattura → rebuild → ripristina"
export function withPreservedFocus(root, rebuildFn) {
  const snap = captureFocusState(root);
  rebuildFn();
  restoreFocusState(root, snap);
}

function _buildSelector(el) {
  if (!el || el.nodeType !== 1) return null;
  const tag  = el.tagName.toLowerCase();
  const cls  = el.classList.length ? '.' + Array.from(el.classList).map(_cssEscape).join('.') : '';
  const data = Array.from(el.attributes)
    .filter(a => a.name.startsWith('data-'))
    .map(a => `[${a.name}="${_cssEscape(a.value)}"]`)
    .join('');
  if (!cls && !data) return null;
  return `${tag}${cls}${data}`;
}

function _cssEscape(s) {
  return window.CSS?.escape ? CSS.escape(s) : String(s).replace(/([^\w-])/g, '\\$1');
}
