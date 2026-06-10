# Combat header, toolbar, modal XP e rail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Header del combat ridotto a una riga (sessione | round | esci), nuova toolbar azioni sopra la griglia, flusso "Assegna XP" in un modal pergamena con importi rapidi e log in cronaca, rail Iniziativa senza distanze.

**Architecture:** Solo HTML/CSS/JS vanilla, nessun bundler. I controlli master escono dall'header e diventano `#combat-toolbar` in cima a `#combat-center` (fuori dai pannelli griglia/nave/scena che si scambiano). Gli id esistenti (`btn-next-turn`, `btn-reset`, `btn-upload-scene`, `btn-toggle-ship`, `select-progression-mode-live`, `master-controls`, `xp-award-players`, `input-xp-amount`, `btn-award-xp`) vengono preservati così gli event listener di `app.js` e il toggle in `UI.js:209` continuano a funzionare.

**Tech Stack:** HTML + CSS + ES6 modules, Firebase Realtime Database. **Non esiste una suite di test automatici**: ogni task si verifica a mano nel browser (serve un `config.js` reale; avvia con `python3 -m http.server 8080` dalla root e apri `http://localhost:8080`).

**Spec:** `docs/superpowers/specs/2026-06-10-combat-header-xp-rail-design.md`

---

### Task 1: Header a una riga + toolbar + markup del modal XP

Il markup del modal XP entra già in questo task (anche se il comportamento arriva nel Task 2) perché `app.js:747` fa `document.getElementById('btn-award-xp').addEventListener(...)` senza optional chaining: se rimuovessimo il form dall'header senza reintrodurre quegli id, l'app andrebbe in errore al caricamento.

**Files:**
- Modify: `index.html:140-171` (header), `index.html:185` (toolbar in `#combat-center`), `index.html:~610` (modal XP dopo `#add-combatant-modal`)
- Modify: `style.css:1298-1303` (`.master-controls`), `style.css:1421-1423` (override 600px), `style.css:1429-1435` (`.combat-header-right`, da rimuovere)
- Modify: `app.js:1058` (toggle visibilità bottone XP per modalità progressione)

- [ ] **Step 1: Sostituire l'header in `index.html`**

Sostituire l'intero blocco `<header class="combat-header">…</header>` (righe 140-171, contiene `.combat-header-right` e `#master-controls`) con:

```html
    <header class="combat-header">
      <div class="session-info">
        <span class="session-label">Sessione:</span>
        <span id="session-code-display" class="session-code"></span>
        <button id="btn-copy-code" class="btn-copy" title="Copia codice">📋 Copia</button>
      </div>
      <span id="round-display" class="round-display">Round 1</span>
      <button id="btn-exit-session" class="btn-exit-session" title="Esci dalla sessione">← Esci</button>
    </header>
```

- [ ] **Step 2: Aggiungere la toolbar in cima a `#combat-center`**

In `index.html`, subito dopo `<div id="combat-center" class="combat-center">` (riga ~185, prima del commento del pannello nave), inserire:

```html
        <!-- Toolbar azioni: controlli master a sinistra, scena/nave (tutti) a destra -->
        <div id="combat-toolbar" class="combat-toolbar">
          <div id="master-controls" class="master-controls hidden">
            <button id="btn-next-turn" class="btn-primary btn-next">Turno Successivo ▶</button>
            <button id="btn-award-xp-open" class="btn-secondary btn-sm">✨ Assegna XP</button>
            <select id="select-progression-mode-live" class="btn-secondary btn-sm" title="Modalità progressione">
              <option value="xp">XP</option>
              <option value="milestone">Milestone</option>
            </select>
            <button id="btn-reset" class="btn-danger">↺ Reset Incontro</button>
          </div>
          <div class="combat-toolbar-shared">
            <button id="btn-upload-scene" class="btn-secondary btn-sm" title="Carica immagine scena">🖼 Scena</button>
            <button id="btn-toggle-ship" class="btn-secondary btn-sm" title="Apri pannello nave">🚢 Damselfly</button>
          </div>
        </div>
```

Nota: `#master-controls` mantiene lo stesso id — `UI.renderMasterPanel` (`src/UI.js:209`) continua a mostrarlo/nasconderlo senza modifiche. `🖼` e `🚢` restano visibili a tutti come oggi.

- [ ] **Step 3: Aggiungere il markup del modal XP**

In `index.html`, dopo la chiusura di `#add-combatant-modal` (riga ~610, prima del commento del modal condizioni), inserire:

