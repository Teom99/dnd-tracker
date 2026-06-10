# Combat header, modal XP e rail — design

**Data:** 2026-06-10 · **Branch:** redesign/grimoire

## Contesto

Quattro problemi segnalati nella vista combat:

1. L'header ammassa in una riga info sessione, round, bottoni utility e controlli master; il form "Assegna XP" (`<details>`) si espande dentro l'header rompendo il layout.
2. Il flusso "Assegna XP" è scomodo per il master.
3. La rail "Iniziativa" mostra le distanze in metri quando un token è selezionato sulla griglia (o dal proprio token): non deve mostrarle.
4. Sospetto che i giocatori vedessero i toggle visibilità HP/CA e la barra HP delle creature — diagnosi: era un artefatto di test (due schede anonime nello stesso browser condividono lo uid, quindi la scheda "giocatore" era il master). Nessuna modifica al codice, solo verifica.

## 1. Header del combat

`header.combat-header` contiene solo:

- sinistra: `Sessione:` + codice + `📋 Copia` (invariati)
- centro: `Round N`
- destra: `← Esci`

Si rimuovono dall'header: `#master-controls` (Turno Successivo, Reset), `#select-progression-mode-live`, `#xp-award-section` con il `details` e relativo CSS ormai inutilizzato. `🖼 Upload image` e `🚢 Damselfly` si spostano nella toolbar (sotto).

## 2. Toolbar azioni (`#combat-toolbar`)

Nuova barra in cima a `#combat-center`, **esterna** ai pannelli che si scambiano (griglia / nave / scena), così resta visibile con la nave aperta.

- Visibile a tutti: `🖼 Scena` (ex "Upload image") e `🚢 Damselfly` — stessa visibilità di oggi.
- Solo master (gating come l'attuale `#master-controls`, via `UI.js`): `Turno Successivo ▶`, `✨ Assegna XP`, select `XP/Milestone`, `↺ Reset`.
- `✨ Assegna XP` visibile solo in modalità progressione `xp` (come l'attuale `#xp-award-section`).
- Layout flex con `flex-wrap` per il mobile. L'header interno di `#grid-section` (modifica griglia, taglia token) resta invariato.
- Gli id dei bottoni esistenti (`btn-next-turn`, `btn-reset`, `btn-upload-scene`, `btn-toggle-ship`, `select-progression-mode-live`) restano gli stessi: gli event listener in `app.js` non cambiano.

## 3. Modal "Assegna XP"

Nuovo modal `#xp-award-modal` nello stile pergamena dei modal esistenti (`#add-combatant-modal`):

- Titolo "✨ Assegna Punti Esperienza".
- Lista dei soli combattenti `type === 'player'` con checkbox (tutti selezionati di default) e meta `Lv.X — N XP` (dati da `progressionData`, come l'attuale render di `#xp-award-players`).
- Bottoni rapidi `+25 +50 +100 +250 +500` che **sommano** la cifra al campo importo.
- Campo numerico importo + anteprima testuale live: `→ 150 XP a Theren e Mirka` (vuota/disabilitata se importo 0 o nessun selezionato).
- Bottone `Assegna`: applica la **stessa cifra a ogni selezionato** via `session.addXp(id, amount)` (logica invariata), scrive un log in cronaca ("Il master ha assegnato 150 XP a Theren e Mirka") seguendo il pattern dei log su azione utente, svuota il campo e chiude il modal.
- Chiusura: bottone ✕/Annulla e click sul backdrop, come gli altri modal.
- Il contenuto della lista si (ri)popola all'apertura dal `state.snapshot` corrente; non serve re-render realtime mentre è aperto.

## 4. Rail Iniziativa — niente distanze

In `GridUI.renderInitiativeList` si rimuove il calcolo e il markup della distanza (`distText` / `.rail-dist`, oggi a `GridUI.js:302-306`) e il CSS relativo. Restano ritratto, mini-barra HP e nome. Le etichette di distanza **sopra i token della griglia** (in `renderGrid`) restano invariate.

## 5. Visibilità HP/CA creature — solo verifica

Il codice gata già correttamente su `isMaster` (toggle in `UI.js:389-408`, barra HP via `showFullHp`, CA via `acVisible`, mini-barre rail via `hpVisible`). Nessuna modifica. Verifica manuale richiesta: master in finestra normale, giocatore ospite in **incognito** (uid diverso); confermare che il giocatore non veda i toggle 👁/🛡, né barra HP, né CA delle creature quando nascoste, e che veda l'hint qualitativo quando `showHealthHint` è attivo.

## Fuori scope

- Modalità "dividi totale" nel modal XP (opzione B scartata).
- Spostare "Fine Turno" dalla card del giocatore.
- Modifiche a chi può caricare la scena o aprire la nave (visibilità invariata).

## Test

Verifica manuale (non esiste una suite automatica):

1. Header master e giocatore: una riga, niente controlli master nell'header.
2. Toolbar: master vede tutte le azioni, giocatore solo Scena/Nave; con la nave aperta la toolbar resta visibile e il toggle richiude.
3. Modal XP: selezione default, bottoni rapidi che sommano, anteprima, assegnazione multi-giocatore, log in cronaca, chiusura.
4. Modalità Milestone: bottone XP nascosto, "Concedi Level-up" sulle card invariato.
5. Rail senza distanze; etichette distanza sui token della griglia ancora presenti.
6. Verifica incognito del punto 5 (visibilità HP/CA).
7. Mobile (<1100px): toolbar che va a capo, header leggibile.
