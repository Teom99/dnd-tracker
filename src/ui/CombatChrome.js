// Interfaccia della schermata di combattimento: applica state.ui al DOM
// tramite attributi data-* su #view-combat (il CSS fa il resto) e lega i
// comandi che aprono/chiudono menu e pannelli. Non ricostruisce markup:
// i nodi di ogni comando sono quelli di index.html, spostati di posto.
import { state } from '../utils/state.js';
import { icon } from './icons.js';
import { detailStillValid, readDensity } from '../logic/combatChrome.js';

const view = () => document.getElementById('view-combat');

const DEFAULT_UI = () => ({ tool: 'move', menuOpen: false, drawer: null, detailId: null, spellsOpen: false, initSheetOpen: false });

// <el data-icon="nome" [data-icon-size="24"]> → SVG inserito in testa al contenuto
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]:not([data-icon-done])').forEach((el) => {
    const size = parseInt(el.dataset.iconSize, 10) || 18;
    el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon, { size }));
    el.dataset.iconDone = '1';
  });
}

// Idempotente, nessun innerHTML. Va chiamata dopo ogni modifica di state.ui
// e in coda al listener di sessione.
export function apply() {
  const v = view();
  if (!v) return;
  const ui = state.ui;
  // Il combattente aperto nel dettaglio può essere stato rimosso da un altro client
  if (ui.drawer === 'detail' && !detailStillValid(ui.detailId, state.snapshot?.combatants)) {
    ui.drawer = null;
    ui.detailId = null;
  }
  v.dataset.tool = ui.tool;
  v.dataset.menu = ui.menuOpen ? 'open' : '';
  v.dataset.drawer = ui.drawer ?? '';
  v.dataset.spells = ui.spellsOpen ? 'open' : '';
  v.dataset.initSheet = ui.initSheetOpen ? 'open' : '';
  v.dataset.density = readDensity();
  document.getElementById('btn-menu')?.setAttribute('aria-expanded', String(ui.menuOpen));
}

export function set(patch) {
  Object.assign(state.ui, patch);
  apply();
}

export function reset() {
  state.ui = DEFAULT_UI();
  apply();
}

export function init() {
  hydrateIcons();

  document.addEventListener('click', (e) => {
    const menu = document.getElementById('topbar-more');
    if (!menu) return;
    if (e.target.closest('#btn-menu')) { set({ menuOpen: !state.ui.menuOpen }); return; }
    if (state.ui.menuOpen) {
      // Una voce (bottone) chiude il menu; il select della progressione e l'esterno no/sì
      if (e.target.closest('#topbar-more button')) set({ menuOpen: false });
      else if (!menu.contains(e.target)) set({ menuOpen: false });
    }
    if (e.target.closest('#btn-open-notes')) set({ drawer: 'notes', menuOpen: false });
    else if (e.target.closest('#btn-open-log')) set({ drawer: 'log', menuOpen: false });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (state.ui.menuOpen) set({ menuOpen: false });
  });

  apply();
}
