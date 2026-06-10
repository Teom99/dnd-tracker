# Riorganizzazione layout vista combat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chip token rimossi, toolbar a tutta pagina sotto un header sottile, dettaglio del selezionato a destra della griglia, cronaca a fisarmonica (con badge eventi non letti) sotto la griglia.

**Architecture:** Solo riorganizzazione di markup (`index.html`) e CSS (`style.css`); il rendering esistente non cambia. Unica logica nuova: toggle fisarmonica in `app.js` e contatore badge in `src/UI.js` (stato in memoria per client, nessuna scrittura Firebase dal listener). `renderTokenBar` viene eliminata da `src/grid.js`.

**Tech Stack:** HTML + CSS + ES6 modules, no bundler. **Nessuna suite di test**: verifica statica con `node --check` (su questa macchina node è nel PATH via fnm) e verifica manuale finale.

**Spec:** `docs/superpowers/specs/2026-06-11-combat-dashboard-layout-design.md`

I numeri di riga si riferiscono allo stato a inizio piano (commit `8e2d77b`); ogni task li sposta — usare i frammenti di codice come riferimento, non i numeri.

---

### Task 1: Rimozione chip token

**Files:**
- Modify: `index.html:228` (`#grid-token-bar`)
- Modify: `src/grid.js:59,75-116` (`renderTokenBar`)
- Modify: `style.css:2542-2562` (`.grid-token-bar`, `.grid-token-chip*`)

- [ ] **Step 1: Rimuovere il markup**

In `index.html`, dentro `#grid-section`, eliminare la riga:

```html
          <div id="grid-token-bar" class="grid-token-bar"></div>
```

- [ ] **Step 2: Rimuovere la chiamata e la funzione in `src/grid.js`**

Eliminare la riga (dentro `renderGrid`, dopo la chiamata a `GridUI.renderGrid`):

```js
  renderTokenBar(gridPos, combatants);
```

ed eliminare per intero la funzione `export function renderTokenBar(gridPos, combatants) { … }` (da `export function renderTokenBar` fino alla `}` che chiude `bar.onclick = (e) => {…};` e la funzione — righe 75-116). La funzione non è importata da nessun altro file (verificato).

- [ ] **Step 3: Rimuovere il CSS**

In `style.css` eliminare il blocco da `.grid-token-bar {` fino a `.grid-token-chip.ko { opacity: 0.4; }` compreso (subito prima di `.grid-container {`):

```css
.grid-token-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  min-height: 0;
}

.grid-token-chip {
  padding: 0.25rem 0.6rem;
  background: rgba(0,0,0,0.25);
  border: 1px solid var(--border-dim);
  border-radius: 4px;
  color: var(--text-muted);
  font-family: var(--font-heading);
  font-size: 0.78rem;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.grid-token-chip:hover { border-color: var(--border-warm); color: var(--text); }
.grid-token-chip.selected { border-color: var(--gold); color: var(--gold); background: rgba(212,175,94,0.08); }
.grid-token-chip.ko { opacity: 0.4; }
```

- [ ] **Step 4: Verifica statica**

- `node --check src/grid.js` → OK
- `grep -rn "grid-token\|renderTokenBar" index.html src/ app.js style.css` → nessun risultato

- [ ] **Step 5: Commit**

```bash
git add index.html src/grid.js style.css
git commit -m "feat(combat): rimossi i chip token, selezione solo da rail e griglia"
```

---

### Task 2: Toolbar a tutta pagina, dettaglio a destra, cronaca sotto la griglia

Riorganizza il markup della vista combat e il layout CSS. Stato intermedio valido: la cronaca appare come pannello pieno sotto la griglia (diventa fisarmonica nel Task 3).

**Files:**
- Modify: `index.html` (spostamenti: `#combat-toolbar`, `#event-log-section`, `.detail-area`)
- Modify: `style.css:644-647` (sheet-only), `style.css:689-733` (media query desktop/mobile)

- [ ] **Step 1: Spostare `#combat-toolbar` fuori dalla dashboard**

In `index.html`, tagliare l'intero blocco toolbar (oggi dentro `#combat-center`, righe 169-180) e incollarlo tra il banner errori e la dashboard; aggiornare anche i due commenti. Risultato:

