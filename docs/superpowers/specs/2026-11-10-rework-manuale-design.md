# Rework UX/UI "Manuale" — design

Data: 2026-11-10 · Mockup di riferimento: `2026-11-10-rework-manuale-mockup.html` (stessa cartella; aprirlo nel browser)

Legenda: **[utente]** = deciso dall'utente in conversazione · **[scelta mia]** = default scelto da chi ha scritto il documento, non discusso; l'utente può ribaltarlo.

## Perché

Il sito funziona ma "si vede che è fatto da ingegneri e non da designer": tutto è visibile insieme e con lo stesso peso, la toolbar della mappa ha una ventina di icone emoji senza nome, e a colpo d'occhio sembra complicato. Si vuole un sito bello, accattivante e intuitivo, che richiami le pagine di pergamena di D&D. **[utente]**

Non è un cambio di colori: è un rework completo di UX/UI. Tutte le funzionalità restano, ma organizzate in gerarchie invece che esposte tutte insieme. **[utente]**

## Obiettivi

1. Nuova identità visiva "Manuale": il sito è una pagina del Manuale del Giocatore (carta, inchiostro, titoli rosso scuro, filetti oro). **[utente]**
2. Due varianti della stessa identità, chiara e notte, con un interruttore. **[utente]**
3. Gerarchia a tre livelli in ogni schermata: primo piano / a un tocco / nei menu (vedi sotto).
4. Icone vere al posto delle emoji. **[utente]**
5. Strumenti "Area incantesimo" e "Traiettoria" comprensibili sia mentre si usano sia nel risultato sulla mappa. **[utente]**
6. Funziona bene su PC e su telefono: il gruppo usa entrambi. **[utente]**

## Non-obiettivi

- Nessun cambio a modello dati, regole Firebase, logica di turni/HP/sync, tranne il nuovo nodo per la traiettoria.
- Nessuna voce di `TODO.txt` (resistenze, dadi, undo danni, ecc.).
- Nessun framework, bundler o dipendenza di build: restano HTML + CSS + moduli ES6 su GitHub Pages.
- Nessuna illustrazione su commissione (ritratti, copertine): gli avatar restano quelli caricati dagli utenti.

## Anti-obiettivi (se succede, il lavoro è fallito) **[utente]**

- Manca una funzionalità che oggi c'è.
- Viene introdotta una regressione.
- Restano emoji usate come icone dell'interfaccia.

## Vincoli

- **Parità funzionale**: l'inventario in fondo a questo documento è la checklist. Ogni voce deve essere raggiungibile nel sito nuovo; spostarla in un menu va bene, toglierla no.
- **Pattern di concorrenza di `CLAUDE.md`** vanno rispettati alla lettera, perché sono la causa storica delle regressioni di questo progetto: `captureFocusState`/`restoreFocusState` su ogni rebuild `innerHTML` con input; niente scritture nel listener di sessione; `onValue` sempre conservati e staccati; controlli statici non sovrascritti mentre l'utente li modifica; dati ad alta frequenza fuori da `sessions/{code}`; stato locale azzerato in `exitToHome`.
- Il JS si aggancia al DOM tramite `id`, `data-action`, `data-path`, `data-draw-tool`, `data-shape` e classi (`master-only`, `hidden`, …). Ristrutturando l'HTML questi agganci vanno conservati o aggiornati insieme al JS che li usa, mai lasciati orfani.
- Sulla macchina dell'utente non c'è Node: i test sono pagine HTML nel browser, come `test/shapes.html`.
- Il sito in uso (ramo `main`, GitHub Pages) deve restare funzionante finché il nuovo non è approvato: si lavora su un ramo separato. **[scelta mia]**

## Sistema visivo

Riferimento vincolante per l'aspetto: le sezioni "A · Manuale" e "Manuale, versione notte" del mockup. **[utente]** I valori esatti dei colori si prendono da lì (classi `.t-a` e `.t-a.night`).

