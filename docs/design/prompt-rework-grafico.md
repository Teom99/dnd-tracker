# Prompt — Rework grafico D&D Combat Tracker

---

Sei un art director / UI designer specializzato in interfacce dense per strumenti da tavolo.
Devi progettare un **rework grafico** di un combat tracker web per D&D 5e, usato in tempo reale
da un master e 4-6 giocatori durante la sessione. L'obiettivo non è riscrivere il prodotto:
le funzionalità restano tutte, cambia il **vestito**. Oggi è funzionale ma anonimo; lo voglio
**accattivante**: più gerarchia visiva, più carattere, qualche momento "wow" controllato,
senza perdere leggibilità né velocità d'uso al tavolo.

## 1. Contesto d'uso (progetta per questo, non per uno screenshot)

- Sessione serale, luce bassa, 3-4 ore di uso continuato → tema scuro obbligatorio, niente bianchi accecanti.
- **Tutti sono su laptop**, master e giocatori: schermi da **1280 a 1920px**, finestra a tutto schermo.
  Il bersaglio di progetto è **1440px**. È qui che il design deve essere eccellente.
- Il **telefono** (390-430px) capita: un giocatore che arriva senza portatile, qualcuno che controlla
  la scheda dal divano. Deve funzionare in modo dignitoso, ma è il **caso secondario** —
  non sacrificare una singola scelta desktop per migliorarlo.
- Tutto è **real-time**: ogni azione di chiunque ridisegna pezzi di UI per tutti entro ~100ms.
  L'interfaccia deve far capire *a colpo d'occhio* "di chi è il turno" e "cosa è appena successo".
- Dimensioni realistiche su cui calibrare i layout: **4-6 giocatori** più **3-10 creature** in campo,
  **20-60 voci** nel log di una serata, griglia **20×20** caselle (fino a 40×40). Non progettare
  liste da tre righe: progetta per il caso pieno.
- Lingua: italiano.

## 2. Vincoli tecnici tassativi

### 2.1 La regola che governa tutto: nessun build step

Il sito è pubblicato su GitHub Pages direttamente dai file sorgente. Non esiste `package.json`,
non esiste `node_modules`, non esiste CI: si fa `git push` e il sito è online. **Questo non cambia.**

Quindi il vincolo vero non è "niente librerie", è: **niente che richieda compilazione**.
Tutto deve girare nel browser così com'è scritto.

### 2.2 Stack

- **Preact + htm**, caricati come moduli ES da CDN tramite `<script type="importmap">` in `index.html`,
  con versioni **pinnate esatte** (ultima 10.x di `preact`, 3.x di `htm` — verifica al momento dell'uso).
  I componenti si scrivono con i template literal di `htm`, non con JSX (il JSX richiederebbe
  compilazione). `htm` e JSX sono però intercambiabili per costruzione: se un giorno arriverà un
  build step, i componenti non andranno riscritti.
- JavaScript **ES6 modules** nativi, CSS in fogli di stile classici.
- Backend **Firebase Realtime Database** (non va toccato).
- Parte dell'applicazione è ancora rendering imperativo "vecchio stile" (`innerHTML` ricostruito a ogni
  aggiornamento). La migrazione a componenti è in corso e procede un pezzo alla volta: il design deve
  funzionare in entrambi i regimi. Vedi §2.4.

### 2.3 Il CSS resta globale — serve una convenzione

Senza build step **non esiste CSS scoped**: nessun `<style scoped>`, nessun CSS Module, nessuna
classe generata. Ogni regola che scrivi vale su tutto il sito.

Oggi questo è già un problema: ~4.500 righe di CSS in 6 file globali, al punto che `index.html`
contiene un blocco intitolato letteralmente `/* Reset conflitti style.css */` per spegnere regole
che si pestano i piedi.

**Parte del tuo deliverable è risolvere questo**: proponi una convenzione di naming esplicita
(BEM o equivalente), con un prefisso per area, e applicala in modo coerente a tutto ciò che consegni.
Una regola che non sia o un token, o una primitiva dichiarata riutilizzabile, o una classe con
prefisso di componente, è un errore.

