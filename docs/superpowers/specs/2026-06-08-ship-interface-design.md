# Ship Interface — Design Spec
**Date:** 2026-06-08  
**Status:** Approved

---

## Overview

Aggiungere al combat tracker un pannello interattivo per la nave Damselfly: mappa SVG con griglia, posizionamento token per deck, tracking HP nave e stato armi. Accessibile come tab/pannello nel combat view, indipendente dalla lista combattenti.

---

## Modello dati Firebase

```
sessions/{code}/ship/
  hp: number                          ← PF nave correnti (default 200)
  hpMax: number                       ← PF max (default 200)
  weapons/
    ballista/
      state: "ready" | "loading" | "fired" | "destroyed"
      crewIds: { [combatantId]: true }
    mangonel/
      state: "ready" | "loading" | "fired" | "destroyed"
      crewIds: { [combatantId]: true }
  tokens/
    [combatantId]/
      deck: "top" | "main" | "forward"
      col: number
      row: number
  rooms/
    [deck]/
      [roomId]/
        name: string     ← override nome (solo se master modifica)
        notes: string    ← note libere
```

**Regole di accesso:**
- HP nave: modificabile solo dal master
- Weapon state e crewIds: modificabili da tutti (master + player)
- Token positions: ogni player sposta il proprio; master sposta tutti
- Room overrides: solo master

**Deck selector:** stato locale per client (non Firebase). Ogni giocatore vede il deck che vuole indipendentemente.

---

## Config nave (hardcoded)

Definita in `src/ShipUI.js` come costante `DAMSELFLY_CONFIG`:

```js
const DAMSELFLY_CONFIG = {
  top: {
    label: 'Top Deck',
    cols: 12,
    rows: 4,
    rooms: [
      { id: 'open_deck',  label: 'Ponte',       x: 0, y: 0, w: 12, h: 4, color: '#4a6741' },
    ]
  },
  main: {
    label: 'Main Deck',
    cols: 12,
    rows: 7,
    rooms: [
      { id: 'cargo',      label: 'Stiva',         x: 0, y: 0, w:  5, h: 4, color: '#5a4a3a' },
      { id: 'kitchen',    label: 'Cucina',         x: 5, y: 0, w:  3, h: 3, color: '#6b4c2a' },
      { id: 'crew',       label: 'Alloggi',        x: 8, y: 0, w:  4, h: 3, color: '#3a4a5a' },
      { id: 'common',     label: 'Zona Comune',    x: 5, y: 3, w:  4, h: 4, color: '#4a3a5a' },
      { id: 'captain',    label: 'Cabina Capitano',x: 9, y: 3, w:  3, h: 4, color: '#6b3a2a' },
    ]
  },
  forward: {
    label: 'Forward Deck',
    cols: 6,
    rows: 4,
    invertedGravity: true,
    rooms: [
      { id: 'forward_hold', label: 'Prua',       x: 0, y: 0, w: 6, h: 4, color: '#3a4a4a' },
    ]
  }
};
```

Il master può sovrascrivere `label` e aggiungere `notes` per ogni room — salvati su Firebase sotto `ship/rooms/`. La forma e le dimensioni rimangono fisse.

---

## Nuovi file

### `src/Ship.js`
Firebase CRUD per lo stato nave. Pattern identico a `Combatant.js`.

```js
class Ship {
  constructor(db, sessionCode) { ... }
  _ref(path = '') { ... }          // sessions/{code}/ship/...

  async updateHp(delta) { ... }    // runTransaction, min 0 max hpMax
  async setHpMax(val) { ... }
  async setWeaponState(weaponId, state) { ... }
  async toggleCrewMember(weaponId, combatantId) { ... }  // runTransaction
  async setTokenPosition(combatantId, deck, col, row) { ... }
  async removeToken(combatantId) { ... }
  async setRoomOverride(deck, roomId, field, value) { ... }
  async init() { ... }             // set defaults se ship nodo non esiste
}
```

### `src/ShipUI.js`
Rendering SVG pannello nave. Pattern parallelo a `GridUI.js`.

```js
export function renderShipPanel(shipData, combatants, myUid, isMaster, localDeck, callbacks) { ... }
// Ritorna HTML stringa per innerHTML

export function renderShipSvg(deckKey, deckConfig, roomOverrides, tokens, combatants, selectedTokenId) { ... }
// Ritorna SVG stringa
```

