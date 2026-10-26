/* Scheda combattente (prefisso fc-). Sostituisce la card di renderCombatantList in UI.js.
   Compatta di default, si apre per i campi: niente più muro di input.

   Esteso rispetto al kit «Lanterna» per coprire tutte e 18 le callback dell'app
   (il kit ne prevedeva 7). Aggiunti: rimozione, azione dichiarata, mostra HP /
   mostra CA, fazione, apri scheda, level-up, concedi level-up, carica avatar,
   fine turno, e la modifica della CA fra i campi editabili.

   DUE COSE DA SAPERE, entrambe divergenze dal kit risolte a favore dell'app:

   1. HP NASCOSTI. `c.hp` può essere null: è la regola di visibilità applicata
      da adapt.js (i giocatori non vedono i numeri delle creature). In quel caso
      non si disegnano né numeri né barra, ma l'hint qualitativo se il master
      l'ha acceso. Passare null a HpBar darebbe NaN.

   2. CHI COLPISCE CHI. Nel kit `onApply` tratta la carta come BERSAGLIO.
      Nell'app è l'opposto: la carta è l'ATTORE e i bersagli sono i chip
      selezionati — `onApplyToTarget(sourceId, targetId, delta, azione)`, da cui
      il log "A ha colpito B". Qui vale il modello dell'app: cambiarlo
      invertirebbe silenziosamente la feature e romperebbe i log. */
import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Icon } from '../icons.js';
import { Portrait, HpBar, CondChip, DeathSaves, Corners } from './ds.js';