### 2.4 Due regimi di rendering, due regole per le animazioni

- **Componenti Preact** (quelli che consegni tu): il DOM persiste tra un aggiornamento e l'altro, solo
  ciò che cambia davvero viene toccato. Qui le animazioni d'entrata, le transizioni di stato e le
  micro-interazioni **funzionano normalmente**. Usale.
- **Render imperativi ancora da migrare**: il contenitore viene svuotato e ricostruito ad ogni
  aggiornamento Firebase, anche più volte al secondo. Qui un'animazione d'entrata riparte da capo
  ogni volta e sfarfalla. Per queste zone: solo cambi di stato istantanei, più flash brevi (<2.5s)
  applicati via classe.

Indica chiaramente, per ogni animazione che proponi, a quale dei due regimi appartiene.

### 2.5 La griglia SVG è il punto caldo

La mappa tattica è un SVG ridisegnato continuamente: fino a 40×40 celle, più token, muri, pittura,
template d'area e i cursori live degli altri giocatori aggiornati ogni 120ms. Resterà rendering
imperativo a mano anche dopo la migrazione, perché è la scelta giusta per quel carico.

**Niente `filter`, `backdrop-filter`, `blur` o ombre per singola cella.** Effetti costosi solo su
elementi singoli e isolati (il token attivo, la cornice della mappa).

### 2.6 Risorse

- Font già caricati da Google Fonts: Cormorant, Alegreya Sans, Grenze Gotisch, Cinzel, EB Garamond.
  Puoi ricombinarli, **non aggiungerne più di uno nuovo**.
- Ornamenti e texture: solo CSS o SVG inline (data-URI). **Nessun file immagine**, nessun icon font,
  nessuna libreria di icone. Le icone attuali sono emoji — vanno sostituite (§5.7).
- Touch target minimo 44px dove il touch è plausibile, contrasto testo AA su fondo scuro.

## 3. Punto di partenza: il design system esistente

C'è già un tema chiamato **"Cenere & Verderame"** — dark fantasy sobrio, ispirazione Souls-like.
Funziona come base, va **alzato di livello**, non buttato.

Token attuali in `:root`:

```css
--bg0 … --bg3        /* 4 livelli di fondo, quasi neri */
--line, --line-strong
--gold / --gold-bright / --gold-dim / --gold-faint   /* oro antico, costante in tutte le palette */
--bone / --mut / --faint                              /* 3 livelli di testo */
--accent / --accent-dim / --accent-faint              /* varia con la palette */
--blood, --blood-deep, --heal, --hp-fill, --hp-trail  /* semantici: danno, cura, barre HP */
--font-display: 'Cormorant'      --font-ui: 'Alegreya Sans'      --font-mono
--r: 2px     /* raggio quasi tagliente */     --tap: 44px
```

Primitive già esistenti da mantenere (o sostituire con equivalenti migliori):
`.ds-panel` (pannello con bordo + gradiente), `.orn-c` (angoli in oro), `.ds-heading`
(titolo con filetti laterali), `.ds-sep` (separatore ◆), `.emblem` (sigillo circolare CSS),
`.fog-stage` (grana pellicola + vignetta a tutto schermo), `.t-display/.t-label/.t-gold`.

**Esiste già un pannello "Aspetto"** che l'utente apre a runtime, persistito in `localStorage`
e applicato come attributi sull'elemento `<html>`:
- `data-palette`: Cenere & Verderame (default) · Ambra · Arcano · Vespro
- `data-ornament`: Standard · Essenziale · Ricco (quanti ornamenti mostrare)
- `data-typeface`: Cormorant · Grenze Gotisch

**Questo meccanismo va preservato**: il nuovo design deve restare parametrico su quei tre assi,
e tutte e 4 le palette devono risultare belle, non solo quella di default.

## 4. Inventario completo delle funzionalità da vestire

### 4.1 Home

