# Rail con anelli HP, tooltip hover, select in header, distanze euclidee — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rail Iniziativa con soli ritratti ad anello HP color-fazione, tooltip informativo on hover su rail e griglia, select XP/Milestone nell'header (solo master), distanze di griglia euclidee arrotondate al mezzo metro.

**Architecture:** Tutte le modifiche vivono in `src/GridUI.js` (rail, tooltip, distanza), `src/UI.js` (export di `healthHintText`, gating del select), `index.html` (header) e `style.css`. Il tooltip è un singolo `div#combat-tooltip` appeso a `document.body`, con API `showCombatTooltip`/`hideCombatTooltip` esportate da `GridUI.js` e usate da rail e griglia; attivo solo se `matchMedia('(hover: hover)')`.

**Tech Stack:** HTML + CSS + ES6 modules, no bundler. **Nessuna suite di test automatici**: verifica statica con `~/.local/node/bin/node --check` (node NON è nel PATH) e verifica manuale nel browser a fine lavoro.

**Spec:** `docs/superpowers/specs/2026-06-10-rail-ring-tooltip-design.md`

---

### Task 1: Rail — anelli HP, niente nomi, colori fazione

**Files:**
- Modify: `src/GridUI.js:286-330` (`renderInitiativeList`)
- Modify: `style.css:2630-2680` (blocco `.rail-*`)

- [ ] **Step 1: Nuovo markup delle voci rail in `src/GridUI.js`**

In `renderInitiativeList`, sostituire il corpo del loop `for (const c of sortedCombatants)` (oggi calcola `hpBar` e produce `<li>` con `rail-portrait` + `hpBar` + `rail-name`) con:

```js
  for (const c of sortedCombatants) {
    const isActive   = c.id === currentTurnId;
    const isSelected = c.id === selectedId;
    const isKO       = c.hpCurrent === 0;

    // HP visibile: master sempre; per i player solo PG/pet (le creature restano nascoste)
    const hpVisible = isMaster || c.type !== 'creature';
    const hpPct = c.hpMax > 0 ? Math.max(0, Math.min(100, (c.hpCurrent / c.hpMax) * 100)) : 0;
    const ringPct = hpVisible ? hpPct : 100;

    const isPg = c.type === 'player' || c.type === 'pet';
    let cls = 'rail-item';
    cls += isPg ? ' pg' : (c.faction === 'good' ? ' ally' : ' foe');
    if (isActive)   cls += ' active-turn';
    if (isSelected) cls += ' selected';
    if (isKO)       cls += ' ko';

    html += `
      <li class="${cls}" data-id="${c.id}" style="--hp:${ringPct.toFixed(0)}">
        <span class="rail-ring"><span class="rail-portrait">${isKO ? '💀' : esc((c.name || '?').slice(0, 2).toUpperCase())}</span></span>
      </li>`;
  }
```

Note: sparisce l'attributo `title` sulle voci con `data-id` (sostituito dal tooltip del Task 2; le voci `rail-add` lo mantengono). La classe `pg` resta per i PG; le creature ora hanno `foe` (default/`faction:'evil'`) o `ally` (`faction:'good'`).

- [ ] **Step 2: Avvolgere anche le voci "aggiungi" nel ring (markup uniforme)**

Sempre in `renderInitiativeList`, sostituire le due voci add:

```js
  if (isMaster && onAddCombatant) {
    html += `<li class="rail-item rail-add" data-action="add-combatant" title="Aggiungi alla battaglia"><span class="rail-ring"><span class="rail-portrait">＋</span></span></li>`;
  } else if (!isMaster && onAddCombatant) {
    html += `<li class="rail-item rail-add" data-action="add-combatant" title="Aggiungi compagno"><span class="rail-ring"><span class="rail-portrait">🐾</span></span></li>`;
  }
```

- [ ] **Step 3: CSS — anello + bordo interno, rimozione barra e nome**

