# Microinterazioni

**Regimi**: *P* = componente Preact (DOM persistente: le animazioni d'entrata e le transizioni funzionano). *I* = render imperativo ancora da migrare (il contenitore viene ricostruito: solo cambi istantanei e flash <2.5 s via classe). Con `prefers-reduced-motion` tutto si riduce a 1 ms.

| Elemento | Trigger | Durata | Easing | Proprietà | Regime |
|---|---|---|---|---|---|
| Nome nel banner turno (`tb-turn__name`) | cambio di `active.id` (rimonta per `key`) | 620 ms | `ease-out` | `opacity`, `transform` | P |
| Linea di luce del banner (`tb-turn__sweep`) | cambio turno | 900 ms | `ease-out` | `transform` (scaleX), `opacity` | P |
| Fiamma del banner | sempre | 2.8 s, loop | `ease-io` | `opacity`, `transform` | P |
| Respiro del banner «è tuo» (`tb-turn.is-mine`) | tocca a te | 2.4 s, loop | `ease-io` | `box-shadow` (un solo elemento) | P |
| Riga attiva nell'iniziativa (`ir-pop`) | diventa attiva | 420 ms | `ease-spring` | `opacity`, `transform` | P |
| Nastro «Tocca a te» (`dk__ribbon`) | tocca a te | 500 ms | `ease-spring` | `opacity`, `transform` | P |
| Fine turno che respira (`dk-beat`) | tocca a te | 2 s, loop | `ease-io` | `box-shadow` (un solo elemento) | P |
| Apertura carta (`fc-open`) | click sulla testata | 320 ms | `ease-out` | `opacity`, `transform` | P |
| Barra HP: riempimento | variazione HP | 450 ms | `ease-out` | `transform` (scaleX) | P |
| Barra HP: scia | variazione HP | 900 ms, ritardo 320 ms | `ease-out` | `transform` (scaleX) | P |
| Barra HP in `I` | variazione HP | 0 | — | stato istantaneo | I |
| Flash HP danno/cura (`fc.is-flash-*`) | `hp` cambia | 1.2 s | `ease-out` | `opacity` (pseudo-elemento) | P e I |
| Anello XP pronto (`ds-ready`) | level-up pronto | 1.6 s, loop | `ease-io` | `opacity`, `transform` | P (in `I`: anello oro pieno fisso) |
| Rombo/tondo death save | click | 320 ms | `ease-spring` | `transform`, `background-color` | P |
| Voce di log nuova (`lg-new`) | arriva un evento | 2.4 s | `ease-out` | `opacity` (pseudo-elemento) | P e I |
| Notifica popup (`nt-in`) | evento | 320 ms | `ease-out` | `opacity`, `transform` | P |
| Timer della notifica (`nt-timer`) | notifica visibile | 3 s | lineare | `transform` (scaleX) | P |
| Sottolineatura delle tab | cambio tab | 320 ms | `ease-out` | `transform` (scaleX) | P |
| Menu «⋯» (`tb-pop`) | apertura | 200 ms | `ease-out` | `opacity`, `transform` | P |
| Condizione selezionata in modale | click | 320 ms | `ease-spring` | `transform`, `background-color` | P |
| Hover/press di pulsanti e tasti dock | puntatore | 120 ms | `ease-out` | `transform`, colori | P e I |
| Chip, segmenti, campi | hover/focus/stato | 200 ms | `ease-out` | colori, `box-shadow` | P e I |
| Spinner di caricamento | `is-loading` | 800 ms, loop | lineare | `transform` | P e I |
| Cursori live sulla mappa | ogni 120 ms | 0 | — | posizione istantanea | I |
| Token attivo/selezionato sulla mappa | selezione | 0 | — | alone `radialGradient` statico | I |
| Ghost di spostamento, raggio, template | puntatore | 0 | — | geometria istantanea | I |
| Cambio palette/ornamento/carattere | pannello Aspetto | 0 | — | attributi su `<html>` | P e I |
