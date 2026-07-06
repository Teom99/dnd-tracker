# Project Scaffolding — Layer-Based Directory Structure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the flat `src/` and monolithic `style.css` into a layer-based directory structure, then update `CLAUDE.md` with comprehensive per-feature documentation.

**Architecture:** JS files move into `src/{data,ui,logic,utils,views}/`; all import paths update accordingly. `style.css` + `theme.css` split into `styles/{base,home,combat,character,grid,ship}.css`. No file is renamed — only moved. No logic changes.

**Tech Stack:** HTML + CSS + ES6 modules, no bundler. `git mv` to preserve history.

---

## Task 1: Create directory scaffolding

**Files:**
- Create: `src/data/`, `src/ui/`, `src/logic/`, `src/utils/`, `src/views/`, `styles/`

- [ ] **Step 1: Create all directories**

```bash
mkdir -p /Users/monti/Desktop/dnd_website/src/data \
         /Users/monti/Desktop/dnd_website/src/ui \
         /Users/monti/Desktop/dnd_website/src/logic \
         /Users/monti/Desktop/dnd_website/src/utils \
         /Users/monti/Desktop/dnd_website/src/views \
         /Users/monti/Desktop/dnd_website/styles
```

- [ ] **Step 2: Verify directories exist**

```bash
ls /Users/monti/Desktop/dnd_website/src/
```

Expected: `data  ui  logic  utils  views` plus any remaining files.

---

## Task 2: Move JS files (git mv preserves history)

**Files:** All 19 `src/*.js` files moving to subdirectories.

- [ ] **Step 1: Move data layer files**

```bash
cd /Users/monti/Desktop/dnd_website && \
git mv src/Session.js         src/data/Session.js && \
git mv src/Combatant.js       src/data/Combatant.js && \
git mv src/CharacterLibrary.js src/data/CharacterLibrary.js && \
git mv src/CharacterSheet.js  src/data/CharacterSheet.js && \
git mv src/Ship.js            src/data/Ship.js
```

- [ ] **Step 2: Move UI layer files**

```bash
cd /Users/monti/Desktop/dnd_website && \
git mv src/UI.js        src/ui/UI.js && \
git mv src/GridUI.js    src/ui/GridUI.js && \
git mv src/SheetUI.js   src/ui/SheetUI.js && \
git mv src/ShipUI.js    src/ui/ShipUI.js && \
git mv src/LevelUpUI.js src/ui/LevelUpUI.js
```

- [ ] **Step 3: Move logic layer files**

```bash
cd /Users/monti/Desktop/dnd_website && \
git mv src/CombatTracker.js src/logic/CombatTracker.js && \
git mv src/LevelUp.js       src/logic/LevelUp.js && \
git mv src/grid.js          src/logic/grid.js
```

- [ ] **Step 4: Move utils layer files**

```bash
cd /Users/monti/Desktop/dnd_website && \
git mv src/state.js      src/utils/state.js && \
git mv src/DndApi.js     src/utils/DndApi.js && \
git mv src/imageUtils.js src/utils/imageUtils.js
```

- [ ] **Step 5: Move views layer files**

```bash
cd /Users/monti/Desktop/dnd_website && \
git mv src/home.js  src/views/home.js && \
git mv src/sheet.js src/views/sheet.js && \
git mv src/core.js  src/views/core.js
```

- [ ] **Step 6: Verify all moves**

```bash
find /Users/monti/Desktop/dnd_website/src -name "*.js" | sort
```

Expected: 19 files across 5 subdirectories, zero `.js` files directly in `src/`.

---

## Task 3: Fix import paths in `app.js`

**Files:**
- Modify: `app.js:6-20`

- [ ] **Step 1: Replace all 15 local import paths**

In `app.js`, lines 6–20 currently read:

```js
import { getMonsterList, getMonster, getSpellList, getConditionDescriptions } from './src/DndApi.js';
import { Session }           from './src/Session.js';
import { CharacterLibrary }  from './src/CharacterLibrary.js';
import * as UI               from './src/UI.js';
import * as GridUI           from './src/GridUI.js';
import { state }             from './src/state.js';
import { initCombatManagers, exitToHome, esc, closeConditionModal } from './src/core.js';
import { CharacterSheet } from './src/CharacterSheet.js';
import { renderGrid }        from './src/grid.js';
import { initSheet, setupSheetListener, makeCallbacks } from './src/sheet.js';
import { LevelUp }   from './src/LevelUp.js';
import { LevelUpUI } from './src/LevelUpUI.js';
import { Ship }    from './src/Ship.js';
import * as ShipUI from './src/ShipUI.js';
import { updateHomeAuthUI, loadCharacterLibrary, populateJoinPicker, populateCreaturePicker, saveUserSession, loadUserSessions } from './src/home.js';
```

Replace them with:

```js
import { getMonsterList, getMonster, getSpellList, getConditionDescriptions } from './src/utils/DndApi.js';
import { Session }           from './src/data/Session.js';
import { CharacterLibrary }  from './src/data/CharacterLibrary.js';
import * as UI               from './src/ui/UI.js';
import * as GridUI           from './src/ui/GridUI.js';
import { state }             from './src/utils/state.js';
import { initCombatManagers, exitToHome, esc, closeConditionModal } from './src/views/core.js';
import { CharacterSheet } from './src/data/CharacterSheet.js';
import { renderGrid }        from './src/logic/grid.js';
import { initSheet, setupSheetListener, makeCallbacks } from './src/views/sheet.js';
import { LevelUp }   from './src/logic/LevelUp.js';
import { LevelUpUI } from './src/ui/LevelUpUI.js';
import { Ship }    from './src/data/Ship.js';
import * as ShipUI from './src/ui/ShipUI.js';
import { updateHomeAuthUI, loadCharacterLibrary, populateJoinPicker, populateCreaturePicker, saveUserSession, loadUserSessions } from './src/views/home.js';
```

---

## Task 4: Fix inter-module imports (6 files)

Each file moved to a subdirectory; relative paths to siblings must be updated.

**Files:**
- Modify: `src/data/CharacterSheet.js`
- Modify: `src/data/CharacterLibrary.js` (no change needed — both in `data/`)
- Modify: `src/ui/LevelUpUI.js`
- Modify: `src/logic/grid.js`
- Modify: `src/views/home.js`
- Modify: `src/views/core.js`
- Modify: `src/views/sheet.js`

- [ ] **Step 1: Fix `src/data/CharacterSheet.js`**

Find and replace:
```js
import { resizeToBase64 } from './imageUtils.js';
```
→
```js
import { resizeToBase64 } from '../utils/imageUtils.js';
```

- [ ] **Step 2: Fix `src/ui/LevelUpUI.js`**

Find and replace:
```js
import { LevelUp } from './LevelUp.js';
```
→
```js
import { LevelUp } from '../logic/LevelUp.js';
```

- [ ] **Step 3: Fix `src/logic/grid.js`**

Find and replace:
```js
import * as GridUI from './GridUI.js';
import { state }   from './state.js';
```
→
```js
import * as GridUI from '../ui/GridUI.js';
import { state }   from '../utils/state.js';
```

- [ ] **Step 4: Fix `src/views/home.js`**

Find and replace:
```js
import { CharacterLibrary }      from './CharacterLibrary.js';
import * as UI                   from './UI.js';
import { state }                 from './state.js';
```
→
```js
import { CharacterLibrary }      from '../data/CharacterLibrary.js';
import * as UI                   from '../ui/UI.js';
import { state }                 from '../utils/state.js';
```

(Leave `from './core.js'` and `from './sheet.js'` unchanged — same directory.)

- [ ] **Step 5: Fix `src/views/core.js`**