- **Carta**: fondo pergamena con grana leggera (rumore SVG inline, nessuna immagine esterna). Niente riquadri arrotondati con ombra: le sezioni si separano con filetti (doppio filetto per testata e dock, filetto oro sotto i titoli di sezione), come in un libro.
- **Inchiostro**: testo bruno scuro; titoli e azione principale in rosso scuro; oro solo per filetti, selezione e turno attivo.
- **Colori di significato**, distinti dall'accento: verde = giocatori, rosso = nemici, azzurro = alleati, grigio = morto; danno/cura mantengono i flash rosso/verde attuali, ritoccati per la carta.
- **Caratteri**: Alegreya SC per i titoli, Alegreya per il testo, da Google Fonts, con fallback Georgia/serif. **[scelta mia]** Numeri tabellari dove si incolonnano (HP, iniziativa).
- **Tema**: chiaro e notte sono gli unici due temi e sostituiscono il viola attuale e `theme-old`. **[utente, confermato sul mockup]** Alla prima visita segue l'impostazione di sistema, poi ricorda la scelta in `localStorage`. **[scelta mia]** Tutti i colori passano da variabili CSS in `styles/base.css`; nessun colore letterale nei componenti, compresi gli stili inline oggi presenti in `index.html` e `UI.js`.
- **Mappa**: la griglia è un foglio di pergamena leggermente più scuro con linee a inchiostro; muri bruno scuro; segnalini rotondi con bordo-barra HP come oggi.
- **Un solo bottone primario per schermata** (pieno, rosso scuro). Gli altri sono a contorno o solo testo.

## Icone

- Icone a tema da **game-icons.net** (licenza CC BY 3.0): riga di crediti con autori nel footer della home e nel README. **[utente ha approvato la fonte]**
- Icone di servizio (annulla, ripeti, cestino, zoom, menu, chiudi, copia) come semplici SVG a tratto nello stesso peso visivo. **[scelta mia]**
- Montaggio: un unico modulo (es. `src/ui/icons.js`) che esporta gli SVG come stringhe con `fill="currentColor"`, così seguono il tema; nessuna richiesta di rete. **[scelta mia]**
- Ogni bottone solo-icona ha `title` e `aria-label`. Dove c'è spazio, icona + nome scritto.
- A lavoro finito, una ricerca di emoji nei file di interfaccia (`index.html`, `src/ui`, `src/views`, `app.js`, `src/logic/grid.js`, `styles`) non deve trovare icone. Restano ammessi solo i caratteri tipografici usati come testo (es. `·`, `→`) e la favicon.

## Gerarchia

Cosa si fa più spesso, detto dall'utente: segnare l'iniziativa; nel proprio turno colpire, curare, muoversi, lanciare incantesimi; il master fa lo stesso con le sue creature e a volte sposta i segnalini dei giocatori; disegnare sulla mappa e tracciare traiettorie e aree. **[utente]**

### Schermata di combattimento

| Livello | Cosa |
|---|---|
| Primo piano | Lista iniziativa snella (ordine, iniziale/avatar, nome, barra HP secondo le regole di visibilità attuali, turno attivo evidenziato, iniziativa modificabile al volo) · mappa con il movimento come azione predefinita · dock in basso col proprio personaggio: vita, CA, danno/cura, incantesimi, **Fine turno** come unico primario |
| A un tocco | Strumenti mappa con nome scritto: Muovi · Area incantesimo · Traiettoria · Disegna. Le opzioni di uno strumento compaiono solo quando è attivo · dettaglio di un combattente toccandolo nella lista (HP max, HP temporanei, CA, condizioni, ispirazione, fazione, taglia, mostra HP/CA, scheda o stat block, rimuovi, tiri salvezza contro la morte) · scheda completa |
| Nei menu | Riposo breve/lungo · nave · scena · cronache · log eventi · aggiungi creatura/famiglio · assegna XP e modalità progressione · muri e dimensioni griglia · svuota griglia · reset incontro · tema · copia codice · esci |