```html
    <div id="error-message-combat" class="error-banner hidden"></div>

    <!-- Toolbar azioni a tutta pagina: controlli master a sinistra, scena/nave (tutti) a destra -->
    <div id="combat-toolbar" class="combat-toolbar">
      <div id="master-controls" class="master-controls hidden">
        <button id="btn-next-turn" class="btn-primary btn-next">Turno Successivo ▶</button>
        <button id="btn-reset" class="btn-danger">↺ Reset Incontro</button>
      </div>
      <div class="combat-toolbar-shared">
        <button id="btn-award-xp-open" class="btn-secondary btn-sm hidden">✨ Assegna XP</button>
        <button id="btn-upload-scene" class="btn-secondary btn-sm" title="Carica immagine scena">🖼 Scena</button>
        <button id="btn-toggle-ship" class="btn-secondary btn-sm" title="Apri pannello nave">🚢 Damselfly</button>
      </div>
    </div>

    <!-- Dashboard tattica: rail turni | griglia + cronaca | dettaglio -->
    <div class="dashboard">
```

- [ ] **Step 2: Spostare `#event-log-section` dentro `#combat-center`**

Tagliare l'intero blocco (oggi terzo figlio di `.dashboard`, righe 235-242):

```html
      <!-- Log eventi -->
      <section id="event-log-section" class="event-log-section">
        <div class="event-log-header">
          <span class="event-log-title">📜 Log Eventi</span>
          <button id="btn-clear-log" class="btn-clear-log" title="Cancella log">🗑</button>
        </div>
        <div id="event-log" class="event-log"></div>
      </section>
```

e incollarlo dentro `#combat-center`, subito dopo `</section>` che chiude `#grid-section` e prima di `</div><!-- /#combat-center -->`.

- [ ] **Step 3: Spostare `.detail-area` dentro la dashboard**

Tagliare il blocco (oggi dopo `</div><!-- /.dashboard -->`, righe 246-250):

```html
    <!-- Dettaglio combattente selezionato -->
    <div class="detail-area">
      <ol id="detail-list" class="combatant-list combatant-detail"></ol>
      <p id="empty-detail-msg" class="empty-msg hidden">Seleziona un combattente.</p>
    </div>
```

e incollarlo come terzo figlio di `.dashboard` (dove stava `#event-log-section`), tra `</div><!-- /#combat-center -->` e `</div><!-- /.dashboard -->`. Struttura finale:

```html
    <header class="combat-header">…</header>
    <div id="error-message-combat" class="error-banner hidden"></div>
    <div id="combat-toolbar" class="combat-toolbar">…</div>
    <div class="dashboard">
      <aside id="turn-rail" class="turn-rail">…</aside>
      <div id="combat-center" class="combat-center">
        <div id="ship-panel" class="hidden"></div>
        <section id="scene-section" …>…</section>
        <section id="grid-section" …>…</section>
        <section id="event-log-section" …>…</section>
      </div><!-- /#combat-center -->
      <div class="detail-area">…</div>
    </div><!-- /.dashboard -->
    <div class="combat-cols">…</div>
```

- [ ] **Step 4: Nascondere la toolbar in modalità sheet-only fuori sessione**

In `style.css`, al blocco (righe 644-647):

```css
body.sheet-only:not(.in-combat) .combat-header  { display: none; }
body.sheet-only:not(.in-combat) .dashboard      { display: none; }
```

aggiungere subito dopo la riga del `.combat-header`:

```css
body.sheet-only:not(.in-combat) #combat-toolbar { display: none; }
```

(la regola esistente su `.detail-area` resta: è ridondante ma innocua.)

- [ ] **Step 5: Aggiornare la media query desktop (≥1100px)**

In `style.css` sostituire dentro `@media (min-width: 1100px)` (righe 689-708):

```css
  .dashboard {
    display: grid;
    grid-template-columns: 84px minmax(0, 1fr) 280px;
    align-items: start;
  }
  .turn-rail { position: sticky; top: 0.5rem; }
  #event-log-section { max-height: min(70vh, 640px); overflow-y: auto; }
```

con:

```css
  .dashboard {
    display: grid;
    grid-template-columns: 84px minmax(0, 1fr) 340px;
    align-items: start;
  }
  .turn-rail { position: sticky; top: 0.5rem; }
  .detail-area { position: sticky; top: 0.5rem; }
```