```html
  <!-- ═══════════════════════════════════════════════
       MODAL — assegna XP (solo master, modalità XP)
  ═══════════════════════════════════════════════ -->
  <div id="xp-award-modal" class="modal hidden" role="dialog" aria-modal="true" aria-label="Assegna punti esperienza">
    <div class="modal-content">
      <h3>✨ Assegna Punti Esperienza</h3>
      <div id="xp-award-players" class="xp-award-players"></div>
      <div class="xp-quick-row">
        <button type="button" class="btn-secondary btn-sm xp-quick" data-xp="25">+25</button>
        <button type="button" class="btn-secondary btn-sm xp-quick" data-xp="50">+50</button>
        <button type="button" class="btn-secondary btn-sm xp-quick" data-xp="100">+100</button>
        <button type="button" class="btn-secondary btn-sm xp-quick" data-xp="250">+250</button>
        <button type="button" class="btn-secondary btn-sm xp-quick" data-xp="500">+500</button>
      </div>
      <input type="number" id="input-xp-amount" min="0" placeholder="XP a ciascuno">
      <p id="xp-award-preview" class="xp-award-preview"></p>
      <div class="input-row">
        <button id="btn-award-xp" class="btn-primary" disabled>Assegna</button>
        <button id="btn-xp-award-close" class="btn-secondary">Annulla</button>
      </div>
    </div>
  </div>
```

- [ ] **Step 4: Aggiornare il CSS**

In `style.css`:

1. Sostituire il blocco `.master-controls` (righe 1298-1303) con:

```css
.combat-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  background: var(--bg-card);
  border: 1px solid var(--border-warm);
  border-radius: var(--radius);
  padding: 0.5rem 0.75rem;
  box-shadow: var(--shadow), inset 0 1px 0 rgba(255,255,255,0.04);
}

.master-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

.combat-toolbar-shared {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}
```

2. Rimuovere l'override nel media query 600px (righe 1421-1423: `.master-controls { padding: 0; }`).
3. Rimuovere il blocco `.combat-header-right` (righe 1429-1435) — il wrapper non esiste più nell'HTML.
4. Vicino a `.xp-award-players` (riga 2346) aggiungere:

```css
.xp-quick-row     { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.xp-award-preview { min-height: 1.1em; margin: 0; font-size: 0.85rem; font-style: italic; color: var(--text-muted); }
#btn-award-xp:disabled { opacity: 0.5; cursor: default; }
```

- [ ] **Step 5: Aggiornare il toggle di visibilità del bottone XP in `app.js`**

`#xp-award-section` non esiste più. A riga ~1058 sostituire:

```js
document.getElementById('xp-award-section')?.classList.toggle('hidden', (data.progressionMode ?? 'xp') !== 'xp');
```

con:

```js
document.getElementById('btn-award-xp-open')?.classList.toggle('hidden', (data.progressionMode ?? 'xp') !== 'xp');
```

- [ ] **Step 6: Verifica manuale**

Avviare `python3 -m http.server 8080`, creare una sessione da master e controllare:
- header su una riga: sessione | Round N | Esci; nessun controllo master nell'header
- toolbar sopra la griglia: Turno Successivo, ✨ Assegna XP, select XP/Milestone, Reset a sinistra; 🖼 Scena e 🚢 Damselfly a destra
- aprendo la nave (🚢) la toolbar resta visibile e il toggle richiude
- da giocatore (finestra in incognito): nella toolbar si vedono solo 🖼 e 🚢
- in modalità Milestone il bottone ✨ sparisce
- nessun errore in console al caricamento

- [ ] **Step 7: Commit**

```bash
git add index.html style.css app.js
git commit -m "feat(combat): header a una riga e toolbar azioni sopra la griglia"
```

---

### Task 2: Comportamento del modal "Assegna XP"

**Files:**
- Modify: `app.js:747-753` (handler `btn-award-xp`), `app.js:982-986` (vicino al wiring del modal add-combatant), `app.js:1059-1070` (render `xp-award-players` nel listener realtime, da rimuovere)

- [ ] **Step 1: Rimuovere il render dei giocatori dal listener realtime**

