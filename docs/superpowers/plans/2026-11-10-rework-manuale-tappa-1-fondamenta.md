# Rework "Manuale" — Tappa 1: Fondamenta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tutto il sito passa all'identità "Manuale" (carta, inchiostro, caratteri) in due temi, chiaro e notte, con interruttore, componenti di base rifatti e un modulo icone pronto — senza cambiare layout né logica.

**Architecture:** Un nuovo vocabolario di variabili CSS (`--c-*`, `--f-*`) definito una volta in `styles/base.css` per i due temi. Le variabili vecchie (due vocabolari: `--gold/--text-muted/--border-warm…` e `--bg0/--bone/--mut/--line…`) diventano alias delle nuove, così ogni schermata cambia aspetto senza toccarne il CSS; gli alias si tolgono schermata per schermata nelle tappe successive. Tema scelto da `data-theme` su `<html>`, deciso da una funzione pura testabile.

**Tech Stack:** HTML + CSS + moduli ES6, nessun bundler. Test = pagine HTML in `test/` aperte nel browser (come `test/shapes.html`). Niente Node sulla macchina: server locale con `python3 -m http.server 8000` dalla radice del progetto.

**Spec:** `docs/superpowers/specs/2026-11-10-rework-manuale-design.md` · mockup `docs/superpowers/specs/2026-11-10-rework-manuale-mockup.html` (classi `.t-a` e `.t-a.night`).

**Ambito:** solo la tappa 1 della spec. Le tappe 2–5 (combattimento, scheda, home, resto) avranno ciascuna il proprio piano, scritto dopo che l'utente ha approvato il mockup di quella schermata, come prevede la spec.

## Global Constraints

- Nessuna funzionalità rimossa, nessun cambio a modello dati o logica. In questa tappa non si toccano `src/data/`, `src/logic/`, né la struttura HTML delle viste.
- `id`, `data-action`, `data-path`, `data-draw-tool`, `data-shape` e le classi usate dal JS (`hidden`, `master-only`, …) restano identici.
- Pattern di concorrenza di `CLAUDE.md` invariati (in questa tappa non si scrive codice che li tocchi; se un passo sembra richiederlo, fermarsi).
- Nessuna dipendenza di build, nessuna richiesta di rete nuova oltre a Google Fonts.
- Tutti i colori nuovi passano da variabili `--c-*`. Nessun colore letterale nuovo nei componenti.
- Lavoro sul ramo `rework-manuale`; `main` non si tocca; niente push senza richiesta dell'utente.
- Commit in italiano nello stile del repo (`feat(rework): …`, `Fix: …`), con le righe di attribuzione della sessione.

## Review Focus

1. `localStorage` contiene un valore di tema non valido (es. il vecchio `"old"`, `"purple"`, stringa vuota) → si usa il tema di sistema, senza errori. *(test in Task 1)*
2. `localStorage` non disponibile o che lancia (navigazione privata) → il sito si apre col tema di sistema e l'interruttore funziona per la sessione. *(test in Task 1)*
3. Primo caricamento in tema notte → nessun lampo di pagina chiara prima che parta `app.js`. *(verifica in Task 1, passo 6)*
4. Nome icona inesistente passato a `icon()` → stringa vuota e `console.warn`, mai `undefined` scritto nell'HTML. *(test in Task 4)*
5. Testo che dopo il cambio palette resta chiaro su carta chiara (o scuro su carta scura) per via di un colore letterale rimasto → nessun testo illeggibile in home, combattimento, scheda, nave, finestre, in entrambi i temi. *(verifica in Task 3, passo 5)*

---

### Task 0: Correzione del rientro su `main`, poi ramo

Nel working tree ci sono modifiche non committate che non c'entrano col rework: la correzione "personaggio morto / 1 HP al rientro" (`app.js`, `src/data/Combatant.js`, `src/logic/combatantRules.js`). Non devono finire mescolate al rework.

