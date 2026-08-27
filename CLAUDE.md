# D&D Combat Tracker — Guida per Claude Code

## Cos'è questo progetto

Combat tracker real-time per D&D 5e, condiviso tra master e giocatori durante una sessione.  
**Stack**: HTML + CSS + ES6 modules (no bundler, no framework) · Firebase Realtime Database + Auth · GitHub Pages.

---

## Architettura file

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
| `src/utils/domPreserve.js` | `captureFocusState`/`restoreFocusState` — preserva focus, valore, cursore e scroll di un input durante un rebuild `innerHTML` |
| `src/views/home.js` | Auth UI, libreria personaggi, picker join/creature, sessioni utente salvate |
| `src/views/sheet.js` | Sheet listener, `makeCallbacks`, `initSheet`, `openCharacterSheet`, `openLibrarySheet`, `bindSheetEvents` |
| `src/views/core.js` | `initCombatManagers`, `exitToHome`, `esc`, `openConditionModal`, `removeCombatant`, `closeConditionModal` |

---

## Modello dati Firebase

```
sessions/{code}/
  masterUid, round, currentTurnId
  gridConfig/  cols, rows                  (dimensioni decise dal master, default 20x20)
  combatants/{id}/  name, type (player|creature), initiative, hpMax, hpCurrent,
                    conditions/{name: true}, ownerUid, charId, armorClass,
                    currentAction, showHealthHint, inspiration (bool),
                    size (tiny|small|medium|large|huge|gargantuan)
  grid/{combatantId}/  col, row            (angolo top-left del footprint)
  walls/{col_row}: true
  template/  shape (circle|cone|line), originCol, originRow, size (metri), angleDeg, ownerUid
             (un solo template attivo per sessione; null se nessuno)
  logs/{logId}/
    message, type, actor, target, amount, createdByUid,
    timestamp (serverTimestamp), clientTimestamp

characters/{uid}/{charId}/
  name, type, armorClass, hpMax, abilities/{str,dex,...}, skills/,
  savingThrows/, spellSlots/, spells/, cantrips/, attacks/,
  inventory/, deathSaves/{successes, failures}, tempHp, hitDiceUsed,
  spellBonusModifier, spellcastingAbility, size, ...

userSessions/{uid}/{code}/
  combatantId, characterName, role, charId, lastSeen
```

**Firebase Security Rules** (impostare manualmente in Console):
```json
"sessions": { "$code": { ".read": true, ".write": "auth != null" } },
"characters": { "$uid": { ".read": "$uid === auth.uid", ".write": "$uid === auth.uid" } },
"userSessions": { "$uid": { ".read": "$uid === auth.uid", ".write": "$uid === auth.uid" } }
```

---

## Stato implementazione

