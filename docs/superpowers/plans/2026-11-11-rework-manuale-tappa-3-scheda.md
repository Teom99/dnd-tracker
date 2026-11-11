# Rework "Manuale" — Tappa 3: Scheda personaggio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La scheda personaggio (`#view-character`) e il pannello di salita di livello passano al layout del mockup approvato — testata con anello XP, fascia vitale sempre in vista, colonna di caratteristiche/tiri salvezza/abilità, cinque schede (Combattimento · Incantesimi · Zaino · Capacità · Personaggio) — senza perdere nessun campo né funzione.

**Architecture:** Ricomposizione, come nella tappa 2: ogni campo `data-path`, ogni `id` e ogni handler resta com'è, cambia dove sta nel markup e quando è visibile. Le cinque schede sono pannelli (`.sheet-pane[data-pane]`) mostrati da `#view-character[data-tab]`; lo stato della scheda scelta è locale e ricordato. La logica pura nuova (scheda valida, progresso XP, "livello pronto", sottotitolo) sta in `src/logic/sheetView.js` ed è testata in pagina. Il CSS della scheda esce dal `<style>` inline di `index.html` e va in `styles/character.css`, convertito alle variabili `--c-*`.

**Tech Stack:** HTML + CSS + moduli ES6, nessun bundler. Test = pagine in `test/` eseguite con Chrome headless tramite `test/run.sh` (creato nel Task 0).

**Spec:** `docs/superpowers/specs/2026-11-10-rework-manuale-design.md` (sezione "Altre viste → Scheda personaggio" e inventario "Scheda personaggio") · mockup approvato `docs/superpowers/specs/2026-11-10-rework-manuale-mockup-scheda.html`.

## Global Constraints

- **Parità funzionale**: tutta la voce "Scheda personaggio" dell'inventario in fondo alla spec resta raggiungibile; spostare in una scheda va bene, togliere no.
- **Nessun `id`, `data-path`, `data-action`, `data-ability`, `data-skill`, `data-type`, `data-index`, `data-level` rinominato o rimosso** in `#view-character`. In particolare restano: `mod-{ab}`, `save-{ab}`, `skill-{sk}`, `passive-perception`, `spell-save-dc`, `spell-attack-bonus`, `spell-slots-list`, `cantrips-list`, `form-add-cantrip`, `cantrip-name`, `spells-by-level`, `inventory-list`, `form-add-item`, `item-name/qty/notes`, `class-features-list`, `section-class-features`, `death-successes`, `death-failures`, `form-add-attack`, `class-select`, `btn-levelup`, `btn-back-to-combat`, `error-message-sheet`, `sheet-sub`, `sheet-level-label`, `sheet-xp-fill`, `sheet-xp-text`, `avatar-file-input`.
- **Pattern di concorrenza di `CLAUDE.md` alla lettera**: i renderer che ricostruiscono `innerHTML` con campi dentro (`renderSpellSlots`, `renderInventory`, `renderClassFeatures`) continuano a usare `captureFocusState`/`restoreFocusState`; `populateSheet` continua a non toccare il campo attivo; nessuna scrittura Firebase nel listener della scheda se non quelle già presenti (sync verso il combattente con `prevX`).
- Le transazioni sul combattente avviate dalla scheda restano con `{ applyLocally: false }` (`NO_OPTIMISTIC`).
- Solo variabili `--c-*` / `--f-*` nel CSS nuovo; icone solo con `icon()`/`data-icon` (`CombatChrome.hydrateIcons` si può riusare: va chiamata anche sulla scheda); nessuna emoji come icona nei file della scheda a fine tappa.
- Un solo `.btn--primary` visibile nella scheda: "Sali di livello" quando il livello è pronto (altrimenti nessun primario). Nel pannello di salita di livello il primario è "Conferma".
- Dati che vengono da Firebase e finiscono in HTML: nella scheda sono scrivibili solo dal proprietario (`characters/{uid}`), ma i renderer già usano `escapeHtml`; non allentarlo. I dati del combattente mostrati nella scheda (vita attuale) passano da `safeCombatant`/`num`.
- Ramo `rework-manuale`, niente push. Commit in italiano con le righe di attribuzione della sessione.

