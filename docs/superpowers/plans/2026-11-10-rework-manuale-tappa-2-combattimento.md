# Rework "Manuale" — Tappa 2: Combattimento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La schermata di combattimento passa al layout a tre livelli del mockup approvato (iniziativa · mappa con quattro strumenti · dock, tutto il resto nel menu), con lo strumento Traiettoria nuovo e senza perdere nessuna funzione.

**Architecture:** Ricomposizione, non riscrittura. Tutti gli elementi che oggi hanno un `id` e un handler (`#btn-rest-short`, `#grid-draw-palette`, `#creature-list`, `#panel-side`, …) restano gli stessi nodi con gli stessi handler: cambiano solo dove stanno nel markup e quando sono visibili. La visibilità è guidata da un piccolo stato di interfaccia locale (`state.ui`) e da attributi `data-*` su `#view-combat` che il CSS legge. La logica pura nuova (quale strumento è attivo, densità dell'iniziativa, distanza della traiettoria) sta in `src/logic/` ed è testata in pagina.

**Tech Stack:** HTML + CSS + moduli ES6, nessun bundler. Test = pagine in `test/` eseguite con Chrome headless (`python3 -m http.server 8000`, poi `--headless=new --dump-dom` e lettura di `#summary`).

**Spec:** `docs/superpowers/specs/2026-11-10-rework-manuale-design.md` · mockup approvato `docs/superpowers/specs/2026-11-10-rework-manuale-mockup-combattimento.html` (fotogrammi 1, 2, 3, 3b, 4, 5, 6) · aree e traiettorie: prima sezione di `2026-11-10-rework-manuale-mockup.html`.

## Global Constraints

- **Parità funzionale**: ogni voce "Testata combattimento", "Combattenti", "Dock", "Mappa", "Cronache e log" dell'inventario in fondo alla spec deve restare raggiungibile. Spostare va bene, togliere no.
- **Nessun `id`, `data-action`, `data-path`, `data-draw-tool`, `data-shape`, `data-color` rinominato o rimosso.** Un nodo si sposta intero; il suo handler non si riscrive.
- **Pattern di concorrenza di `CLAUDE.md` alla lettera**: nessuna scrittura Firebase nel listener di sessione; `captureFocusState`/`restoreFocusState` su ogni rebuild `innerHTML` che contiene campi; controlli statici non sovrascritti mentre l'utente li modifica; stato locale azzerato in `exitToHome`; ogni `onValue` conservato e staccato.
- Lo stato di interfaccia nuovo è **locale al client** (mai su Firebase), tranne la traiettoria.
- Solo variabili `--c-*` / `--f-*` nel CSS nuovo; icone solo con `icon()` da `src/ui/icons.js`. A fine tappa nessuna emoji nei file della schermata di combattimento.
- Un solo `.btn--primary` visibile per ruolo: "Fine turno" (giocatore, solo nel suo turno) o "Turno successivo" (master).
- I `confirm()` nativi restano dove sono (sostituirli non è in questa tappa).
- Ramo `rework-manuale`, niente push. Commit in italiano con le righe di attribuzione della sessione.

## Review Focus

1. Un altro giocatore agisce (snapshot in arrivo) mentre ho aperto menu, popover incantesimi, pannello dettaglio o riga opzioni → restano aperti, e un campo in modifica dentro il dettaglio non perde focus né testo. *(verifica Task 3 passo 6, Task 4 passo 6)*
2. Il combattente aperto nel dettaglio viene rimosso da un altro client → il pannello si chiude da solo, nessun errore. *(test Task 1: `detailStillValid`; verifica Task 4)*
3. Cambio strumento a metà di un'azione (origine area già fissata, forma in trascinamento, traiettoria con solo il primo punto) → l'azione a metà viene annullata, nessun residuo sulla mappa. *(test Task 1: `toolTransition`; verifica Task 5)*
4. Traiettoria verso un combattente che poi viene rimosso o tolto dalla mappa, o da un giocatore che esce → la freccia sparisce, non resta appesa né genera errori di render. *(test Task 7: `trajectoryEndpoints`)*
5. Larghezze intermedie (tablet ~800px, telefono in orizzontale) → nessun comando irraggiungibile, nessuno scorrimento orizzontale della pagina. *(verifica Task 9)*

## File Structure

| File | Cosa cambia |
|---|---|
| `src/logic/combatChrome.js` (nuovo) | Logica pura dell'interfaccia: strumento attivo, transizioni, densità iniziativa, validità del dettaglio |
| `src/logic/trajectory.js` (nuovo) | Logica pura della traiettoria: estremi in coordinate griglia e distanza |
| `src/ui/CombatChrome.js` (nuovo) | Applica `state.ui` al DOM (attributi `data-*`, apertura/chiusura pannelli), lega i comandi nuovi |
| `src/utils/state.js` | Aggiunge `state.ui` e `state.trajectoryFrom` |
| `index.html` | Ricomposizione di `#view-combat`; via il blocco `<style>` inline della vista combat (va in `styles/combat.css`) e lo script dei tab |
| `styles/combat.css`, `styles/grid.css` | Layout nuovo; via le variabili alias in questi due file |
| `src/ui/UI.js` | Dock (icone, bottone Incantesimi, primario), righe iniziativa "Dettagli", emoji → `icon()` |
| `src/ui/GridUI.js`, `src/logic/grid.js` | Resa dell'area, traiettoria, lista iniziativa a due densità, emoji → `icon()` |
| `src/data/Session.js` | `setTrajectory` / `clearTrajectory` / `clearAllTrajectories` |
| `app.js` | Aggancio di `CombatChrome`, pulizia traiettorie nelle azioni utente, emoji → `icon()` |
| `src/views/core.js` | `exitToHome` azzera `state.ui` e `state.trajectoryFrom` |
| `test/combatChrome.html`, `test/trajectory.html` (nuovi) | Test in pagina |

---

### Task 1: Stato dell'interfaccia (logica pura)

**Files:** Create `src/logic/combatChrome.js`, `test/combatChrome.html`. Modify `src/utils/state.js`.

**Interfaces — Produces:**
- `state.ui = { tool: 'move', menuOpen: false, drawer: null, detailId: null, spellsOpen: false, initSheetOpen: false }` — `drawer`: `null | 'detail' | 'log' | 'notes'`.
- `state.trajectoryFrom = null` (id del combattente di partenza mentre si traccia).
- `TOOLS = ['move', 'area', 'traj', 'draw', 'walls']`.
- `toolTransition(prev, next): { tool, reset: string[] }` — `tool` = `next`, tranne riclic sullo strumento attivo diverso da `move` → `'move'`. `reset` elenca cosa annullare uscendo da `prev`: `area` → `['templatePlacingShape','templateOrigin']`; `draw` → `['drawMode']`; `walls` → `['gridEditMode']`; `traj` → `['trajectoryFrom']`; `move` → `[]`.
- `toolFromState({ gridEditMode, drawMode, templatePlacingShape, trajTool }): tool` — precedenza `walls` > `draw` > `area` (se `templatePlacingShape` non nullo **oppure** `tool` era `area`) > `traj` > `move`. Serve a riallineare `state.ui.tool` quando una modalità viene cambiata da codice esistente.
- `readDensity(): 'compact'|'details'` e `saveDensity(v)` — chiave `localStorage['dnd-init-density']`, default `'compact'`, try/catch come `theme.js`; valore non valido → `'compact'`.
- `detailStillValid(detailId, combatants): boolean` — falso se `detailId` è nullo o non è chiave di `combatants`.

- [ ] **Step 1:** Scrivere `test/combatChrome.html` (stesso telaio di `test/theme.html`) con:

```js
eq(toolTransition('move','draw'), { tool:'draw', reset:[] });
eq(toolTransition('draw','draw'), { tool:'move', reset:['drawMode'] });
eq(toolTransition('move','move'), { tool:'move', reset:[] });
eq(toolTransition('area','traj'), { tool:'traj', reset:['templatePlacingShape','templateOrigin'] });
eq(toolTransition('traj','move'), { tool:'move', reset:['trajectoryFrom'] });
eq(toolTransition('walls','draw'), { tool:'draw', reset:['gridEditMode'] });
eq(toolFromState({ gridEditMode:true, drawMode:true }), 'walls');
eq(toolFromState({ drawMode:true, templatePlacingShape:'cone' }), 'draw');
eq(toolFromState({ templatePlacingShape:'cone' }), 'area');
eq(toolFromState({ trajTool:true }), 'traj');
eq(toolFromState({}), 'move');
eq(detailStillValid('a', { a:{} }), true);
eq(detailStillValid('a', { b:{} }), false);
eq(detailStillValid(null, { a:{} }), false);
eq(detailStillValid('a', null), false);
// densità: default, valore non valido, storage che lancia (come in test/theme.html)
```

- [ ] **Step 2:** Eseguire → FAIL (modulo assente).
- [ ] **Step 3:** Implementare il modulo e aggiungere i due campi a `state.js`.
- [ ] **Step 4:** Eseguire → PASS. Rieseguire tutta la suite (`shapes`, `theme`, `icons`, `combatantRules`, `combatChrome`).
- [ ] **Step 5:** Commit `feat(rework): stato interfaccia della schermata di combattimento`.

---

### Task 2: Testata e menu

**Files:** Modify `index.html` (righe ~772-806 e script "Topbar: menu overflow"), `styles/combat.css`, `app.js`. Create `src/ui/CombatChrome.js`.

**Interfaces — Produces:**
- `CombatChrome.init()` — chiamata una volta da `app.js` all'avvio; lega i comandi nuovi con delega su `#view-combat`.
- `CombatChrome.apply()` — scrive su `#view-combat` gli attributi `data-tool`, `data-drawer`, `data-menu` (`open`/assente), `data-spells`, `data-init-sheet`, `data-density`; idempotente, **non fa `innerHTML`**. Va chiamata dopo ogni modifica di `state.ui` e in coda al listener di sessione.
- `CombatChrome.set(patch)` — `Object.assign(state.ui, patch)` + `apply()`.
- `CombatChrome.reset()` — riporta `state.ui` ai default; usata da `exitToHome`.

**Decisioni:**
- La testata contiene, in ordine: drago (`icon('dragon')`) + codice sessione (`#session-code-display`) · `#turn-banner` · spazio · `#btn-next-turn` ("Turno successivo", solo master, primario) · `#btn-menu` (nuovo, "Menu" con `icon('menu')`).
- `#topbar-more` diventa il menu a comparsa **a tutte le larghezze** (oggi lo è solo su telefono): pannello ancorato sotto `#btn-menu`, visibile con `[data-menu="open"]`. Si chiude cliccando una voce, fuori, o con Esc. `#btn-topbar-more` si elimina (lo sostituisce `#btn-menu`); è l'unico `id` rimosso e non ha handler in `app.js` (solo nello script inline che si elimina).
- Voci del menu, raggruppate come nel fotogramma 5. Ogni voce è il **bottone esistente** spostato dentro `#topbar-more`, con icona e nome scritto:
  - *Sessione*: `#btn-copy-code` "Copia codice" · `#btn-open-notes` (nuovo → `set({drawer:'notes'})`) "Cronache" · `#btn-open-log` (nuovo → `drawer:'log'`) "Diario eventi" · `#btn-upload-scene` "Scena" · `#btn-toggle-ship` "Nave"
  - *Gruppo*: `#btn-rest-short` · `#btn-rest-long` · `#btn-open-add-pet` (nuovo, solo non-master: apre una finestra che contiene il form esistente `#form-add-pet`, spostato intero)
  - *Master* (dentro `#master-controls`, che resta il contenitore mostrato solo al master): `#btn-open-add-creature` (spostato da `#master-add-form`) · `#select-progression-mode-live` con etichetta "Progressione" · `#xp-award-section` "Assegna XP" · `#btn-grid-edit` "Muri e dimensioni mappa" · `#btn-grid-reset` "Svuota mappa" (pericolo) · `#btn-reset` "Reset incontro" (pericolo)
  - *Altro*: `#btn-theme-toggle-combat` · `#btn-exit-session`
- `_syncThemeButtons` in `app.js` continua a scrivere l'`innerHTML` del bottone tema: l'etichetta nel menu diventa "Tema notte" / "Tema chiaro".
- `_applyGridEditUI` scrive oggi `editBtn.textContent`: va cambiato in modo che non cancelli l'icona (testo in uno `<span>`), e a modifica attiva la voce diventa "Fine modifica mappa".

- [ ] **Step 1:** Spostare il markup e scrivere il CSS del menu in `styles/combat.css`; togliere le regole `.topbar-more*` e `.more-lbl` dal `<style>` inline.
- [ ] **Step 2:** Creare `src/ui/CombatChrome.js` con `init/apply/set/reset` e il comportamento del menu; chiamare `init()` da `app.js` e `apply()` in coda al listener in `_startListening` e in `_enterCombatView`.
- [ ] **Step 3:** `exitToHome` (`src/views/core.js`) chiama `CombatChrome.reset()`.
- [ ] **Step 4: Verifica nel browser**, da master e da giocatore, chiaro e notte: ogni voce del menu fa quello che faceva il bottone di prima (copia codice, scena, nave, riposi, aggiungi creatura, progressione, XP, muri, svuota, reset, tema, esci). Il menu resta aperto se arriva uno snapshot (provocarlo da un'altra scheda). Suite dei test verde.
- [ ] **Step 5:** Commit `feat(rework): testata e menu della schermata di combattimento`.

---

### Task 3: Due colonne e pannello laterale a comparsa

**Files:** Modify `index.html` (righe ~810-961, script "Side panel tabs" e "Mobile tabbar"), `styles/combat.css`, `src/ui/CombatChrome.js`.

**Decisioni:**
- `.combat-shell` passa a due colonne: `#panel-init` (iniziativa) e `#panel-grid` (mappa). Con `[data-drawer]` valorizzato su PC si aggiunge una terza colonna con `#panel-side` (come nel fotogramma 3); sotto i 900px `#panel-side` è un pannello sovrapposto che entra da destra.
- `#panel-side` resta il nodo di oggi con i suoi tre `.side-pane`. Spariscono i bottoni `.side-tabs` e la `#tabbar`: quale pannello è visibile lo decide `[data-drawer="detail|log|notes"]` via CSS (`.side-pane[data-pane="cards"]` per `detail`). In testa a `#panel-side` un titolo (`.rule-head`: "Dettaglio" / "Diario eventi" / "Cronache") e `#btn-drawer-close` (`icon('close')`).
- Le liste `#creature-list` e `#player-list` restano dove sono e continuano a essere renderizzate per intero da `UI.renderCombatantList` (nessun cambio alla funzione in questo task): in modalità `detail` il CSS nasconde tutte le card tranne quella con `data-id` uguale a `state.ui.detailId`. Per farlo `CombatChrome.apply()` mette la classe `is-detail` sul `li` giusto dopo ogni render (cercandolo per `data-id`; se le card non hanno ancora `data-id` sul `li`, aggiungerlo nel template di `renderCombatantList`).
- I messaggi "Nessuna creatura" / "In attesa dei giocatori…" si spostano in fondo a `#panel-init`.
- Lo script inline dei tab e della tabbar si elimina; le classi `is-mobile-on` non servono più.

- [ ] **Step 1:** Ricomporre markup e CSS come sopra; spostare in `styles/combat.css` tutte le regole della vista combat oggi nel `<style>` inline di `index.html` (sezione "COMBAT STAGE" e seguenti), sostituendo le variabili alias con `--c-*`.
- [ ] **Step 2:** `CombatChrome`: `#btn-open-log`, `#btn-open-notes`, `#btn-drawer-close`, Esc.
- [ ] **Step 3:** In `apply()`: se `state.ui.drawer === 'detail'` e `!detailStillValid(state.ui.detailId, state.snapshot?.combatants)` → `drawer = null`, `detailId = null` (Review Focus 2).
- [ ] **Step 4: Verifica.** Diario e Cronache si aprono dal menu e funzionano come prima (svuota log, aggiungi/modifica/elimina nota, blocco di modifica).
- [ ] **Step 5:** Suite verde.
- [ ] **Step 6 (Review Focus 1):** con una cronaca in modifica nel pannello, provocare snapshot da un'altra scheda: focus, testo e cursore restano.
- [ ] **Step 7:** Commit `feat(rework): layout a due colonne e pannello laterale`.

---

### Task 4: Iniziativa a due densità e dettaglio del combattente

**Files:** Modify `src/ui/GridUI.js` (`renderInitiativeList`, riga ~955), `src/logic/grid.js` (chiamata, riga ~83), `styles/combat.css`, `src/ui/CombatChrome.js`, `index.html` (intestazione di `#panel-init`).

**Interfaces — Consumes:** `readDensity/saveDensity`, `CombatChrome.set`. **Produces:**
- `renderInitiativeList(container, sortedCombatants, gridPos, myCombatantId, selectedId, currentTurnId, isMaster, onSelect, combatants, opts)` — nuovo ultimo parametro `opts = { density, myUid, masterUid, onToggleInspiration }`; i chiamanti esistenti senza `opts` ottengono la resa compatta.
- Interruttore `#init-density` in testa a `#panel-init`: due bottoni "Compatta" / "Dettagli".

**Decisioni:**
- **Compatta** (fotogramma 1): numero iniziativa · segnalino tondo con iniziale o avatar, bordo per tipo · nome · barra vita · valore. Riga del turno attivo su fondo `--c-paper-lo`; riga selezionata con contorno oro; KO attenuato con `icon('skull')`.
- **Dettagli** (fotogramma 3b): la stessa riga più una seconda riga con CA, HP temporanei (se > 0), tiri salvezza contro la morte (solo per il proprio PG, dati di `state.sheetData`, come oggi), condizioni come chip, e la stella dell'ispirazione (`icon('star')`) per PG e famigli.
- **Visibilità**: si riusano le stesse regole di `UI.renderCombatantList` (cosa vede il master, cosa i giocatori, `showHealthHint`, `showAC`). Estrarre da `UI.js` le funzioni che le decidono (`healthHintText`, la condizione "posso vedere gli HP esatti", "posso vedere la CA") in funzioni esportate e usarle in entrambi i renderer, senza cambiarne il comportamento.
- **Ispirazione**: la stella è un `<button data-action="toggle-inspiration" data-id>`, `disabled` se non sono il proprietario né il master (stessa regola di oggi); il clic chiama il callback esistente `onToggleInspiration`.
- **Clic su una riga**: apre il dettaglio → `CombatChrome.set({ drawer:'detail', detailId:id })`. In più resta il comportamento di oggi: per il master `dnd:dock-select`, per il giocatore `selectToken`. Riclic sulla riga già aperta chiude il dettaglio.
- **Modifica rapida dell'iniziativa** (richiesta esplicita: "segnare l'iniziativa"): il numero a sinistra della riga è cliccabile per chi può modificarla (stessa regola di `edit-initiative` sulle card) e apre lo stesso editor inline di oggi; il rebuild della lista va avvolto in `captureFocusState`/`restoreFocusState`.
- La distanza dal segnalino selezionato che oggi appare nella lista resta, nella colonna del valore.
- La densità è per client e ricordata (`saveDensity`); `[data-density]` allarga la colonna a 300px in "Dettagli".

- [ ] **Step 1:** Estrarre le regole di visibilità in funzioni esportate da `UI.js` (refactor senza cambi di comportamento); suite verde e controllo a vista delle card.
- [ ] **Step 2:** Implementare le due rese e l'interruttore.
- [ ] **Step 3:** Clic riga → dettaglio; editor rapido dell'iniziativa.
- [ ] **Step 4: Verifica** da master e da giocatore: in "Dettagli" un giocatore non vede HP né CA dei nemici salvo `showHealthHint`/`showAC`; l'ispirazione si accende solo dove consentito e si aggiorna per tutti.
- [ ] **Step 5:** Suite verde.
- [ ] **Step 6 (Review Focus 1 e 2):** con l'editor dell'iniziativa aperto, snapshot da un'altra scheda → resta aperto; rimuovendo da un'altra scheda il combattente aperto nel dettaglio → il pannello si chiude.
- [ ] **Step 7:** Commit `feat(rework): iniziativa compatta/dettagli e dettaglio combattente`.

---

### Task 5: Strumenti della mappa

**Files:** Modify `index.html` (`.grid-toolbar`, righe ~827-885), `styles/grid.css`, `src/ui/CombatChrome.js`, `app.js` (`_syncGridModeUI`, `_applyGridEditUI`, `_applyDrawControlsUI`, `_applyTemplateControlsUI`), `src/logic/grid.js` (`renderTokenBar`).

**Decisioni:**
- Riga strumenti: quattro bottoni con icona e nome — `#tool-move` "Muovi" (`footprints`), `#tool-area` "Area" (`blast`), `#tool-traj` "Traiettoria" (`arrow-flight`), `#tool-draw` "Disegna" (`brush`) — seguiti da `#grid-hint`. Lo strumento attivo ha `.active`. `#btn-draw-toggle` si elimina dal markup: lo sostituisce `#tool-draw`, che chiama la stessa `toggleDrawMode()`.
- Sotto, **una sola riga di opzioni** visibile secondo `[data-tool]`:
  - `move` → `#grid-token-bar` con etichetta "Segnalini" e, per il master, `#grid-master-controls` (selettore taglia) con etichetta "Taglia".
  - `area` → `#grid-template-controls`: i tre bottoni forma con nome scritto ("Cerchio", "Cono", "Linea") e `#btn-template-clear` "Rimuovi area".
  - `traj` → `#traj-controls` (nuovo, vedi Task 7).
  - `draw` → `#grid-draw-palette`, raggruppata come nel fotogramma 4: *Strumento* (pennello `#tool-brush` nuovo → `setDrawTool('brush')`, `#btn-draw-eraser`, `#btn-draw-bucket`, rettangolo, quadrato, cerchio) · *Colore* (8 campioni + `#input-draw-custom`) · *Dimensione* (`#select-draw-size`, nascosto per secchiello e forme piene invece che disattivato) · *Forma del pennello* (visibile solo con pennello/gomma) · *Pieno/contorno* (`#btn-draw-fill`, visibile solo con le forme) · annulla, ripeti, "Pulisci".
  - `walls` (solo master, attivata dal menu) → `#grid-edit-controls` con etichette "Larghezza" / "Altezza", un bottone "Fine modifica" che clicca `#btn-grid-edit`, e l'indicazione "Tocca o trascina sulle caselle per i muri".
- Il clic su uno strumento passa da `toolTransition`: applica `reset` a `state`, poi attiva la modalità di arrivo con le funzioni esistenti (`toggleDrawMode`, `toggleTemplatePlacement`), poi `_syncGridModeUI()` e `_rerenderGridFromSnapshot()`.
- `_syncGridModeUI` chiama anche `state.ui.tool = toolFromState(...)` e `CombatChrome.apply()`, così se una modalità cambia per altra via (es. piazzamento area concluso) i bottoni restano allineati. Scegliendo "Area" senza forma si resta su `area` con la riga opzioni aperta e nessuna forma attiva.
- Le funzioni `_apply*UI` smettono di impostare `style.display` sui gruppi (lo fa il CSS da `[data-tool]`) e di scrivere emoji in `textContent` (usano `icon()`); il resto resta com'è, compreso il flag `_customColorPicking`.
- `renderTokenBar`: `💀` → `icon('skull')`; il resto invariato.
- Zoom: `icon('zoom-in'|'zoom-out'|'zoom-reset')`.
- `#grid-hint` continua a essere scritto da `GridUI.renderGrid`; aggiungere i testi per `traj`.

- [ ] **Step 1:** Markup e CSS della riga strumenti e delle righe opzioni.
- [ ] **Step 2:** `CombatChrome`: clic sugli strumenti con `toolTransition`; adeguare le `_apply*UI`.
- [ ] **Step 3: Verifica** funzione per funzione della voce "Mappa" dell'inventario della spec (movimento, raggio, ghost, segnalini piazza/rimuovi, taglia, muri, dimensioni, svuota, area ×3, disegno: pennello, gomma, 8 colori, colore libero con picker aperto durante uno snapshot, secchiello, tre forme, pieno/contorno, dimensione, forma, annulla/ripeti, pulisci, zoom, pan, cursori).
- [ ] **Step 4 (Review Focus 3):** fissare l'origine di un'area e passare a "Disegna"; iniziare una forma e passare a "Muovi": nessun residuo, nessuna scrittura.
- [ ] **Step 5:** Suite verde. Commit `feat(rework): strumenti della mappa con nome e opzioni a comparsa`.

---

### Task 6: Area incantesimo guidata e leggibile

**Files:** Modify `src/ui/GridUI.js` (`templateShapeMarkup`, resa del template a riga ~626 e ghost a ~810), `styles/grid.css`, `index.html` (dentro `#grid-template-controls`), `src/ui/CombatChrome.js`.

**Decisioni** (dal mockup delle aree):
- Striscia a passi `#area-steps` nella riga opzioni: "1. Scegli la forma · 2. Tocca da dove parte · 3. Orienta e tocca per confermare"; il passo corrente in evidenza, i precedenti barrati. Il passo si ricava da `state.templatePlacingShape` / `state.templateOrigin`. Bottone "Annulla" che azzera il piazzamento.
- Sulla mappa, area confermata: riempimento tratteggiato (pattern SVG a righe diagonali) nel colore `--c-foe`, bordo pieno 2.5, punto pieno sull'origine, etichetta su fondo `--c-paper-hi` con "Forma misura · autore" (autore = nome del combattente o giocatore che l'ha piazzata, ricavato da `ownerUid`; se non ricavabile, solo forma e misura).
- I segnalini coinvolti (già calcolati per l'hint) ricevono un cerchio tratteggiato esterno.
- L'elenco "Colpiti: …" passa dall'hint a una riga `#area-hit` sotto la riga opzioni, visibile a tutti finché l'area esiste.
- Geometria, dati (`sessions/{code}/template`), permessi di rimozione e flusso clic-clic **invariati**.

- [ ] **Step 1:** Striscia a passi e "Annulla".
- [ ] **Step 2:** Nuova resa SVG (pattern in `<defs>` dell'SVG della griglia; i colori via `var(--c-*)`).
- [ ] **Step 3: Verifica** con due schede: l'area piazzata da una compare identica nell'altra con etichetta e bersagli cerchiati; cono e linea seguono l'orientamento; chi non è autore né master non vede "Rimuovi area".
- [ ] **Step 4:** Suite verde (`shapes` in particolare). Commit `feat(rework): area incantesimo guidata e leggibile`.

---

### Task 7: Traiettoria

**Files:** Create `src/logic/trajectory.js`, `test/trajectory.html`. Modify `src/data/Session.js`, `src/ui/GridUI.js`, `src/logic/grid.js`, `app.js`, `src/views/core.js`, `index.html`, `CLAUDE.md` (modello dati).

**Interfaces — Produces:**
- Dati: `sessions/{code}/trajectories/{uid}` = `{ fromId, toId }` oppure `{ fromId, toCol, toRow }`, più `ownerUid`. Una per giocatore; una nuova sovrascrive la propria.
- `Session.setTrajectory(uid, data)`, `Session.clearTrajectory(uid)`, `Session.clearAllTrajectories()`.
- `trajectoryEndpoints(traj, gridPos, combatants): { from:{col,row,n}, to:{col,row,n} } | null` — `null` se `fromId` non è in `combatants` o non ha posizione in `gridPos`, o se `toId` è indicato ma manca da `combatants`/`gridPos`. `n` = lato del footprint (`footprintOf(size)`); per una cella `n = 1`.
- `trajectoryDistance(endpoints): number` — `squareDistance` di `GridUI.js` tra i due footprint (metri, variante 5-10-5 bordo-a-bordo).

**Decisioni:**
- Strumento "Traiettoria": primo tocco su un segnalino → `state.trajectoryFrom`; secondo tocco su un segnalino o una cella → scrive la traiettoria e azzera `trajectoryFrom`. Chiunque può partire da qualunque segnalino (serve anche al master per le sue creature).
- Riga opzioni `#traj-controls`: "1. Tocca chi attacca · 2. Tocca il bersaglio" con passo corrente in evidenza, e `#btn-traj-clear` "Rimuovi la mia traiettoria" (visibile se ne ho una; il master ha "Rimuovi tutte").
- Resa: freccia tratteggiata dal centro del footprint di partenza a quello d'arrivo, colore `--c-ally`, punta a freccia, etichetta con la distanza su fondo `--c-paper-hi`. Le traiettorie con `trajectoryEndpoints === null` non si disegnano (Review Focus 4).
- **Pulizia, sempre da azioni utente e mai dal listener**: `clearAllTrajectories()` nell'handler di `#btn-next-turn` e in `onEndTurn` (dopo `nextTurnAtomic`), in `#btn-reset`, in "Svuota mappa". `removeCombatant` non scrive nulla in più: una traiettoria rimasta senza estremi semplicemente non si disegna e viene spazzata al cambio turno.
- `exitToHome` azzera `state.trajectoryFrom`. Reset della griglia (`Session.resetGrid`) cancella anche `trajectories`.

- [ ] **Step 1:** Scrivere `test/trajectory.html`:

```js
const comb = { a:{ size:'medium' }, b:{ size:'large' } };
const pos  = { a:{ col:2, row:2 }, b:{ col:6, row:2 } };
eq(trajectoryEndpoints({ fromId:'a', toId:'b' }, pos, comb), { from:{col:2,row:2,n:1}, to:{col:6,row:2,n:2} });
eq(trajectoryEndpoints({ fromId:'a', toCol:5, toRow:5 }, pos, comb), { from:{col:2,row:2,n:1}, to:{col:5,row:5,n:1} });
eq(trajectoryEndpoints({ fromId:'x', toId:'b' }, pos, comb), null);          // attaccante rimosso
eq(trajectoryEndpoints({ fromId:'a', toId:'x' }, pos, comb), null);          // bersaglio rimosso
eq(trajectoryEndpoints({ fromId:'a', toId:'b' }, { a:pos.a }, comb), null);  // bersaglio tolto dalla mappa
eq(trajectoryEndpoints({ fromId:'a' }, pos, comb), null);                    // dato incompleto
eq(trajectoryEndpoints(null, pos, comb), null);
eq(trajectoryDistance({ from:{col:2,row:2,n:1}, to:{col:6,row:2,n:2} }), 4); // bordo-a-bordo: 6-2 = 4 caselle
eq(trajectoryDistance({ from:{col:0,row:0,n:1}, to:{col:3,row:3,n:1} }), 4); // diagonale 5-10-5: 3 + floor(3/2)
eq(trajectoryDistance({ from:{col:2,row:2,n:1}, to:{col:2,row:2,n:1} }), 0);
```

(Prima di fissare i valori attesi delle distanze, verificarli chiamando `squareDistance` con gli stessi argomenti in `test/shapes.html` o in console: se la funzione esistente dà valori diversi, vale la funzione esistente e si correggono i valori attesi, annotandolo nel ledger.)

- [ ] **Step 2:** Eseguire → FAIL.
- [ ] **Step 3:** Implementare `src/logic/trajectory.js`; eseguire → PASS.
- [ ] **Step 4:** `Session` (tre metodi), passaggio di `state.snapshot.trajectories` e dei callback a `GridUI.renderGrid` (nuovi parametri in coda, come è stato fatto per gli altri strumenti), resa e interazione.
- [ ] **Step 5:** Pulizia nelle quattro azioni utente elencate.
- [ ] **Step 6: Verifica** con due schede: la freccia compare all'altro; sparisce al cambio turno; togliendo dalla mappa il bersaglio sparisce senza errori in console.
- [ ] **Step 7:** Aggiornare il modello dati in `CLAUDE.md`. Suite verde. Commit `feat(griglia): strumento Traiettoria`.

---

### Task 8: Dock e incantesimi

**Files:** Modify `src/ui/UI.js` (`renderPlayerDock` ~838, `renderMasterDock` ~916, `openDockActionModal` ~973), `app.js` (handler di `#my-dock`, righe ~417-441), `styles/combat.css`, `src/ui/CombatChrome.js`, `index.html` (contenitore `#spells-pop`).

**Decisioni:**
- Dock giocatore (fotogramma 1): ritratto con cornice XP (invariata, compreso lo stato "level-up pronto") · nome e sottotitolo · Vita · CA · azioni con icona e nome: Attacca (`sword`), Cura (`heal`), Incantesimi (`spellbook`), Condizioni (`star`), Scheda (`scroll`) · "Fine turno" primario, presente solo nel proprio turno. **Attacca e Cura restano visibili solo nel proprio turno, come oggi.** I `data-action` esistenti non cambiano; nuovo `data-action="dock-spells"`.
- Tiri salvezza contro la morte nel dock quando KO: invariati.
- Dock master (fotogramma 3): stessa struttura per il combattente in `state.selectedDockId`, senza Incantesimi e con "Scheda mostro" (`data-action="view-stat-block"`, già gestito) quando la creatura ha `monsterApiIndex`.
- **Popover Incantesimi** `#spells-pop` (fotogramma 2), fuori da `#my-dock` così il rebuild del dock non lo tocca; visibile con `[data-spells]`. Contenuto renderizzato da una nuova `UI.renderSpellsPopover(sheetData, callbacks)`:
  - slot per livello (solo livelli con massimo > 0) a rombi cliccabili → `state.sheet.setSpellSlotsUsed(lvl, count)` (transazione esistente);
  - trucchetti e incantesimi **preparati** per livello, sola lettura;
  - se la scheda non ha slot né incantesimi: "Nessun incantesimo sulla scheda" e un bottone "Apri la scheda".
  - Va ri-renderizzato quando cambia `state.sheetData` (in `setupSheetListener`, solo se aperto).
- Finestra bersagli (`openDockActionModal`): stessa logica, emoji → `icon()`, bottone di conferma primario.
- Notifiche in `app.js`: `🗡 ` / `✚ ` → `icon('sword')` / `icon('heal')` (controllare che `showNotification` inserisca HTML e non testo; se usa `textContent`, aggiungere un parametro icona invece di concatenare).

- [ ] **Step 1:** Dock giocatore e master.
- [ ] **Step 2:** Popover incantesimi.
- [ ] **Step 3: Verifica**: attacco e cura su uno e più bersagli, condizioni, scheda, fine turno, tiri salvezza da KO fino al ritorno a 1 HP, slot usati dal popover che si aggiornano anche nella scheda, popover che resta aperto durante uno snapshot (Review Focus 1).
- [ ] **Step 4:** Suite verde. Commit `feat(rework): dock e incantesimi a portata di mano`.

---

### Task 9: Telefono e larghezze intermedie

**Files:** Modify `styles/combat.css`, `styles/grid.css`, `index.html` (striscia del turno), `src/ui/CombatChrome.js`, `src/ui/UI.js` (`renderRound`).

**Decisioni** (fotogramma 6):
- Sotto i 760px: una colonna. `#panel-init` non è in pagina: diventa un foglio che sale dal basso con `[data-init-sheet]`. Al suo posto, sopra la mappa, la striscia `#turn-pill`: segnalino + "Tocca a X · poi Y" + freccia; toccandola `set({ initSheetOpen:true })`. Il testo lo scrive `UI.renderRound` (che riceve già il combattente attivo; aggiungere il successivo).
- Testata: drago + codice · round · bottone menu solo icona. Il menu è un foglio a tutta larghezza.
- Riga strumenti: quattro bottoni su una riga, scorribile in orizzontale se non ci stanno; la riga opzioni va a capo.
- `#panel-side` (dettaglio, diario, cronache) è un foglio a tutto schermo con chiusura in alto.
- Dock: ritratto, Vita, CA, Attacca, Cura, "Altro" (apre un piccolo foglio con Incantesimi, Condizioni, Scheda), e "Fine turno" a tutta larghezza sotto.
- Tra 760 e 1100px: due colonne con l'iniziativa a 190px; il dettaglio è sovrapposto invece che in terza colonna.
- La mappa usa tutta l'altezza disponibile tra testata e dock (`height: 100%` sul contenitore, non `vh`).

- [ ] **Step 1:** CSS e striscia del turno.
- [ ] **Step 2: Verifica** in un `iframe` a 380, 600, 800 e 1024px (stesso metodo della tappa 1), chiaro e notte: ogni comando delle Task 2-8 è raggiungibile; nessuno scorrimento orizzontale della pagina (`document.documentElement.scrollWidth <= innerWidth`) (Review Focus 5).
- [ ] **Step 3:** Suite verde. Commit `feat(rework): schermata di combattimento su telefono`.

---

### Task 10: Chiusura della tappa

- [ ] **Step 1: Emoji.** `grep -nP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B00}-\x{2BFF}]' app.js src/ui/UI.js src/ui/GridUI.js src/logic/grid.js styles/combat.css styles/grid.css` e la parte `#view-combat` di `index.html` → nessuna usata come icona (restano ammessi `·`, `→`, `×`, `◆◇` degli slot). Sostituire ciò che resta con `icon()`.
- [ ] **Step 2: Alias.** In `styles/combat.css` e `styles/grid.css` nessuna variabile dei vecchi vocabolari (`grep -n -- "--gold\|--bone\|--mut\b\|--bg[0-3]\|--line\b\|--text-muted\|--border-warm\|--font-ui\|--font-display"`). Il blocco alias in `base.css` resta (serve a scheda, home, nave).
- [ ] **Step 3: Parità.** Spuntare una per una le voci "Testata combattimento", "Combattenti", "Dock", "Mappa", "Cronache e log" dell'inventario della spec, da master e da giocatore; annotare nel ledger dove si trova ora ciascuna.
- [ ] **Step 4: Due client.** Prova con due utenti diversi (serve un secondo profilo o dispositivo: chiedere all'utente di partecipare con il telefono se l'automazione ha un solo profilo): scrittura in un campo mentre l'altro muove un segnalino o infligge danni; Fine turno ripetuto; cursori con nome in chiaro e in notte; blocco delle cronache; area e traiettoria viste dall'altro; uscita e rientro; reset incontro.
- [ ] **Step 5:** Tutta la suite verde.
- [ ] **Step 6:** Aggiornare `CLAUDE.md`: architettura file, sezione nuova "Schermata di combattimento" (stato `state.ui`, regola "i nodi si spostano, gli handler no", come aggiungere una voce al menu o uno strumento alla mappa), Traiettoria nel modello dati e nella documentazione della griglia, pattern "Aggiungere un'azione a una card" aggiornato.
- [ ] **Step 7:** Commit `Docs: CLAUDE.md aggiornato alla tappa 2 del rework`. Preparare il mockup della tappa 3 (scheda personaggio).