In `style.css`, sostituire l'intero blocco da `.rail-item {` (riga ~2630) fino a `.rail-add .rail-portrait { ... }` incluso (riga ~2680, comprende `.rail-portrait`, `.rail-item.pg .rail-portrait`, `.rail-item.active-turn .rail-portrait`, `.rail-item.selected .rail-portrait`, `.rail-item.ko`, `.rail-hp`, `.rail-hp-fill`, `.rail-hp-fill.pg`, `.rail-hp-hidden`, `.rail-name`) con:

```css
.rail-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  min-width: 52px;
}

/* Fazione: anello HP (--ring-c) e bordo interno fisso (--ring-b) */
.rail-item.pg   { --ring-c: #5e8f54; --ring-b: #3e5e38; }
.rail-item.foe  { --ring-c: #a83232; --ring-b: #6e2222; }
.rail-item.ally { --ring-c: #b8954a; --ring-b: #7a6230; }

/* Anello esterno: si svuota in senso orario con gli HP (--hp = percentuale) */
.rail-ring {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: conic-gradient(var(--ring-c) calc(var(--hp, 100) * 1%), var(--hp-bar-bg) 0);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: box-shadow .15s;
}

.rail-portrait {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-card);
  border: 2px solid var(--ring-b, var(--border-warm));
  font-family: var(--font-heading);
  font-size: 0.8rem;
  color: var(--text);
}

.rail-item.active-turn .rail-ring { box-shadow: 0 0 12px var(--gold-glow); }
.rail-item.selected .rail-ring    { outline: 2px solid var(--gold-light); outline-offset: 2px; }
.rail-item.ko { opacity: 0.45; }

.rail-add .rail-ring     { background: none; }
.rail-add .rail-portrait { border-style: dashed; border-color: var(--border-warm); color: var(--gold); }
```

- [ ] **Step 4: Verifica statica**

- `~/.local/node/bin/node --check src/GridUI.js` → OK
- `grep -n "rail-hp\|rail-name" src/GridUI.js style.css` → nessun risultato
- `grep -n "rail-ring" src/GridUI.js style.css` → presente in entrambi
- `grep -c 'data-id' src/GridUI.js` invariato rispetto a prima nel blocco rail (il click-handler `container.onclick` usa `li[data-id]`: non toccarlo)

- [ ] **Step 5: Commit**

```bash
git add src/GridUI.js style.css
git commit -m "feat(rail): ritratti con anello HP color fazione, niente nomi"
```

---

### Task 2: Tooltip condiviso on hover (rail + griglia)

**Files:**
- Modify: `src/UI.js:750` (`healthHintText` → export)
- Modify: `src/GridUI.js` (import, nuovo componente tooltip, integrazione rail e griglia, rimozione tooltip SVG)
- Modify: `style.css` (stili `#combat-tooltip`, rimozione `.sq-tooltip-name`)

- [ ] **Step 1: Esportare `healthHintText` da `src/UI.js`**

Alla riga ~750, cambiare `function healthHintText(percent) {` in `export function healthHintText(percent) {`. (`UI.js` non importa nulla, quindi nessun ciclo di import.)

- [ ] **Step 2: Import e componente tooltip in `src/GridUI.js`**

In cima al file (riga 1, prima dei commenti va bene anche dopo; convenzione: import in testa):

```js
import { healthHintText } from './UI.js';
```

Dopo la funzione `esc` (riga ~91), aggiungere:

```js
// ─── Tooltip combattente (solo dispositivi con hover reale) ─────────────────
const _canHover = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;
let _tipEl = null;

function _tooltipHtml(c, isMaster) {
  const hpVisible = isMaster || c.type !== 'creature';
  const hpPct = c.hpMax > 0 ? Math.max(0, Math.min(100, (c.hpCurrent / c.hpMax) * 100)) : 0;
  let hpLine = '';
  if (hpVisible)               hpLine = `<div class="ct-hp">HP ${c.hpCurrent} / ${c.hpMax}</div>`;
  else if (c.showHealthHint)   hpLine = `<div class="ct-hint">${esc(healthHintText(hpPct))}</div>`;
  const acVisible = c.type !== 'creature' || isMaster || c.showAC === true;
  const acLine = (acVisible && c.armorClass != null) ? `<div class="ct-ac">CA ${esc(String(c.armorClass))}</div>` : '';
  const conds = c.conditions ? Object.keys(c.conditions) : [];
  const condLine = conds.length ? `<div class="ct-conds">${conds.map(esc).join(' · ')}</div>` : '';
  return `<div class="ct-name">${esc(c.name)}</div>${hpLine}${acLine}${condLine}`;
}

export function showCombatTooltip(c, isMaster, x, y) {
  if (!_canHover || !c) return;
  if (!_tipEl) {
    _tipEl = document.createElement('div');
    _tipEl.id = 'combat-tooltip';
    document.body.appendChild(_tipEl);
  }
  _tipEl.innerHTML = _tooltipHtml(c, isMaster);
  _tipEl.style.left = `${Math.min(x + 14, window.innerWidth - 200)}px`;
  _tipEl.style.top  = `${Math.min(y + 14, window.innerHeight - 130)}px`;
  _tipEl.classList.add('visible');
}

export function hideCombatTooltip() {
  _tipEl?.classList.remove('visible');
}
```

