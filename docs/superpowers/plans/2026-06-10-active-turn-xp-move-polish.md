# Turno attivo brillante, XP a destra, spostamento raffinato — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bagliore pulsante sul combattente di turno nella rail, bottone "✨ Assegna XP" a destra nella toolbar (gating master+modalità esplicito), niente tooltip sulla griglia durante lo spostamento, e spostamento dei token grandi anche sulle celle del proprio footprint.

**Architecture:** Quattro modifiche indipendenti e piccole: una regola CSS animata (`style.css`), uno spostamento di markup con gating combinato (`index.html` + `app.js` + `src/UI.js`), e due ritocchi al `mousemove`/`click` di `renderGrid` (`src/GridUI.js`). Nessun cambio al modello dati.

**Tech Stack:** HTML + CSS + ES6 modules, no bundler. **Nessuna suite di test**: verifica statica con `~/.local/node/bin/node --check` (node NON è nel PATH) e verifica manuale finale.

**Spec:** `docs/superpowers/specs/2026-06-10-active-turn-xp-move-polish-design.md`

---

### Task 1: Bagliore pulsante sul turno attivo (rail)

**Files:**
- Modify: `style.css:2676`

- [ ] **Step 1: Sostituire la regola del bagliore**

Sostituire:

```css
.rail-item.active-turn .rail-ring { box-shadow: 0 0 12px var(--gold-glow); }
```

con:

```css
.rail-item.active-turn .rail-ring { animation: rail-turn-glow 2s ease-in-out infinite; }
@keyframes rail-turn-glow {
  0%, 100% { box-shadow: 0 0 10px var(--gold-glow), 0 0 22px var(--gold-glow); }
  50%      { box-shadow: 0 0 16px var(--gold-glow), 0 0 34px 6px var(--gold-glow); }
}
```

- [ ] **Step 2: Verifica statica**

`grep -n "rail-turn-glow" style.css` → 2 risultati (regola + keyframes). Le regole `selected`/`ko` adiacenti restano invariate.

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "feat(rail): bagliore pulsante sul combattente di turno"
```

---

### Task 2: Bottone "✨ Assegna XP" a destra con gating esplicito

**Files:**
- Modify: `index.html:171-179` (toolbar)
- Modify: `app.js:1105` (toggle nel listener realtime)
- Modify: `src/UI.js` (`renderMasterPanel`, ~riga 207)

- [ ] **Step 1: Spostare il bottone nel markup**

In `index.html`, RIMUOVERE da `#master-controls` la riga:

```html
            <button id="btn-award-xp-open" class="btn-secondary btn-sm">✨ Assegna XP</button>
```

e inserirla (con classe `hidden` in più) come PRIMO elemento di `.combat-toolbar-shared`:

```html
          <div class="combat-toolbar-shared">
            <button id="btn-award-xp-open" class="btn-secondary btn-sm hidden">✨ Assegna XP</button>
            <button id="btn-upload-scene" class="btn-secondary btn-sm" title="Carica immagine scena">🖼 Scena</button>
            <button id="btn-toggle-ship" class="btn-secondary btn-sm" title="Apri pannello nave">🚢 Damselfly</button>
          </div>
```

`#master-controls` resta con `btn-next-turn` e `btn-reset`.

- [ ] **Step 2: Gating combinato nel listener realtime**

In `app.js` (riga ~1105), nel listener realtime — dove `isMaster` è già calcolato poco sopra come `const isMaster = data.masterUid === state.myUid;` — sostituire:

```js
    document.getElementById('btn-award-xp-open')?.classList.toggle('hidden', (data.progressionMode ?? 'xp') !== 'xp');
```

con:

```js
    document.getElementById('btn-award-xp-open')?.classList.toggle('hidden', !isMaster || (data.progressionMode ?? 'xp') !== 'xp');
```

- [ ] **Step 3: Gating all'ingresso in `renderMasterPanel`**

In `src/UI.js`, `renderMasterPanel` diventa:

```js
export function renderMasterPanel(isMaster) {
  document.getElementById('master-add-form')?.classList.toggle('hidden', !isMaster);
  document.getElementById('master-controls')?.classList.toggle('hidden', !isMaster);
  document.getElementById('select-progression-mode-live')?.classList.toggle('hidden', !isMaster);
  document.getElementById('btn-award-xp-open')?.classList.toggle('hidden', !isMaster);
  document.getElementById('player-pet-form')?.classList.toggle('hidden', isMaster);
}
```

Nota: per il master, `renderMasterPanel` lo mostra all'ingresso e il primo snapshot lo corregge subito se la modalità è Milestone (il toggle dello Step 2 gira a ogni snapshot). Per i giocatori resta sempre nascosto (markup `hidden` + entrambi i toggle).

- [ ] **Step 4: Verifica statica**

- `grep -c "btn-award-xp-open" index.html` → 1 (dentro `.combat-toolbar-shared`)
- `~/.local/node/bin/node --check app.js && ~/.local/node/bin/node --check src/UI.js` → OK
- listener click `app.js:1024` invariato

- [ ] **Step 5: Commit**

```bash
git add index.html app.js src/UI.js
git commit -m "feat(toolbar): bottone Assegna XP a destra accanto a Scena e nave"
```

---

### Task 3: Niente tooltip durante lo spostamento + movimento dentro il proprio footprint

