/* Colonna sinistra — Iniziativa (prefisso ir-). Sostituisce renderInitiativeList in GridUI.js. */
import { html } from 'htm/preact';
import { Icon } from '../icons.js';
import { Portrait, HpBar, CondChip, EmptyState, Corners } from './ds.js';

export function InitiativeRail({ combatants, activeId, meId, round, isMaster, selectedId, onSelect, onNext, onAdd, onReroll, onReset }) {
  if (!combatants.length) {
    return html`<aside class="ir ds-panel"><${Corners} /><${EmptyState} compact icon="hourglass" title="Nessuna iniziativa" text="Quando i combattenti tirano, l'ordine di turno nasce qui." action=${isMaster ? 'Aggiungi creatura' : null} onAction=${onAdd} /></aside>`;
  }
  const idx = combatants.findIndex((c) => c.id === activeId);
  return html`<aside class="ir ds-panel" aria-label="Ordine di iniziativa">
    <${Corners} />
    <header class="ir__head"><h2 class="ds-heading"><span>Iniziativa</span></h2><span class="ir__round">Round <b>${round}</b></span></header>
    <ol class="ir__list">
      ${combatants.map((c, i) => {
        const active = c.id === activeId;
        const dying = c.kind === 'pc' && c.hp <= 0 && !c.dead;
        const past = idx >= 0 && i < idx;
        const cls = ['ir__item', `ir__item--${c.dead ? 'dead' : c.kind}`, active && 'is-active', past && 'is-done', c.dead && 'is-dead', dying && 'is-dying', c.id === meId && 'is-mine', c.id === selectedId && 'is-selected'].filter(Boolean).join(' ');
        return html`<li key=${c.id} class=${cls} aria-current=${active ? 'step' : null}>
          <button type="button" class="ir__btn" onClick=${() => onSelect && onSelect(c.id)}>
            <span class="ir__n" aria-label=${'Posizione ' + (i + 1)}><span>${i + 1}</span></span>
            <${Portrait} c=${c} size="sm" xp=${false} />
            <span class="ir__id">
              <span class="ir__name">${c.short}</span>
              <span class="ir__hp">${c.dead ? 'Abbattuto' : dying ? html`<em>Morente</em>` : html`<b>${c.hp}</b>/${c.hpMax}`}</span>
            </span>
            <span class="ir__ini">${c.init}</span>
            ${active ? html`<span class="ir__more">
              <${HpBar} hp=${c.hp} max=${c.hpMax} temp=${c.temp} size="sm" />
              ${c.action ? html`<span class="ir__action"><${Icon} name="sword" size=${13} />${c.action}</span>` : null}
              ${c.conds.length ? html`<span class="ir__conds">${c.conds.map((k) => html`<${CondChip} cond=${k} />`)}</span>` : null}
            </span>` : (c.conds.length && !c.dead ? html`<span class="ir__dots" title=${c.conds.map((k) => k.label).join(', ')}>${c.conds.map(() => html`<i></i>`)}</span>` : null)}
          </button>
        </li>`;
      })}
    </ol>
    ${isMaster ? html`<footer class="ir__foot">
      <button type="button" class="ds-btn ds-btn--primary ir__next" onClick=${onNext}>Turno successivo <${Icon} name="chevron" size=${16} class="ds-ic--right" /></button>
      <div class="ir__tools">
        <button type="button" class="ds-btn ds-btn--quiet" onClick=${onReroll}><${Icon} name="dice" size=${15} /> Ritira</button>
        <button type="button" class="ds-btn ds-btn--quiet" onClick=${onAdd}><${Icon} name="plus" size=${15} /> Creatura</button>
        <button type="button" class="ds-btn ds-btn--quiet is-danger" onClick=${onReset}><${Icon} name="alert" size=${15} /> Reset</button>
      </div></footer>` : null}
  </aside>`;
}