- **Topbar**: emblema, nome utente, "Accedi con Google" (solo se l'account è anonimo), logout.
- **Schermata di login** (quando sloggato): login box centrato, Google o accesso anonimo.
- **Crea sessione** (master): genera un codice a 4 cifre, sceglie le dimensioni della griglia.
- **Unisciti a una sessione**: campo codice + picker del personaggio dalla libreria (chip selezionabili).
- **Sessioni salvate**: righe con codice in evidenza, nome personaggio, ruolo, "rientra" / "esci".
- **Libreria personaggi e creature**: griglia di card (avatar, nome, tipo, HP, CA); crea, modifica,
  duplica, elimina; il click apre la scheda personaggio completa.
- **Anteprima personaggio** selezionato.

### 4.2 Vista combattimento — il cuore dell'app

Shell a **3 colonne** (oggi: `clamp(196px,18vw,256px)` | `1fr` | `clamp(284px,27vw,352px)`),
altezza fissa `100dvh`, nessuno scroll di pagina: scrollano solo i pannelli.
Sei libero di riprogettare queste proporzioni — anzi, vedi §5.6.

**Topbar**: emblema · codice sessione + copia · **banner del turno** (round corrente + nome di chi è
di turno, è l'elemento più importante della schermata) · bottone "Turno ▸" (master) · menu "⋯" con
Scena, Nave, Riposo breve, Riposo lungo, Tema, Reset incontro (master), modalità progressione,
assegna XP · Esci.

**Colonna sinistra — Iniziativa**: lista ordinata dei combattenti con numero d'ordine, nome,
HP sintetici, condizioni, evidenza forte sul turno attivo; in fondo i controlli master.

**Colonna centrale — Griglia tattica** (SVG adattivo, 1 casella = 1 metro):
- **Token** rotondi, fondo opaco, **il bordo è anche la barra HP** (arco proporzionale);
  colore per tipo: verde = giocatore, azzurro = creatura alleata, rosso = nemica, grigio+teschio = morto;
  iniziale del nome dentro, nome completo in maiuscoletto sotto; **alone oro** per token attivo/selezionato.
- Token **multi-cella** per taglia: 1×1 Media, 2×2 Grande, 3×3 Enorme, 4×4 Mastodontica.
- **Raggio di movimento**: selezionando un token si illuminano le caselle raggiungibili.
- **Ghost di spostamento** al passaggio del mouse (colorato come il token, grigio se la destinazione è invalida).
- **Muri** disegnabili dal master (drag), bloccano il movimento.
- **Disegno libero sulla mappa**, aperto a tutti: palette di 8 colori + color picker custom + gomma,
  **secchiello** (flood fill), dimensione pennello 1×1→4×4, forma quadrata/rotonda,
  anteprima dell'area sotto il cursore, undo/redo, "pulisci tutto".
- **Template d'area** per incantesimi: cerchio / cono / linea, piazzamento clic-clic con anteprima
  live e **misura in metri** accanto al cursore; celle coperte evidenziate; condiviso a tutti in tempo reale.
- **Cursori live multiplayer**: ogni giocatore vede il puntatore degli altri con nome e colore personale.
- Zoom +/−/reset con pulsanti flottanti, pan con trascinamento.
- **Barra token** sopra la griglia: chip dei personaggi da piazzare.
- Toolbar contestuale con hint testuale che cambia in base alla modalità attiva
  (muri / disegno / template / selezione).

**Colonna destra — tre schede**:
1. **Carte**: una card per combattente, è l'elemento più denso dell'app. Contiene ritratto con
   **cornice XP a conic-gradient** (diventa oro pieno e pulsa quando il level-up è pronto), nome,
   barra HP, CA, iniziativa editabile inline, HP max e HP temporanei editabili inline,
   condizioni attive come chip, azione dichiarata, pulsante **ispirazione ✦**, campo quantità +
   bottoni danno/cura con **selezione multipla dei bersagli** tramite chip,
   **death saves inline** quando il PG è a 0 HP, **flash rosso/verde** ad ogni variazione di HP.
2. **Log eventi**: cronologia real-time ("A ha colpito B infliggendo 7 danni"), con svuota.
3. **Cronache**: note di sessione condivise e modificabili da tutti, con **lock colorato** che mostra
   chi sta scrivendo in quel momento, più un archivio.

**Dock personale** (footer): il proprio personaggio sempre a portata di mano — ritratto con cornice XP,
HP, XP numerici, azioni rapide, "Fine turno".

**Pannello scena**: immagine evocativa caricata dal master, espandibile/riducibile/eliminabile.

**Pannello nave "Damselfly"**: ponti renderizzati come stanze in CSS grid (tutti visibili insieme),
token equipaggio spostabili tra stanze, carte delle armi con stato e equipaggio assegnato,
barra di integrità dello scafo.

**Notifiche popup** (alto a destra, impilate, 3s): danno/cura ricevuti dal proprio PG + riepilogo
broadcast di ogni colpo a tutto il tavolo.

**Modali**: condizioni (griglia di condizioni 5e selezionabili), stat block mostro (da API open5e),
archivio cronache, level-up, upload scena (con drop zone), azione dal dock, assegna XP,
aggiungi creatura (picker libreria + ricerca mostri), pannello Aspetto.

**Su telefono** (caso secondario): le 3 colonne collassano e si naviga con una tabbar in basso a 5 voci
— Battaglia · Ordine · Carte · Diario · Cronache. Il dock personale resta sempre visibile.

### 4.3 Scheda personaggio

Stat block 5e completo, stile "tomo": testata con nome, sottotitolo classe/livello e barra XP;
layout a due colonne per sezioni; 6 caratteristiche con modificatore; competenze ed expertise
segnate con **pip**; tiri salvezza; CA, velocità, iniziativa, HP, HP temporanei, dadi vita;
death saves; attacchi; **slot incantesimo a rombi** con +/− e massimo editabile; trucchetti e
incantesimi per livello; inventario; feature di classe; pannello level-up con scelta delle feature.

## 5. Cosa non funziona oggi (i problemi da risolvere)

1. **Tutto pesa uguale.** La griglia, le card e l'iniziativa hanno la stessa densità e lo stesso
   contrasto: l'occhio non sa dove andare. Serve una gerarchia netta tra "chi è di turno",
   "cosa posso fare adesso" e "informazione di contorno".
2. **Il momento più importante del gioco — il cambio turno — è silenzioso.** Serve un trattamento
   visivo memorabile (ma breve, e non invasivo per chi non è di turno).
3. **Le card combattente sono muri di input.** Troppi campi editabili visibili insieme, nessun ritmo.
   Con 6 giocatori e 8 creature in lista, la colonna destra diventa illeggibile.
4. **Mancano gli stati vuoti e di attesa**: schermate senza combattenti, senza note, senza scena
   sono spoglie e fanno sembrare l'app rotta.
5. **Il tema è sobrio fino all'anonimo.** Ornamenti e texture ci sono ma troppo timidi per leggersi.
6. **Il desktop non sfrutta lo spazio che ha.** Le 3 colonne sono dimensionate con `clamp()` stretti:
   a 1920px restano larghe quanto a 1280px e la griglia si prende tutto l'avanzo, mentre la lista
   delle carte — la zona dove si agisce davvero — resta compressa. Ripensa le proporzioni per
   1440-1920px, dove questo strumento vive.
7. **Le emoji usate come icone** (⚓ 🌗 🎨 🪣 ⬡) rompono il tono visivo e rendono diversamente su
   iOS/Android/Windows.

## 6. Cosa devi consegnare

1. **Due direzioni artistiche** descritte in 5-6 righe ciascuna (moodboard a parole: materiali,
   contrasto, grado di ornamento, trattamento tipografico, riferimenti). Poi **scegli tu la migliore,
   motiva in due righe e sviluppa solo quella** — non fermarti a chiedere.

2. **Componenti Preact + htm**, un file `.js` per componente, scritti così:

   ```js
   import { html } from 'htm/preact';
   export function FightCard({ combatant, isActive, canEdit, onDamage, onHeal }) {
     return html`<li class="fc ${isActive ? 'fc--active' : ''}">…</li>`;
   }
   ```

   Nessun `document.getElementById` dentro i componenti: dati in ingresso come props, azioni in uscita
   come callback. I componenti prioritari, con la funzione di rendering attuale che vanno a sostituire:

   | Componente | Sostituisce |
   |---|---|
   | `FightCard` / `CombatantList` | `renderCombatantList` in `src/ui/UI.js` |
   | `InitiativeRail` | `renderInitiativeList` in `src/ui/GridUI.js` |
   | `PlayerDock` / `MasterDock` | `renderPlayerDock` / `renderMasterDock` in `src/ui/UI.js` |
   | `EventLog` | `renderLogs` in `src/ui/UI.js` |
   | `TopBar` | markup statico in `index.html` |

3. **Una pagina demo** (`demo.html`) che monta i componenti con dati finti realistici — 5 giocatori
   e 8 creature, HP plausibili, condizioni attive, un PG a 0 HP con death saves in corso, un log di
   30 voci. Apribile direttamente nel browser via import map, senza installare niente.

4. **Mockup HTML di layout** per le viste intere, dove il valore è nella composizione più che nei
   componenti:
   - `01-login.html`
   - `02-home.html` (libreria + sessioni + crea/unisciti)
   - `03-combat-1440.html` — **il deliverable più importante**: le 3 colonne, topbar, dock, griglia
     popolata con token, muri, pittura, un template d'area e i cursori di altri giocatori
   - `04-combat-1920.html` — come cambiano le proporzioni con più spazio (vedi §5.6)
   - `05-scheda.html`
   - `06-nave.html`
   - `07-modali.html` (condizioni, level-up, aggiungi creatura, pannello Aspetto, notifiche impilate)
   - `08-mobile.html` — a 390px, **priorità bassa**: deve essere dignitoso, non eccellente

5. **Un file `tokens.css`** con il set completo di custom properties, incluse le 4 varianti
   `[data-palette]`, le 3 `[data-ornament]` e le 2 `[data-typeface]`, più la convenzione di naming
   di §2.3 documentata in testa al file.

6. **Specifiche delle microinterazioni** in una tabella: elemento, trigger, durata, easing, proprietà
   animate, **e a quale regime di rendering appartiene** (componente Preact o render imperativo, §2.4).
   Solo `transform` e `opacity` dove possibile.

7. **Tutti gli stati**, non solo quello felice: hover, focus-visible, active, disabled, loading,
   vuoto, errore, offline, turno attivo, PG morente, PG morto.

8. **Un set di icone SVG inline** (stroke, ~20 glifi) per rimpiazzare le emoji.

## 7. Criteri di accettazione

- Apro `03-combat-1440.html` e capisco **di chi è il turno in meno di un secondo**.
- Con 6 giocatori e 8 creature in lista la colonna destra resta leggibile e scansionabile.
- A 1920px lo spazio in più va dove serve, non solo alla griglia.
- `demo.html` si apre nel browser e funziona senza alcuna installazione: niente `npm install`,
  niente compilazione, solo doppio click (o un server statico locale per i moduli ES).
- Le 4 palette e i 3 livelli di ornamento funzionano tutti, senza testo illeggibile in nessuna combinazione.
- Il contrasto del testo su fondo supera AA; la griglia resta leggibile con la stanza al buio.
- Nessun file immagine, nessun font nuovo oltre al massimo di uno.
- Il risultato sembra **lo strumento di una campagna**, non un'app aziendale a tema fantasy.

## 8. Cosa NON fare

- **Non proporre niente che richieda un build step**: Tailwind con compilazione, shadcn/ui,
  SFC Svelte o Vue, CSS Modules, Sass, PostCSS, TypeScript. Se non gira nel browser così com'è scritto,
  è fuori. (Preact e htm vanno bene proprio perché si caricano da CDN come moduli ES.)
- Non introdurre `backdrop-filter` o `filter: blur()` dentro la griglia SVG.
- Non eliminare funzionalità per "pulire" il design: devono esserci tutte, semmai raggruppate meglio.
- Non passare al tema chiaro, nemmeno come opzione secondaria.
- Non sacrificare il desktop per il mobile: le priorità sono in §1.
- Non usare lorem ipsum: contenuti finti plausibili e in italiano.