**Files:**
- Modify: `src/GridUI.js:281-293` (`mousemove`), `src/GridUI.js:307-330` (`click`)

- [ ] **Step 1: `mousemove` — tooltip soppresso e ghost sull'intero footprint tranne l'ancora**

Sostituire il listener (righe ~281-293):

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

con:

```js
  // Tooltip combattente + ghost di anteprima al passaggio del mouse.
  // Durante lo spostamento (token selezionato spostabile) il tooltip è soppresso: si vede solo il ghost.
  svg.addEventListener('mousemove', (e) => {
    const hit = e.target.closest('.sq-hit');
    const occId = hit ? occCell[`${parseInt(hit.dataset.c)}_${parseInt(hit.dataset.r)}`] : null;
    const occ   = occId ? comb[occId] : null;
    if (occ && !canMoveSelected) showCombatTooltip(occ, isMaster, e.clientX, e.clientY);
    else hideCombatTooltip();

    if (!canMoveSelected || !hit) { hideGhost(); return; }
    const col = parseInt(hit.dataset.c), row = parseInt(hit.dataset.r);
    const selAnchor = pos[selectedId];
    const isAnchor  = selAnchor && col === selAnchor.col && row === selAnchor.row;
    if (isAnchor || !canPlace(col, row, selSide, selectedId)) { hideGhost(); return; }
    showGhost(col, row);
  });
```

(`pos` è già in scope in `renderGrid`. Il vecchio check `occId === selectedId` sparisce: le celle del proprio footprint diverse dall'ancora ora mostrano il ghost — `canPlace` le considera valide perché esenta il token in movimento.)

- [ ] **Step 2: `click` — celle del proprio footprint come destinazioni**

Nel listener `click` (righe ~307-330), sostituire il blocco:

```js
    if (occupantId) {
      // Click su token → seleziona/deseleziona
      onSelect(occupantId === selectedId ? null : occupantId);
      return;
    }
```

con:

```js
    if (occupantId) {
      // Click sul token selezionato e spostabile: le celle del footprint sono destinazioni
      // (la cella cliccata diventa la nuova ancora top-left; sull'ancora attuale = deselezione)
      if (occupantId === selectedId && (isMaster || myOwnedIds.has(selectedId))) {
        const selAnchor = pos[selectedId];
        if (selAnchor && !(col === selAnchor.col && row === selAnchor.row) && canPlace(col, row, selSide, selectedId)) {
          onMove(selectedId, col, row);
        }
        onSelect(null);
        return;
      }
      // Click su token → seleziona/deseleziona
      onSelect(occupantId === selectedId ? null : occupantId);
      return;
    }
```

Note:
- per i token 1×1 la cella cliccata coincide sempre con l'ancora → solo `onSelect(null)`: comportamento identico a oggi;
- se il viewer non può muovere il token selezionato (giocatore con token altrui), si cade nel ramo esistente → `onSelect(null)` (deselezione), come oggi;
- `canPlace` va comunque verificata: un'ancora interna può spingere il footprint fuori dai bordi o su muri/altri token;
- il ramo `editMode && isMaster` a inizio listener resta invariato (ritorna prima).

- [ ] **Step 3: Verifica statica**

- `~/.local/node/bin/node --check src/GridUI.js` → OK
- `grep -n "occId === selectedId" src/GridUI.js` → nessun risultato
- `grep -c "selAnchor" src/GridUI.js` → 4 (due nel mousemove, due nel click)

- [ ] **Step 4: Commit**

```bash
git add src/GridUI.js
git commit -m "feat(grid): spostamento dentro il proprio footprint, tooltip soppresso durante il movimento"
```

---

### Task 4: Aggiornare CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (bullet redesign in "### Completato")

- [ ] **Step 1: Aggiornamento puntuale**

In coda al bullet lungo `- Redesign "Grimorio miniato"` (attualmente termina con `durante lo spostamento del token selezionato`), aggiungere:

```
; turno attivo con bagliore pulsante nella rail; ✨ Assegna XP a destra nella toolbar (visibile solo a master in modalità XP); durante lo spostamento niente tooltip sulla griglia e click sulle celle del proprio footprint = nuova ancora (sull'ancora attuale = deselezione)
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: stato implementazione aggiornato (turno pulsante, XP a destra, spostamento raffinato)"
```

---

### Verifica manuale finale (utente, con Firebase reale)

1. Rail: il ritratto di turno pulsa con bagliore oro intenso (~2s); selezione e KO invariati.
2. Toolbar: ✨ a destra prima di Scena; solo master in modalità XP; sparisce in Milestone; i giocatori non lo vedono mai; il modal si apre come prima.
3. Token selezionato spostabile: nessun tooltip sulla griglia (solo ghost); deselezionando, i tooltip tornano; tooltip della rail sempre attivi.
4. Token 2×2+: ghost anche sulle celle interne del footprint (non sull'ancora); click su cella interna → il token si sposta con quella cella come nuova ancora; click sull'ancora → deselezione senza scritture; ancora interna che spingerebbe il footprint fuori griglia/su muri → niente ghost, click senza spostamento.
5. Token 1×1: click sul token = deselezione (come prima).
6. Giocatore con token altrui selezionato: click sul token = deselezione, nessuno spostamento; nessun ghost.