- [ ] **Step 1:** Chiedere all'utente se ha provato la correzione in sessione reale e se va committata su `main`. Senza un sì esplicito, non committare su `main`: creare invece il ramo `fix-rientro-hp` da `main` e committarla lì.
- [ ] **Step 2:** Commit della sola correzione: `Fix: personaggio morto o a 1 HP al rientro in sessione`.
- [ ] **Step 3:** Commit separato di spec, mockup e piani: `Docs: design e piano del rework "Manuale"`.
- [ ] **Step 4:** `git switch -c rework-manuale` a partire dal commit che contiene la correzione.

Verifica: `git status` pulito, `git log --oneline -3` mostra i commit attesi.

---

### Task 1: Tema chiaro/notte

**Files:**
- Create: `src/utils/theme.js`, `test/theme.html`
- Modify: `index.html` (script in `<head>`, righe ~16-25; pannello `#theme-panel` e il suo `<script>`, righe ~1454-1530), `app.js:23-36`

**Interfaces — Produces:**
- `resolveTheme(saved: string|null, prefersDark: boolean): 'light'|'night'` — `saved` vale solo se è esattamente `'light'` o `'night'`; altrimenti decide `prefersDark`.
- `readSavedTheme(): string|null` e `saveTheme(theme): void` — chiave `localStorage` **`dnd-theme`**; entrambe racchiuse in try/catch (ritornano `null` / non fanno nulla se lo storage lancia).
- `applyTheme(theme): void` — imposta `document.documentElement.dataset.theme`.
- `toggleTheme(): 'light'|'night'` — inverte, applica, salva, ritorna il nuovo tema.
- `initTheme(): void` — applica `resolveTheme(readSavedTheme(), matchMedia('(prefers-color-scheme: dark)').matches)`; se non c'è scelta salvata, segue i cambi di sistema a pagina aperta.
- Contratto DOM: `<html data-theme="light|night">` sempre valorizzato.

- [ ] **Step 1: Scrivere `test/theme.html`** nello stile di `test/shapes.html` (importa il modulo, stampa PASS/FAIL per riga, titolo verde/rosso). Casi:

```js
eq(resolveTheme('light', true),  'light');
eq(resolveTheme('night', false), 'night');
eq(resolveTheme(null, true),     'night');
eq(resolveTheme(null, false),    'light');
eq(resolveTheme('old', false),   'light');   // vecchia chiave/valore
eq(resolveTheme('purple', true), 'night');
eq(resolveTheme('', true),       'night');
// storage che lancia
const real = Object.getOwnPropertyDescriptor(window, 'localStorage');
Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); }, configurable: true });
eq(readSavedTheme(), null);
noThrow(() => saveTheme('night'));
Object.defineProperty(window, 'localStorage', real);
// toggle
applyTheme('light'); eq(toggleTheme(), 'night'); eq(document.documentElement.dataset.theme, 'night');
```

- [ ] **Step 2:** Aprire `http://localhost:8000/test/theme.html` → FAIL (modulo inesistente).
- [ ] **Step 3:** Implementare `src/utils/theme.js` con le firme sopra.
- [ ] **Step 4:** Riaprire la pagina di test → tutte PASS.
- [ ] **Step 5: Agganciare al sito.**
  - In `<head>` di `index.html`, sostituire lo script che legge `dnd-rework-tweaks` e `theme` con uno script inline (non modulo, deve girare prima del primo paint) che replica `resolveTheme` in tre righe e imposta `data-theme`. Commento: "duplicato minimo di src/utils/theme.js per evitare il lampo; tenere allineati".
  - In `app.js` sostituire `initTheme`/`toggleTheme` locali (righe 23-36) con l'import da `src/utils/theme.js`; `#btn-theme-toggle-home` e `#btn-theme-toggle-combat` chiamano `toggleTheme()`.
  - Rimuovere da `index.html` `#theme-panel` e il suo script (palette/ornament/typeface): il sistema a tweak sparisce. Rimuovere dal CSS le regole `.theme-old`, `[data-palette]`, `[data-ornament]`, `[data-typeface]`, `.tp-*`.
  - Le chiavi `theme` e `dnd-rework-tweaks` non vengono più lette (non serve cancellarle).