---

## Layout UI

Un bottone **"🚢 Nave"** visibile a tutti nel combat view (accanto a `#master-controls` o come elemento separato nell'header del combat). Click → il pannello nave sostituisce la lista combattenti. Click di nuovo (o bottone "← Combattenti") → torna alla lista.

```
┌─────────────────────────────────────────────┐
│ 🚢 Damselfly      HP [████████░░] 160/200   │
│                   [−10] [+10] (solo master)  │
├─────────────────────────────────────────────┤
│ Ballista  [Pronta     ▼]  👥 Gareth · Thorn │
│ Mangonel  [In carica  ▼]  👥 —              │
├─────────────────────────────────────────────┤
│  [Top Deck]  [● Main Deck]  [Forward Deck]  │  ← tab locale
├─────────────────────────────────────────────┤
│                                             │
│           SVG mappa deck corrente           │
│    (rooms colorate + grid + token circles)  │
│                                             │
└─────────────────────────────────────────────┘
```

**HP nave:** bottoni `−10 / +10` visibili solo al master. Tutti vedono la barra.

**Weapon state dropdown:** `Pronta → In carica → Sparata → Distrutta`. Modificabile da tutti.

**Crew assignment:** ogni combattente ha un chip sotto la weapon card. Click sul proprio chip → toggle presenza. Master può cliccare chip di chiunque.

---

## Rendering SVG

Per ogni deck:
1. Rettangoli colorati semitrasparenti per ogni room (con label centrata)
2. Grid di linee sottili sopra (celle quadrate, 1 cella = 1.5m)
3. Cerchi token (raggio ~0.4 cella) con iniziale personaggio, colore fazione (`--faction-evil` / `--faction-good`)
4. Bordo evidenziato sul token del proprio personaggio

**Interazione token (click-to-select / click-to-place):**
- Click su token proprio (o qualsiasi se master) → `selectedTokenId` settato localmente
- Click su cella vuota con token selezionato → `ship.setTokenPosition(id, deck, col, row)`
- Click su cella occupata da altro token → nessun effetto (o deseleziona)
- Token selezionato: bordo pulsante CSS

---

## Integrazione nei file esistenti

### `index.html`
- Bottone `#btn-toggle-ship` nell'header combat view
- Div `#ship-panel` (hidden di default) dentro `#view-combat`

### `app.js`
- Import `Ship` e `ShipUI`
- `state.ship` istanza di `Ship`
- `state.localDeck = 'main'` (stato locale)
- `state.shipPanelOpen = false`
- Listener `onValue` su `sessions/{code}/ship` → re-render pannello
- Handler `btn-toggle-ship` → toggle `shipPanelOpen`, show/hide pannello
- `_renderShipPanel()` helper simile a `_renderSessionNotes()`

### `src/Session.js`
- `create()`: inizializzare `ship: { hp: 200, hpMax: 200, weapons: { ballista: {state:'ready'}, mangonel: {state:'ready'} } }` alla creazione sessione

### `style.css`
- `.ship-panel`, `.ship-hp-bar`, `.ship-weapon-card`, `.ship-crew-chip`
- `.ship-svg-container` (overflow scroll per deck grandi)
- `.ship-deck-tab`, `.ship-deck-tab.active`

---

## Verifica post-implementazione

1. Master crea sessione → `ship` nodo inizializzato su Firebase con defaults
2. Click "🚢 Nave" → pannello si apre, lista combattenti nascosta
3. Player posiziona il proprio token su Main Deck cella (3,2) → tutti i client vedono il token lì
4. Player A è su Top Deck, Player B è su Main Deck → vedono deck diversi simultaneamente senza interferenza
5. Master applica −30 HP alla nave → barra aggiornata in real-time su tutti i client
6. Player clicca "Pronta" sulla Ballista → stato cambia, aggiornato per tutti
7. Player si aggiunge come crew alla Ballista → chip appare con il suo nome
8. Master sovrascrive nome room "Stiva" → nuovo nome visibile a tutti
9. Token combattente rimosso dal combat → token scompare dalla mappa nave