- [ ] **Step 3: Integrazione nella rail**

In `renderInitiativeList`, dopo l'assegnazione di `container.onclick = ...`, aggiungere:

```js
  container.onmousemove = (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li) { hideCombatTooltip(); return; }
    const c = sortedCombatants.find(x => x.id === li.dataset.id);
    if (c) showCombatTooltip(c, isMaster, e.clientX, e.clientY);
  };
  container.onmouseleave = () => hideCombatTooltip();
```

- [ ] **Step 4: La griglia usa il tooltip condiviso**

In `renderGrid`, sostituire il blocco "Tooltip nome al passaggio del mouse" (righe ~212-235: `let nameTooltip = null;` e il listener `mousemove` che crea il `<text class="sq-tooltip-name">`) con:

```js
  // Tooltip combattente al passaggio del mouse (condiviso con la rail)
  svg.addEventListener('mousemove', (e) => {
    const hit = e.target.closest('.sq-hit');
    const occId = hit ? occCell[`${parseInt(hit.dataset.c)}_${parseInt(hit.dataset.r)}`] : null;
    const occ   = occId ? comb[occId] : null;
    if (occ) showCombatTooltip(occ, isMaster, e.clientX, e.clientY);
    else hideCombatTooltip();
  });
```

e nel listener `mouseleave` esistente (righe ~243-246) sostituire `nameTooltip?.remove(); nameTooltip = null;` con `hideCombatTooltip();` (la riga che toglie `.sq-hover` resta).

- [ ] **Step 5: CSS del tooltip, rimozione `.sq-tooltip-name`**

In `style.css`, rimuovere la regola `.sq-tooltip-name` (cercarla con grep) e aggiungere, vicino al blocco della griglia o in coda alla sezione rail:

```css
/* ─── Tooltip combattente (rail + griglia, solo desktop) ─── */
#combat-tooltip {
  position: fixed;
  z-index: 200;
  max-width: 190px;
  background: linear-gradient(175deg, var(--bg-page), var(--bg-deep));
  border: 1px solid var(--border-warm);
  border-radius: 6px;
  padding: 0.45rem 0.65rem;
  box-shadow: 0 6px 24px rgba(0,0,0,0.7);
  pointer-events: none;
  display: none;
  font-size: 0.8rem;
  line-height: 1.35;
}
#combat-tooltip.visible { display: block; }
#combat-tooltip .ct-name  { font-family: var(--font-heading); font-size: 0.85rem; color: var(--gold-light); margin-bottom: 2px; }
#combat-tooltip .ct-hp    { color: var(--text); }
#combat-tooltip .ct-hint  { color: var(--text-muted); font-style: italic; }
#combat-tooltip .ct-ac    { color: #7ab4e0; }
#combat-tooltip .ct-conds { color: var(--text-muted); }
```

- [ ] **Step 6: Verifica statica**

- `~/.local/node/bin/node --check src/GridUI.js && ~/.local/node/bin/node --check src/UI.js` → OK
- `grep -n "sq-tooltip-name\|nameTooltip" src/GridUI.js style.css` → nessun risultato
- `grep -n "export function healthHintText" src/UI.js` → 1 risultato
- `grep -n "import { healthHintText }" src/GridUI.js` → 1 risultato
- `grep -rn "from './GridUI.js'" src/UI.js` → nessun risultato (no cicli)

