/* Scheda combattente (prefisso fc-). Sostituisce renderCombatantList / card in UI.js.
   Compatta di default (una riga leggibile), si apre per i campi: niente più muro di input. */
import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Icon } from '../icons.js';
import { Portrait, HpBar, CondChip, DeathSaves, Corners } from './ds.js';

const KIND = { pc: 'Giocatore', ally: 'Alleato', enemy: 'Nemico' };

export function FightCard({ c, isActive, isMine, canEdit, open, targets = [], onToggle, onApply, onField, onConditions, onInspiration, onDeathSave, onStatBlock }) {
  const [qty, setQty] = useState(5);
  const [sel, setSel] = useState([]);           // bersagli extra (selezione multipla)
  const [edit, setEdit] = useState(false);
  const [flash, setFlash] = useState('');
  const prev = useRef(c.hp);

  // Flash rosso/verde a ogni variazione di HP (classe temporanea <2.5s — funziona in entrambi i regimi).
  useEffect(() => {
    if (prev.current !== c.hp) {
      setFlash(c.hp < prev.current ? 'dmg' : 'heal');
      const t = setTimeout(() => setFlash(''), 1200);
      prev.current = c.hp;
      return () => clearTimeout(t);
    }
  }, [c.hp]);

  const dying = c.kind === 'pc' && c.hp <= 0 && !c.dead;
  const toggleSel = (id) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  const apply = (kind) => onApply && onApply(kind, qty, [c.id, ...sel]);
  const cls = ['fc', `fc--${c.dead ? 'dead' : c.kind}`, isActive && 'is-active', open && 'is-open', dying && 'is-dying', c.dead && 'is-dead', isMine && 'is-mine', flash && `is-flash-${flash}`].filter(Boolean).join(' ');

  return html`<li class=${cls} data-id=${c.id}>
    <${Corners} />
    <button type="button" class="fc__head" aria-expanded=${open} aria-controls=${'fc-body-' + c.id} onClick=${() => onToggle && onToggle(c.id)}>
      <${Portrait} c=${c} />
      <span class="fc__id">
        <span class="fc__name"><span class="fc__name-t">${c.name}</span>${isActive ? html`<span class="fc__turn" title="È il suo turno"><${Icon} name="flame" size=${13} /></span>` : null}</span>
        <span class="fc__sub">${c.sub}${c.owner ? ' · ' + c.owner : ''}</span>
      </span>
      <span class="fc__init" title="Iniziativa">${c.init}</span>
      <span class="fc__vit">
        <span class="fc__hp ${dying ? 'is-zero' : ''}" aria-label=${`${c.hp} su ${c.hpMax} punti ferita`}><b>${c.hp}</b><i>/${c.hpMax}</i>${c.temp ? html`<u title="HP temporanei">+${c.temp}</u>` : null}</span>
        <${HpBar} hp=${c.hp} max=${c.hpMax} temp=${c.temp} />
        <span class="fc__ac" title="Classe Armatura"><${Icon} name="shield" size=${14} />${c.ac}</span>
      </span>
    </button>
    ${c.conds.length || open ? html`<div class="fc__conds">
      ${c.conds.map((k) => html`<${CondChip} cond=${k} onRemove=${canEdit && open ? (x) => onConditions && onConditions(c.id, x) : null} />`)}
      ${canEdit ? html`<button type="button" class="ds-chip ds-chip--add" onClick=${() => onConditions && onConditions(c.id)}><${Icon} name="plus" size=${12} /> Condizione</button>` : null}
    </div>` : null}
    ${open ? html`<div class="fc__body" id=${'fc-body-' + c.id}>
      ${c.action ? html`<p class="fc__action"><${Icon} name="sword" size=${15} /><span><em>Azione dichiarata</em>${c.action}</span></p>` : null}
      ${dying ? html`<${DeathSaves} saves=${c.deathSaves || { ok: 0, ko: 0 }} canEdit=${canEdit || isMine} onToggle=${(k, i) => onDeathSave && onDeathSave(c.id, k, i)} />` : null}
      <div class="fc__apply">
        <label class="fc__qty"><span class="ds-t-label">Quantità</span>
          <span class="ds-stepper">
            <button type="button" class="ds-stepper__b" aria-label="Meno" onClick=${() => setQty(Math.max(1, qty - 1))}><${Icon} name="minus" size=${14} /></button>
            <input class="ds-field ds-stepper__in" inputmode="numeric" value=${qty} onInput=${(e) => setQty(parseInt(e.target.value, 10) || 0)} />
            <button type="button" class="ds-stepper__b" aria-label="Più" onClick=${() => setQty(qty + 1)}><${Icon} name="plus" size=${14} /></button>
          </span></label>
        <button type="button" class="ds-btn ds-btn--dmg" onClick=${() => apply('dmg')}><${Icon} name="sword" size=${16} /> Danno</button>
        <button type="button" class="ds-btn ds-btn--heal" onClick=${() => apply('heal')}><${Icon} name="heart" size=${16} /> Cura</button>
      </div>
      ${targets.length ? html`<div class="fc__targets" role="group" aria-label="Applica anche a">
        <span class="ds-t-label">Applica anche a</span>
        ${targets.map((t) => html`<button type="button" class="ds-chip ds-chip--pick ${sel.includes(t.id) ? 'is-on' : ''}" aria-pressed=${sel.includes(t.id)} onClick=${() => toggleSel(t.id)}>${t.short}</button>`)}
      </div>` : null}
      <div class="fc__tools">
        ${c.kind === 'pc' ? html`<button type="button" class="ds-btn ds-btn--quiet fc__insp ${c.insp ? 'is-on' : ''}" aria-pressed=${!!c.insp} onClick=${() => onInspiration && onInspiration(c.id)}><${Icon} name="star" size=${15} /> Ispirazione</button>` : html`<button type="button" class="ds-btn ds-btn--quiet" onClick=${() => onStatBlock && onStatBlock(c.id)}><${Icon} name="book" size=${15} /> Stat block</button>`}
        ${canEdit ? html`<button type="button" class="ds-btn ds-btn--quiet" aria-expanded=${edit} onClick=${() => setEdit(!edit)}><${Icon} name="chevron" size=${14} class=${edit ? 'is-flip' : ''} /> Modifica valori</button>` : null}
      </div>
      ${edit ? html`<div class="fc__edit">
        ${[['init', 'Iniziativa', c.init], ['hpMax', 'HP max', c.hpMax], ['temp', 'HP temp.', c.temp]].map(([f, l, v]) => html`<label class="fc__edit-f"><span class="ds-t-label">${l}</span>
          <input class="ds-field" inputmode="numeric" value=${v} onChange=${(e) => onField && onField(c.id, f, parseInt(e.target.value, 10) || 0)} /></label>`)}
      </div>` : null}
    </div>` : null}
  </li>`;
}
