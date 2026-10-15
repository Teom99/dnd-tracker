/* Dock personale (prefisso dk-). Sostituisce renderPlayerDock in UI.js. Sempre visibile, anche su telefono. */
import { html } from 'htm/preact';
import { Icon } from '../icons.js';
import { Portrait, HpBar, CondChip, Corners } from './ds.js';

const QUICK = [{ id: 'attack', icon: 'sword', label: 'Attacca' }, { id: 'dash', icon: 'run', label: 'Scatta' }, { id: 'help', icon: 'hand', label: 'Aiuta' }, { id: 'dice', icon: 'dice', label: 'Tira' }];

export function PlayerDock({ me, isMyTurn, offline, xp = { cur: 0, next: 0 }, onQuick, onEndTurn, onSheet, onInspiration }) {
  if (!me) return html`<footer class="dk dk--empty"><span class="ds-t-label">Nessun personaggio assegnato — guardi la scena da spettatore.</span></footer>`;
  const dying = me.hp <= 0 && !me.dead;
  return html`<footer class="dk ${isMyTurn ? 'is-turn' : ''} ${dying ? 'is-dying' : ''} ${me.dead ? 'is-dead' : ''} ${offline ? 'is-offline' : ''}" aria-label="Il tuo personaggio">
    <${Corners} />
    ${isMyTurn ? html`<span class="dk__ribbon"><${Icon} name="flame" size=${14} /> Tocca a te</span>` : null}
    <button type="button" class="dk__who" onClick=${onSheet} title="Apri la scheda">
      <${Portrait} c=${me} size="lg" />
      <span class="dk__id"><span class="dk__name">${me.name}</span><span class="dk__sub">${me.sub} · ${me.owner}</span></span>
    </button>
    <div class="dk__vitals">
      <div class="dk__hp"><span class="ds-t-label">Punti ferita</span>
        <span class="dk__hp-n ${dying ? 'is-zero' : ''}"><b>${me.hp}</b><i>/${me.hpMax}</i>${me.temp ? html`<u>+${me.temp} temp.</u>` : null}</span></div>
      <${HpBar} hp=${me.hp} max=${me.hpMax} temp=${me.temp} size="lg" />
      <div class="dk__row">
        <span class="dk__stat"><${Icon} name="shield" size=${14} /> CA <b>${me.ac}</b></span>
        <span class="dk__stat">Iniz. <b>${me.init}</b></span>
        <span class="dk__stat dk__xp">XP <b>${xp.cur.toLocaleString('it-IT')}</b> / ${xp.next.toLocaleString('it-IT')}</span>
        ${me.conds.map((k) => html`<${CondChip} cond=${k} />`)}
      </div>
    </div>
    <div class="dk__quick" role="group" aria-label="Azioni rapide">
      ${QUICK.map((q) => html`<button type="button" class="dk__q" disabled=${me.dead || offline} onClick=${() => onQuick && onQuick(q.id)}><${Icon} name=${q.icon} size=${20} /><span>${q.label}</span></button>`)}
      <button type="button" class="dk__q dk__q--insp ${me.insp ? 'is-on' : ''}" aria-pressed=${!!me.insp} onClick=${onInspiration}><${Icon} name="star" size=${20} /><span>Ispirazione</span></button>
    </div>
    <button type="button" class="ds-btn ds-btn--primary dk__end" disabled=${!isMyTurn || offline} onClick=${onEndTurn}>Fine turno <${Icon} name="check" size=${18} /></button>
  </footer>`;
}
