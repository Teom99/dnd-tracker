# Design: Sistema XP / Milestone

**Data:** 2026-06-08  
**Stato:** Approvato

---

## Obiettivo

Aggiungere un sistema di progressione dei personaggi al combat tracker. Il master sceglie tra due modalità: accumulo XP (con tabella D&D 5e) o milestone (level-up diretto). La progressione è visibile in tempo reale a tutti i partecipanti nella vista combat.

---

## Modello dati Firebase

```
sessions/{code}/
  progressionMode: "xp" | "milestone"        ← nuovo campo
  xp/{combatantId}: number                    ← solo in modalità XP; XP totali accumulati
  levelUpGranted/{combatantId}: true | null   ← solo in modalità milestone; il master concede il level-up
```

**Note:**
- Gli XP vivono sulla sessione, non sul personaggio. Non persistono tra sessioni.
- Il livello rimane su `characters/{uid}/{charId}/level` (già esistente).
- `progressionMode` viene scritto alla creazione della sessione e può essere cambiato dal master durante la sessione.
- Gli XP sono totali cumulativi (non si azzerano al level-up), in linea con la tabella D&D 5e standard.

**Tabella XP D&D 5e:**

| Livello | XP Totali |
|---------|----------:|
| 1       |         0 |
| 2       |       300 |
| 3       |       900 |
| 4       |     2.700 |
| 5       |     6.500 |
| 6       |    14.000 |
| 7       |    23.000 |
| 8       |    34.000 |
| 9       |    48.000 |
| 10      |    64.000 |
| 11      |    85.000 |
| 12      |   100.000 |
| 13      |   120.000 |
| 14      |   140.000 |
| 15      |   165.000 |
| 16      |   195.000 |
| 17      |   225.000 |
| 18      |   265.000 |
| 19      |   305.000 |
| 20      |   355.000 |

---

## Selezione modalità progressione

### Alla creazione della sessione (`home.js`)

Aggiungere un `<select id="select-progression-mode">` con opzioni "XP" e "Milestone" nella home card master, prima del pulsante "Crea Sessione". Il valore viene letto in `app.js` al click di `btn-create-session` e passato a `Session.create()`.

`Session.create()` riceve un parametro `options = {}` e scrive `progressionMode` nel nodo sessione Firebase.

### Durante la sessione (pannello master)

Nel pannello `#master-controls` (visibile solo al master), aggiungere un toggle/select per cambiare modalità al volo. Scrive su `sessions/{code}/progressionMode` tramite `Session.setProgressionMode(mode)`.

---

## Barra XP nella combat card (`UI.js`)

Per i combattenti di tipo `player` (non creature, non pet):

**In modalità XP:**
- Sotto la sezione HP, mostrare una riga con il contatore `XP: 450 / 900 per Lv.3` e una barra di avanzamento blu.
- La barra mostra il progresso tra il threshold del livello corrente e quello del livello successivo.
- A livello 20 (massimo): mostrare `XP: 355.000 — Livello massimo` senza barra.
- Visibile a tutti (master e tutti i giocatori).

**In modalità milestone:**
- Nessuna barra. Il livello è già mostrato dal `level-badge` esistente.

**Badge level-up:**
- Quando `xp[combatantId] >= soglia(livello + 1)` (modalità XP) oppure `levelUpGranted[combatantId] === true` (modalità milestone): mostrare `✨ Pronto per salire!` sul badge della card.
- Il bottone `⬆ Sali di livello` appare solo sulla card del giocatore stesso (`isOwnCard`); cliccarlo apre il modale level-up esistente (`LevelUpUI.js`).
- Dopo il level-up completato, il flag `levelUpGranted/{combatantId}` viene rimosso dalla sessione.
- **Lato master (solo milestone):** su ogni card giocatore il master vede il bottone `🎖 Concedi Level-up` (al posto della XP bar). Cliccarlo scrive `sessions/{code}/levelUpGranted/{combatantId}: true`. Il master non può scrivere direttamente sulla scheda del giocatore (Firebase security rules).

---

## Pannello assegnazione XP (master, modalità XP)

Nel pannello master (`#master-controls`), un form collassabile `#xp-award-form`:

```
[ ▼ Assegna XP ]
  ☑ Thorin   (Lv.2 — 450 XP)
  ☑ Elara    (Lv.2 — 450 XP)
  ☐ Grom     (Lv.1 — 0 XP)
  Quantità: [_______]  [Assegna XP]
```

- Elenca tutti i combattenti di tipo `player` presenti nella sessione.
- Checkbox pre-selezionate (tutti selezionati di default).
- Al submit: per ogni giocatore selezionato, scrive `sessions/{code}/xp/{combatantId}` sommando la quantità usando `runTransaction`.
- Se il totale supera la soglia del livello successivo: il sistema non forza il level-up; il giocatore vedrà il badge e sceglierà quando salire.
- Visibile solo in modalità XP.

---

## Moduli coinvolti e modifiche

| File | Modifiche |
|---|---|
| `index.html` | `<select id="select-progression-mode">` nella home card master; `#xp-award-form` nel pannello master |
| `src/Session.js` | `create(options)` scrive `progressionMode`; `setProgressionMode(mode)`; `addXp(combatantId, amount)` con runTransaction; `grantLevelUp(combatantId)`; `clearLevelUpGrant(combatantId)` |
| `src/UI.js` | `renderCombatantList` riceve `progressionMode`, mappa `xp` e `levelUpGranted`; aggiunge sezione barra XP, badge e bottoni level-up/concedi |
| `src/sheet.js` | `makeCallbacks()` aggiunge `onLevelUp` che apre il modale esistente e dopo il completamento chiama `clearLevelUpGrant`; `onGrantLevelUp` per il master in milestone |
| `src/home.js` | Legge `#select-progression-mode` e lo passa alla chiamata di `session.create()` |
| `app.js` | Il listener Firebase passa `progressionMode` e `xp` al render; handler click su `#xp-award-form` |

---

## Flusso dati

1. Master crea sessione con `progressionMode` → salvato su Firebase.
2. Tutti i client ricevono `progressionMode` e `xp` nel listener `session.listen()`.
3. `app.js` passa questi valori a `UI.renderCombatantList`.
4. Master assegna XP dal pannello → `Session.addXp()` con runTransaction.
5. Firebase notifica tutti → re-render delle card con barra aggiornata.
6. **Modalità XP:** se `xp >= soglia(livello + 1)`, badge compare sulla card del giocatore.
7. **Modalità milestone:** master clicca `🎖 Concedi Level-up` sulla card → `Session.grantLevelUp(combatantId)` → badge compare sulla card del giocatore.
8. Il giocatore clicca `⬆ Sali di livello` sulla propria card → modale level-up esistente si apre.
9. Al completamento del modale: `CharacterSheet.setField('level', newLevel)` (già esistente) + `Session.clearLevelUpGrant(combatantId)`.

---

## Gestione edge case

- **Giocatore senza `charId`** (entrato senza selezionare un personaggio dalla libreria): il bottone level-up è nascosto (non c'è scheda su cui scrivere).
- **Cambio modalità a sessione in corso**: i dati XP rimangono su Firebase ma le barre/form vengono nascosti/mostrati in base alla nuova modalità.
- **Livello 20**: nessun badge level-up, nessun bottone, barra sostituita da testo "Livello massimo".
- **Dati XP assenti** (sessione creata prima di questa feature): XP default a 0, nessuna rottura.