In `app.js` (righe ~1059-1070), eliminare il blocco che popola `#xp-award-players` ad ogni snapshot (la lista ora si popola all'apertura del modal):

```js
    const onlyPlayers = sorted.filter(c => c.type === 'player');
    const xpPlayersEl = document.getElementById('xp-award-players');
    if (xpPlayersEl && isMaster) {
      xpPlayersEl.innerHTML = onlyPlayers.map(c => {
        const xp  = data.xp?.[c.id] ?? 0;
        const lvl = c.level ?? 1;
        return `<label class="xp-player-row">
          <input type="checkbox" class="xp-player-check" data-id="${c.id}" checked>
          ${esc(c.name)} <span class="xp-player-meta">Lv.${lvl} — ${xp.toLocaleString('it')} XP</span>
        </label>`;
      }).join('');
    }
```

Lasciare intatte le righe che sincronizzano `selLive.value` e il toggle di `btn-award-xp-open`.

- [ ] **Step 2: Aggiungere apertura, popolamento, anteprima e bottoni rapidi**

In `app.js`, dopo il wiring del modal add-combatant (riga ~986), aggiungere:

```js
// Modal "Assegna XP" (aperto dalla toolbar, solo master in modalità XP)
const _xpModal = document.getElementById('xp-award-modal');

function _joinNames(names) {
  return names.length > 1 ? names.slice(0, -1).join(', ') + ' e ' + names.at(-1) : (names[0] ?? '');
}

function _updateXpPreview() {
  const amount = parseInt(document.getElementById('input-xp-amount').value) || 0;
  const names  = [...document.querySelectorAll('.xp-player-check:checked')].map(cb => cb.dataset.name);
  const valid  = amount > 0 && names.length > 0;
  document.getElementById('xp-award-preview').textContent = valid ? `→ ${amount} XP a ${_joinNames(names)}` : '';
  document.getElementById('btn-award-xp').disabled = !valid;
}

function _openXpModal() {
  const data = state.snapshot;
  if (!data) return;
  const players = state.tracker.sortedCombatants(data.combatants).filter(c => c.type === 'player');
  document.getElementById('xp-award-players').innerHTML = players.map(c => {
    const xp  = data.xp?.[c.id] ?? 0;
    const lvl = c.level ?? 1;
    return `<label class="xp-player-row">
      <input type="checkbox" class="xp-player-check" data-id="${c.id}" data-name="${esc(c.name)}" checked>
      ${esc(c.name)} <span class="xp-player-meta">Lv.${lvl} — ${xp.toLocaleString('it')} XP</span>
    </label>`;
  }).join('');
  document.getElementById('input-xp-amount').value = '';
  _updateXpPreview();
  _xpModal.classList.remove('hidden');
}

document.getElementById('btn-award-xp-open').addEventListener('click', _openXpModal);
document.getElementById('btn-xp-award-close').addEventListener('click', () => _xpModal.classList.add('hidden'));
_xpModal.addEventListener('click', (e) => { if (e.target === _xpModal) _xpModal.classList.add('hidden'); });
_xpModal.addEventListener('input', _updateXpPreview);
_xpModal.addEventListener('change', _updateXpPreview);
_xpModal.querySelectorAll('.xp-quick').forEach(btn => btn.addEventListener('click', () => {
  const inp = document.getElementById('input-xp-amount');
  inp.value = (parseInt(inp.value) || 0) + parseInt(btn.dataset.xp);
  _updateXpPreview();
}));
```

Nota: `esc`, `state` e `state.tracker` sono già importati/disponibili in `app.js` (vedi uso a riga ~1067 e ~972).

- [ ] **Step 3: Estendere l'handler di assegnazione con log e chiusura**

Sostituire l'handler esistente di `btn-award-xp` (`app.js:747-753`) con:

```js
document.getElementById('btn-award-xp').addEventListener('click', async () => {
  const amount = parseInt(document.getElementById('input-xp-amount')?.value) || 0;
  if (!amount || !state.session) return;
  const checked = [...document.querySelectorAll('.xp-player-check:checked')];
  if (!checked.length) return;
  for (const cb of checked) await state.session.addXp(cb.dataset.id, amount);
  const names = checked.map(cb => cb.dataset.name);
  state.session.addLogEvent(`Il master ha assegnato ${amount} XP a ${_joinNames(names)}`, 'info', { amount });
  document.getElementById('input-xp-amount').value = '';
  _xpModal.classList.add('hidden');
});
```

Il log segue il pattern "scrivere log solo nelle azioni utente" (CLAUDE.md): nessuna scrittura nel listener realtime. Attenzione: `_joinNames` e `_xpModal` sono definiti nel blocco dello Step 2, che nel file deve comparire prima di questo handler oppure essere funzioni/const top-level dichiarate prima dell'uso a runtime (l'handler scatta solo al click, quindi basta che siano definiti al load — lo sono, essendo top-level).

- [ ] **Step 4: Verifica manuale**