- [ ] **Step 7: Commit**

```bash
git add src/GridUI.js src/UI.js style.css
git commit -m "feat(combat): tooltip informativo on hover su rail e griglia"
```

---

### Task 3: Select XP/Milestone nell'header

**Files:**
- Modify: `index.html:140-178` (header + toolbar)
- Modify: `src/UI.js:207-211` (`renderMasterPanel`)
- Modify: `style.css` (regola `.combat-header-actions`)

- [ ] **Step 1: Spostare il select nell'header in `index.html`**

Nell'header (righe 140-148), avvolgere il bottone Esci in un wrapper e aggiungere il select prima di esso. L'header diventa:

```html
    <header class="combat-header">
      <div class="session-info">
        <span class="session-label">Sessione:</span>
        <span id="session-code-display" class="session-code"></span>
        <button id="btn-copy-code" class="btn-copy" title="Copia codice">📋 Copia</button>
      </div>
      <span id="round-display" class="round-display">Round 1</span>
      <div class="combat-header-actions">
        <select id="select-progression-mode-live" class="btn-secondary btn-sm hidden" title="Modalità progressione">
          <option value="xp">XP</option>
          <option value="milestone">Milestone</option>
        </select>
        <button id="btn-exit-session" class="btn-exit-session" title="Esci dalla sessione">← Esci</button>
      </div>
    </header>
```

Nota: il select parte con classe `hidden` (i giocatori non devono vederlo mai, nemmeno prima del primo render).

Nella toolbar (righe ~164-173), RIMUOVERE il `<select id="select-progression-mode-live">…</select>` da `#master-controls` (restano `btn-next-turn`, `btn-award-xp-open`, `btn-reset`).

- [ ] **Step 2: Gating master in `src/UI.js`**

In `renderMasterPanel` (riga ~207) aggiungere una riga:

```js
export function renderMasterPanel(isMaster) {
  document.getElementById('master-add-form')?.classList.toggle('hidden', !isMaster);
  document.getElementById('master-controls')?.classList.toggle('hidden', !isMaster);
  document.getElementById('select-progression-mode-live')?.classList.toggle('hidden', !isMaster);
  document.getElementById('player-pet-form')?.classList.toggle('hidden', isMaster);
}
```

- [ ] **Step 3: CSS wrapper**

In `style.css`, vicino a `.btn-exit-session` (riga ~1437), aggiungere:

```css
.combat-header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}
```

- [ ] **Step 4: Verifica statica**

