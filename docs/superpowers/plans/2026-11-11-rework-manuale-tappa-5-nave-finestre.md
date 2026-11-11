# Rework "Manuale" — tappa 5: nave, cronache, scena, finestre, pulizia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (native, inline). Steps use checkbox syntax.

**Goal:** Rivestire nave, diario, cronache, notifiche e finestre rimaste come da mockup approvato; scena in finestra con X, caricabile ed eliminabile da tutti; conferme nella pagina al posto di `confirm()`/`prompt()`; pulizia finale (alias, colori letterali, CSS morto).

**Architecture:** Un solo modulo `src/ui/dialogs.js` (`openSheet` + `askConfirm`, `askText`, `askChoice`, tutte Promise) usato da tutto il sito. La scena diventa il modal `#scene-modal` (classe `.veil`) con stato locale "chiusa da me"; si apre da sola quando `sceneImageUrl` cambia dopo il primo snapshot, "Rivedi scena" nel menu la riapre. Nave e notifiche restano nei loro moduli ma con solo `--c-*`. La pulizia sostituisce gli alias di `styles/base.css` con le variabili nuove in ogni file e poi elimina il blocco.

**Tech Stack:** HTML + CSS + ES6 modules, test in pagina (`test/run.sh`).

**Spec:** `docs/superpowers/specs/2026-11-10-rework-manuale-design.md` e mockup approvato `docs/superpowers/specs/2026-11-10-rework-manuale-mockup-nave-finestre.html`.

## Global Constraints

- Nessuna emoji; icone solo `icon('nome')`; bottoni solo-icona con `aria-label` e `title`.
- Solo `--c-*`/`--f-*`; eccezioni ai letterali: colori delle condizioni (`UI.js`), palette del disegno, logo Google. I colori delle stanze della nave diventano miscele di token (`color-mix`).
- Un solo `.btn--primary` per finestra; azioni distruttive con `.btn--danger` (rosso `--c-foe`).
- Nessun `id`/handler esistente viene rinominato (eccetto la rimozione dichiarata di `#scene-section` e dei suoi bottoni `btn-hide-scene`/`btn-expand-scene`/`btn-change-scene`/`btn-clear-scene`, sostituiti dagli equivalenti nel modal).
- Pattern di concorrenza di `CLAUDE.md` invariati (focus preservato nei rebuild, niente scritture nel listener, `onValue` conservati).
- La scena resta in `sessions/{code}/sceneImageUrl|sceneImageName` (nessun cambio di modello dati); carica/cambia/elimina per tutti.

## Review Focus

- Doppio clic su un bottone di conferma: l'azione parte una volta sola; Esc/clic fuori/Annulla = `false`/`null`, mai l'azione.
- Due `askConfirm` aperti insieme (es. due azioni ravvicinate): il secondo aspetta o sostituisce senza lasciare promesse pendenti; nessun foglio orfano nel DOM.
- Testo con `<`/`"` (nome personaggio, creatura) nei fogli: mostrato come testo.
- Scena: all'ingresso in sessione con scena già presente NON si apre da sola; si apre quando l'URL cambia; chiuderla non la chiude agli altri; URL non http(s)/data malevolo non finisce in `src`/`href` (validare lo schema).
- Scena eliminata mentre un altro la sta guardando: il modal si chiude da solo e "Rivedi scena" sparisce.
- Nave: nomi stanza/personaggi con HTML mostrati come testo; stanze leggibili in tema notte.
- Pulizia: nessuna variabile `var(--old)` senza definizione dopo la rimozione degli alias; le viste vecchie (modali, nave, log) restano leggibili nei due temi.

---

### Task 1: `dialogs.js` (fogli di conferma/testo/scelta)

**Files:** Create `src/ui/dialogs.js`, `test/dialogs.html`; Modify `styles/base.css` (`.btn--danger`, `.sheet-dialog`).