Find and replace:
```js
import { Combatant }    from './Combatant.js';
import { CombatTracker } from './CombatTracker.js';
import * as UI           from './UI.js';
import { state }         from './state.js';
```
→
```js
import { Combatant }    from '../data/Combatant.js';
import { CombatTracker } from '../logic/CombatTracker.js';
import * as UI           from '../ui/UI.js';
import { state }         from '../utils/state.js';
```

- [ ] **Step 6: Fix `src/views/sheet.js`**

Find and replace:
```js
import * as SheetUI      from './SheetUI.js';
import * as UI           from './UI.js';
import { CharacterSheet } from './CharacterSheet.js';
import { state }          from './state.js';
import { LevelUp }   from './LevelUp.js';
import { LevelUpUI } from './LevelUpUI.js';
```
→
```js
import * as SheetUI      from '../ui/SheetUI.js';
import * as UI           from '../ui/UI.js';
import { CharacterSheet } from '../data/CharacterSheet.js';
import { state }          from '../utils/state.js';
import { LevelUp }   from '../logic/LevelUp.js';
import { LevelUpUI } from '../ui/LevelUpUI.js';
```

(Leave `from './core.js'` unchanged — same directory.)

---

## Task 5: Verify JS and commit

- [ ] **Step 1: Open the app in the browser**

Open `index.html` via a local HTTP server or directly in a browser. Verify:
- Home screen loads (auth panel visible)
- No console errors about failed module imports
- If a Firebase session is available, join one and verify the combat view renders

- [ ] **Step 2: Commit JS reorganization**

```bash
cd /Users/monti/Desktop/dnd_website && \
git add -A && \
git commit -m "Refactor: layer-based directory structure for src/ (data/ui/logic/utils/views)"
```

---

## Task 6: Split `style.css` into `styles/`

Each step reads a range from `style.css` and writes a new file. The split follows the section comment headers in the file. After all files are written, `style.css` and `theme.css` will be deleted.

**Files:**
- Create: `styles/base.css`, `styles/home.css`, `styles/combat.css`, `styles/character.css`, `styles/grid.css`, `styles/ship.css`
- Delete: `style.css`, `theme.css`

### CSS section map (line ranges in `style.css`)

| Destination | Sections (start line — title) |
|---|---|
| `base.css` | 1 "Variabili e reset" → 244 end of "Errori"; 1305–1315 "Responsive"; all of `theme.css` |
| `home.css` | 245 "AUTH PANEL" → 505 end of "HOME VIEW"; 2235 "LIBRERIA PERSONAGGI" → 2363; 2707 "Modal archivio" → 2746 |
| `combat.css` | 506 "COMBAT VIEW — header" → 1304 end of "NOTIFICHE POPUP"; 1316 "COMBAT HEADER" → 1341; 2559 "CRONACHE" → 2900 end of "D&D API" |
| `character.css` | 1342 "SCHEDA PERSONAGGIO — header" → 2234 end of "CA badge"; 3240 "Level Up" → 3503 |
| `grid.css` | 2364 "GRIGLIA DI BATTAGLIA" → 2558; 2901 "MODAL UPLOAD SCENA" → 3239 end of "SVG elementi" |
| `ship.css` | 3504 "SHIP PANEL" → 3739 end of file |

- [ ] **Step 1: Create `styles/base.css`**

Read `style.css` lines 1–244, then 1305–1315, then the full contents of `theme.css`. Concatenate them into `styles/base.css` with a comment header:

```css
/* ── base.css — variables, reset, typography, buttons, inputs, theme ── */
```

- [ ] **Step 2: Create `styles/home.css`**

Read `style.css` lines 245–505, 2235–2363, 2707–2746. Concatenate into `styles/home.css`:

```css
/* ── home.css — auth panel, home view, library, pickers, archive modal ── */
```

- [ ] **Step 3: Create `styles/combat.css`**

Read `style.css` lines 506–1304, 1316–1341, 2559–2900. Concatenate into `styles/combat.css`:

```css
/* ── combat.css — combat view, combatant list, modals, notifications, logs ── */
```

