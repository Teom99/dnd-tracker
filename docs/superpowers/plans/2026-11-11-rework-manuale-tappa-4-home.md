# Rework "Manuale" — tappa 4: home e libreria — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (native, inline). Steps use checkbox syntax.

**Goal:** Rifare la home (login, sessioni, entra/crea, libreria) come da mockup approvato, senza perdere funzioni e senza emoji.

**Architecture:** Si mantengono tutti gli `id`/handler esistenti (`form-join`, `input-session-code`, `input-pg-name`, `input-pg-initiative`, `btn-create-session`, `select-progression-mode`, `btn-create-player`, `btn-create-creature`, `user-sessions-list`, `character-library-list`, `join-char-list`, `notes-archive-*`, `btn-google-signin`, `btn-anon-signin`, `btn-upgrade-google`, `btn-sign-out`, `btn-theme-toggle-home`, `dnd:rejoin`, `dnd:join-with-character`). Logica pura nuova in `src/logic/homeView.js` (testata); `src/views/home.js` la usa per il render; markup in `index.html`, stili in `styles/home.css` con soli `--c-*`.

**Tech Stack:** HTML + CSS + ES6 modules, test in pagina (`test/run.sh`).

**Spec:** `docs/superpowers/specs/2026-11-10-rework-manuale-design.md` (sezione Home) e mockup `docs/superpowers/specs/2026-11-10-rework-manuale-mockup-home.html` (approvato dall'utente).

## Global Constraints

- Nessuna emoji né glifo-icona: solo `icon('nome')` (`src/ui/icons.js`); tutti i bottoni solo-icona con `aria-label` e `title`.
- Solo variabili `--c-*`/`--f-*`, nessun colore letterale (eccezione: logo Google).
- Un solo `.btn--primary` per stato della home: "Rientra" se esiste una sessione, altrimenti "Varca la soglia".
- Gli `id` elencati sopra non si rinominano. Cambia dove stanno e come si vedono.
- Renderer con `innerHTML` + input: `captureFocusState`/`restoreFocusState` (`src/utils/domPreserve.js`).
- Dati Firebase in HTML solo via `esc()`/`num()`; `data:image/` verificato per gli avatar (come oggi).
- Nessun test esistente deve rompersi (`test/run.sh`).

## Review Focus

- Libreria con `type` mancante/corrotto: resta selezionabile come PG (come oggi).
- Sessione con `lastSeen` mancante: non rompe l'ordinamento, va in coda.
- Doppio clic su "Entra" della carta non deve scatenare due ingressi (campo e bottone disabilitati subito).
- Nome con `<`/`"` in sessioni, libreria e cronache: mostrato come testo.
- Libreria vuota: stati vuoti con azione; elenco sessioni vuoto: "Entra" diventa l'azione piena.
- Eliminazione personaggio: richiede conferma nella pagina; "Annulla" non cancella.

---

### Task 1: Logica pura della home

**Files:** Create `src/logic/homeView.js`, `test/homeView.html`.

**Interfaces — Produces:**
- `splitSessions(list) -> { resume: S|null, others: S[] }` — ordina per `lastSeen` decrescente (assente = 0, stabile); `resume` è la prima.
- `filterLibrary(entries, filter) -> entries` — `entries` = `[id, c][]`; filter `'all'|'player'|'creature'`; `'player'` = `c.type !== 'creature'`, `'creature'` = `c.type === 'creature'`; filtro sconosciuto = all.
- `libraryMeta(c) -> string` — PG: `sheetSubtitle`-like "Classe · Livello N · Razza" omettendo i vuoti, "Personaggio" se niente; creatura: "Creatura · {Taglia IT} · CA {n}" omettendo i vuoti.
- `lastSeenLabel(ts, now) -> string` — "adesso" (<1 min), "oggi", "ieri", "N giorni fa", "" se ts non valido.

- [ ] Scrivere `test/homeView.html` (stile di `test/sheetView.html`) con: split (vuoto → `{resume:null, others:[]}`, ordinamento, `lastSeen` mancante in coda), filter (type mancante conta PG, filtro sconosciuto), meta (PG completo, PG vuoto, creatura con taglia `large` → "Grande"), lastSeenLabel (0/NaN → "", ieri, 3 giorni).
- [ ] `test/run.sh homeView.html` → FAIL (modulo mancante).
- [ ] Implementare `homeView.js`. Run → PASS.
- [ ] Commit `feat(rework): logica pura della home`.

### Task 2: Markup e stile della home

**Files:** Modify `index.html` (`#view-home`), `styles/home.css`, `src/views/home.js` (solo hook di markup, vedi Task 3).

- [ ] `#home-cards`: sezione `#home-resume` (titolo "Riprendi", hero con `#home-resume-card`), `#user-sessions-section` ("Altre sessioni", `#user-sessions-list`), riga `.home-actions` con scheda **Entra** (contiene `#form-join` con `#input-session-code`, `#join-char-picker`/`#join-char-list` come chip, `#input-pg-name`, `#input-pg-initiative`, submit) e scheda **Crea** (`#select-progression-mode`, `#btn-create-session`), poi `#character-library-section` con filtro (`#lib-filter`, bottoni `[data-filter]`), `#character-library-list`, `#btn-create-player`, `#btn-create-creature`; footer `.home-foot` con crediti icone (CC BY 3.0, `CREDITS.md`).
- [ ] Rimuovere `#character-preview-section` (legacy nascosto) e verificare con grep che nessun JS lo usi (`updateHomeAuthUI` lo tocca: togliere i riferimenti).
- [ ] Icone via `data-icon` (idratate da `CombatChrome.hydrateIcons`); emblema del login con icona `dragon`.
- [ ] `styles/home.css`: riscrivere con `--c-*` secondo il mockup (hero, `.home-actions` a 2 colonne → 1 sotto 760px, carte libreria `.lib-card`, chip `.pick-chip`, stati vuoti, footer). Eliminare regole morte (`.char-lib-entry`, `.btn-secondary` ecc.) dopo aver verificato che il JS non le usi più.
- [ ] Commit `feat(rework): markup e stile della home in stile Manuale`.

### Task 3: Render della home (`src/views/home.js`)

**Files:** Modify `src/views/home.js`.

**Interfaces — Consumes:** Task 1 (`splitSessions`, `filterLibrary`, `libraryMeta`, `lastSeenLabel`), `icon` da `../ui/icons.js`.

- [ ] `loadUserSessions`: `splitSessions(active)`; `resume` nel hero (`#home-resume-card`: codice, ruolo con `icon('crown'|'shield')`, nome personaggio, `lastSeenLabel`, bottone pieno "Rientra" con le stesse `data-*` e il click `.btn-rejoin` di oggi, Cronache `.btn-notes-session`, Rimuovi `.btn-delete-session`), `others` come righe compatte con gli stessi bottoni; nascondere la sezione che non ha voci. Un solo delegato di click per entrambi i contenitori.
- [ ] Il bottone di "Entra" è pieno solo se non c'è `resume` (classe `btn--primary` commutata in questo punto).
- [ ] `loadCharacterLibrary`: carte `.lib-card` (avatar `data:image/` o iniziale, `esc(name)`, `libraryMeta`, Apri scheda `data-action="open-sheet"`, Entra solo per non-creature, cestino `data-action="delete-char"`), filtro `[data-filter]` (stato in `state.libFilter`, non su Firebase), "Entra" apre inline `.lib-join` con campo codice e bottone (stesso submit `.char-lib-join` e stesso evento `dnd:join-with-character`, disabilitazione immediata).
- [ ] `deleteLibraryChar`: conferma in pagina (la carta mostra "Eliminare? Elimina / Annulla"), niente `confirm()`.
- [ ] `populateJoinPicker`: chip `.pick-chip` (selezionato `.selected`, `state.selectedJoinCharId` come oggi), chip "Nuovo personaggio" che deseleziona e svuota il nome.
- [ ] `_openNotesArchiveModal`: senza emoji, titolo "Cronache — {code}".
- [ ] Sostituire ogni emoji residua in `home.js` con `icon()`.
- [ ] Commit `feat(rework): render di sessioni e libreria in stile Manuale`.

### Task 4: Verifica, pulizia, documentazione, revisione

- [ ] Browser (due origini come in tappa 3): login → home; sessione creata e "Rientra"; join da codice con chip e con "Nuovo personaggio"; Entra dalla carta (doppio clic = un solo ingresso); filtro; elimina con Annulla/Elimina; Cronache; tema chiaro/notte; iframe 380/600/820/1024/1280 senza scroll orizzontale.
- [ ] Sweep: nessuna emoji in `index.html#view-home`, `home.js`, `home.css`; nessun colore letterale; nessun id perso (confronto prima/dopo).
- [ ] `test/run.sh` tutto verde. Aggiornare `CLAUDE.md` (righe architettura `homeView.js`, sezione Libreria/Sessioni, rimozione della frase sulle emoji della home).
- [ ] Revisione finale con un subagent (modello `opus`, focus = Review Focus sopra); un solo giro di fix con test RED→GREEN; ripulire la cartella di lavoro.
