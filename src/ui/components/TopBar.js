import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { Icon } from '../icons.js';
import { TurnBanner } from './TurnBanner.js';

export function TopBar({ session, active, isMyTurn, isMaster, offline, menu = [], menuOpen: menuOpenProp, onNext, onCopy, onMenu, onExit, round }) {
  const [menuOpenState, setMenu] = useState(false);
  const menuOpen = menuOpenProp != null ? menuOpenProp : menuOpenState;
  const items = menu.filter((m) => isMaster || !m.master);
  return html`<header class="tb ${offline ? 'is-offline' : ''}">
    <div class="tb__brand">
      <span class="ds-emblem" aria-hidden="true"><${Icon} name="flame" size=${20} /></span>
      <button type="button" class="tb__code" onClick=${onCopy} title="Copia il codice sessione">
        <span class="tb__code-label">Sessione</span><b>${session.code}</b><${Icon} name="copy" size=${14} />
      </button>
    </div>
    <${TurnBanner} round=${round} active=${active} isMyTurn=${isMyTurn} />
    <div class="tb__actions">
      ${offline ? html`<span class="ds-chip ds-chip--warn" role="status"><${Icon} name="wifiOff" size=${14} /> Offline · ritento…</span>` : null}
      ${isMaster ? html`<button type="button" class="ds-btn ds-btn--primary tb__next" onClick=${onNext}>Turno <${Icon} name="chevron" size=${16} class="tb__next-ic" /></button>` : null}
      <div class="tb__menu">
        <button type="button" class="ds-btn ds-btn--icon" aria-haspopup="menu" aria-expanded=${menuOpen} aria-label="Menu"
          onClick=${() => { setMenu(!menuOpen); onMenu && onMenu(!menuOpen); }}><${Icon} name="more" size=${20} /></button>
        ${menuOpen ? html`<ul class="tb__pop ds-panel" role="menu">
          ${items.map((m) => html`<li role="none"><button role="menuitem" type="button" class="tb__pop-item ${m.danger ? 'is-danger' : ''}"><${Icon} name=${m.icon} size=${16} />${m.label}</button></li>`)}
        </ul>` : null}
      </div>
      <button type="button" class="ds-btn ds-btn--quiet" onClick=${onExit}><${Icon} name="logout" size=${16} /> Esci</button>
    </div>
  </header>`;
}