- [ ] **Step 4: Create `styles/character.css`**

Read `style.css` lines 1342–2234, 3240–3503. Concatenate into `styles/character.css`:

```css
/* ── character.css — character sheet, stat block, spells, inventory, level-up ── */
```

- [ ] **Step 5: Create `styles/grid.css`**

Read `style.css` lines 2364–2558, 2901–3239. Concatenate into `styles/grid.css`:

```css
/* ── grid.css — battle grid, tokens, walls, movement, scene panel, SVG ── */
```

- [ ] **Step 6: Create `styles/ship.css`**

Read `style.css` lines 3504–3739. Write to `styles/ship.css`:

```css
/* ── ship.css — ship panel, decks, weapons, crew tokens ── */
```

---

## Task 7: Update `index.html` link tags

**Files:**
- Modify: `index.html:10-11`

- [ ] **Step 1: Replace the two existing stylesheet links**

Find:
```html
  <link rel="stylesheet" href="style.css">
  <link rel="stylesheet" href="theme.css">
```

Replace with:
```html
  <link rel="stylesheet" href="styles/base.css">
  <link rel="stylesheet" href="styles/home.css">
  <link rel="stylesheet" href="styles/combat.css">
  <link rel="stylesheet" href="styles/character.css">
  <link rel="stylesheet" href="styles/grid.css">
  <link rel="stylesheet" href="styles/ship.css">
```

---

## Task 8: Verify CSS and commit

- [ ] **Step 1: Open the app in the browser**

Verify all views look correct:
- Home: auth panel, session cards, library styled
- Combat: fight cards, dock, HP bars, conditions
- Character sheet: stat blocks, spell slots, inventory
- Grid: SVG tokens, walls, movement highlights
- Ship panel (if applicable)

If any section is unstyled, check that the corresponding CSS file was extracted correctly (no missing lines at section boundaries).

- [ ] **Step 2: Delete old CSS files**

```bash
cd /Users/monti/Desktop/dnd_website && \
git rm style.css theme.css
```

- [ ] **Step 3: Commit CSS split**

```bash
cd /Users/monti/Desktop/dnd_website && \
git add styles/ index.html && \
git commit -m "Refactor: split style.css + theme.css into styles/ (base/home/combat/character/grid/ship)"
```

---

## Task 9: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

Two changes: (A) update the Architettura file table and Pattern ricorrenti to reflect new paths; (B) add a full per-feature documentation section.

### A — Update Architettura file table

Replace the existing table with:

```markdown
| File | Ruolo |
|---|---|
| `index.html` | Struttura viste: `#view-home`, `#view-combat`, `#view-character` + modal condizioni |
| `styles/base.css` | Variabili CSS, reset, tipografia, bottoni, input — tema fantasy dark |
| `styles/home.css` | Home view, auth panel, libreria personaggi, picker join/creature |
| `styles/combat.css` | Vista combat, card combattente, dock giocatore, modal condizioni, log |
| `styles/character.css` | Scheda personaggio, stat block, slot magia, inventario, level-up |
| `styles/grid.css` | Griglia SVG, token, muri, movimento, pannello scena |
| `styles/ship.css` | Pannello nave, ponti, armi, token equipaggio |
| `config.js` | `FIREBASE_CONFIG` — da non committare con dati reali |
| `app.js` | Entry point: event listeners top-level, `_enterCombatView`, `_startListening`, `_rejoinSession` |
| `src/utils/state.js` | Singleton `state` con tutto lo stato globale (`db`, `auth`, `session`, `myUid`, `myCombatantId`, `snapshot`, ecc.) |
| `src/data/Session.js` | Create/join/restore sessione, auth, `nextTurnAtomic` (runTransaction), log eventi (`addLogEvent`, `addActionLog`, `clearLogs`) |
| `src/data/Combatant.js` | CRUD combattenti: add/updateHp/setMaxHp/toggleCondition/remove |
| `src/data/CharacterLibrary.js` | CRUD libreria personaggi/creature per utente (`characters/{uid}/{charId}/`) |
| `src/data/CharacterSheet.js` | Scheda PG: lettura/scrittura su `characters/{uid}/{charId}/` |
| `src/data/Ship.js` | CRUD nave (`sessions/{code}/ship`): hp, armi, equipaggio, posizioni token |
| `src/ui/UI.js` | Render lista combattenti, modal condizioni, death saves inline, render log (`renderLogs`) |
| `src/ui/GridUI.js` | Griglia quadrata SVG (dimensioni da `gridConfig`, 1 casella = 1m), muri, token multi-cella per taglia |
| `src/ui/SheetUI.js` | Render scheda personaggio (abilità, slot, incantesimi, inventario) |
| `src/ui/ShipUI.js` | Render pannello nave Damselfly: ponti/stanze CSS grid, token equipaggio, carte armi |
| `src/ui/LevelUpUI.js` | Render pannello level-up: feature di classe, modal conferma |
| `src/logic/CombatTracker.js` | `nextTurn(combatants)`, `sortedCombatants()`, `reset()` |
| `src/logic/LevelUp.js` | Logica XP/milestone, calcolo livello, feature di classe disponibili |
| `src/logic/grid.js` | `renderGrid`, `renderTokenBar` — orchestrazione render griglia |
| `src/utils/DndApi.js` | Fetch mostri/incantesimi/condizioni da api.open5e.com |
| `src/utils/imageUtils.js` | `resizeToBase64` — ridimensionamento avatar prima dell'upload |
| `src/views/home.js` | Auth UI, libreria personaggi, picker join/creature, sessioni utente salvate |
| `src/views/sheet.js` | Sheet listener, `makeCallbacks`, `initSheet`, `openCharacterSheet`, `openLibrarySheet`, `bindSheetEvents` |
| `src/views/core.js` | `initCombatManagers`, `exitToHome`, `esc`, `openConditionModal`, `removeCombatant`, `closeConditionModal` |
```

### B — Update Pattern ricorrenti

Replace old paths in the two existing patterns:

Pattern 1: change `src/UI.js` → `src/ui/UI.js` and `src/sheet.js` → `src/views/sheet.js`

Pattern 2: change `src/sheet.js` → `src/views/sheet.js`

### C — Add per-feature documentation section

Add this new section after `## Stato implementazione`:

```markdown
---

## Documentazione per feature

### Auth

**Cosa fa:** Login Google tramite popup; fallback a account anonimo se l'utente rifiuta o non è connesso. L'account anonimo può essere promosso a Google via `linkWithPopup` su richiesta.

**File:** `app.js` (init + `onAuthStateChanged`), `src/views/home.js` (`updateHomeAuthUI`)

**Firebase paths:** Firebase Authentication service (non Realtime Database)

**Invarianti:**
- `state.myUid` è sempre valorizzato dopo auth (uid anonimo o Google)
- `state.isAnon` = true quando l'utente è anonimo
- Il bottone "Accedi con Google" appare solo se `isAnon === true`

---

### Sessioni

**Cosa fa:** Il master crea una sessione con codice casuale a 4 cifre. I giocatori si uniscono inserendo il codice. Al reload la sessione viene rijoinnata automaticamente leggendo `userSessions/{uid}`.

**File:** `src/data/Session.js`, `app.js` (`_enterCombatView`, `_startListening`, `_rejoinSession`), `src/views/home.js` (`saveUserSession`, `loadUserSessions`)

**Firebase paths:**
- `sessions/{code}/` — nodo sessione completo (letto in streaming via `onValue`)
- `userSessions/{uid}/{code}/` — metadati join (combatantId, role, charId, lastSeen)

**Invarianti:**
- `nextTurnAtomic` usa `runTransaction` — nessuna race condition tra client
- Il listener `session.listen()` in `_startListening()` riceve l'intero nodo ad ogni aggiornamento e ri-renderizza tutto; non fare operazioni costose qui
- Scrivere log solo nelle azioni utente, mai nel listener, per evitare duplicati multi-client

---

### Libreria personaggi

**Cosa fa:** CRUD per profili PG e creature per utente. Visibile nella home e richiamabile nei form "unisciti" e "aggiungi creatura" come picker.

**File:** `src/data/CharacterLibrary.js`, `src/data/CharacterSheet.js`, `src/views/home.js` (`loadCharacterLibrary`, `populateJoinPicker`, `populateCreaturePicker`)

**Firebase paths:**
- `characters/{uid}/{charId}/` — profilo completo (name, type, hpMax, armorClass, abilities, size, avatar, …)

**Invarianti:**
- Le security rules limitano lettura/scrittura a `$uid === auth.uid`
- `charId` è un push-key Firebase; usarlo come riferimento in `combatants/{id}/charId`

---

### Combat tracker

**Cosa fa:** Ordina i combattenti per iniziativa, gestisce il turno corrente, permette danni/cure (atomici), toggle condizioni, azioni dichiarate, death saves.

**File:** `src/logic/CombatTracker.js` (ordinamento, nextTurn), `src/data/Combatant.js` (CRUD Firebase), `src/ui/UI.js` (render lista), `src/views/core.js` (orchestrazione)

**Firebase paths:**
- `sessions/{code}/combatants/{id}/` — hpCurrent, hpMax, initiative, conditions, currentAction, size, ownerUid, charId
- `sessions/{code}/round`, `sessions/{code}/currentTurnId`

**Invarianti:**
- `updateHp` è atomico: legge `hpMax` e aggiorna `hpCurrent` in un solo `runTransaction`
- Player KO restano nel turno per death saves; creature KO vengono saltate
- Visibilità HP: master vede tutto · player vede tutti i PG · creature mostrano solo hint opzionale
- Death saves inline: 3 successi = revive a 1 HP (scritto via `Combatant.updateHp`)

---

### Scheda personaggio

**Cosa fa:** Stat block D&D 5e completo — abilità, skill, tiri salvezza, attacchi, slot magia, incantesimi, inventario, death saves. Sincronizza AC, HP max e velocità al combattente in sessione in real-time.

**File:** `src/data/CharacterSheet.js` (lettura/scrittura Firebase), `src/ui/SheetUI.js` (render), `src/views/sheet.js` (listener eventi, callbacks, sync al combattente)

**Firebase paths:**
- `characters/{uid}/{charId}/` — tutti i campi della scheda
- `sessions/{code}/combatants/{id}/armorClass`, `hpMax`, `speed` — sincronizzati da `setupSheetListener`

**Invarianti:**
- `setupSheetListener` usa `prevAc`/`prevHpMax` per evitare scritture Firebase inutili a ogni snapshot
- `setSpellSlotsUsed` usa `runTransaction` per slot incantesimo (scritture concorrenti)
- `state.sheetReturnView` controlla dove torna il tasto "indietro" (combat o home)
- `_sheetBound` flag su elementi DOM per evitare listener duplicati su re-render
- I `data-path` input in `index.html` sono popolati automaticamente da `SheetUI.populateSheet` e scritti su Firebase da `bindSheetEvents`

---

### Griglia di battaglia

**Cosa fa:** Griglia quadrata SVG adattiva (viewBox + preserveAspectRatio). Zoom +/−/reset con pulsanti flottanti. Pan con drag quando zoom > 1. Il master disegna/rimuove muri cliccando. Selezione token mostra raggio di movimento. Token multi-cella per taglia. Ghost preview al passaggio mouse.

**File:** `src/logic/grid.js` (orchestrazione render), `src/ui/GridUI.js` (SVG, token, muri, movimento)

**Firebase paths:**
- `sessions/{code}/gridConfig/` — cols, rows (default 20×20)
- `sessions/{code}/grid/{combatantId}/` — col, row (angolo top-left del footprint)
- `sessions/{code}/walls/{col_row}` — true se muro presente

**Invarianti:**
- 1 casella = 1 metro; diagonali alternate 5-10-5 (variante DMG: `max + floor(min/2)`)
- Footprint token: Tiny/Small/Medium=1×1, Large=2×2, Huge=3×3, Gargantuan=4×4
- La casella cliccata è ~il centro del footprint per token grandi (offset `floor((n-1)/2)`)
- Movimento valida bordi, muri e sovrapposizioni sull'intero footprint prima di scrivere
- Reset (solo master) svuota `grid/` e `walls/` — token e muri cancellati

---

### Pannello nave (Damselfly)

**Cosa fa:** Gestione della nave Damselfly — integrità scafo, armi con stato e equipaggio assegnato, token equipaggio spostabili tra le stanze dei ponti.

**File:** `src/data/Ship.js` (CRUD Firebase), `src/ui/ShipUI.js` (render ponti, armi, token)

**Firebase paths:**
- `sessions/{code}/ship/` — hp, weapons/{id}/state, crew/{id}/room, positions/

**Invarianti:**
- I ponti sono renderizzati tutti insieme (niente tab), come CSS grid
- Il pannello nave è visibile solo al master e ai giocatori con ruolo "equipaggio"

---

### Sistema level-up

**Cosa fa:** Traccia XP milestone, rileva quando il level-up è disponibile, mostra il pannello di scelta feature di classe. La cornice XP del ritratto diventa oro pieno e pulsa quando il level-up è pronto.

**File:** `src/logic/LevelUp.js` (calcolo livello, feature disponibili), `src/ui/LevelUpUI.js` (render pannello, modal)

**Firebase paths:**
- `characters/{uid}/{charId}/xp` — XP correnti
- `characters/{uid}/{charId}/level` — livello corrente
- `characters/{uid}/{charId}/classFeatures/` — feature scelte

**Invarianti:**
- Il sistema usa milestone XP (soglie fisse per livello), non XP liberi
- `LevelUpUI` viene iniettato nel DOM solo quando `LevelUp.isReady()` restituisce true

---

### Log eventi

**Cosa fa:** Log condiviso e real-time di tutti gli eventi di combattimento (danni, cure, cambio turno, reset). Log azioni con formato "A ha colpito B infliggendogli N danni". Cancellazione condivisa.

**File:** `src/data/Session.js` (`addLogEvent`, `addActionLog`, `clearLogs`), `src/ui/UI.js` (`renderLogs`)

**Firebase paths:**
- `sessions/{code}/logs/{logId}/` — message, type, actor, target, amount, createdByUid, timestamp, clientTimestamp

**Invarianti:**
- Scrivere log solo nelle azioni utente (mai nel listener Firebase) per evitare duplicati multi-client
- Nel listener fare solo `UI.renderLogs(snapshot)`, mai `addLogEvent`
- `clientTimestamp` è usato per ordinamento locale quando il server timestamp non è ancora disponibile
```

- [ ] **Step 1: Apply all three changes to `CLAUDE.md`**

1. Replace the `## Architettura file` table with the new table from section A above.
2. Update the two `## Pattern ricorrenti` path references (`src/UI.js` → `src/ui/UI.js`, `src/sheet.js` → `src/views/sheet.js`).
3. Add the full `## Documentazione per feature` section from section C above, inserting it after `## Stato implementazione`.

---

## Task 10: Commit CLAUDE.md

- [ ] **Step 1: Commit documentation update**

```bash
cd /Users/monti/Desktop/dnd_website && \
git add CLAUDE.md && \
git commit -m "Docs: update CLAUDE.md with new paths and full per-feature documentation"
```

- [ ] **Step 2: Final verification**

```bash
find /Users/monti/Desktop/dnd_website/src -name "*.js" | sort
ls /Users/monti/Desktop/dnd_website/styles/
git log --oneline -5
```

Expected: 5 subdirs in `src/`, 6 files in `styles/`, 3 new commits on the log.