## Review Focus

1. Un campo della scheda è in modifica (es. note libere, una cella dell'inventario, il massimo di uno slot) mentre arriva un aggiornamento non correlato → focus, testo e cursore restano; il campo in una scheda nascosta non viene mai toccato. *(verifica Task 2, passo 7)*
2. Scheda di un personaggio nuovo o con dati parziali (niente classe, caratteristiche assenti, XP assente) → nessun `NaN`/`undefined` visibile, sottotitolo "—", anello a 0, "Sali di livello" assente senza classe. *(test Task 1: `sheetSubtitle`, `xpProgress`)*
3. Scheda scelta salvata non valida, o storage bloccato → si apre "Combattimento", senza errori. *(test Task 1: `readSheetTab`)*
4. Scheda aperta dalla libreria della home (nessuna sessione) → niente vita attuale né dati di combattimento, nessun errore, "Indietro" torna alla home. *(verifica Task 3, passo 6)*
5. Livello 20, XP enorme o negativo → anello fermo tra 0 e 100%, "Sali di livello" assente a 20. *(test Task 1: `xpProgress`, `levelUpReady`)*

## File Structure

| File | Cosa cambia |
|---|---|
| `test/run.sh` (nuovo) | Esegue le pagine di test con Chrome headless e stampa l'ultima riga di ciascuna |
| `src/logic/sheetView.js` (nuovo) | `SHEET_TABS`, `readSheetTab`/`saveSheetTab`, `xpProgress`, `levelUpReady`, `sheetSubtitle` |
| `test/sheetView.html` (nuovo) | Test in pagina della logica sopra |
| `index.html` | Nuovo markup di `#view-character`; via il CSS inline della scheda (blocchi "Sheet overlay" e "Scheda personaggio (tomo)") |
| `styles/character.css` | Layout nuovo, CSS spostato dall'inline, variabili alias → `--c-*` |
| `src/ui/SheetUI.js` | Anello XP, sottotitolo, vita attuale, slot a rombi, emoji → `icon()` |
| `src/views/sheet.js` | Schede (stato, clic, tastiera), pulsante di livello, idratazione icone, vitals dalla sessione |
| `src/ui/LevelUpUI.js` | Titolo senza emoji, bottoni; resto invariato |
| `app.js` | Aggiorna la vita attuale della scheda a ogni snapshot di sessione |

---

### Task 0: Esecutore dei test nel repo

**Files:** Create `test/run.sh`.

- [ ] **Step 1:** Creare `test/run.sh`:

```bash
#!/bin/bash
# Uso: test/run.sh pagina.html [...]  (senza argomenti: tutte le pagine tranne il campionario)
# Avvia un server statico se serve e apre ogni pagina di test in Chrome headless; legge #summary.
cd "$(dirname "$0")/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
curl -s -o /dev/null http://localhost:8000/index.html || { (python3 -m http.server 8000 >/dev/null 2>&1 &); sleep 1; }
pages=("$@"); [ ${#pages[@]} -eq 0 ] && pages=($(cd test && ls *.html | grep -v componenti))
rc=0
for p in "${pages[@]}"; do
  dom=$("$CHROME" --headless=new --disable-gpu --virtual-time-budget=8000 --dump-dom "http://localhost:8000/test/$p" 2>/dev/null)
  s=$(echo "$dom" | grep -o '<div id="summary"[^>]*>[^<]*' | sed 's/.*>//')
  echo "$p: ${s:-NESSUN RISULTATO}"
  echo "$dom" | grep -o 'class="t ko">[^<]*' | sed 's/.*>/  FAIL: /'
  case "$s" in "✓"*) ;; *) rc=1;; esac
done
exit $rc
```

- [ ] **Step 2:** `chmod +x test/run.sh && test/run.sh` → Expected: tutte le pagine esistenti `✓` (hardening, trajectory, visibility, combatChrome, shapes, theme, icons, combatantRules).
- [ ] **Step 3:** Commit `Chore: test/run.sh per eseguire i test in pagina`.

---

### Task 1: Logica pura della scheda

**Files:** Create `src/logic/sheetView.js`, `test/sheetView.html`. Modify `src/ui/SheetUI.js` (le funzioni locali `XP_THRESHOLDS`/calcolo XP in `updateComputedValues` passano a usare il modulo).

**Interfaces — Produces:**
- `XP_THRESHOLDS: number[]` (le stesse venti soglie di `SheetUI.js` riga 17 e `UI.js`; **una sola copia**: `UI.js` e `SheetUI.js` la importano da qui).
- `SHEET_TABS = ['combat','spells','bag','features','character']`.
- `readSheetTab(): string` / `saveSheetTab(tab): void` — chiave `localStorage['dnd-sheet-tab']`, default `'combat'`, valore non valido → `'combat'`, `try/catch` come `theme.js`; `saveSheetTab` ignora valori non validi.
- `xpProgress(level, xp): { pct: number, hi: number|null, max: boolean }` — `level` non numerico → 1; `pct` tra 0 e 1 (xp negativo/NaN → 0, oltre la soglia → 1); a `level >= 20`: `{ pct: 1, hi: null, max: true }`; altrimenti `hi = XP_THRESHOLDS[level]`.
- `levelUpReady({ level, xp, mode, granted }): boolean` — `mode === 'xp'`: `level < 20 && xp >= XP_THRESHOLDS[level]`; altrimenti `granted === true` (e `level < 20`).
- `sheetSubtitle(d): string` — come oggi (`race · "<classe> Lv.<n>" · sottoclasse · background · allineamento`, parti vuote saltate), `'—'` se nessuna.

- [ ] **Step 1:** Scrivere `test/sheetView.html` (stesso telaio di `test/hardening.html`) con questi casi:

```js
eq(xpProgress(4, 1950), { pct: 1950/6500, hi: 6500, max: false });
eq(xpProgress(1, 0),    { pct: 0, hi: 300, max: false });
eq(xpProgress(1, 9999), { pct: 1, hi: 300, max: false });      // oltre la soglia: fermo al 100%
eq(xpProgress(1, -50),  { pct: 0, hi: 300, max: false });
eq(xpProgress(1, NaN),  { pct: 0, hi: 300, max: false });
eq(xpProgress(undefined, 100), { pct: 100/300, hi: 300, max: false });
eq(xpProgress(20, 400000), { pct: 1, hi: null, max: true });
eq(xpProgress(25, 1),      { pct: 1, hi: null, max: true });
eq(levelUpReady({ level: 3, xp: 900, mode: 'xp' }), true);
eq(levelUpReady({ level: 3, xp: 899, mode: 'xp' }), false);
eq(levelUpReady({ level: 20, xp: 999999, mode: 'xp' }), false);
eq(levelUpReady({ level: 3, xp: 0, mode: 'milestone', granted: true }), true);
eq(levelUpReady({ level: 3, xp: 99999, mode: 'milestone', granted: false }), false);
eq(levelUpReady({ level: 20, mode: 'milestone', granted: true }), false);
eq(sheetSubtitle({}), '—');
eq(sheetSubtitle(null), '—');
eq(sheetSubtitle({ race: 'Mezzelfo', class: 'Ladra', level: 4, subclass: 'Furfante arcano', background: 'Criminale', alignment: 'Caotico neutrale' }),
   'Mezzelfo · Ladra Lv.4 · Furfante arcano · Criminale · Caotico neutrale');
eq(sheetSubtitle({ class: 'Ladra' }), 'Ladra');
eq(sheetSubtitle({ level: 3 }), '—');                           // il livello da solo non basta
eq(sheetSubtitle({ race: '  ', class: ' Ladra ', level: 2 }), 'Ladra Lv.2');
// scheda scelta: default, valore non valido, storage che lancia (come in test/combatChrome.html)
```

- [ ] **Step 2:** `test/run.sh sheetView.html` → FAIL (modulo assente).
- [ ] **Step 3:** Implementare `src/logic/sheetView.js` con le firme sopra.
- [ ] **Step 4:** `test/run.sh sheetView.html` → PASS. In `SheetUI.updateComputedValues` sostituire il calcolo della barra XP con `xpProgress` e il sottotitolo con `sheetSubtitle`; `XP_THRESHOLDS` di `SheetUI.js` e `UI.js` importate dal modulo (via le due copie locali). `test/run.sh` completo verde.
- [ ] **Step 5:** Commit `feat(rework): logica pura della scheda (XP, livello pronto, schede)`.

---

### Task 2: Struttura, schede e stile della scheda

**Files:** Modify `index.html` (`#view-character`, righe ~740-930; via i blocchi CSS inline "Sheet overlay" e "Scheda personaggio (tomo)"), `styles/character.css`, `src/views/sheet.js` (`bindSheetEvents`), `src/ui/SheetUI.js` (`populateSheet`: `--xp` sul ritratto).

**Decisioni (dal mockup):**
- **Barra in alto** (`.sheet-overlay-header`, resta): `#btn-back-to-combat` con `data-icon="back"` "Indietro", titolo "Scheda personaggio", `.rule-double` sotto.
- **Testata** (`.sheet-head`): ritratto `.portrait` (resta cliccabile per caricare l'avatar) dentro `.pframe` con anello XP (`--xp` 0–1 da `xpProgress`; classe `.lvlup` = oro pieno e pulsante quando `levelUpReady`); `input.sheet-name-input[data-path=characterName]` grande in Alegreya SC; `#sheet-sub` sottotitolo; riga XP con `#sheet-level-label`, `#sheet-xp-fill` e `#sheet-xp-text` (stessi id); `#btn-levelup` a destra.
- **Fascia vitale** (`.vitals`) subito sotto: Vita (`#sheet-hp-current` / `input[data-path=hpMax]` + HP temporanei `input[data-path=tempHp]` + barra), CA `input[data-path=armorClass]`, Velocità `speed`, Iniziativa `initiativeMod`, Competenza `proficiencyBonus` (oggi sta in "Caratteristiche"), Ispirazione (sola lettura: stella accesa se `combatants/{id}/inspiration`; fuori sessione nascosta). Gli input sono quelli di oggi spostati: stessi `data-path`/`data-number`/`min`/`max`.
- **Colonna sinistra** (`.sheet-left`): Caratteristiche (griglia 3×2: `abilities/*` input + `#mod-*`), Tiri salvezza (`.save-row`, `#save-*`), Abilità in `<details>` ripiegabile (chiusa di default, `.skill-row`, `#skill-*`), Percezione passiva `#passive-perception`.
- **Schede** a destra: barra `.sheet-tabs[role=tablist]` con cinque `button[role=tab][data-tab]` (icone `sword`, `spellbook`, `potion`, `star`, `quill`) e cinque `section.sheet-pane[role=tabpanel][data-pane]`:
  - `combat`: dado vita (`hitDiceType`, `hitDiceUsed`), TS morte (`#death-successes`/`#death-failures`), Attacchi (lista + `#form-add-attack`);
  - `spells`: tutta la sezione "Magia" di oggi (`spellcastingAbility`, `#spell-save-dc`, `#spell-attack-bonus`, `spellBonusModifier`, slot, trucchetti, incantesimi per livello);
  - `bag`: valute `currency/*`, `#inventory-list`, `#form-add-item`;
  - `features`: `#section-class-features` + `#class-features-list`, poi capacità/lingue/competenze/note libere (`features`, `languages`, `otherProficiencies`, `notes`);
  - `character`: Identità (tutti i campi di oggi, compreso `#class-select`) e "Personalità & legami" (`<details>`, `personalityTraits`, `ideals`, `bonds`, `flaws`).
- Le sezioni dentro le schede non sono più `<details class="tome">`: diventano blocchi con titolo `.rule-head`. L'unico ripiegabile oltre alle abilità è "Personalità & legami".
- Stato: `#view-character[data-tab="<tab>"]` (CSS mostra un pannello); clic sul tab → `saveSheetTab` + attributo; frecce sinistra/destra spostano il tab (e il fuoco) come in `role=tablist`; `aria-selected` e `tabindex` coerenti. All'apertura (`openCharacterSheet`, `openLibrarySheet`) si legge `readSheetTab()`.
- Il CSS spostato dall'inline va in `styles/character.css`, convertito con la stessa mappa alias → `--c-*` usata in tappa 2 (`recolor` per i letterali: nessun colore letterale a fine task). Via `.orn-c` e `.tome` non usati.
- `CombatChrome.hydrateIcons(document.getElementById('view-character'))` all'apertura (le icone nel markup statico sono `data-icon`).

- [ ] **Step 1:** Riscrivere il markup di `#view-character` come sopra, **spostando i nodi esistenti** (copiare per intero i blocchi `<div class="skill-row">` ecc.; non riscriverli).
- [ ] **Step 2:** Controllo meccanico di parità: ogni `id` e ogni `data-path` presenti in `#view-character` prima (da `git show HEAD:index.html`) sono presenti dopo; eseguire
  `python3 - <<'EOF'` che estrae `id="…"`, `data-path="…"`, `data-ability`, `data-skill`, `data-type`, `data-action` dalle due versioni e stampa le differenze → Expected: nessuna mancanza (le aggiunte sono ammesse). Eseguire anche: ogni `getElementById('…')` di `SheetUI.js`/`sheet.js`/`LevelUpUI.js` esiste in `index.html`.
- [ ] **Step 3:** CSS in `styles/character.css` (testata, fascia, colonna sinistra, schede, pannelli, righe); eliminare dall'inline di `index.html` i due blocchi e la regola `body.sheet-only .combat-shell`… **solo** se non più usata (verificare con grep prima).
- [ ] **Step 4:** `sheet.js`: schede (clic, frecce, `aria-*`), lettura/salvataggio, idratazione icone; `SheetUI.populateSheet`: `--xp` e `.lvlup` sul `.pframe` (con `levelUpReady`: dati dalla scheda `d.level`/`d.xp` e, in sessione, `state.snapshot.xp[myCombatantId]`, `progressionMode`, `levelUpGranted[myCombatantId]`).
- [ ] **Step 5:** `test/run.sh` verde.
- [ ] **Step 6: Verifica nel browser**, chiaro e notte: aprire la scheda dal combattimento e dalla libreria della home; ogni scheda mostra i suoi campi; riaprendo la scheda resta quella scelta; un valore scritto in un campo di una scheda si ritrova dopo il cambio scheda e dopo il ricaricamento (si scrive su Firebase come prima); caratteristiche → modificatori, tiri salvezza e abilità si ricalcolano; i pallini di competenza ciclano; TS morte; aggiunta/rimozione di attacco, trucchetto, incantesimo, oggetto, capacità.
- [ ] **Step 7 (Review Focus 1):** con il cursore dentro la textarea "Note libere", scrivere una modifica ad altro campo della stessa scheda da un'altra via (`state.sheet.setField('speed', 10)` da console): la textarea mantiene nodo, focus, testo, cursore; la scheda "Combattimento" (nascosta) si aggiorna senza errori.
- [ ] **Step 8:** Commit `feat(rework): scheda personaggio a testata, fascia vitale e cinque schede`.

---

### Task 3: Testata e fascia vitale vive

**Files:** Modify `src/ui/SheetUI.js`, `src/views/sheet.js`, `app.js`.

**Interfaces — Produces:** `SheetUI.updateVitals(combatant | null, { inSession: boolean })` — scrive `#sheet-hp-current` (`num(hpCurrent)`) e la larghezza della barra vita; mostra/nasconde `.v-current` (vita attuale) e la stella dell'ispirazione (`#sheet-insp`, accesa se `combatant.inspiration === true`) secondo `inSession`. Non lancia mai con `combatant` nullo o con campi non numerici (usa `num` da `src/utils/sanitize.js`).

**Decisioni:**
- La vita **attuale** appartiene al combattente (`sessions/{code}/combatants/{id}/hpCurrent`), non alla scheda: nella scheda è **sola lettura** e si cambia con danno/cura dal combattimento. Il massimo e i PF temporanei sono i campi della scheda, modificabili come oggi (il sync verso il combattente resta quello di `setupSheetListener`).
- Fuori sessione (scheda aperta dalla libreria della home) `inSession` è falso: non si mostrano vita attuale né ispirazione, solo i campi della scheda.
- Il pulsante `#btn-levelup` resta visibile nelle stesse condizioni di oggi (`_updateLevelUpButton`: classe impostata e livello 1–19), ma è **primario solo quando `levelUpReady`**, altrimenti è un `.btn` normale. (Il mockup lo mostrava solo a livello pronto: si tiene visibile anche prima perché oggi il master può concedere il livello a voce e il giocatore deve poterlo fare.) Il bottone usa `data-icon="crown"`.
- `app.js`: nel listener di sessione, in coda e solo se `#view-character` è visibile (`body.sheet-only`), chiamare `SheetUI.updateVitals(myCombatant, { inSession: true })` e ricalcolare il livello pronto; nessuna scrittura Firebase.
- `exitToHome` e l'apertura da libreria chiamano `updateVitals(null, { inSession: false })`.

- [ ] **Step 1:** Test in `test/sheetView.html` non servono (DOM). Scrivere comunque un caso puro per l'ordine dei dati: `levelUpReady` già coperto in Task 1.
- [ ] **Step 2:** Implementare `updateVitals`, la chiamata dal listener e l'aggiornamento di `_updateLevelUpButton` (primario/normale).
- [ ] **Step 3:** `test/run.sh` verde.
- [ ] **Step 4:** Commit `feat(rework): vita attuale, ispirazione e livello pronto sulla scheda`.
- [ ] **Step 5: Verifica con due client** (master su `localhost`, giocatore su `127.0.0.1`, come in tappa 2): il master infligge danni al giocatore con la scheda aperta → la vita attuale si aggiorna da sola; il master concede l'ispirazione → la stella si accende; il giocatore sale di XP (master "Assegna XP") oltre soglia → anello oro e bottone primario.
- [ ] **Step 6 (Review Focus 4):** scheda aperta dalla libreria della home: nessuna vita attuale né ispirazione, nessun errore in console, "Indietro" torna alla home.

---

### Task 4: Schede Incantesimi, Zaino, Capacità

**Files:** Modify `src/ui/SheetUI.js` (`renderSpellSlots`, `renderCantrips`, `renderSpellsByLevel`, `renderInventory`, `renderAttacks`, `renderClassFeatures`), `styles/character.css`.

**Decisioni:**
- **Slot a rombi** come nel popover del dock: ogni slot è un `button.dia.free|used[data-level]` (stesse classi di `UI.renderSpellsPopover`; il CSS dei rombi di `combat.css` va in `base.css` per condividerlo o si duplica con le variabili). Clic su un rombo pieno → `onSetUsed(lvl, used+1)`, su uno vuoto → `used-1`, con gli stessi limiti di oggi. Il massimo per livello resta un `input.slot-max-input[data-level]` accanto (modifica inline). Spariscono i bottoni −/+ (li sostituiscono i rombi); `data-delta` non è più usato: aggiornare il gestore di clic. Il ridisegno resta avvolto in `captureFocusState`/`restoreFocusState`.
- Tutte le emoji dei renderer → `icon()`: `✕` → `icon('close')`, `✔` → `icon('check')`, `✎` → `icon('edit')`; ogni bottone solo-icona ha `aria-label`.
- Trucchetti e incantesimi: righe come nel mockup (nome, tipo/livello, segno dei preparati `.prep[aria-pressed]` invariato); "Aggiungi" in un campo (il form esiste già per trucchetti e per livello: restano, riga più compatta). La ricerca dei nomi (`app.js`, `_showSpellSuggestions`) continua a funzionare sugli stessi `id`/selettori.
- Attacchi: riga `nome / dettagli / bonus` con rimozione; nessun pulsante "Tira" (non esiste, è in `TODO.txt`).
- Zaino: valute in una fascia, righe oggetto con modifica inline come oggi; resto invariato.

- [ ] **Step 1:** Modificare i renderer e il CSS.
- [ ] **Step 2:** `test/run.sh` verde.
- [ ] **Step 3: Verifica nel browser:** slot — clic su rombi usa/recupera (si vede anche nel popover del dock e viceversa), cambio del massimo, ridisegno con un campo in modifica (Review Focus 1: scrivere nel campo "Nome trucchetto" e provocare un aggiornamento della scheda); aggiungere/rimuovere trucchetto, incantesimo (con suggerimenti), segnare un preparato; oggetti: aggiungi, modifica, salva, annulla, rimuovi; capacità di classe: aggiungi, modifica, rimuovi.
- [ ] **Step 4:** Commit `feat(rework): incantesimi a rombi, zaino e capacità in stile Manuale`.

---

### Task 5: Salita di livello

**Files:** Modify `src/ui/LevelUpUI.js` (titolo senza emoji), `index.html` (`#levelup-modal`), `styles/character.css`, `src/views/sheet.js` (`_openLevelUpModal`: il `confirm()` nativo resta).

**Decisioni:** Il pannello resta la finestra `#levelup-modal` (`.veil` + `.modal-frame`); contenuto e flusso invariati (capacità del livello, PF massimi suggeriti, capacità modificabili, conferma). Cambia: titolo `${icon('crown')} Livello ${n}: classe` al posto di `⬆ Level Up: …`, riquadro riassuntivo come nel mockup (competenza, dado vita, slot nuovi) **solo se i dati sono già calcolati in `changes`** (altrimenti il riquadro non si mostra: non si inventano valori), campi e righe con le classi dei campi nuovi, un solo `.btn--primary` ("Conferma livello N"). Il flusso di creazione guidata (`openCreation`, usato dalla home) condivide la finestra: ne cambia solo l'aspetto comune; la sua riorganizzazione è nella tappa 4.

- [ ] **Step 1:** Modifiche e CSS.
- [ ] **Step 2:** `test/run.sh` verde.
- [ ] **Step 3: Verifica nel browser:** da una scheda con classe (es. Rogue, livello 1): "Sali di livello" → conferma nativa → finestra con capacità del livello e PF suggeriti → Conferma → livello +1, `hpMax` +, slot aggiornati, capacità aggiunte, anello XP/pulsante coerenti; Annulla non cambia nulla; a livello 20 il pulsante è assente (Review Focus 5).
- [ ] **Step 4:** Commit `feat(rework): salita di livello in stile Manuale`.

---

### Task 6: Telefono

**Files:** Modify `styles/character.css`, `src/views/sheet.js` (solo se serve scorrere il tab attivo in vista).

**Decisioni** (mockup 5): ≤760px una colonna: testata (ritratto + nome/sottotitolo, bottone di livello sotto a tutta larghezza), fascia vitale a 3 colonne con la vita su tutta la riga, poi la colonna sinistra (caratteristiche 3×2, tiri salvezza, abilità ripiegabile), poi barra schede scorrevole in orizzontale (`scrollbar-width: none`, tab attivo portato in vista con `scrollIntoView({inline:'nearest'})`) e il pannello. "Indietro" resta in alto. Nessuno scorrimento orizzontale della pagina; target touch ≥ 40px per tab, rombi e pallini (area cliccabile ≥ 36px, anche se il disegno è più piccolo).

- [ ] **Step 1:** CSS e `scrollIntoView`.
- [ ] **Step 2: Verifica** in iframe a 380, 600, 820, 1024, 1280 (stesso metodo della tappa 2), chiaro e notte: `documentElement.scrollWidth <= innerWidth`, ogni scheda raggiungibile, la scheda lunga scorre nel suo contenitore, la testata non si sovrappone.
- [ ] **Step 3:** Commit `feat(rework): scheda personaggio su telefono`.

---

### Task 7: Chiusura della tappa

- [ ] **Step 1: Emoji.** Nessuna emoji come icona in `src/ui/SheetUI.js`, `src/ui/LevelUpUI.js`, `src/views/sheet.js`, `styles/character.css`, e nel markup di `#view-character` e `#levelup-modal` (scansione con una regex su `[\U0001F300-\U0001FAFF☀-➿⬀-⯿]` e sui simboli `✕ ✔ ✎ ⬨ ⬆`; restano ammessi `·`, `×`, `→`, `—`, `○ ◐` nelle note di legenda delle abilità solo se sostituiti da pallini CSS: preferire i pallini).
- [ ] **Step 2: Alias.** In `styles/character.css` nessuna variabile dei vecchi vocabolari (`--gold`, `--bone`, `--mut`, `--faint`, `--bg0..3`, `--line*`, `--border-warm`, `--text-muted`, `--font-ui`, `--font-display`, `--radius`) e nessun colore letterale (grep come in tappa 2). Il blocco alias in `base.css` resta per home e nave.
- [ ] **Step 3: Parità.** Spuntare una a una le voci "Scheda personaggio" dell'inventario della spec (testata con nome, classe e livello, barra XP; caratteristiche, tiri salvezza, abilità con competenza/expertise; CA, HP max, velocità, taglia, HP temporanei, dadi vita; attacchi; trucchetti, incantesimi per livello con preparati; slot usati e massimo; caratteristica da incantatore e modificatore extra; inventario; privilegi di classe e statistiche personalizzate; TS morte; avatar; level-up; ritorno a combattimento o home) e annotare nel ledger in quale scheda si trova ciascuna.
- [ ] **Step 4: Due client.** Con master e giocatore: il giocatore modifica HP max, CA, velocità, nome e avatar dalla scheda → il combattente si aggiorna per il master (sync esistente); il giocatore cambia slot dalla scheda → il popover del dock mostra lo stesso; il master danneggia il giocatore → vita attuale nella scheda; rientro in sessione con la scheda aperta e poi chiusa (nessun ritorno alla home; Review Focus del rientro di tappa 1).
- [ ] **Step 5:** Tutta la suite `test/run.sh` verde.
- [ ] **Step 6:** Aggiornare `CLAUDE.md`: architettura file (`sheetView.js`, `test/run.sh`), sezione "Scheda personaggio" (schede, `data-tab`, `updateVitals`, dove vive la vita attuale), regola "le sezioni sono pannelli, i campi non si rinominano", pattern "Aggiungere un campo alla scheda" aggiornato (dentro quale `.sheet-pane`).
- [ ] **Step 7:** Commit `Docs: CLAUDE.md aggiornato alla tappa 3 del rework`. Preparare il mockup della tappa 4 (home e libreria).
