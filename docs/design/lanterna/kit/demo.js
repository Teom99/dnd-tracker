/* Lanterna — demo interattiva: monta i componenti con dati finti. Nessun build: moduli ES + import map (vedi demo.html). */
import { html, render } from 'htm/preact';
import { useState, useRef } from 'preact/hooks';
import { COMBATANTS, SESSION, LOG, MENU } from './demo-data.js';
import { MAP_SVG } from './demo-map.js';
import { TopBar, InitiativeRail, CombatantList, EventLog, PlayerDock, MasterDock, Toasts, Icon } from './components/index.js';

let uid = 100;
const clock = () => new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

function App() {
  const [list, setList] = useState(COMBATANTS);
  const [activeId, setActive] = useState(SESSION.activeId);
  const [round, setRound] = useState(SESSION.round);
  const [log, setLog] = useState(LOG);
  const [toasts, setToasts] = useState([]);
  const [tab, setTab] = useState('cards');
  const [master, setMaster] = useState(false);
  const [offline, setOffline] = useState(false);
  const [newId, setNewId] = useState(null);
  const byId = (id) => list.find((c) => c.id === id);
  const active = byId(activeId);
  const idx = list.findIndex((c) => c.id === activeId);
  const meId = master ? null : SESSION.meId;
  const alive = list.filter((c) => !c.dead);

  const push = (type, title, text, amount, mine) => {
    const id = ++uid; setToasts((t) => [...t, { id, type, title, text, amount, mine }].slice(-3));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  };
  const addLog = (type, parts) => { const id = 'e' + ++uid; setLog((l) => [...l, { id, t: clock(), type, round, parts }]); setNewId(id); setTimeout(() => setNewId(null), 2400); };

  const next = () => {
    let i = idx, r = round;
    do { i = (i + 1) % list.length; if (i === 0) r++; } while (list[i].dead);
    setActive(list[i].id); if (r !== round) { setRound(r); addLog('turn', ['Inizia il ', { v: 'Round ' + r, k: 'turn' }]); }
    addLog('turn', ['Tocca a ', { n: list[i].short, k: list[i].kind }]);
    if (list[i].id === SESSION.meId) push('turn', 'Tocca a te', 'Round ' + r, null, true);
  };
  const apply = (kind, qty, ids) => {
    setList((l) => l.map((c) => {
      if (!ids.includes(c.id)) return c;
      const hp = kind === 'dmg' ? Math.max(0, c.hp - qty) : Math.min(c.hpMax, c.hp + qty);
      const dead = c.kind !== 'pc' && hp === 0;
      return { ...c, hp, dead, deathSaves: c.kind === 'pc' && hp === 0 ? (c.deathSaves || { ok: 0, ko: 0 }) : c.deathSaves };
    }));
    ids.forEach((id) => {
      const c = byId(id); if (!c) return;
      addLog(kind, kind === 'dmg' ? [{ n: c.short, k: c.kind }, ' subisce ', { v: qty + ' danni', k: 'dmg' }] : [{ n: c.short, k: c.kind }, ' recupera ', { v: qty + ' PF', k: 'heal' }]);
      if (id === SESSION.meId) push(kind, kind === 'dmg' ? 'Subisci danno' : 'Vieni curato', 'Aldric', (kind === 'dmg' ? '−' : '+') + qty, true);
    });
    if (ids.length > 1) push(kind, 'Colpo multiplo', `${ids.length} bersagli`, (kind === 'dmg' ? '−' : '+') + qty);
  };
  const patch = (id, fn) => setList((l) => l.map((c) => (c.id === id ? fn(c) : c)));

  return html`<div class="ly" data-view="map">
    <div class="ly__top"><${TopBar} session=${SESSION} active=${active} isMyTurn=${activeId === SESSION.meId && !master} isMaster=${master} round=${round} offline=${offline} menu=${MENU} onNext=${next} onCopy=${() => push('turn', 'Codice copiato', SESSION.code)} /></div>
    <div class="ly__rail"><${InitiativeRail} combatants=${list} activeId=${activeId} meId=${meId} round=${round} isMaster=${master} onNext=${next} onSelect=${() => {}} onReroll=${() => push('turn', 'Iniziativa ritirata', 'Demo')} onAdd=${() => push('turn', 'Aggiungi creatura', 'Nel prodotto apre il picker')} onReset=${() => { setList(COMBATANTS); setActive(SESSION.activeId); setRound(3); }} /></div>
    <main class="ly__map"><section class="gr ds-panel"><i class="ds-corner ds-corner--tl"></i><i class="ds-corner ds-corner--br"></i>
      <div class="gr__bar"><span class="ds-t-label">Demo · i controlli sono veri</span><span class="gr__sp"></span>
        <label class="ds-chip ds-chip--pick ${master ? 'is-on' : ''}"><input type="checkbox" hidden checked=${master} onChange=${(e) => setMaster(e.target.checked)} /> Vista master</label>
        <label class="ds-chip ds-chip--pick ${offline ? 'is-on' : ''}"><input type="checkbox" hidden checked=${offline} onChange=${(e) => setOffline(e.target.checked)} /> Simula offline</label></div>
      <div class="gr__stage"><div class="gr__frame" dangerouslySetInnerHTML=${{ __html: MAP_SVG }}></div></div>
      <div class="gr__hint"><${Icon} name="area" size=${15} /><span>Snapshot SVG: la griglia resta rendering imperativo. Prova <b>Turno</b>, danno/cura sulle carte, le palette dal pannello Aspetto.</span></div></section></main>
    <aside class="ly__side"><div class="ly__pane ds-panel">
      <nav class="ds-tabs" role="tablist">${[['cards', 'Carte', list.length], ['log', 'Log', log.length]].map(([k, l, n]) => html`<button type="button" class="ds-tabs__btn ${tab === k ? 'is-on' : ''}" onClick=${() => setTab(k)}>${l}<span class="ds-tabs__n">${n}</span></button>`)}</nav>
      ${tab === 'cards'
        ? html`<${CombatantList} combatants=${list} activeId=${activeId} meId=${meId} isMaster=${master} onApply=${apply}
            onInspiration=${(id) => patch(id, (c) => ({ ...c, insp: !c.insp }))}
            onField=${(id, f, v) => patch(id, (c) => ({ ...c, [f]: v }))}
            onDeathSave=${(id, k, i) => patch(id, (c) => { const s = { ...(c.deathSaves || { ok: 0, ko: 0 }) }; s[k] = s[k] === i + 1 ? i : i + 1; return { ...c, deathSaves: s }; })} />`
        : html`<${EventLog} entries=${log} isMaster=${master} newId=${newId} onClear=${() => setLog([])} />`}
    </div></aside>
    <div class="ly__dock">${master
      ? html`<${MasterDock} active=${active} next=${list[(idx + 1) % list.length]} round=${round} offline=${offline} onNext=${next} />`
      : html`<${PlayerDock} me=${byId(SESSION.meId)} isMyTurn=${activeId === SESSION.meId} offline=${offline} xp=${{ cur: 1674, next: 2700 }} onEndTurn=${next} onInspiration=${() => patch(SESSION.meId, (c) => ({ ...c, insp: !c.insp }))} />`}</div>
    <${Toasts} items=${toasts} onDismiss=${(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
  </div>`;
}
render(html`<${App} />`, document.getElementById('app'));
