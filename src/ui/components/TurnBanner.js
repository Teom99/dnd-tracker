/* Banner del turno — l'elemento più importante della schermata (prefisso tb-turn).
   key={activeId} fa rimontare il nome a ogni cambio turno: l'animazione d'entrata riparte
   SOLO qui (regime Preact), mai nei render imperativi. */
import { html } from 'htm/preact';
import { Icon } from '../icons.js';

export function TurnBanner({ round, active, isMyTurn, waiting }) {
  if (waiting || !active) {
    return html`<div class="tb-turn tb-turn--idle" aria-live="polite">
      <span class="tb-turn__round">Nessuno scontro</span><span class="tb-turn__name">In attesa del master…</span></div>`;
  }
  return html`<div class="tb-turn tb-turn--${active.dead ? 'dead' : active.kind} ${isMyTurn ? 'is-mine' : ''}" aria-live="polite">
    <span class="tb-turn__rule tb-turn__rule--l"></span>
    <span class="tb-turn__flame"><${Icon} name="flame" size=${22} /></span>
    <span class="tb-turn__text">
      <span class="tb-turn__round">Round <b>${round}</b>${isMyTurn ? html` · <em>Tocca a te</em>` : null}</span>
      <span class="tb-turn__name" key=${active.id}>${active.name}</span>
    </span>
    <span class="tb-turn__sweep" key=${'s' + active.id} aria-hidden="true"></span>
    <span class="tb-turn__rule tb-turn__rule--r"></span>
  </div>`;
}
