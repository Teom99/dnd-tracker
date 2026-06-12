# D&D Combat Tracker — Guida per Claude Code

## Cos'è questo progetto

Combat tracker real-time per D&D 5e, condiviso tra master e giocatori durante una sessione.  
**Stack**: HTML + CSS + ES6 modules (no bundler, no framework) · Firebase Realtime Database + Auth · GitHub Pages.

---

## Architettura file

| File | Ruolo |
|---|---|
| `index.html` | Struttura viste: `#view-home`, `#view-combat`, `#view-character` + modal condizioni |
| `style.css` | Tema fantasy dark (Cinzel/Crimson Text, sfondo `#0f0f1a`, oro `#c9a84c`) |
| `config.js` | `FIREBASE_CONFIG` — da non committare con dati reali |
| `app.js` | Entry point: event listeners top-level, `_enterCombatView`, `_startListening`, `_rejoinSession` |
| `src/state.js` | Singleton `state` con tutto lo stato globale (`db`, `auth`, `session`, `myUid`, `myCombatantId`, `snapshot`, ecc.) |
| `src/core.js` | `initCombatManagers`, `exitToHome`, `esc`, `openConditionModal`, `removeCombatant`, `closeConditionModal` |
| `src/home.js` | Auth UI, libreria personaggi, picker join/creature, sessioni utente salvate |
| `src/sheet.js` | Sheet listener, `makeCallbacks`, `initSheet`, `openCharacterSheet`, `openLibrarySheet`, `bindSheetEvents` |
| `src/grid.js` | `renderGrid`, `renderTokenBar` |
| `src/Session.js` | Create/join/restore sessione, auth, `nextTurnAtomic` (runTransaction), log eventi (`addLogEvent`, `addActionLog`, `clearLogs`) |
| `src/Combatant.js` | CRUD combattenti: add/updateHp/setMaxHp/toggleCondition/remove |
| `src/CombatTracker.js` | `nextTurn(combatants)`, `sortedCombatants()`, `reset()` |
| `src/CharacterLibrary.js` | CRUD libreria personaggi/creature per utente (`characters/{uid}/{charId}/`) |
| `src/CharacterSheet.js` | Scheda PG: lettura/scrittura su `characters/{uid}/{charId}/` |
| `src/UI.js` | Render lista combattenti, modal condizioni, death saves inline, render log (`renderLogs`) |
| `src/Ship.js` | CRUD nave (`sessions/{code}/ship`): hp, armi, equipaggio, posizioni token |
| `src/ShipUI.js` | Render pannello nave Damselfly: ponti/stanze CSS grid, token equipaggio, carte armi |
| `src/SheetUI.js` | Render scheda personaggio (abilità, slot, incantesimi, inventario) |
| `src/GridUI.js` | Griglia quadrata SVG (dimensioni da `gridConfig`, 1 casella = 1m), muri, token multi-cella per taglia |

---

## Modello dati Firebase

```
sessions/{code}/
  masterUid, round, currentTurnId
  gridConfig/  cols, rows                  (dimensioni decise dal master, default 20x20)
  combatants/{id}/  name, type (player|creature), initiative, hpMax, hpCurrent,
                    conditions/{name: true}, ownerUid, charId, armorClass,
                    currentAction, showHealthHint,
                    size (tiny|small|medium|large|huge|gargantuan)
  grid/{combatantId}/  col, row            (angolo top-left del footprint)
  walls/{col_row}: true
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
- Raggio di movimento: selezionato un token vivo, le caselle raggiungibili (distanza Chebyshev bordo-a-bordo ≤ velocità, 1 casella = 1 m) sono evidenziate (`.sq-reach`); velocità sincronizzata dalla scheda (`speed` → combattente), default 9 m se assente (creature); hint della toolbar contestuale a modifica/selezione (gestito da `GridUI.renderGrid`)
- Taglia token: Piccola/Media (1×1), Grande (2×2), Enorme (3×3), Mastodontica (4×4); default dalla libreria/scheda, override del master in sessione; distanza Chebyshev bordo-a-bordo (1 casella = 1m)
- Token rotondi (cerchio + alone per attivo/selezionato) con anello HP intorno al token: master vede tutti gli anelli, i player solo PG/famigli (mai gli HP esatti delle creature); colore anello a soglie (verde > 50%, oro 25–50%, rosso < 25%); token giocatore evidenziati in verde; movimento valida bordi, muri e sovrapposizioni sull'intero footprint
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

### Bug noti non ancora risolti
Nessuno al momento.

---

## Pattern ricorrenti da rispettare

**Aggiungere un'azione a una card combattente:**
1. Aggiungere `data-action="nome"` al bottone in `src/UI.js` -> `renderCombatantList` (template HTML)
2. Aggiungere handler in `list.onclick` delegation nello stesso file
3. Aggiungere callback `onNome` in `makeCallbacks()` dentro `src/sheet.js`
4. Implementare la logica nel callback (usa `state.*` per accedere a db, session, ecc.)

**Aggiungere un campo alla scheda personaggio:**
1. Aggiungere `<input data-path="fieldName" data-number>` in `index.html` dentro `#view-character`
2. `SheetUI.populateSheet` lo popola automaticamente tramite `data-path`
3. `CharacterSheet.setField` lo scrive su Firebase tramite l'event listener in `bindSheetEvents` (`src/sheet.js`)
4. Se serve sync al combattente: aggiungere logica in `setupSheetListener` in `src/sheet.js`

**Scritture concorrenti critiche:** usare `runTransaction` (vedi `Combatant.updateHp`, `Session.nextTurnAtomic`, `CharacterSheet.setSpellSlotsUsed`)

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