export function FightCard({
  c, isActive, open, targets = [], selectedTargets = [],
  onToggle, onToggleTarget, onApply, onField, onConditions, onInspiration,
  onDeathSave, onStatBlock, onRemove, onSetAction, onToggleHealthHint,
  onToggleShowAC, onSetFaction, onOpenSheet, onLevelUp, onGrantLevelUp,
  onUploadAvatar, onEndTurn,
}) {
  const [qty, setQty]   = useState('');
  const [edit, setEdit] = useState(false);
  const [flash, setFlash] = useState('');
  const prev = useRef(c.hp);

  // Flash rosso/verde a ogni variazione di HP. Qui il DOM persiste tra un
  // aggiornamento Firebase e l'altro, quindi basta uno stato locale: non serve
  // più la mappa _prevHp/_hpFlash che in UI.js sopravviveva ai rebuild.
  useEffect(() => {
    if (prev.current !== c.hp && prev.current !== null && c.hp !== null) {
      setFlash(c.hp < prev.current ? 'dmg' : 'heal');
      const t = setTimeout(() => setFlash(''), 2400);
      prev.current = c.hp;
      return () => clearTimeout(t);
    }
    prev.current = c.hp;
  }, [c.hp]);

  const dying   = c.kind === 'pc' && c.hp === 0 && !c.dead;
  const canEdit = c.canEdit;

  const applyTo = (sign) => {
    const amt = parseInt(qty, 10);
    if (!amt || amt <= 0 || !selectedTargets.length) return;
    onApply && onApply(c.id, selectedTargets, sign * amt);
    setQty('');
  };

  const cls = ['fc', `fc--${c.dead ? 'dead' : c.kind}`,
    isActive && 'is-active', open && 'is-open', dying && 'is-dying',
    c.dead && 'is-dead', c.isMine && 'is-mine', flash && `is-flash-${flash}`,
  ].filter(Boolean).join(' ');

  return html`<li class=${cls} data-id=${c.id}>
    <${Corners} />

    <button type="button" class="fc__head" aria-expanded=${open}
            aria-controls=${'fc-body-' + c.id} onClick=${() => onToggle && onToggle(c.id)}>
      <${Portrait} c=${c} />
      <span class="fc__id">
        <span class="fc__name">
          <span class="fc__name-t">${c.name}</span>
          ${isActive ? html`<span class="fc__turn" title="È il suo turno"><${Icon} name="flame" size=${13} /></span>` : null}
        </span>
        <span class="fc__sub">${c.sub}</span>
      </span>
      <span class="fc__init" title="Iniziativa">${c.init}</span>

      <span class="fc__vit">
        ${c.hpHidden
          ? html`<span class="fc__hint ${c.hintKey ? 'fc__hint--' + c.hintKey : ''}">
                   ${c.hint ?? '—'}
                 </span>`
          : html`
            <span class="fc__hp ${dying ? 'is-zero' : ''}"
                  aria-label=${`${c.hp} su ${c.hpMax} punti ferita`}>
              <b>${c.hp}</b><i>/${c.hpMax}</i>${c.temp ? html`<u title="HP temporanei">+${c.temp}</u>` : null}
            </span>
            <${HpBar} hp=${c.hp} max=${c.hpMax} temp=${c.temp} />`}
        ${c.ac !== null ? html`<span class="fc__ac" title="Classe Armatura"><${Icon} name="shield" size=${14} />${c.ac}</span>` : null}
      </span>
    </button>

    ${c.conds.length || (open && canEdit) ? html`<div class="fc__conds">
      ${c.conds.map((k) => html`<${CondChip} cond=${k}
          onRemove=${canEdit && open ? (x) => onConditions && onConditions(c.id, x.id) : null} />`)}
      ${canEdit ? html`<button type="button" class="ds-chip ds-chip--add"
          onClick=${() => onConditions && onConditions(c.id)}>
        <${Icon} name="plus" size=${12} /> Condizione</button>` : null}
    </div>` : null}

    ${open ? html`<div class="fc__body" id=${'fc-body-' + c.id}>

      ${c.canSetAction
        ? html`<label class="fc__action-edit">
            <span class="ds-t-label">Azione dichiarata</span>
            <input class="ds-field" value=${c.action}
                   placeholder="Arma o incantesimo (es. Ascia da guerra)"
                   onChange=${(e) => onSetAction && onSetAction(c.id, e.target.value.trim())} />
          </label>`
        : c.action
          ? html`<p class="fc__action"><${Icon} name="sword" size=${15} /><span><em>Azione dichiarata</em>${c.action}</span></p>`
          : null}

      ${dying && c.isMine ? html`<${DeathSaves} saves=${c.deathSaves || { ok: 0, ko: 0 }}
          canEdit=${true} onToggle=${(k, i) => onDeathSave && onDeathSave(c.id, k, i)} />` : null}

      ${isActive ? html`
        <div class="fc__targets" role="group" aria-label="Bersagli">
          <span class="ds-t-label">Bersagli</span>
          ${targets.map((t) => html`<button type="button"
              class="ds-chip ds-chip--pick ${selectedTargets.includes(t.id) ? 'is-on' : ''}"
              aria-pressed=${selectedTargets.includes(t.id)}
              onClick=${() => onToggleTarget && onToggleTarget(c.id, t.id)}>${t.label}</button>`)}
        </div>
        <div class="fc__apply">
          <label class="fc__qty"><span class="ds-t-label">Quantità</span>
            <input class="ds-field" inputmode="numeric" placeholder="0" value=${qty}
                   onInput=${(e) => setQty(e.target.value)} />
          </label>
          <button type="button" class="ds-btn ds-btn--dmg" onClick=${() => applyTo(-1)}>
            <${Icon} name="sword" size=${16} /> Danno</button>
          <button type="button" class="ds-btn ds-btn--heal" onClick=${() => applyTo(1)}>
            <${Icon} name="heart" size=${16} /> Cura</button>
        </div>` : null}

      <div class="fc__tools">
        ${c.kind === 'pc' ? html`<button type="button"
            class="ds-btn ds-btn--quiet fc__insp ${c.insp ? 'is-on' : ''}"
            aria-pressed=${!!c.insp} disabled=${!canEdit}
            onClick=${() => onInspiration && onInspiration(c.id)}>
          <${Icon} name="star" size=${15} /> Ispirazione</button>` : null}

        ${c.isMaster && c.isCreature && c.monsterApiIndex ? html`<button type="button"
            class="ds-btn ds-btn--quiet"
            onClick=${() => onStatBlock && onStatBlock(c.id, c.monsterApiIndex)}>
          <${Icon} name="book" size=${15} /> Stat block</button>` : null}

        ${c.isMine ? html`<button type="button" class="ds-btn ds-btn--quiet"
            onClick=${() => onOpenSheet && onOpenSheet(c.id)}>
          <${Icon} name="book" size=${15} /> Scheda</button>` : null}

        ${c.xp && c.xp.ready && c.isMine ? html`<button type="button" class="ds-btn ds-btn--primary"
            onClick=${() => onLevelUp && onLevelUp(c.id)}>
          <${Icon} name="star" size=${15} /> Sali di livello</button>` : null}

        ${c.canGrantLevelUp ? html`<button type="button" class="ds-btn ds-btn--quiet"
            onClick=${() => onGrantLevelUp && onGrantLevelUp(c.id)}>
          <${Icon} name="star" size=${15} /> Concedi level-up</button>` : null}

        ${c.canUploadAvatar ? html`<button type="button" class="ds-btn ds-btn--quiet"
            onClick=${() => onUploadAvatar && onUploadAvatar(c)}>
          <${Icon} name="upload" size=${15} /> Ritratto</button>` : null}

        ${canEdit ? html`<button type="button" class="ds-btn ds-btn--quiet" aria-expanded=${edit}
            onClick=${() => setEdit(!edit)}>
          <${Icon} name="chevron" size=${14} class=${edit ? 'is-flip' : ''} /> Modifica valori</button>` : null}

        ${isActive && c.canEndTurn ? html`<button type="button" class="ds-btn ds-btn--primary fc__end"
            onClick=${() => onEndTurn && onEndTurn(c.id)}>
          <${Icon} name="flame" size=${15} /> Fine turno</button>` : null}
      </div>

      ${c.isMaster && c.isCreature ? html`<div class="fc__master">
        <span class="ds-t-label">Controlli master</span>
        <div class="fc__master-row">
          <div class="ds-seg" role="group" aria-label="Fazione">
            <button type="button" class="ds-seg__btn ${c.faction !== 'good' ? 'is-on' : ''}"
                    onClick=${() => onSetFaction && onSetFaction(c.id, 'evil')}>Avversario</button>
            <button type="button" class="ds-seg__btn ${c.faction === 'good' ? 'is-on' : ''}"
                    onClick=${() => onSetFaction && onSetFaction(c.id, 'good')}>Alleato</button>
          </div>
          <button type="button" class="ds-btn ds-btn--quiet ${c.showHealthHint ? 'is-on' : ''}"
                  onClick=${() => onToggleHealthHint && onToggleHealthHint(c.id)}>
            <${Icon} name="eye" size=${14} /> Mostra HP</button>
          ${c.ac !== null || c.isMaster ? html`<button type="button"
                  class="ds-btn ds-btn--quiet ${c.showAC ? 'is-on' : ''}"
                  onClick=${() => onToggleShowAC && onToggleShowAC(c.id)}>
            <${Icon} name="shield" size=${14} /> Mostra CA</button>` : null}
        </div>
      </div>` : null}

      ${edit ? html`<div class="fc__edit">
        <label class="fc__edit-f"><span class="ds-t-label">Iniziativa</span>
          <input class="ds-field" inputmode="numeric" value=${c.init}
                 onChange=${(e) => onField && onField(c.id, 'initiative', parseInt(e.target.value, 10) || 0)} /></label>
        ${c.canEditMaxHp && !c.hpHidden ? html`<label class="fc__edit-f"><span class="ds-t-label">HP max</span>
          <input class="ds-field" inputmode="numeric" value=${c.hpMax}
                 onChange=${(e) => onField && onField(c.id, 'hpMax', parseInt(e.target.value, 10) || 1)} /></label>` : null}
        ${!c.hpHidden ? html`<label class="fc__edit-f"><span class="ds-t-label">HP temp.</span>
          <input class="ds-field" inputmode="numeric" value=${c.temp}
                 onChange=${(e) => onField && onField(c.id, 'tempHp', parseInt(e.target.value, 10) || 0)} /></label>` : null}
        ${c.canEditAc ? html`<label class="fc__edit-f"><span class="ds-t-label">CA</span>
          <input class="ds-field" inputmode="numeric" value=${c.ac ?? ''}
                 onChange=${(e) => onField && onField(c.id, 'ac', parseInt(e.target.value, 10) || 0)} /></label>` : null}
      </div>` : null}

      ${canEdit ? html`<div class="fc__danger">
        <button type="button" class="ds-btn ds-btn--quiet fc__remove"
                onClick=${() => onRemove && onRemove(c.id)}>
          <${Icon} name="x" size=${14} /> Rimuovi dalla sessione</button>
      </div>` : null}

    </div>` : null}
  </li>`;
}
