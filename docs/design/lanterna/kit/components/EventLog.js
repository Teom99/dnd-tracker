/* Log eventi real-time (prefisso lg-). Sostituisce renderLogs in UI.js.
   Raggruppato per round con titolo sticky; l'ultima voce porta .is-new (flash <2.5s). */
import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { Icon } from '../icons.js';
import { Seg, EmptyState } from './ds.js';

const ICON = { dmg: 'sword', heal: 'heart', turn: 'hourglass', death: 'skull', cond: 'flame', roll: 'dice' };
const FILTERS = [{ id: 'all', label: 'Tutto' }, { id: 'dmg', label: 'Danni' }, { id: 'heal', label: 'Cure' }, { id: 'cond', label: 'Stati' }, { id: 'turn', label: 'Turni' }];

const Part = ({ p }) => typeof p === 'string' ? p
  : p.n ? html`<b class="lg__who lg__who--${p.k}">${p.n}</b>`
  : html`<b class="lg__val lg__val--${p.k}">${p.v}</b>`;

export function EventLog({ entries, isMaster, newId, onClear }) {
  const [f, setF] = useState('all');
  const list = entries.filter((e) => f === 'all' || e.type === f || (f === 'dmg' && e.type === 'death'));
  if (!entries.length) {
    return html`<${EmptyState} icon="scroll" title="Nessun evento" text="Qui comparirà ogni colpo, cura e cambio di turno, in tempo reale per tutto il tavolo." compact />`;
  }
  const rounds = [...new Set(list.map((e) => e.round))].reverse();
  return html`<div class="lg">
    <div class="lg__bar"><${Seg} label="Filtra eventi" value=${f} onChange=${setF} items=${FILTERS} />
      ${isMaster ? html`<button type="button" class="ds-btn ds-btn--quiet" onClick=${onClear}><${Icon} name="x" size=${14} /> Svuota</button>` : null}</div>
    <div class="lg__scroll">
      ${rounds.map((r) => html`<section class="lg__round" aria-label=${'Round ' + r}>
        <h3 class="lg__rtitle"><span>Round ${r}</span></h3>
        <ol class="lg__list">
          ${list.filter((e) => e.round === r).reverse().map((e) => html`<li key=${e.id} class="lg__item lg__item--${e.type} ${e.id === newId ? 'is-new' : ''}">
            <span class="lg__ic"><${Icon} name=${ICON[e.type]} size=${14} /></span>
            <p class="lg__text">${e.parts.map((p) => html`<${Part} p=${p} />`)}</p>
            <time class="lg__t">${e.t}</time></li>`)}
        </ol></section>`)}
    </div>
  </div>`;
}
