/* Dock del master (prefisso dk-, variante dk--master). Sostituisce renderMasterDock in UI.js. */
import { html } from 'htm/preact';
import { Icon } from '../icons.js';
import { Portrait, Corners } from './ds.js';

export function MasterDock({ active, next, round, offline, onNext, onAdd, onConditions, onScene, onShip, onRest, onSheet }) {
  return html`<footer class="dk dk--master ${offline ? 'is-offline' : ''}" aria-label="Controlli del master">
    <${Corners} />
    <div class="dk__now">
      ${active ? html`<${Portrait} c=${active} size="lg" xp=${false} />` : null}
      <span class="dk__id"><span class="ds-t-label">Round ${round} · di turno</span>
        <span class="dk__name">${active ? active.name : '—'}</span>
        <span class="dk__sub">${next ? 'Poi: ' + next.name : 'Fine del round'}</span></span>
    </div>
    <div class="dk__quick" role="group" aria-label="Strumenti">
      <button type="button" class="dk__q" onClick=${onAdd}><${Icon} name="plus" size=${20} /><span>Creatura</span></button>
      <button type="button" class="dk__q" onClick=${onConditions}><${Icon} name="flame" size=${20} /><span>Condizioni</span></button>
      <button type="button" class="dk__q" onClick=${onScene}><${Icon} name="eye" size=${20} /><span>Scena</span></button>
      <button type="button" class="dk__q" onClick=${onShip}><${Icon} name="anchor" size=${20} /><span>Nave</span></button>
      <button type="button" class="dk__q" onClick=${onRest}><${Icon} name="moon" size=${20} /><span>Riposo</span></button>
      <button type="button" class="dk__q" onClick=${onSheet}><${Icon} name="book" size=${20} /><span>Bestiario</span></button>
    </div>
    <button type="button" class="ds-btn ds-btn--primary dk__end" disabled=${offline} onClick=${onNext}>Turno successivo <${Icon} name="chevron" size=${18} class="ds-ic--right" /></button>
  </footer>`;
}