- `grep -c "select-progression-mode-live" index.html` → 1 (solo nell'header)
- il listener `app.js` per `select-progression-mode-live` (riga ~743) resta invariato e l'elemento esiste → nessun cambio in app.js
- `grep -n "selLive" app.js` → la sync nel listener realtime continua a funzionare per id (invariata)

- [ ] **Step 5: Commit**

```bash
git add index.html src/UI.js style.css
git commit -m "feat(header): select XP/Milestone nell'header, solo master"
```

---

### Task 4: Distanze euclidee arrotondate

**Files:**
- Modify: `src/GridUI.js:1-3` (commento di testa), `src/GridUI.js:78-83` (`squareDistance`)

- [ ] **Step 1: Nuova `squareDistance`**

Sostituire (righe ~78-83):

```js
// Distanza Chebyshev bordo-a-bordo tra due footprint quadrati.
export function squareDistance(c1, r1, n1, c2, r2, n2) {
  const dc = axisDist(c1, c1 + n1 - 1, c2, c2 + n2 - 1);
  const dr = axisDist(r1, r1 + n1 - 1, r2, r2 + n2 - 1);
  return Math.max(dc, dr);
}
```

con:

```js
// Distanza euclidea bordo-a-bordo tra due footprint quadrati, arrotondata al mezzo metro.
export function squareDistance(c1, r1, n1, c2, r2, n2) {
  const dc = axisDist(c1, c1 + n1 - 1, c2, c2 + n2 - 1);
  const dr = axisDist(r1, r1 + n1 - 1, r2, r2 + n2 - 1);
  return Math.round(Math.hypot(dc, dr) * 2) / 2;
}
```

- [ ] **Step 2: Aggiornare il commento di testa del file**

Riga 3: sostituire `// Distanza Chebyshev (diagonali = 1), misurata bordo-a-bordo tra footprint.` con `// Distanza euclidea bordo-a-bordo tra footprint, arrotondata al mezzo metro.`

- [ ] **Step 3: Verifica numerica**

Run:
```bash
~/.local/node/bin/node -e "
function axisDist(a1,a2,b1,b2){return Math.max(0,Math.max(a1,b1)-Math.min(a2,b2));}
function d(c1,r1,n1,c2,r2,n2){const dc=axisDist(c1,c1+n1-1,c2,c2+n2-1);const dr=axisDist(r1,r1+n1-1,r2,r2+n2-1);return Math.round(Math.hypot(dc,dr)*2)/2;}
console.log(d(0,0,1,3,0,1));   // atteso 3   (3 caselle in orizzontale)
console.log(d(0,0,1,3,3,1));   // atteso 4   (3 in diagonale: 4.24 → 4)
console.log(d(0,0,1,4,4,1));   // atteso 5.5 (4 in diagonale: 5.66 → 5.5)
console.log(d(0,0,1,1,1,1));   // atteso 1.5 (1 in diagonale: 1.41 → 1.5)
console.log(d(0,0,2,3,0,2));   // atteso 1   (2x2 adiacente con 1 casella di gap)
console.log(d(0,0,1,0,1,1));   // atteso 1   (adiacenti in verticale)
"
```
Expected output: `3` `4` `5.5` `1.5` `1` `1`.

- `~/.local/node/bin/node --check src/GridUI.js` → OK

- [ ] **Step 4: Commit**

```bash
git add src/GridUI.js
git commit -m "feat(grid): distanze euclidee bordo-a-bordo arrotondate al mezzo metro"
```

---

### Task 5: Aggiornare CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (tabella architettura riga `src/GridUI.js`, bullet taglia token, bullet redesign)

- [ ] **Step 1: Tre aggiornamenti puntuali**

1. Nella tabella "Architettura file", riga `src/GridUI.js`: sostituire `` `renderInitiativeList` = rail dei turni (ritratti + mini-barre HP + bottone aggiungi) `` con `` `renderInitiativeList` = rail dei turni (ritratti con anello HP color fazione + bottone aggiungi); tooltip hover condiviso (`showCombatTooltip`) ``.
2. Nel bullet "Taglia token" della sezione Completato: sostituire `distanza Chebyshev bordo-a-bordo (1 casella = 1m)` con `distanza euclidea bordo-a-bordo arrotondata al mezzo metro (1 casella = 1m)`.
3. In coda al bullet del redesign (quello che termina con `rail iniziativa senza distanze (restano le etichette sui token della griglia)`), aggiungere: `; rail con soli ritratti ad anello HP (verde PG, rosso avversari, oro alleati; pieno per i giocatori sulle creature), tooltip essenziale on hover su rail e griglia (solo desktop, regole visibilità HP/CA invariate), select XP/Milestone nell'header solo master`.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: stato implementazione aggiornato (anelli rail, tooltip, distanze euclidee)"
```

---

### Verifica manuale finale (utente, con Firebase reale)

1. Rail: soli ritratti; anelli verde/rosso/oro per PG/avversari/alleati; bordo interno sempre color fazione; da giocatore anelli creature pieni, da master si svuotano; turno attivo con bagliore oro; selezione con contorno; KO spento col 💀; ＋/🐾 ok.
2. Tooltip desktop su rail e griglia: nome sempre; HP/CA secondo regole; hint qualitativo con `showHealthHint`; condizioni; niente tooltip su touch.
3. Header: select XP/Milestone accanto a Esci, solo master; cambio modalità mostra/nasconde ✨ Assegna XP.
4. Griglia: etichette distanza euclidee (diag 3 = 4m, diag 4 = 5.5m), bordo-a-bordo per token grandi.
5. Mobile: rail orizzontale con soli ritratti, nessun tooltip.
