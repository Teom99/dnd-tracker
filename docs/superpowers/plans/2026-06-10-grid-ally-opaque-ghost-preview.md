# Alleati opachi e ghost di anteprima spostamento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Token alleati opachi sulla griglia e ghost semitrasparente del token selezionato che mostra in tempo reale la destinazione valida sotto il cursore.

**Architecture:** Tutto in `src/GridUI.js` (`renderGrid`) + una regola CSS. I colori base dei token vengono estratti in un helper `tokenBaseColors` usato sia dal loop dei token sia dal ghost. Il ghost è un singolo `<g class="sq-ghost">` SVG creato lazy e riposizionato via `transform` nello stesso listener `mousemove` del tooltip; nessun re-render per frame, nessun cambio a click/validazione/Firebase.

**Tech Stack:** HTML + CSS + ES6 modules, no bundler. **Nessuna suite di test**: verifica statica con `~/.local/node/bin/node --check` (node NON è nel PATH) e verifica manuale finale nel browser.

**Spec:** `docs/superpowers/specs/2026-06-10-grid-ally-opaque-ghost-preview-design.md`

---

### Task 1: Fill opaco per le creature alleate

**Files:**
- Modify: `src/GridUI.js:197`

- [ ] **Step 1: Cambiare il fill**

In `renderGrid`, nel loop dei token, sostituire la riga:

```js
    else if (occ.faction === 'good') { fill = 'rgba(138,109,50,0.35)'; stroke = isSelected ? '#d4af5e' : isActive ? '#e3c87e' : '#b8954a'; }
```

con:

```js
    else if (occ.faction === 'good') { fill = '#2b2110'; stroke = isSelected ? '#d4af5e' : isActive ? '#e3c87e' : '#b8954a'; }
```

- [ ] **Step 2: Verifica statica**

- `~/.local/node/bin/node --check src/GridUI.js` → OK
- `grep -n "rgba(138,109,50" src/GridUI.js` → nessun risultato

- [ ] **Step 3: Commit**

```bash
git add src/GridUI.js
git commit -m "fix(grid): token alleati con fill opaco"
```

---

### Task 2: Ghost di anteprima spostamento

**Files:**
- Modify: `src/GridUI.js` (helper `tokenBaseColors`, refactor colori nel loop token, ghost nel `mousemove`/`mouseleave`)
- Modify: `style.css` (regola `.sq-ghost`)

- [ ] **Step 1: Estrarre l'helper `tokenBaseColors`**

In `src/GridUI.js`, subito PRIMA del commento `// ─── Re-render callback (resize) ───…` (riga ~129), aggiungere:

```js
// Colori base di un token (variante non selezionata/attiva), usati anche dal ghost
function tokenBaseColors(occ, isMyToken) {
  if (isMyToken)              return { fill: '#16240f', stroke: '#5e8f54' };
  if (occ.type === 'player')  return { fill: '#13241c', stroke: '#4a8a6e' };
  if (occ.faction === 'good') return { fill: '#2b2110', stroke: '#b8954a' };
  return { fill: '#2a100c', stroke: '#a84a3a' };
}
```

- [ ] **Step 2: Usare l'helper nel loop dei token**

Nel loop token di `renderGrid`, sostituire il blocco:

```js
    let fill, stroke;
    if (isMyToken)      { fill = '#16240f'; stroke = isSelected ? '#9ccf6e' : '#5e8f54'; }
    else if (isPlayer)  { fill = '#13241c'; stroke = isSelected ? '#d4af5e' : isActive ? '#e3c87e' : '#4a8a6e'; }
    else if (occ.faction === 'good') { fill = '#2b2110'; stroke = isSelected ? '#d4af5e' : isActive ? '#e3c87e' : '#b8954a'; }
    else                { fill = '#2a100c'; stroke = isSelected ? '#d4af5e' : isActive ? '#e3c87e' : '#a84a3a'; }
    if (isDead) { fill = '#3a352c'; stroke = '#6e6657'; }
```

con (semantica identica: il proprio token ignora `isActive` per lo stroke, come oggi):

```js
    const base = tokenBaseColors(occ, isMyToken);
    let fill   = base.fill;
    let stroke = isMyToken
      ? (isSelected ? '#9ccf6e' : base.stroke)
      : (isSelected ? '#d4af5e' : isActive ? '#e3c87e' : base.stroke);
    if (isDead) { fill = '#3a352c'; stroke = '#6e6657'; }
```

La variabile `isPlayer` resta usata? Verificare: nel loop attuale `isPlayer` serve solo a questo blocco — dopo il refactor rimuovere `const isPlayer = occ.type === 'player';` se non ha altri usi nel loop.

- [ ] **Step 3: Ghost — stato e funzioni in `renderGrid`**

Dopo la definizione di `canPlace` (riga ~246, dopo la sua chiusura), aggiungere:

```js
  // Ghost di anteprima: impronta del token selezionato sulla destinazione sotto il cursore
  const canMoveSelected = !!selectedId && (isMaster || myOwnedIds.has(selectedId)) && !(editMode && isMaster);
  let ghostEl = null;

  function hideGhost() { ghostEl?.remove(); ghostEl = null; }

  function showGhost(col, row) {
    const occ = comb[selectedId];
    if (!occ) { hideGhost(); return; }
    const { x, y } = cellXY(col, row);
    const inset = 3;
    if (!ghostEl) {
      const w      = selSide * CELL;
      const colors = tokenBaseColors(occ, selectedId === myCombatantId);
      const fsz    = Math.max(8, Math.min(18, selSide * 11)).toFixed(0);
      ghostEl = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      ghostEl.setAttribute('class', 'sq-ghost');
      ghostEl.setAttribute('pointer-events', 'none');
      ghostEl.innerHTML =
        `<rect width="${w - inset * 2}" height="${w - inset * 2}" rx="4" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2"/>` +
        `<text x="${(w / 2 - inset).toFixed(1)}" y="${(w / 2 - inset + selSide * 3).toFixed(1)}" text-anchor="middle" font-size="${fsz}" class="sq-name">${esc((occ.name || '?').slice(0, 3).toUpperCase())}</text>`;
      svg.appendChild(ghostEl);
    }
    ghostEl.setAttribute('transform', `translate(${x + inset}, ${y + inset})`);
  }
```

Nota: il contenuto del ghost (colori, taglia, iniziali) dipende solo dal token selezionato, fisso per tutto il render: si costruisce una volta e si riposiziona col `transform`. Al cambio selezione `renderGrid` rifà tutto da zero (l'SVG viene ricreato via `innerHTML`).

- [ ] **Step 4: Integrazione nel `mousemove` e `mouseleave` esistenti**

Sostituire il listener `mousemove` del tooltip (righe ~249-255):

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

con:

```js
  // Tooltip combattente + ghost di anteprima al passaggio del mouse
  svg.addEventListener('mousemove', (e) => {
    const hit = e.target.closest('.sq-hit');
    const occId = hit ? occCell[`${parseInt(hit.dataset.c)}_${parseInt(hit.dataset.r)}`] : null;
    const occ   = occId ? comb[occId] : null;
    if (occ) showCombatTooltip(occ, isMaster, e.clientX, e.clientY);
    else hideCombatTooltip();

    if (!canMoveSelected || !hit) { hideGhost(); return; }
    const col = parseInt(hit.dataset.c), row = parseInt(hit.dataset.r);
    if (occId === selectedId || !canPlace(col, row, selSide, selectedId)) { hideGhost(); return; }
    showGhost(col, row);
  });
```

(`occId === selectedId` serve perché `canPlace` esenta il token in movimento dalle proprie celle: senza il check, il ghost apparirebbe sopra il token stesso.)

Nel listener `mouseleave` esistente (righe ~263-266), aggiungere `hideGhost();` dopo `hideCombatTooltip();`:

```js
  svg.addEventListener('mouseleave', () => {
    svg.querySelectorAll('.sq.sq-hover').forEach(h => h.classList.remove('sq-hover'));
    hideCombatTooltip();
    hideGhost();
  });
```

- [ ] **Step 5: CSS**

In `style.css`, vicino alle altre regole della griglia (cercare `.sq-dist` con grep), aggiungere:

```css
.sq-ghost { opacity: 0.45; }
```

- [ ] **Step 6: Verifica statica**

- `~/.local/node/bin/node --check src/GridUI.js` → OK
- `grep -n "tokenBaseColors" src/GridUI.js` → definizione + 2 usi (loop token, showGhost)
- `grep -n "sq-ghost" src/GridUI.js style.css` → presente in entrambi
- `grep -n "isPlayer" src/GridUI.js` → nessun residuo inutilizzato nel loop token (se la variabile non è più usata, deve essere stata rimossa)

- [ ] **Step 7: Commit**

```bash
git add src/GridUI.js style.css
git commit -m "feat(grid): ghost di anteprima del token selezionato sulla destinazione"
```

---

### Task 3: Aggiornare CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (bullet redesign in "### Completato")

- [ ] **Step 1: Aggiornamento puntuale**

In coda al bullet lungo che inizia con `- Redesign "Grimorio miniato"` (ultimo della sezione "### Completato", attualmente termina con `select XP/Milestone nell'header solo master`), aggiungere:

```
; token alleati opachi sulla griglia; ghost di anteprima (`.sq-ghost`, stesso colore del token, opacità 0.45) sulla destinazione valida durante lo spostamento del token selezionato
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: stato implementazione aggiornato (alleati opachi, ghost anteprima)"
```

---

### Verifica manuale finale (utente, con Firebase reale)

1. Alleato 2×2/3×3: fill opaco, niente linee della griglia visibili sotto; nemici/PG/morti invariati.
2. Token selezionato spostabile: ghost con colori e impronta del token sulle destinazioni valide, che segue il cursore senza scie; nulla su muri, fuori bordi, celle occupate o sopra il token stesso.
3. Click sulla destinazione: il token finisce esattamente dove mostrava il ghost.
4. Giocatore con token altrui selezionato: nessun ghost. Master in modalità modifica: nessun ghost.
5. Deselezione o mouse fuori dalla griglia: ghost rimosso.
