/* Colonna destra, scheda «Carte» (prefisso cl-). Filtro + gruppi con titolo sticky + una sola carta aperta. */
import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { Icon } from '../icons.js';
import { Seg, EmptyState } from './ds.js';
import { FightCard } from './FightCard.js';

export function CombatantList({ combatants, activeId, meId, isMaster, openId: openProp, filter: filterProp = 'all', onAdd, ...handlers }) {
  const [openState, setOpen] = useState(activeId);
  const [filterState, setFilter] = useState(filterProp);
  const openId = openProp !== undefined ? openProp : openState;
  const filter = filterState;
  const players = combatants.filter((c) => c.kind === 'pc');
  const creatures = combatants.filter((c) => c.kind !== 'pc');

  if (!combatants.length) {
    return html`<${EmptyState} icon="sword" title="Il campo è vuoto" text=${isMaster ? 'Aggiungi i primi combattenti dalla libreria o cerca un mostro nel bestiario.' : 'Il master non ha ancora schierato nessuno. Appena inizia lo scontro, le carte compariranno qui.'} action=${isMaster ? 'Aggiungi creatura' : null} onAction=${onAdd} />`;
  }

  const group = (title, list, tone) => list.length ? html`<section class="cl__group" aria-label=${title}>
    <h3 class="cl__title cl__title--${tone}"><span>${title}</span><b>${list.length}</b></h3>
    <ul class="cl__list">
      ${list.map((c) => html`<${FightCard} key=${c.id} c=${c} isActive=${c.id === activeId} isMine=${c.id === meId}
        canEdit=${isMaster || c.id === meId} open=${openId === c.id}
        targets=${combatants.filter((t) => t.id !== c.id && !t.dead)}
        onToggle=${(id) => setOpen(openId === id ? null : id)} ...${handlers} />`)}
    </ul></section>` : null;

  return html`<div class="cl">
    <div class="cl__bar">
      <${Seg} label="Filtra combattenti" value=${filter} onChange=${setFilter} items=${[
        { id: 'all', label: 'Tutti', n: combatants.length }, { id: 'pc', label: 'Giocatori', n: players.length }, { id: 'mob', label: 'Creature', n: creatures.length }]} />
      ${isMaster ? html`<button type="button" class="ds-btn ds-btn--icon" aria-label="Aggiungi creatura" onClick=${onAdd}><${Icon} name="plus" size=${18} /></button>` : null}
    </div>
    <div class="cl__scroll">
      ${filter !== 'mob' ? group('Giocatori', players, 'pc') : null}
      ${filter !== 'pc' ? group('Creature', creatures, 'mob') : null}
    </div>
  </div>`;
}
