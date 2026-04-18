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
| `app.js` | Entry point: stato globale, event listeners, listener Firebase real-time |
| `Session.js` | Create/join/restore sessione, auth, `nextTurnAtomic` (runTransaction) |
| `Combatant.js` | CRUD combattenti: add/updateHp/setMaxHp/toggleCondition/remove |
| `CombatTracker.js` | `nextTurn(combatants)`, `sortedCombatants()`, `reset()` |
| `CharacterLibrary.js` | CRUD libreria personaggi/creature per utente (`characters/{uid}/{charId}/`) |
| `CharacterSheet.js` | Scheda PG: lettura/scrittura su `characters/{uid}/{charId}/` |
| `UI.js` | Render lista combattenti, modal condizioni, death saves inline |
| `SheetUI.js` | Render scheda personaggio (abilità, slot, incantesimi, inventario) |
| `GridUI.js` | Griglia esagonale SVG (punta in alto, odd-r offset, 20×12, 1 hex = 1.5m) |

---

## Modello dati Firebase

```
sessions/{code}/
  masterUid, round, currentTurnId
  combatants/{id}/  name, type (player|creature), initiative, hpMax, hpCurrent,
                    conditions/{name: true}, ownerUid, charId, armorClass,
                    currentAction, showHealthHint
  grid/{combatantId}/  col, row

characters/{uid}/{charId}/
  name, type, armorClass, hpMax, abilities/{str,dex,...}, skills/,
  savingThrows/, spellSlots/, spells/, cantrips/, attacks/,
  inventory/, deathSaves/{successes, failures}, tempHp, hitDiceUsed, ...

userSessions/{uid}/{code}/  combatantId, name, type, charId  (per rejoin)
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
- Auth Google + anonima con fallback, upgrade anonimo → Google
- Sessioni: crea (master), join (player), rejoin automatico al reload
- Libreria personaggi/creature dalla home (CRUD, `characters/{uid}/{charId}/`)
- Picker libreria nel form join e nel form aggiungi creatura
- Scheda personaggio completa (abilità, skill, tiri salvezza, slot magia, attacchi, incantesimi, inventario, death saves)
- Lista combattenti real-time con HP, iniziativa, condizioni, azioni dichiarate
- Visibilità HP: master vede solo creature · player vede tutti i PG · hint opzionale su creature
- HP max editabile inline (card combat) e dalla scheda PG, con sync automatico al combattente
- CA sincronizzata dalla scheda al combattente in real-time
- Griglia esagonale con token selector bar, selezione + posizionamento, distanze in metri
- Tasto "Fine Turno" sulla card del giocatore attivo
- Death saves inline nella card quando KO: 3 successi = revive a 1 HP
- `nextTurn` atomico con `runTransaction` (no race condition)
- I player KO restano nel turno per death saves; creature KO saltate
- Favicon emoji drago SVG inline

### Bug noti non ancora risolti
- **Inventario nella scheda**: eliminazione oggetti non funziona + dopo il primo add il form smette di funzionare

### Da implementare (backlog)
- **C2** — Layout 3 colonne in combat: Creature | Player | Scheda sempre visibile — feature invasiva, richiede pianificazione prima di toccare il codice
- **C3** — Refactor struttura progetto (cartelle `src/`, separare state da handlers in `app.js`)

---

## Pattern ricorrenti da rispettare

**Aggiungere un'azione a una card combattente:**
1. Aggiungere `data-action="nome"` al bottone in `UI.js` → `renderCombatantList` (template HTML)
2. Aggiungere handler in `list.onclick` delegation nello stesso file
3. Aggiungere callback `onNome` all'oggetto callbacks passato da `app.js`
4. Implementare la logica in `app.js`

**Aggiungere un campo alla scheda personaggio:**
1. Aggiungere `<input data-path="fieldName" data-number>` in `index.html` dentro `#view-character`
2. `SheetUI.populateSheet` lo popola automaticamente tramite `data-path`
3. `CharacterSheet.setField` lo scrive su Firebase tramite l'event listener in `app.js` (`_bindSheetEvents`)
4. Se serve sync al combattente: aggiungere logica in `_setupSheetListener` in `app.js`

**Scritture concorrenti critiche:** usare `runTransaction` (vedi `Combatant.updateHp`, `Session.nextTurnAtomic`)

---

## Note operative

- `app.js` è il file più grande e complesso — contiene tutto lo stato globale (`myUid`, `myCombatantId`, `_snapshot`, `_sheet`, `_sheetData`, `_acMap`, `_library`, ecc.)
- Il listener Firebase `session.listen()` in `_startListening()` riceve l'intero nodo sessione ad ogni aggiornamento e ri-renderizza tutto — non fare operazioni costose qui
- `_sheetReturnView` controlla dove torna il tasto "indietro" dalla scheda (combat o home)
- `_sheetBound` flag su elementi DOM per evitare listener duplicati su re-render