- [ ] **Step 6: Verifica nel browser.** Con `localStorage['dnd-theme']='night'`, ricaricare con throttling CPU attivo: lo sfondo non passa mai dal chiaro. Cliccare l'interruttore in home e in combattimento: `data-theme` cambia e sopravvive al reload. `grep -rn "theme-old\|dnd-rework-tweaks\|data-palette\|tp-swatch" index.html app.js styles src` → nessun risultato.
- [ ] **Step 7:** Commit `feat(rework): tema chiaro/notte con interruttore`.

---

### Task 2: Variabili, carta e caratteri

**Files:**
- Modify: `styles/base.css` (blocco `:root` in testa e ovunque siano definite `--bg0`, `--bone`, `--mut`, `--line`, `--font-display`, `--font-ui`: cercarle con `grep -n -- "--bg0:\|--bone:\|--font-display:" styles index.html`), `index.html` (link Google Fonts, riga 9)

**Interfaces — Produces** (variabili su `:root`, ridefinite sotto `:root[data-theme="night"]`):

| Variabile | Chiaro | Notte |
|---|---|---|
| `--c-paper` | `#efe3c8` | `#1d1814` |
| `--c-paper-hi` (campi, segnalini) | `#f6ecd6` | `#2a221a` |
| `--c-paper-lo` (riga attiva, hover) | `#e2d2ad` | `#2e261d` |
| `--c-track` (fondo barre) | `#d3c19a` | `#3a3024` |
| `--c-text` | `#2b1d12` | `#e9dcc0` |
| `--c-mute` | `#7a6548` | `#a08d6e` |
| `--c-rule` | `#b9a57f` | `#5a4a34` |
| `--c-heading` | `#6b1d10` | `#d98a6a` |
| `--c-accent` | `#6b1d10` | `#b5452f` |
| `--c-on-accent` | `#f6ecd6` | `#fbf1dc` |
| `--c-gold` | `#b8892b` | `#c9a24a` |
| `--c-pc` | `#3f6b3a` | `#7fb26f` |
| `--c-foe` | `#9a2a1c` | `#d9604c` |
| `--c-ally` | `#2f5f7d` | `#6fa8c9` |
| `--c-map` | `#e6d6b3` | `#262019` |
| `--c-map-edge` | `#8a7350` | `#5a4a34` |
| `--c-map-line` | `rgba(74,52,28,.22)` | `rgba(233,220,192,.12)` |
| `--c-wall` | `#4a3826` | `#8a7758` |
| `--c-reach` | `rgba(107,29,16,.14)` | `rgba(217,138,106,.18)` |
| `--paper-grain` | i due data-URI di rumore SVG del mockup (`.t-a` e `.t-a.night`) | |
| `--f-display` | `"Alegreya SC", Georgia, serif` | = |
| `--f-body` | `"Alegreya", Georgia, serif` | = |
| `--r` | `3px` | = |

`--c-dead` = `var(--c-mute)`, `--c-heal` = `var(--c-pc)`, `--c-dmg` = `var(--c-foe)`. Anche `color-scheme: light` / `dark` nei due blocchi.

