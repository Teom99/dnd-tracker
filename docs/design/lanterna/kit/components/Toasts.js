/* Notifiche popup impilate (prefisso nt-). Alto a destra, 3 s. Regime Preact: l'entrata anima. */
import { html } from 'htm/preact';
import { Icon } from '../icons.js';

const IC = { dmg: 'sword', heal: 'heart', cond: 'flame', turn: 'hourglass', death: 'skull', warn: 'alert' };

export function Toasts({ items, onDismiss }) {
  return html`<div class="nt" role="region" aria-label="Notifiche" aria-live="polite">
    ${items.map((t) => html`<div key=${t.id} class="nt__item nt__item--${t.type} ${t.mine ? 'is-mine' : ''}">
      <span class="nt__ic"><${Icon} name=${IC[t.type]} size=${18} /></span>
      <span class="nt__text"><b>${t.title}</b><span>${t.text}</span></span>
      ${t.amount ? html`<span class="nt__amount">${t.amount}</span>` : null}
      <button type="button" class="nt__x" aria-label="Chiudi" onClick=${() => onDismiss && onDismiss(t.id)}><${Icon} name="x" size=${14} /></button>
      <span class="nt__timer" aria-hidden="true"></span>
    </div>`)}
  </div>`;
}