**Interfaces — Produces:**
- `openSheet({ title, text?, field?: {label, value?, placeholder?, maxLength?}, buttons: [{id, label, kind?: 'primary'|'danger'|'plain', icon?}], cancelId? }) -> Promise<{ id: string, value: string|null } | null>` — `null` se Esc, clic fuori o Annulla (`cancelId`, di default l'ultimo bottone `plain`). Un solo foglio alla volta: una nuova chiamata mentre uno è aperto aspetta in coda (FIFO).
- `askConfirm({ title, text?, confirmLabel, danger?: boolean, cancelLabel? }) -> Promise<boolean>`
- `askText({ title, label, value?, confirmLabel? }) -> Promise<string|null>` (stringa già `trim()`, vuota = `null`)
- `askChoice({ title, text?, primaryLabel, secondaryLabel }) -> Promise<'primary'|'secondary'|null>`

- [ ] Test `test/dialogs.html` (DOM in pagina, bottoni cliccati da script): confirm → clic "Conferma" = `true`; clic "Annulla" = `false`; Esc = `false`; clic sul velo = `false`; doppio clic su Conferma risolve una volta (nessun errore, promise già risolta); `danger:true` dà `.btn--danger` e niente `.btn--primary`; testo con `<b>x</b>` resta testo (nessun `<b>` nel DOM); `askText` restituisce il valore trimmato e `null` se vuoto; `askChoice` primary/secondary; due chiamate in sequenza (la seconda parte solo dopo la prima); dopo la chiusura non resta nessun nodo `.sheet-dialog`; il focus va al bottone di conferma (o al campo) all'apertura.
- [ ] Run → FAIL. Implementare `dialogs.js` (nodo `.veil.sheet-dialog` con `.modal-frame`, `role="dialog" aria-modal="true" aria-labelledby`, trap del Tab tra i bottoni, ripristino del focus all'elemento precedente) e gli stili. Run → PASS.
- [ ] Commit `feat(rework): fogli di conferma nella pagina (dialogs.js)`.

### Task 2: sostituire `confirm()`/`prompt()`

**Files:** Modify `app.js` (reset, riposo breve/lungo, esci, svuota diario, elimina nota, "Adatta allo spazio", pulisci disegno, nuova creatura, rientro con combattente esistente), `src/views/sheet.js` (rimuovi oggetto, sali di livello).

- [ ] Ogni chiamata diventa `await askConfirm/askText/askChoice` con i testi del mockup; i gestori diventano `async`. Distruttive (`danger`): reset incontro, svuota diario, elimina nota, elimina oggetto, pulisci disegno, "Adatta allo spazio" che toglie segnalini. Le altre: riposi, uscita, sali di livello.
- [ ] Rientro con combattente esistente (`app.js` ~ riga 177): `askChoice` con `primaryLabel: 'Rientra con "{nome}"'`, `secondaryLabel: 'Sostituisci con "{nuovo}"'`; `null` (annullato) = non fa nulla (non entra), `primary` = comportamento di oggi per "OK", `secondary` = quello di "Annulla".
- [ ] Nessun `confirm(`/`prompt(`/`alert(` residuo (`grep`). Commit `feat(rework): conferme nella pagina al posto dei messaggi del browser`.

### Task 3: scena in finestra

**Files:** Modify `index.html` (rimuovere `#scene-section`, aggiungere `#scene-modal` e voce `#btn-view-scene` "Rivedi scena" nel menu, nascosta senza scena), `src/ui/UI.js` (`renderScenePanel`, `hideSceneLocally` → `renderScene`, `closeSceneLocally`, `openSceneLocally`), `app.js`, `styles/combat.css`/`grid.css` (rimuovere regole di `#scene-section`).

**Interfaces — Produces:** `src/logic/sceneView.js`: `sceneAction({ prevUrl, nextUrl, firstSnapshot }) -> 'open' | 'close' | 'none'` (`open` solo se `nextUrl` è valido e `!firstSnapshot` e diverso da `prevUrl`; `close` se `nextUrl` assente; altrimenti `none`) e `safeSceneUrl(url) -> string|null` (solo `https:`, `http:` locale non ammesso, `data:image/` ammesso; altro = `null`). Test in `test/sceneView.html`.

- [ ] Test `sceneView` (RED), implementare (GREEN).
- [ ] Modal: titolo con nome file (`textContent`), immagine intera (`max-width/max-height` al viewport, `object-fit: contain`), X, Cambia, Elimina (per tutti); chiude con Esc/clic fuori; chiusura locale (flag in memoria, resettato quando l'URL cambia). `#btn-view-scene` visibile solo se esiste scena valida. Aprire automatico solo se `sceneAction` = 'open'.
- [ ] Verifica a due client: A carica → si apre su B; B chiude → A resta aperto; B "Rivedi scena" la riapre; A elimina → su B il modal si chiude e la voce sparisce; ingresso in sessione con scena già presente → non si apre da sola.
- [ ] Commit `feat(rework): scena in finestra con X, riapribile, per tutti`.

### Task 4: nave, diario, cronache, notifiche, finestre rimaste

**Files:** Modify `src/ui/ShipUI.js`, `styles/ship.css`, `src/ui/UI.js` (log con icona per tipo, etichetta blocco cronache con `icon('quill')`, notifiche), `styles/combat.css`, `styles/base.css`, `index.html` (stili inline residui dei modali → classi), `styles/grid.css` (scena upload).

- [ ] Nave: stanze con `style="--room:…"` sostituito da una classe per stanza (`room--cargo` …) che usa `color-mix` di token; testata/barra scafo/armi come da mockup; stato arma con etichetta colorata; nessun letterale in `ShipUI.js`.
- [ ] Diario: voce con icona del tipo (`damage`→`sword`, `heal`→`heal`, `turn`→`d20`, altro→`scroll`), ora, riga turno evidenziata. Cronache: etichetta del blocco con icona penna e colore del giocatore (colore validato).
- [ ] Notifiche: filetto sinistro per tipo (`danger`/`heal`/`info`), solo token.
- [ ] Modali (condizioni, assegna XP, aggiungi creatura/famiglio, stat block, azione del dock, level-up): titolo `.ds-heading`, un solo `.btn--primary`, via gli `style=` inline di colore (`var(--faint)`, `var(--line-strong)`, …) a favore di classi.
- [ ] Verifica a vista nei due temi + parità (nessun id perso: confronto prima/dopo). Commit per area.

### Task 5: pulizia finale

- [ ] Elencare gli alias in testa a `styles/base.css`; per ciascuno `grep` e sostituire con la variabile nuova in tutti i file (`index.html`, `styles/*.css`, `src/**/*.js`); eliminare il blocco; verificare che nessun `var(--x)` usato sia indefinito (script in console che scorre i fogli di stile e confronta con le proprietà definite su `:root` nei due temi).
- [ ] Colori letterali rimasti (`#rrggbb`, `rgb(`) fuori dalle eccezioni → token. CSS morto (selettori senza riscontro in `index.html`/`src`) → eliminato, con prova per ogni blocco rimosso (`grep`).
- [ ] Emoji: `grep` come da Global Constraints = 0 (esclusi commenti).
- [ ] `CLAUDE.md`: righe architettura (`dialogs.js`, `sceneView.js`), sezione Tema (alias rimossi), Scena e Conferme, Stato implementazione tappe 5–6. `test/run.sh` verde.
- [ ] Commit `chore(rework): pulizia finale (alias, letterali, CSS morto)`.

### Task 6: verifica e revisione

- [ ] Browser, due origini: tutto il flusso della partita (conferme, scena, nave, diario/cronache con blocco, notifiche) nei due temi e a 380/820/1280 px senza overflow.
- [ ] Revisione finale con subagent `opus` sul Review Focus; un solo giro di fix con test RED→GREEN; ripulire la cartella di lavoro; eliminare i dati di prova creati su Firebase (solo quelli, verificando uid e id come in tappa 4).
