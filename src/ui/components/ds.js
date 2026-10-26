/* Lanterna — primitive condivise (prefisso ds-). Nessuna logica di dominio, solo props in / callback out. */
import { html } from 'htm/preact';
import { Icon } from '../icons.js';

/* Ritratto circolare; la cornice XP è un conic-gradient guidato da --xp (0–100).
   xp.ready → anello oro pieno che pulsa (solo opacity/transform, regime Preact). */
export function Portrait({ c, size = 'md', xp = true }) {
  const state = c.dead ? 'dead' : c.kind;
  const pct = c.xp ? c.xp.pct : 0;
  const ready = !!(c.xp && c.xp.ready);
  const ring = xp && c.kind === 'pc';
  const iconSize = size === 'xl' ? 40 : size === 'lg' ? 26 : 18;
  // L'app permette di caricare un ritratto: se c'è, vince sull'iniziale.
  // `c.avatar` è già validato da adapt.js (solo data URL di immagine).
  const face = c.dead
    ? html`<${Icon} name="skull" size=${iconSize} />`
    : c.avatar
      ? html`<img class="ds-portrait__img" src=${c.avatar} alt="" />`
      : (c.short || c.name || '?')[0];
  return html`<span class="ds-portrait ds-portrait--${state} ds-portrait--${size} ${ring ? 'has-xp' : ''} ${ready ? 'is-ready' : ''}"
      style=${ring ? `--xp:${ready ? 100 : pct}%` : null}
      title=${ring ? (c.xp?.title || (ready ? 'Level-up pronto' : `XP ${pct}%`)) : null}>
    <span class="ds-portrait__face">${face}</span>
  </span>`;
}

/* Barra HP: fill = scaleX (transform), trail = scia che cala in ritardo. */
export function HpBar({ hp, max, temp = 0, size = 'md' }) {
  const pct = Math.max(0, Math.min(1, hp / max));
  const tone = hp <= 0 ? 'zero' : pct <= 0.15 ? 'crit' : pct <= 0.35 ? 'low' : 'ok';
  return html`<span class="ds-bar ds-bar--${size} is-${tone}" role="meter" aria-valuemin="0" aria-valuemax=${max} aria-valuenow=${hp} aria-label="Punti ferita">
    <span class="ds-bar__trail" style=${`transform:scaleX(${pct})`}></span>
    <span class="ds-bar__fill" style=${`transform:scaleX(${pct})`}></span>
    ${temp > 0 ? html`<span class="ds-bar__temp" style=${`width:${Math.min(100, (temp / max) * 100)}%`}></span>` : null}
  </span>`;
}

export function CondChip({ cond, onRemove }) {
  return html`<span class="ds-chip ds-chip--cond">
    <span class="ds-chip__pip" aria-hidden="true"></span>${cond.label}
    ${onRemove ? html`<button class="ds-chip__x" type="button" aria-label=${'Rimuovi ' + cond.label} onClick=${() => onRemove(cond)}><${Icon} name="x" size=${12} /></button>` : null}
  </span>`;
}

/* Death saves inline: 3 rombi successo / 3 rombi fallimento. */
export function DeathSaves({ saves, canEdit, onToggle }) {
  const row = (kind, n, label) => html`<span class="ds-saves__row ds-saves__row--${kind}">
    <span class="ds-saves__label">${label}</span>
    ${[0, 1, 2].map((i) => html`<button type="button" class="ds-saves__pip ${i < n ? 'is-on' : ''}" disabled=${!canEdit}
      aria-pressed=${i < n} aria-label=${`${label} ${i + 1}`} onClick=${() => onToggle && onToggle(kind, i)}></button>`)}
  </span>`;
  return html`<div class="ds-saves" role="group" aria-label="Tiri salvezza contro morte">
    <${Icon} name="skull" size=${16} class="ds-saves__skull" />
    ${row('ok', saves.ok, 'Successi')}${row('ko', saves.ko, 'Fallimenti')}
  </div>`;
}

/* Stato vuoto / attesa: sigillo + titolo + frase + azione opzionale. */
export function EmptyState({ icon = 'scroll', title, text, action, onAction, compact }) {
  return html`<div class="ds-empty ${compact ? 'ds-empty--compact' : ''}" role="status">
    <span class="ds-emblem ds-emblem--lg"><${Icon} name=${icon} size=${26} /></span>
    <h3 class="ds-empty__title">${title}</h3>
    <p class="ds-empty__text">${text}</p>
    ${action ? html`<button type="button" class="ds-btn ds-btn--ghost" onClick=${onAction}>${action}</button>` : null}
  </div>`;
}

/* Cornice d'angolo (visibilità governata da data-ornament su <html>). */
export function Corners() {
  return html`<i class="ds-corner ds-corner--tl"></i><i class="ds-corner ds-corner--tr"></i><i class="ds-corner ds-corner--bl"></i><i class="ds-corner ds-corner--br"></i>`;
}

export function Seg({ items, value, onChange, label }) {
  return html`<div class="ds-seg" role="tablist" aria-label=${label}>
    ${items.map((it) => html`<button type="button" role="tab" class="ds-seg__btn ${value === it.id ? 'is-on' : ''}" aria-selected=${value === it.id}
      onClick=${() => onChange && onChange(it.id)}>${it.label}${it.n != null ? html`<span class="ds-seg__n">${it.n}</span>` : null}</button>`)}
  </div>`;
}