Da master in modalità XP:
- ✨ apre il modal: tutti i giocatori selezionati con meta `Lv.X — N XP`
- i bottoni rapidi sommano (+100 due volte → 200); l'anteprima mostra "→ 200 XP a Theren e Mirka"
- deselezionando tutti o con importo 0 il bottone Assegna è disabilitato e l'anteprima sparisce
- Assegna: gli XP risultano sulle card dei giocatori, in cronaca compare "Il master ha assegnato …", il modal si chiude
- riaprendo il modal: campo vuoto, lista aggiornata con i nuovi totali XP
- chiusura con Annulla e con click sul backdrop

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat(combat): modal Assegna XP con importi rapidi, anteprima e log in cronaca"
```

---

### Task 3: Rail Iniziativa senza distanze

**Files:**
- Modify: `src/GridUI.js:286-328` (`renderInitiativeList`)
- Modify: `style.css:2670` (`.rail-dist`)

- [ ] **Step 1: Rimuovere il calcolo distanza dalla rail**

In `src/GridUI.js`, dentro `renderInitiativeList`, eliminare le righe:

```js
  const pos  = gridPos || {};
  const comb = combatants || {};
  const referenceId = selectedId || myCombatantId;
  const refPos  = referenceId ? pos[referenceId] : null;
  const refSide = referenceId ? footprintOf(comb[referenceId]?.size) : 1;
```

e, nel loop, le righe:

```js
    const cPos = pos[c.id];

    let distText = '';
    if (refPos && cPos && c.id !== referenceId) {
      const d = squareDistance(refPos.col, refPos.row, refSide, cPos.col, cPos.row, footprintOf(c.size));
      distText = `<span class="rail-dist">${fmtM(d)}</span>`;
    }
```

e togliere `${distText}` dal template del `<li>`. La firma della funzione resta invariata (i parametri `gridPos`, `myCombatantId`, `combatants` rimangono, anche se ora inutilizzati, per non toccare il call site in `src/grid.js:30`). `squareDistance` e `fmtM` restano esportati/usati da `renderGrid` per le etichette sopra i token: **non rimuoverli**.

- [ ] **Step 2: Rimuovere il CSS `.rail-dist`**

In `style.css` eliminare la riga 2670:

```css
.rail-dist { font-size: 0.6rem; color: var(--gold-dim); }
```

- [ ] **Step 3: Verifica manuale**

Con due token sulla griglia: selezionandone uno, la rail mostra solo ritratto + mini-barra HP + nome (niente metri); le etichette di distanza **sopra i token della griglia** compaiono ancora quando un token è selezionato.

- [ ] **Step 4: Commit**

```bash
git add src/GridUI.js style.css
git commit -m "fix(rail): rimosse le distanze dalla lista iniziativa"
```

---

### Task 4: Verifica visibilità HP/CA + aggiornamento CLAUDE.md

Nessuna modifica al codice di visibilità (spec §5): il problema riportato era un artefatto di test (due schede anonime nello stesso browser condividono lo uid Firebase, quindi la scheda "giocatore" era il master).

**Files:**
- Modify: `CLAUDE.md` (sezione "Stato implementazione" e bullet del redesign)

- [ ] **Step 1: Verifica manuale in incognito**

Master in finestra normale, giocatore ospite in **finestra in incognito** (uid diverso). Con una creatura in sessione, dal lato giocatore confermare:
- non vede i bottoni "👁 Stato salute" né "🛡 CA" (né nelle card né nel pannello dettaglio)
- non vede barra/numeri HP della creatura; con `showHealthHint` attivo vede solo l'hint qualitativo
- non vede la CA della creatura finché il master non attiva "CA visibile"
- nella rail la mini-barra HP della creatura non è visibile

Se uno di questi punti fallisce, fermarsi e indagare con la skill superpowers:systematic-debugging prima di procedere (sarebbe un bug reale, non previsto dalla spec).

- [ ] **Step 2: Aggiornare CLAUDE.md**

Nella sezione "Completato", aggiornare il bullet del redesign aggiungendo in coda:

```
; header combat a una riga (sessione | round | esci) con toolbar azioni `#combat-toolbar` in cima a `#combat-center` (master: turno/XP/progressione/reset; tutti: scena/nave); assegnazione XP nel modal `#xp-award-modal` (importi rapidi, anteprima, log in cronaca, lista popolata all'apertura); rail iniziativa senza distanze (restano le etichette sui token della griglia)
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: stato implementazione aggiornato (toolbar, modal XP, rail)"
```