e nello stesso blocco eliminare la riga:

```css
  .detail-area { max-width: 900px; margin: 0 auto; width: 100%; }
```

- [ ] **Step 6: Aggiornare la media query mobile (<1100px)**

In `style.css` sostituire (righe 710-723):

```css
/* Mobile: ordine Turni → Mia card/dettaglio → Griglia → Altri → Cronaca.
   display:contents fa partecipare rail/center/cronaca direttamente
   all'ordine flex di #view-combat (il dettaglio è fuori da .dashboard) */
@media (max-width: 1099px) {
  #view-combat { display: flex; flex-direction: column; }
  .dashboard       { display: contents; }
  .combat-header   { order: 0; }
  #error-message-combat { order: 1; }
  .turn-rail       { order: 2; }
  .detail-area     { order: 3; }
  .combat-center   { order: 4; }
  .combat-cols     { order: 5; }
  #event-log-section { order: 6; }
  #session-notes-section { order: 7; }
```

con:

```css
/* Mobile: ordine Toolbar → Turni → Mia card/dettaglio → Griglia (+cronaca) → Altri.
   display:contents fa partecipare i figli della dashboard direttamente
   all'ordine flex di #view-combat */
@media (max-width: 1099px) {
  #view-combat { display: flex; flex-direction: column; }
  .dashboard       { display: contents; }
  .combat-header   { order: 0; }
  #error-message-combat { order: 1; }
  #combat-toolbar  { order: 2; }
  .turn-rail       { order: 3; }
  .detail-area     { order: 4; }
  .combat-center   { order: 5; }
  .combat-cols     { order: 6; }
  #session-notes-section { order: 7; }
```

(la riga `#event-log-section { order: 6; }` sparisce: la cronaca ora viaggia dentro `#combat-center`.)

- [ ] **Step 7: Verifica statica**