- **Master**: stessa schermata. Il dock mostra la creatura selezionata (come il dock master attuale) e usa gli stessi comandi dei giocatori; può spostare qualunque segnalino. Le voci solo-master compaiono negli stessi menu. **[utente]**
- **Incantesimi dal dock**: accesso a slot e incantesimi preparati senza aprire la scheda completa. **[scelta mia — l'utente ha visto l'ipotesi nel riepilogo e non l'ha contestata]** Riusa i dati e le scritture della scheda (`setSpellSlotsUsed`), nessuna logica nuova.
- **Telefono**: la mappa occupa lo schermo, il dock resta fisso in basso, iniziativa e menu sono pannelli richiamabili. Il dettaglio del layout è lasciato al builder e va approvato dall'utente su mockup.

### Strumenti mappa

- **Muovi** (predefinito): come oggi, con raggio di movimento, ghost e hint.
- **Area incantesimo**: stesse forme e stessa geometria di oggi (cerchio, cono, linea; `sessions/{code}/template`). Cambia la guida: una striscia a passi ("1. Scegli la forma · 2. Tocca da dove parte · 3. Orienta e conferma") con Annulla/Conferma. Cambia la resa: forma tratteggiata con bordo marcato, punto d'origine, etichetta "forma · misura · autore", bersagli colpiti cerchiati sulla mappa ed elencati sotto. **[utente, sul mockup]**
- **Traiettoria** (funzionalità nuova, l'unica): si tocca chi attacca e poi il bersaglio o una cella; compare una freccia tratteggiata con la distanza in metri (stessa metrica 5-10-5 della griglia), visibile a tutti. **[utente, sul mockup]**
  - Dati **[scelta mia]**: `sessions/{code}/trajectories/{uid}` = `{ fromId, toId | toCol,toRow, ownerUid }`, una per giocatore. Scritture rare, dato di gioco: può stare sotto `sessions/`.
  - Durata **[scelta mia, mostrata nel mockup]**: sparisce al cambio turno. La cancellazione va fatta dall'azione utente che avanza il turno, mai dal listener. Chi l'ha tracciata o il master possono toglierla prima. Va anche pulita da "Reset incontro" e quando uno dei due combattenti viene rimosso.
- **Disegna**: tutte le funzioni attuali (pennello, gomma, secchiello, rettangolo/quadrato/cerchio, pieno/contorno, dimensione, forma, palette, colore libero, undo/redo, pulisci tutto) ma raggruppate: prima lo strumento, poi solo le opzioni che gli si applicano. Serve a colorare il terreno, non più a indicare colpi. Nessun cambio alla logica in `GridUI.js`/`grid.js`.
- **Muri e griglia** (master): dal menu, con la stessa modalità di modifica attuale.
- Le esclusioni reciproche attuali (`gridEditMode`, `drawMode`, piazzamento template) restano e si estendono alla traiettoria.

### Altre viste

Stessa identità e stessa regola dei tre livelli. Il layout di dettaglio è lasciato al builder, da approvare su mockup tappa per tappa.

- **Scheda personaggio**: è già strutturata a sezioni (`details.tome`); si riveste come pagina di manuale mantenendo `data-path` e struttura.
- **Home**: due azioni chiare (crea sessione / entra), poi sessioni recenti e libreria.
- **Nave, cronache, log, finestre modali, notifiche**: rivestite con gli stessi componenti.

## Tappe **[scelta mia, ordine mostrato all'utente e non contestato]**

Ogni tappa: mockup della schermata → approvazione dell'utente → implementazione → controllo di parità e di regressione su quella schermata.

1. Fondamenta: variabili, carta, caratteri, tema chiaro/notte con interruttore, bottoni, campi, finestre modali, modulo icone.
2. Combattimento: testata e menu, lista iniziativa, dock, dettaglio combattente, mappa e strumenti (area guidata, traiettoria, disegno raggruppato), versione telefono.
3. Scheda personaggio e level-up.
4. Home e libreria.
5. Nave, cronache, log, scena, notifiche, finestre rimaste; pulizia finale di emoji, colori letterali e CSS morto; aggiornamento di `CLAUDE.md`.

## Verifica

- **Parità**: la checklist in fondo, spuntata a mano a fine di ogni tappa per le voci di quella schermata e per intero alla fine.
- **Regressioni**: prova con due browser (master + giocatore) sulle situazioni che in passato si sono rotte: uno scrive in un campo mentre l'altro muove un segnalino o infligge danni; Fine turno ripetuto; uscita e rientro in sessione; reset incontro; color picker aperto durante aggiornamenti altrui.
- **Test in pagina**: `test/shapes.html` deve restare verde; la geometria della traiettoria (distanza) va coperta allo stesso modo.
- **Temi**: ogni schermata guardata in chiaro e in notte, a larghezza PC e telefono.

## Lasciato al builder

- Layout di dettaglio di ogni schermata (entro i tre livelli e il mockup), compresa la versione telefono.
- Scelta delle singole icone e nomi delle classi CSS.
- Come suddividere o riorganizzare i file in `styles/`.
- Forma dei menu (a comparsa, pannello laterale, foglio dal basso su telefono).

## Inventario funzionalità (checklist di parità)

**Accesso e home** — login Google · ospite anonimo · promozione ospite→Google · esci dall'account · crea sessione con scelta modalità progressione · entra con codice, nome e iniziativa · scelta personaggio dalla libreria all'ingresso · "Entra" diretto da un personaggio della libreria · sessioni recenti con rientro · rientro automatico al reload · libreria: nuovo personaggio, nuova creatura, apri scheda, elimina, avatar.

**Testata combattimento** — codice sessione e copia · round · turno successivo (master) · scena: carica, cambia, elimina, espandi, nascondi, trascina · pannello nave · riposo breve · riposo lungo · tema · reset incontro (master) · modalità progressione in sessione · assegna XP · concedi level-up · esci.

**Combattenti** — lista ordinata per iniziativa con turno attivo · modifica iniziativa · danno/cura con quantità, su se stessi e su uno o più bersagli · HP max, HP temporanei e CA modificabili · regole di visibilità HP (master/giocatori/hint) · mostra/nascondi HP e CA delle creature · condizioni (finestra con descrizioni) · ispirazione · fazione · azione dichiarata · tiri salvezza contro la morte e ritorno a 1 HP · Fine turno · apri scheda · stat block mostro · rimuovi · aggiungi creatura (ricerca mostri open5e, nome, HP, iniziativa, CA, taglia, dalla libreria) · aggiungi famiglio · cornice XP e segnale di level-up pronto · flash danno/cura · avatar.

**Dock** — proprio personaggio (o creatura selezionata dal master): vita, XP, attacca, cura, condizioni, scheda, Fine turno, finestra scelta bersagli.

**Mappa** — zoom +/−/reset e pan · barra segnalini: piazza, seleziona, rimuovi (master: tutti; giocatori: i propri) · movimento con raggio, ghost, validazione · taglie multi-cella e cambio taglia (master) · segnalini morti · muri e dimensioni griglia (master) · svuota griglia (master) · area cerchio/cono/linea con misura live, celle e coinvolti, rimozione · disegno: pennello, gomma, 8 colori, colore libero, secchiello, rettangolo, quadrato, cerchio, pieno/contorno, dimensione 1–4, forma quadrata/rotonda, anteprima sotto il cursore, undo/redo, pulisci tutto · cursori live degli altri giocatori · hint contestuale.

**Scheda personaggio** — testata con nome, sottotitolo, barra XP · classe e livello · caratteristiche, tiri salvezza, abilità con competenza/expertise · CA, HP max, velocità, taglia, HP temporanei, dadi vita · attacchi · trucchetti · incantesimi per livello con preparati · slot incantesimo (usati e massimo) · caratteristica da incantatore e modificatore extra · inventario (aggiungi, modifica, quantità, rimuovi) · privilegi di classe e statistiche personalizzate · tiri salvezza contro la morte · avatar · level-up (pannello e conferma) · ritorno a combattimento o home.

**Nave** — integrità scafo · armi con stato ed equipaggio · segnalini equipaggio tra le stanze dei ponti.

**Cronache e log** — note di sessione: aggiungi, titolo, testo, espandi, elimina, archivio, blocco di modifica con colore del giocatore · log eventi condiviso e svuota · notifiche personali e riepiloghi a tutti, impilati.