### Completato
- Auth Google + anonima con fallback, upgrade anonimo -> Google
- Sessioni: crea (master), join (player), rejoin automatico al reload
- Libreria personaggi/creature dalla home (CRUD, `characters/{uid}/{charId}/`)
- Picker libreria nel form join e nel form aggiungi creatura
- Scheda personaggio completa (abilità, skill, tiri salvezza, slot magia, attacchi, incantesimi, inventario, death saves)
- Lista combattenti real-time con HP, iniziativa, condizioni, azioni dichiarate
- Visibilità HP: master vede solo creature · player vede tutti i PG · hint opzionale su creature
- HP max editabile inline (card combat) e dalla scheda PG, con sync automatico al combattente
- CA sincronizzata dalla scheda al combattente in real-time
- Griglia quadrata: si adatta sempre al contenitore (SVG `viewBox` + `preserveAspectRatio`); zoom +/−/reset con pulsanti flottanti in basso a destra e pan con trascinamento quando zoom > 1 (pointer events, funziona anche touch); dimensioni fisse decise dal master in "Modifica griglia" (`gridConfig`, default 20x20, resize anytime con drop fuori bordi); in modalità modifica il master clicca/trascina sulle caselle vuote per disegnare/rimuovere muri (bloccano il movimento); reset (solo master) svuota token e muri
- Raggio di movimento: selezionato un token vivo, le caselle raggiungibili (distanza a diagonali alternate bordo-a-bordo ≤ velocità, 1 casella = 1 m) sono evidenziate (`.sq-reach`); velocità sincronizzata dalla scheda (`speed` → combattente), default 9 m se assente (creature); hint della toolbar contestuale a modifica/selezione (gestito da `GridUI.renderGrid`)
- Taglia token: Piccola/Media (1×1), Grande (2×2), Enorme (3×3), Mastodontica (4×4); default dalla libreria/scheda, override del master in sessione; distanza bordo-a-bordo a diagonali alternate (variante DMG 5-10-5: `max + floor(min/2)`, 1 casella = 1m)
- Token rotondi a sfondo opaco con un unico bordo che è anche la barra HP (arco proporzionale, traccia al 25% di opacità): colore per tipo (verde = giocatori, azzurro = creatura alleata, rosso = nemica, grigio = morto); master vede la frazione HP di tutti, i player vedono il bordo pieno sulle creature (HP nascosti); dentro al token solo la prima lettera del nome, nome completo in maiuscoletto sotto; alone oro per attivo/selezionato; movimento valida bordi, muri e sovrapposizioni sull'intero footprint; preview di spostamento al passaggio del mouse (ghost del footprint colorato come il token, grigio se la destinazione non è piazzabile); la cella cliccata è ~il centro del footprint per i token grandi (offset `floor((n-1)/2)`, 1×1 e 2×2 invariati)
- Token morti grigi con teschio
- Tasto "Fine Turno" sulla card del giocatore attivo
- Death saves inline nella card quando KO: 3 successi = revive a 1 HP
- `nextTurn` atomico con `runTransaction` (no race condition)
- `updateHp` atomico su nodo intero combattente (legge `hpMax` e aggiorna `hpCurrent` in un solo transaction)
- I player KO restano nel turno per death saves; creature KO saltate
- Notifiche popup per danni/cure ricevuti dal proprio personaggio
- Log eventi condivisi e realtime su Firebase (`sessions/{code}/logs`)
- Log azioni attaccante->bersaglio (es. "A ha colpito B infliggendogli N danni")
- Cancellazione log condivisa (`session.clearLogs`)
- Favicon emoji drago SVG inline
- Slot incantesimo con counter numerico +/− e max editabile inline; scritture atomiche con `runTransaction`
- Campo `spellBonusModifier` per modificatore extra su CD e bonus attacco magia
- Refactor struttura progetto: `app.js` ridotto, stato in `src/state.js`, logica in moduli separati
- Fix inventario: risolta eliminazione oggetti e blocco form; allineamento tasti rimozione a destra
- Rework "Cenere e Verderame" scheda personaggio: testata con nome/sottotitolo/barra XP, layout 2 colonne a sezioni `details.tome`, pip CSS per competenze/expertise, cstat per statistiche, slot incantesimo a rombi, righe attacchi/incantesimi/inventario a tema (mockup `Rework/04 Scheda.html`)
- Fight card e player dock: barra XP resa come cornice del ritratto (`.fc-pframe`/`.dock-pframe`, conic-gradient con `--xp`); quando il level-up è pronto la cornice diventa oro pieno e pulsa (`.lvlup`, niente badge testuale); numero XP visibile nel dock (`.dock-xp`) e nel tooltip del ritratto; campo quantità danno/cura compatto (placeholder "0", stessa altezza dei bottoni)
- Rework pannello nave Damselfly: ponti renderizzati come stanze CSS grid (tutti i deck visibili, niente tab), spostamento equipaggio token→stanza, carte armi con chip equipaggio e select stato, barra integrità scafo (mockup `Rework/06 Damselfly.html`)
- Fix concorrenza multi-giocatore: `src/utils/domPreserve.js` (`captureFocusState`/`restoreFocusState`) preserva focus, valore, cursore e scroll di un input quando il suo contenitore viene ricostruito da un re-render non correlato (es. un giocatore muove un token mentre un altro scrive). Applicato a Cronache (`UI.renderSessionNotes`, riscritta a patch incrementale — non ricrea mai i nodi title/textarea), editor inline iniziativa/HP max/HP temp/CA sulle card (`UI.renderCombatantList`), scheda personaggio (`SheetUI.renderClassFeatures/renderInventory/renderSpellSlots/populateSheet`), pannello nave (`_renderShipPanel` in `app.js`)
- Tasto ispirazione (✦) su ogni card combattente: `combatants/{id}/inspiration`, visibile a tutti (si illumina oro via `.insp-btn.active` in `index.html`), ma cliccabile solo da proprietario/master (`disabled` altrimenti; `Combatant.setInspiration`)
- Flash colorato sulla card a ogni variazione di `hpCurrent`: rosso neon per danno, verde neon per cura, ~2.5s (`dmg-flash`/`heal-pulse` in `styles/base.css`, applicate da `UI.renderCombatantList` tramite una mappa `_prevHp`/`_hpFlash` che confronta l'HP col render precedente — sopravvive a rebuild concorrenti)
- Template ad area sulla griglia (cerchio/cono/linea): piazzamento clic-clic (origine poi conferma con anteprima live), condiviso in tempo reale (`sessions/{code}/template`), celle coperte evidenziate e combattenti coinvolti elencati nell'hint della toolbar

### Bug noti non ancora risolti
Nessuno al momento.

---

## Pattern ricorrenti da rispettare

**Aggiungere un'azione a una card combattente:**
1. Aggiungere `data-action="nome"` al bottone in `src/ui/UI.js` -> `renderCombatantList` (template HTML)
2. Aggiungere handler in `list.onclick` delegation nello stesso file
3. Aggiungere callback `onNome` in `makeCallbacks()` dentro `src/views/sheet.js`
4. Implementare la logica nel callback (usa `state.*` per accedere a db, session, ecc.)

**Aggiungere un campo alla scheda personaggio:**
1. Aggiungere `<input data-path="fieldName" data-number>` in `index.html` dentro `#view-character`
2. `SheetUI.populateSheet` lo popola automaticamente tramite `data-path`
3. `CharacterSheet.setField` lo scrive su Firebase tramite l'event listener in `bindSheetEvents` (`src/views/sheet.js`)
4. Se serve sync al combattente: aggiungere logica in `setupSheetListener` in `src/views/sheet.js`

**Scritture concorrenti critiche:** usare `runTransaction` (vedi `Combatant.updateHp`, `Session.nextTurnAtomic`, `CharacterSheet.setSpellSlotsUsed`)

**Renderer con `innerHTML` chiamato dal listener Firebase (session o sheet):** se il contenitore include `<input>`/`<textarea>`/`<select>` editabili, avvolgere il rebuild con `captureFocusState`/`restoreFocusState` da `src/utils/domPreserve.js` (vedi `renderCombatantList`, `SheetUI.renderInventory` per l'uso). Senza questo, un update Firebase non correlato (es. un altro giocatore che agisce) cancella focus/testo/scroll di chi sta scrivendo in quel momento — è la causa root del bug "la sessione si resetta quando un altro giocatore interagisce" riapparso più volte in passato.

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

**Cosa fa:** Griglia quadrata SVG adattiva (viewBox + preserveAspectRatio). Zoom +/−/reset con pulsanti flottanti. Pan con drag quando zoom > 1. Il master disegna/rimuove muri cliccando. Selezione token mostra raggio di movimento. Token multi-cella per taglia. Ghost preview al passaggio mouse. Template ad area (cerchio/cono/linea) per incantesimi, condivisi in tempo reale con evidenziazione celle e combattenti coinvolti.

**File:** `src/logic/grid.js` (orchestrazione render), `src/ui/GridUI.js` (SVG, token, muri, movimento, template)

**Firebase paths:**
- `sessions/{code}/gridConfig/` — cols, rows (default 20×20)
- `sessions/{code}/grid/{combatantId}/` — col, row (angolo top-left del footprint)
- `sessions/{code}/walls/{col_row}` — true se muro presente
- `sessions/{code}/template/` — shape, originCol, originRow, size (metri), angleDeg, ownerUid (un solo template alla volta)

**Invarianti:**
- 1 casella = 1 metro; diagonali alternate 5-10-5 (variante DMG: `max + floor(min/2)`)
- Footprint token: Tiny/Small/Medium=1×1, Large=2×2, Huge=3×3, Gargantuan=4×4
- La casella cliccata è ~il centro del footprint per token grandi (offset `floor((n-1)/2)`)
- Movimento valida bordi, muri e sovrapposizioni sull'intero footprint prima di scrivere
- Reset (solo master) svuota `grid/` e `walls/` — token e muri cancellati
- Piazzamento template: clic-clic (origine poi conferma), non drag; mutuamente esclusivo con la modalità modifica muri (`state.gridEditMode`)
- Geometria template: cerchio = raggio; cono = 90° totali (±45° dall'angolo); linea = larghezza fissa 1.5m — celle incluse per centro-cella, non footprint esatto
- Solo chi l'ha piazzato o il master possono cancellare il template attivo; piazzarne uno nuovo sovrascrive il precedente

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

---

## Note operative

- Lo stato globale è in `src/state.js` come singleton `state` — tutti i moduli lo importano e lo mutano direttamente
- `app.js` è solo coordinatore: event listeners top-level e funzioni che richiedono `_enterCombatView` (non estrarre ulteriormente senza motivo)
- Il listener Firebase `session.listen()` in `_startListening()` riceve l'intero nodo sessione ad ogni aggiornamento e ri-renderizza tutto — non fare operazioni costose qui
- Regola log realtime: nel listener fare solo render (`UI.renderLogs`), non scrivere nuovi log per diff snapshot
- Scrivere log solo nelle azioni utente (es. `onApplyToTarget`, cambio turno, reset) per evitare duplicati multi-client
- `state.sheetReturnView` controlla dove torna il tasto "indietro" dalla scheda (combat o home)
- `_sheetBound` flag su elementi DOM per evitare listener duplicati su re-render
- `home.js` comunica con `app.js` tramite custom event `dnd:rejoin` per evitare dipendenza circolare
- `setupSheetListener` usa `prevAc`/`prevHpMax` per evitare scritture Firebase inutili a ogni snapshot scheda
