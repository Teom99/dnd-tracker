# Stati

Tutti gli stati sono visibili in `kit/mockups/09-stati.html`. Hover, focus-visible e active si ottengono dai pseudo-selettori reali; la pagina li simula con classi `sx-*` solo a scopo di documentazione.

| Stato | Trattamento | Dove |
|---|---|---|
| Hover | bordo `gold`, testo `gold-bright`, salita di 1 px (solo con puntatore fine) | tutti i controlli |
| Focus-visible | anello 2 px `gold-bright`, offset 2 px | tutti i controlli |
| Active (premuto) | discesa di 1 px e scala .985 | pulsanti, tasti dock |
| Disabled | opacità 50%, cursore `not-allowed`, nessuno spostamento | pulsanti, campi, azioni se offline |
| Loading | testo nascosto, spinner al centro (`is-loading`) | pulsanti |
| Selezionato | `is-on`: oro su chip, segmenti, modi mappa | chip, seg, tabs |
| Vuoto | sigillo + titolo + frase + azione per il master | carte, iniziativa, log, scena |
| Errore | bordo e alone `blood`, messaggio con icona sotto il campo | campi |
| Offline | chip «Offline · ritento…», filo rosso sotto la topbar, azioni spente | topbar, dock |
| Turno attivo | `glow-turn`, numero oro, banner con respiro, dock «Tocca a te» | banner, rail, carta, dock, token |
| PG morente (0 HP, non morto) | bordo `blood`, HP rossi, death saves inline, pallino che respira | carta, rail, dock |
| PG morto / creatura abbattuta | nome barrato, grigio, teschio, barra vuota | carta, rail, token |
| Già agito nel round | testo attenuato (`is-done`) | rail |
| Flash HP | rosso (danno) o verde (cura) per 1.2 s | carta |
| Level-up pronto | anello XP oro pieno che pulsa | ritratto |