**Alias delle variabili vecchie** (definiti una sola volta su `:root`, sotto le nuove; è il punto di partenza — se una schermata rende male, si corregge l'alias, non il componente):

| Vecchie | → |
|---|---|
| `--bg-deep`, `--bg0`, `--bg-card`, `--bg1` | `--c-paper` |
| `--bg-card-alt`, `--bg2`, `--bg-hover`, `--active-turn-bg` | `--c-paper-lo` |
| `--bg3`, `--hp-bar-bg`, `--hp-bar-border` | `--c-track` |
| `--ink`, `--input-bg` | `--c-paper-hi` |
| `--text`, `--bone`, `--text-primary`, `--text-bright` | `--c-text` |
| `--text-muted`, `--mut`, `--faint`, `--gold-muted` | `--c-mute` |
| `--border-warm`, `--line`, `--line-strong`, `--gold-dim` | `--c-rule` |
| `--gold`, `--gold-bright`, `--gold-light`, `--purple-main` | `--c-heading` |
| `--accent`, `--accent-dim` | `--c-gold` |
| `--gold-glow`, `--gold-faint`, `--accent-faint` | `--c-reach` |
| `--red`, `--red-bright`, `--blood`, `--danger` | `--c-foe` |
| `--green`, `--green-bright`, `--heal` | `--c-pc` |
| `--hp-low` | `--c-gold` |
| `--font-display` | `--f-display` |
| `--font-ui` | `--f-body` |
| `--radius`, `--radius-sm` | `--r` |
| `--shadow` | `none` |
| `--btn-primary-*` | rimosse in Task 3 |

- [ ] **Step 1:** Sostituire il link Google Fonts con: Alegreya (400, 500, 700, corsivo 400), Alegreya SC (500, 700), più il font mono già usato da `--font-mono` se viene da Google. Togliere Cormorant, Grenze Gotisch, Cinzel, EB Garamond, Alegreya Sans.
- [ ] **Step 2:** Scrivere in testa a `styles/base.css` il blocco delle variabili nuove (tabella sopra) per `:root` e `:root[data-theme="night"]`, poi il blocco alias. Eliminare le definizioni precedenti delle variabili vecchie ovunque si trovino (compreso il `<style>` inline di `index.html`), così resta una sola fonte.
- [ ] **Step 3:** `body`: `background: var(--c-paper) var(--paper-grain); color: var(--c-text); font-family: var(--f-body)`. Rimuovere gli sfondi a nebbia/gradiente di `.fog-stage` (resta la classe, senza effetto).
- [ ] **Step 4: Verifica.** `grep -n -- "--bg0:\|--gold:\|--bone:" styles index.html` → ogni variabile vecchia definita una volta sola, come alias. Aprire home e una sessione in chiaro e in notte: fondo carta, testo inchiostro, titoli in Alegreya SC. Difetti di contrasto residui sono attesi e si chiudono in Task 3.
- [ ] **Step 5:** Commit `feat(rework): palette, carta e caratteri "Manuale"`.

---

### Task 3: Componenti di base e pagina campionario

**Files:**
- Create: `test/componenti.html`
- Modify: `styles/base.css` (bottoni, campi, select, finestre modali, titoli, notifiche, scrollbar), `index.html` (blocco `<style>` inline, solo le regole di componenti condivisi)

**Interfaces — Consumes:** variabili di Task 2. **Produces** (classi esistenti, aspetto nuovo; nessun rinomino):
- `.btn` = contorno `1px solid var(--c-rule)`, fondo trasparente, testo `--c-text`; `.btn--primary` = fondo `--c-accent`, testo `--c-on-accent`, grassetto; `.btn--ghost` = solo testo; `.btn--danger` = testo e bordo `--c-foe`; `.btn--sm`, `.btn--icon`, `.btn--block` invariati nelle dimensioni. `:focus-visible` = anello `2px var(--c-gold)`. `:disabled` = opacità .45.
- Campi (`input`, `select`, `textarea`): fondo `--c-paper-hi`, bordo `--c-rule`, raggio `--r`.
- Titoli di sezione: nuova classe **`.rule-head`** = `--f-display`, maiuscoletto spaziato, colore `--c-heading`, filetto sotto `1.5px solid var(--c-gold)`. Le tappe successive la useranno; qui si applica solo dove sostituisce 1:1 uno stile di titolo condiviso esistente.
- Separatori: nuove classi **`.rule-double`** (`3px double var(--c-rule)`) per testate e dock.
- Finestre modali: foglio `--c-paper` con grana, bordo `--c-rule`, velo dietro `rgba(0,0,0,.45)`; nessuna ombra colorata.
- Notifiche (`.notification-stack`): foglio `--c-paper-hi` con bordo `--c-rule` uniforme (nessuna barra colorata laterale); danno = testo `--c-foe`, cura = testo `--c-pc`.
- Flash `dmg-flash` / `heal-pulse`: stessi tempi (~2.5s), colori da `--c-dmg` / `--c-heal`.

- [ ] **Step 1: Scrivere `test/componenti.html`**: pagina statica che carica `styles/base.css` e mostra, sotto titoli `.rule-head`, ogni variante: tutti i bottoni (normale, hover forzato, disabled, focus), campi, select, textarea, una finestra modale aperta, due notifiche (danno e cura), i due separatori, i campioni dei colori `--c-*` con nome. In alto un bottone che chiama `toggleTheme()`.
- [ ] **Step 2:** Aprire `http://localhost:8000/test/componenti.html`: mostra i componenti con lo stile vecchio/rotto (stato "rosso").
- [ ] **Step 3:** Riscrivere in `styles/base.css` le regole dei componenti elencati, usando solo variabili `--c-*`/`--f-*`. Eliminare le `--btn-primary-*`.
- [ ] **Step 4:** Passata sui colori letterali di `styles/base.css` e del `<style>` inline di `index.html`: ogni `#hex`/`rgb()` diventa una variabile `--c-*` oppure viene eliminato con la regola morta che lo conteneva. Gli altri file in `styles/` si ripuliscono nella tappa della loro schermata, **tranne** i letterali che rendono un testo illeggibile (vedi passo 5).
- [ ] **Step 5: Verifica di leggibilità (Review Focus 5).** In chiaro e in notte, a 1280px e 400px, aprire: home (da disconnesso e da connesso), combattimento da master e da giocatore con almeno un combattente KO, scheda personaggio, pannello nave, finestra condizioni, aggiungi creatura, stat block mostro, level-up, archivio cronache. Criterio: nessun testo o icona illeggibile, nessun riquadro scuro pieno su carta chiara. Ogni difetto si corregge sull'alias o, se è un letterale, sostituendolo con una variabile. Fare uno screenshot per vista e tema.
- [ ] **Step 6:** `grep -c -E "#[0-9a-fA-F]{3,8}\b|rgba?\(" styles/base.css` → restano solo le definizioni dentro i blocchi `:root`. `test/shapes.html` e `test/theme.html` ancora verdi.
- [ ] **Step 7:** Mostrare all'utente `test/componenti.html` e gli screenshot; applicare le sue correzioni.
- [ ] **Step 8:** Commit `feat(rework): componenti di base in stile Manuale`.

---

### Task 4: Modulo icone

**Files:**
- Create: `src/ui/icons.js`, `test/icons.html`, `CREDITS.md`
- Modify: `README.md` (riga di crediti), `index.html` (favicon, i due bottoni tema)

**Interfaces — Produces:**
- `icon(name: string, opts?: { size?: number, title?: string }): string` — ritorna `<svg class="ico" viewBox="0 0 512 512" width height fill="currentColor" aria-hidden="true">…</svg>`; con `title` aggiunge `role="img"` e `<title>` al posto di `aria-hidden`. `size` default 18. Nome sconosciuto → `''` e `console.warn`.
- `ICON_NAMES: string[]` — elenco completo.
- CSS `.ico { display:inline-block; vertical-align:-.15em; flex:none }` in `styles/base.css`.
- Nomi (in inglese, stabili, usati dalle tappe successive):
  - a tema, da game-icons.net: `sword` (attacca), `heal`, `shield` (CA), `skull` (KO), `scroll` (scheda), `spellbook`, `potion`, `d20`, `campfire` (riposo breve), `moon` (riposo lungo), `ship`, `picture` (scena), `quill` (cronache), `footprints` (muovi), `blast` (area), `arrow-flight` (traiettoria), `brush`, `bucket`, `eraser`, `wall`, `monster`, `paw` (famiglio), `star` (ispirazione), `crown` (master), `sun` e `crescent` (tema), `dragon` (logo/favicon)
  - di servizio, disegnate a tratto su griglia 512: `undo`, `redo`, `trash`, `plus`, `minus`, `close`, `menu`, `more`, `copy`, `zoom-in`, `zoom-out`, `zoom-reset`, `chevron`, `back`, `check`, `edit`, `eye`, `eye-off`, `square`, `circle`, `rect`, `fill`, `outline`

- [ ] **Step 1: Scrivere `test/icons.html`**: per ogni nome in `ICON_NAMES` controlla che `icon(n)` inizi con `<svg`, contenga `fill="currentColor"` (o `stroke="currentColor"` per quelle a tratto) e non contenga `#000`/`#fff`; `icon('non-esiste') === ''`; `icon('sword', {title:'Attacca'})` contiene `<title>Attacca</title>` e non `aria-hidden`; `ICON_NAMES.length` = numero dei nomi elencati sopra. Sotto i risultati, una griglia che mostra tutte le icone col nome, in entrambi i temi.
- [ ] **Step 2:** Aprire la pagina → FAIL.
- [ ] **Step 3:** Scaricare gli SVG a tema da `https://raw.githubusercontent.com/game-icons/icons/master/<autore>/<nome>.svg` (file in una cartella nuova e vuota fuori dal repo). Di ognuno tenere solo il `d` del tracciato dell'icona: va scartato il tracciato di sfondo `M0 0h512v512H0z`. Annotare autore e nome originale. Se la rete non è disponibile, fermarsi e dirlo all'utente: non disegnare a mano icone a tema di ripiego.
- [ ] **Step 4:** Implementare `src/ui/icons.js` (mappa nome → tracciato, più `icon()`); disegnare le icone di servizio a tratto (`stroke-width` 40 su griglia 512, `stroke-linecap="round"`).
- [ ] **Step 5:** `CREDITS.md`: tabella icona → nome originale → autore, con la dicitura "Icone da game-icons.net, licenza CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/)". Stessa dicitura in una riga del `README.md`. Il link visibile nel footer della home arriva con la tappa 4.
- [ ] **Step 6:** Usare il modulo in due punti, come prova reale: favicon = SVG `dragon` (data-URI) al posto dell'emoji; bottoni `#btn-theme-toggle-home` / `#btn-theme-toggle-combat` mostrano `sun`/`crescent` secondo il tema, aggiornati dentro il gestore del click e all'avvio, con `aria-label="Tema chiaro"` / `"Tema notte"`.
- [ ] **Step 7:** `test/icons.html` → tutte PASS; controllare a occhio la griglia nei due temi (nessuna icona nera su notte, pesi visivi coerenti).
- [ ] **Step 8:** Commit `feat(rework): modulo icone e crediti`.

---

### Task 5: Chiusura della tappa

- [ ] **Step 1: Prova di non-regressione con due browser** (master + giocatore, stessa sessione), in entrambi i temi: creare sessione, entrare, danno/cura, Fine turno più volte di fila, muovere un segnalino mentre l'altro scrive in una cronaca, disegnare con color picker aperto, riposo lungo, reset incontro, uscita e rientro. Nessun comportamento diverso da `main` (a parte l'aspetto).
- [ ] **Step 2:** `test/shapes.html`, `test/theme.html`, `test/icons.html` verdi.
- [ ] **Step 3:** Aggiornare `CLAUDE.md`: tabella file (`src/utils/theme.js`, `src/ui/icons.js`, `test/`), sezione nuova "Tema e variabili" (vocabolario `--c-*`, regola "niente colori letterali", alias temporanei e in che tappa spariscono), rimozione dei riferimenti a `theme-old`.
- [ ] **Step 4:** Commit `Docs: CLAUDE.md aggiornato alla tappa 1 del rework`.
- [ ] **Step 5:** Riferire all'utente cosa è stato verificato e cosa no, e preparare il mockup della tappa 2 (schermata di combattimento completa, PC e telefono) per l'approvazione.
