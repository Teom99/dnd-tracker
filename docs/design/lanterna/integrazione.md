# Integrazione nel sito

Il sito è su GitHub Pages dai sorgenti: nessun build. Il rework si innesta un pezzo alla volta.

## Mappa componenti → funzioni attuali

| Componente | Sostituisce |
|---|---|
| `FightCard` / `CombatantList` | `renderCombatantList` in `src/ui/UI.js` |
| `InitiativeRail` | `renderInitiativeList` in `src/ui/GridUI.js` |
| `PlayerDock` / `MasterDock` | `renderPlayerDock` / `renderMasterDock` in `src/ui/UI.js` |
| `EventLog` | `renderLogs` in `src/ui/UI.js` |
| `TopBar` (+ `TurnBanner`) | markup statico in `index.html` |
| `Toasts` | notifiche popup attuali |

## Import map

```html
<script type="importmap">
{ "imports": {
  "preact": "https://cdn.jsdelivr.net/npm/preact@10.29.8/dist/preact.module.js",
  "preact/hooks": "https://cdn.jsdelivr.net/npm/preact@10.29.8/hooks/dist/hooks.module.js",
  "htm": "https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.module.js",
  "htm/preact": "https://cdn.jsdelivr.net/npm/htm@3.1.1/preact/index.module.js" } }
</script>
```

Aggiungi `Sora` (400–700) al link Google Fonts già presente: è l'unico font nuovo.

## Come montare un pezzo

```js
import { html, render } from 'htm/preact';
import { InitiativeRail } from './components/InitiativeRail.js';
const mount = document.getElementById('ir-root');
const draw = (s) => render(html`<${InitiativeRail} combatants=${s.order} activeId=${s.activeId} round=${s.round} isMaster=${s.isMaster} onNext=${next} />`, mount);
onValue(stateRef, (snap) => draw(snap.val()));   // Firebase: richiami draw a ogni aggiornamento; Preact tocca solo ciò che cambia
```

I componenti non leggono il DOM e non toccano Firebase: dati in ingresso come props, azioni in uscita come callback. Il contenitore montato con `render()` non va mai svuotato a mano.

## Ordine consigliato

1. Sostituisci `tokens.css` e carica `primitives.css` + `components.css`; rimuovi il blocco `/* Reset conflitti style.css */` quando una zona è migrata.
2. `TopBar` + `TurnBanner` (massimo effetto, minimo rischio).
3. `InitiativeRail`, poi `PlayerDock`/`MasterDock`.
4. `CombatantList`/`FightCard` e `EventLog`.
5. Per ultima la griglia: resta imperativa, cambia solo il CSS `gr-*`.

## Controlli prima di unire

- Nessuna regola CSS fuori convenzione (token, `ds-*` o classe col prefisso del componente).
- Nessuna animazione d'entrata in zone ancora imperative.
- Nessun `filter`/`backdrop-filter`/`blur`/ombra dentro l'SVG della griglia.
- Le 4 palette × 3 ornamenti × 2 caratteri aperti da «Aspetto»: nessun testo illeggibile.
