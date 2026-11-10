// Tema chiaro/notte: <html data-theme="light|night">, scelta salvata in
// localStorage['dnd-theme']. Senza scelta salvata si segue il sistema.
// ATTENZIONE: lo script inline in <head> di index.html replica resolveTheme
// per impostare il tema prima del primo paint — tenerli allineati.

const KEY = 'dnd-theme';

export function resolveTheme(saved, prefersDark) {
  if (saved === 'light' || saved === 'night') return saved;
  return prefersDark ? 'night' : 'light';
}

// localStorage può lanciare (navigazione privata, storage bloccato): il tema
// deve funzionare comunque, per la durata della pagina.
export function readSavedTheme() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function saveTheme(theme) {
  try { localStorage.setItem(KEY, theme); } catch { /* storage non disponibile */ }
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

export function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'night' ? 'light' : 'night';
  applyTheme(next);
  saveTheme(next);
  return next;
}

export function initTheme() {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  applyTheme(resolveTheme(readSavedTheme(), mq.matches));
  // Finché l'utente non sceglie, si segue il sistema anche a pagina aperta
  mq.addEventListener('change', (e) => {
    if (readSavedTheme() === null) applyTheme(resolveTheme(null, e.matches));
  });
}
