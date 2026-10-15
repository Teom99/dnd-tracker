# Handoff per Claude Code

Questo file è il prompt da dare a una sessione di Claude Code che lavora **nel repository del sito** (combat tracker D&D 5e, GitHub Pages, nessun build step). Insieme a questo file la sessione deve avere la cartella del kit (`kit/`) e i documenti (`README.md`, `tokens.json`, `integrazione.md`, `microinterazioni.md`, `stati.md`).

## Prompt da incollare

Sei in un repository che pubblica su GitHub Pages direttamente dai sorgenti: niente `package.json`, niente build, niente CI. Devi implementare il rework grafico **«Lanterna»** del combat tracker senza togliere nessuna funzionalità. In `lanterna/` (o dove ti ho messo la cartella) trovi il design completo già verificato: leggi nell'ordine `README.md`, `integrazione.md`, `microinterazioni.md`, `stati.md`, poi apri i mockup in `kit/mockups/` e la demo `kit/demo.html`.

**Vincoli tassativi**
1. Nessun build step: niente Tailwind compilato, Sass, PostCSS, TypeScript, CSS Modules. Tutto gira nel browser così com'è scritto.
2. Componenti **Preact + htm** (non JSX) caricati da CDN con import map e versioni pinnate (`preact@10.29.8`, `htm@3.1.1`, già in `kit/demo.html`). Un file `.js` per componente, nessun `document.getElementById` dentro i componenti: props in ingresso, callback in uscita.
3. Firebase Realtime Database non si tocca. La logica di dominio resta dov'è; i componenti ricevono lo stato e chiamano le funzioni esistenti tramite callback.
4. Font: già caricati Cormorant, Alegreya Sans, Grenze Gotisch, Cinzel, EB Garamond; si aggiunge **solo Sora** (400–700) al link Google Fonts. Nessuna immagine, nessun icon font: le icone sono `kit/icons.js` (SVG inline).
5. Tema scuro sempre. Il pannello «Aspetto» esistente resta e continua a scrivere `data-palette`, `data-ornament`, `data-typeface` su `<html>` (valori: palette `cenere|ambra|arcano|vespro`, ornamento `essenziale|standard|ricco`, carattere `cormorant|grenze`). Se oggi usa altri valori, mappali ai nuovi. Tutte le 4 palette devono restare belle.
6. **Convenzione CSS**: BEM con prefisso per area (vedi la testata di `kit/tokens.css`). Ogni regola nuova è un token, una primitiva `ds-*` o una classe col prefisso del proprio componente. Niente `!important`, id o selettori di tag annidati. Man mano che una zona è migrata, elimina le sue vecchie regole e il corrispondente pezzo del blocco `/* Reset conflitti style.css */`.
7. Due regimi di rendering: i **componenti Preact** possono animare entrate e transizioni; i **render imperativi ancora da migrare** (inclusa la griglia SVG) no: solo cambi istantanei e flash <2.5 s via classe. La griglia SVG resta imperativa; niente `filter`, `backdrop-filter`, `blur` o ombre per cella o token.
8. Layout: 3 colonne a 1440, 4 colonne (`ly--wide`) da 1680 px in su, una vista alla volta con tabbar sotto 760 px. Desktop prima, telefono dignitoso.

**Procedura**
1. Esplora il repo: `index.html`, `src/ui/UI.js`, `src/ui/GridUI.js`, i 6 CSS globali. Scrivi un breve piano che associa ogni funzione `render*` al componente del kit (tabella in `integrazione.md`) e segnala eventuali differenze con quanto assunto qui (nomi di funzioni, struttura dati dei combattenti, formato del log). **Non inventare**: adatta le props ai dati reali con piccoli adattatori, non cambiando il modello dati.
2. Copia `kit/` nel repo (suggerito: `assets/lanterna/` per CSS/icone e `src/ui/components/` per i componenti). Aggiungi l'import map a `index.html` e Sora al link dei font. Sostituisci i token con `kit/tokens.css` e carica `primitives.css` e `components.css` (+ le parti di `views.css` che servono). Verifica che il sito si apra ancora e che nulla sia rotto prima di proseguire.
3. Migra **un pezzo alla volta**, in quest'ordine, committando dopo ciascuno: `TopBar`+`TurnBanner` → `InitiativeRail` → `PlayerDock`/`MasterDock` → `CombatantList`/`FightCard` → `EventLog` → `Toasts`. Per ciascuno: monta con `render()` in un contenitore dedicato, richiama `render()` a ogni aggiornamento Firebase, rimuovi la vecchia funzione imperativa e le sue regole CSS.
4. Poi applica il CSS `gr-*` alla griglia SVG esistente (colori per tipo di token, bordo-arco HP, alone del token attivo come `radialGradient`, muri, pittura, raggio di movimento, template d'area, cursori) senza cambiare la logica di rendering. Poi ridisegna Home, Login, Scheda, Nave e Modali seguendo i mockup `01`, `02`, `05`, `06`, `07`; infine il responsivo telefono (`08`).
5. Applica le microinterazioni della tabella in `microinterazioni.md` rispettando il regime di ogni riga. Applica gli stati di `stati.md` (vuoto, errore, offline, morente, morto, turno attivo…).

**Verifica prima di dichiarare finito**
- Apri il sito a 1440×900, 1920×1080 e 390×844 con più giocatori simulati: di chi è il turno si capisce in meno di un secondo; la colonna carte con 6 giocatori e 8 creature resta scansionabile.
- Prova le 4 palette × 3 ornamenti × 2 caratteri dal pannello Aspetto: nessun testo illeggibile (contrasto AA).
- Cambio turno, danno/cura a più bersagli, death save, level-up, condizioni, template d'area, disegno, cursori live: tutto funziona come prima.
- `grep` che non rimangano `backdrop-filter`/`filter: blur` nella griglia, né emoji usate come icone, né animazioni d'entrata nelle zone imperative.
- Nessun file nuovo richiede un passaggio di compilazione: il sito si pubblica con `git push`.

Alla fine riassumi: cosa hai migrato, cosa resta imperativo e perché, eventuali deviazioni dal design con la motivazione.