- `grep -c "combat-toolbar" index.html` → 1; la riga `id="combat-toolbar"` deve venire PRIMA di `class="dashboard"` (`grep -n 'combat-toolbar\|class="dashboard"\|detail-area\|event-log-section' index.html` e controllare l'ordine: toolbar → dashboard → event-log-section → detail-area)
- `grep -n "event-log-section { order" style.css` → nessun risultato
- `grep -n "minmax(0, 1fr) 340px" style.css` → presente

- [ ] **Step 8: Commit**

```bash
git add index.html style.css
git commit -m "feat(combat): toolbar a tutta pagina, dettaglio a destra della griglia, log sotto la griglia"
```

---

### Task 3: Cronaca a fisarmonica con badge eventi non letti

**Files:**
- Modify: `index.html` (markup `#event-log-section`)
- Modify: `style.css:3169-3216` (blocchi `.event-log-section`, `.event-log-header`, `.event-log-title`, `.event-log`)
- Modify: `src/UI.js` (badge non letti, hook in `renderLogs`, export `markLogsSeen`)
- Modify: `app.js` (listener toggle, vicino a `btn-clear-log` riga ~538)

- [ ] **Step 1: Nuovo markup della sezione**

In `index.html` sostituire l'intero blocco `#event-log-section` (dentro `#combat-center` dopo il Task 2) con:

```html
        <!-- Cronaca (fisarmonica sotto la griglia, default chiusa) -->
        <section id="event-log-section" class="event-log-section collapsed">
          <div id="event-log-header" class="event-log-header">
            <span class="event-log-title">📜 Cronaca</span>
            <span id="event-log-badge" class="event-log-badge hidden"></span>
            <span class="event-log-flex-spacer"></span>
            <button id="btn-clear-log" class="btn-clear-log" title="Cancella log">🗑</button>
            <span id="event-log-chevron" class="event-log-chevron">▾</span>
          </div>
          <div id="event-log" class="event-log"></div>
        </section>
```

- [ ] **Step 2: CSS della fisarmonica**

In `style.css` sostituire i blocchi `.event-log-section`, `.event-log-header`, `.event-log-title` (righe 3169-3193) con:

```css
.event-log-section {
  background: var(--bg-panel);
  border: 1px solid var(--border-dim);
  border-radius: var(--radius);
  box-shadow: inset 0 0 24px rgba(0,0,0,0.3);
  display: flex;
  flex-direction: column;
}

.event-log-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.85rem;
  cursor: pointer;
  user-select: none;
}
.event-log-header:hover .event-log-title { color: var(--gold); }

.event-log-title {
  font-family: 'Cinzel', serif;
  font-size: 0.95rem;
  color: var(--gold-light);
  transition: color 0.15s;
}

.event-log-flex-spacer { flex: 1; }

.event-log-badge {
  background: var(--wax);
  color: var(--text);
  border-radius: 999px;
  font-size: 0.72rem;
  line-height: 1;
  padding: 0.22rem 0.5rem;
}

.event-log-chevron { color: var(--text-muted); font-size: 0.8rem; }

.event-log-section.collapsed .event-log { display: none; }
.event-log-section.collapsed .btn-clear-log { display: none; }
```

(i blocchi `.btn-clear-log` e `.btn-clear-log:hover` esistenti restano invariati.)

Poi nel blocco `.event-log` sostituire:

```css
.event-log {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-height: 400px;
```

con:

```css
.event-log {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0 0.85rem 0.85rem;
  max-height: 220px;
```

- [ ] **Step 3: Badge non letti in `src/UI.js`**

Subito prima di `let lastLogId = null;` (riga ~151) aggiungere:

```js
// ─── Badge eventi non letti (cronaca a fisarmonica, stato per client) ────────
let _logTotal    = 0;
let _logSeen     = 0;
let _logSeenInit = false;

function _updateLogBadge() {
  const badge   = document.getElementById('event-log-badge');
  const section = document.getElementById('event-log-section');
  if (!badge || !section) return;
  if (_logSeen > _logTotal) _logSeen = _logTotal;                       // log cancellati
  if (!section.classList.contains('collapsed')) _logSeen = _logTotal;  // aperta: tutto visto
  const unseen = _logTotal - _logSeen;
  badge.textContent = unseen > 99 ? '99+' : String(unseen);
  badge.classList.toggle('hidden', unseen === 0);
}

export function markLogsSeen() {
  _logSeen = _logTotal;
  _updateLogBadge();
}
```

- [ ] **Step 4: Hook in `renderLogs`**

In `renderLogs` (stesso file) sostituire:

```js
  if (!logsObj) return;

  // Ordina i log per timestamp decrescente (più recenti in alto)
  const logsArray = Object.values(logsObj).sort((a, b) => b.timestamp - a.timestamp);
```

con:

```js
  // Ordina i log per timestamp decrescente (più recenti in alto)
  const logsArray = Object.values(logsObj || {}).sort((a, b) => b.timestamp - a.timestamp);

  // Badge non letti: al primo render i log già presenti contano come visti
  _logTotal = logsArray.length;
  if (!_logSeenInit) { _logSeenInit = true; _logSeen = _logTotal; }
  _updateLogBadge();
```

(`renderLogs` viene chiamata solo dal listener di sessione: qui si fa solo render, nessuna scrittura — regola invariata.)

- [ ] **Step 5: Toggle in `app.js`**

Subito dopo il listener di `btn-clear-log` (riga ~538-542) aggiungere:

```js
document.getElementById('event-log-header').addEventListener('click', (e) => {
  if (e.target.closest('#btn-clear-log')) return;
  const section   = document.getElementById('event-log-section');
  const collapsed = section.classList.toggle('collapsed');
  document.getElementById('event-log-chevron').textContent = collapsed ? '▾' : '▴';
  if (!collapsed) UI.markLogsSeen();
});
```

(`UI` è già importato in testa: `import * as UI from './src/UI.js'`.)

- [ ] **Step 6: Verifica statica**

- `node --check src/UI.js && node --check app.js` → OK
- `grep -c "event-log-badge" index.html` → 1; `grep -c "event-log-badge" src/UI.js` → 1
- `grep -l "collapsed" index.html style.css src/UI.js app.js` → tutti e quattro i file

- [ ] **Step 7: Commit**

```bash
git add index.html style.css src/UI.js app.js
git commit -m "feat(combat): cronaca a fisarmonica sotto la griglia con badge eventi non letti"
```

---

### Task 4: Header sottile

Solo CSS, markup invariato.

**Files:**
- Modify: `style.css:539-550` (`.combat-header`), `style.css:586-591` (`.round-display`)

- [ ] **Step 1: Togliere la cornice all'header**

Sostituire:

```css
.combat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-card);
  border: 1px solid var(--border-warm);
  border-top: 1px solid rgba(255,255,255,0.06);
  border-radius: var(--radius);
  padding: 0.7rem 1rem;
  box-shadow: var(--shadow), inset 0 1px 0 rgba(255,255,255,0.04);
  gap: 0.5rem;
}
```

con:

```css
/* Header sottile: solo testo, la presenza visiva va alla toolbar sottostante */
.combat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 0.25rem;
  gap: 0.5rem;
}
```

- [ ] **Step 2: Round in evidenza con fregi**

Sostituire:

```css
.round-display {
  font-family: 'Cinzel', serif;
  font-size: 0.95rem;
  color: var(--gold-light);
  white-space: nowrap;
}
```

con:

```css
.round-display {
  font-family: 'Cinzel', serif;
  font-size: 1.05rem;
  letter-spacing: 0.08em;
  color: var(--gold-light);
  white-space: nowrap;
}
.round-display::before { content: '⚜  '; color: var(--gold-dim); font-size: 0.8em; }
.round-display::after  { content: '  ⚜'; color: var(--gold-dim); font-size: 0.8em; }
```

- [ ] **Step 3: Verifica statica**

`grep -n "round-display::before" style.css` → presente; ricaricare la pagina non deve mostrare più la card di sfondo dietro "Sessione | Round | Esci".

- [ ] **Step 4: Commit**

```bash
git add style.css
git commit -m "feat(combat): header sottile senza cornice, round in evidenza"
```

---

### Task 5: Aggiornare CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (tabella architettura e bullet redesign in "### Completato")

- [ ] **Step 1: Tre aggiornamenti puntuali**

1. Nella tabella "Architettura file", riga `src/grid.js`: sostituire `` `renderGrid`, `renderTokenBar` `` con `` `renderGrid` ``.
2. Nel bullet lungo `- Redesign "Grimorio miniato"`: sostituire il frammento `cronaca laterale, pannello dettaglio (`#detail-list`) che mostra` con `cronaca a fisarmonica sotto la griglia (default chiusa, badge eventi non letti per client, toggle in app.js), pannello dettaglio (`#detail-list`) a destra della griglia (terza colonna ~340px sticky) che mostra`.
3. Stesso bullet: sostituire il frammento `header combat a una riga (sessione | round | esci) con toolbar azioni `#combat-toolbar` in cima a `#combat-center`` con `header combat sottile senza cornice (sessione | round in evidenza | esci) con toolbar azioni `#combat-toolbar` a tutta pagina tra header e dashboard (su mobile subito dopo l'header)`.
4. In coda allo stesso bullet (dopo `; zoom griglia a bottoni in .grid-zoom-controls visibile a tutti`) aggiungere: `; chip token (#grid-token-bar) rimossi: selezione e piazzamento solo da rail iniziativa e griglia`.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: stato implementazione aggiornato (layout dashboard combat)"
```

---

### Verifica manuale finale (utente, con Firebase reale)

1. **Desktop master:** header sottile col round centrato; toolbar a tutta pagina; rail e griglia partono alla stessa altezza; dettaglio a destra (selezionato o turno attivo); niente chip sopra la griglia.
2. **Cronaca:** chiusa di default (una riga); un evento nuovo fa comparire il badge; aprendola il badge sparisce e il log scorre (max ~220px); 🗑 visibile solo da aperta e funziona; il toggle non scrive nulla su Firebase.
3. **Piazzamento senza chip:** master seleziona una creatura non piazzata dalla rail → tocca una casella → si piazza; idem player col proprio PG.
4. **Scena/nave:** si scambiano ancora con la griglia nello slot centrale, sotto la toolbar.
5. **Mobile (<1100px):** ordine header → toolbar → rail → dettaglio → griglia+cronaca → altri; fisarmonica funzionante; sheet-only fuori sessione non mostra la toolbar.
6. **Desktop stretto (~1100-1250px):** la griglia si comprime ma resta usabile con le tre colonne.
