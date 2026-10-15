Lanterna è il rework grafico del combat tracker D&D 5e: scuro, caldo, moderno, pensato per laptop da 1280 a 1920 px in una stanza al buio, con il telefono come caso secondario. Le funzionalità restano tutte; cambia il vestito. Idea guida: **l'oro è luce**. Solo ciò che è attivo adesso — il turno, il token, la carta, il pulsante utile — emette luce calda; tutto il resto resta cenere.

Il kit è in `kit/` e gira senza build: Preact + htm come moduli ES da CDN (versioni pinnate), CSS classico, nessuna immagine, un solo font nuovo (Sora). Apri `kit/demo.html` con un server statico, oppure i mockup `kit/mockups/*.html` con un doppio click.

## Cosa trovi

| File | Cosa è |
|---|---|
| `kit/tokens.css` | Tutte le custom property, le 4 palette, i 3 livelli d'ornamento, i 2 caratteri, e la **convenzione di naming** documentata in testa |
| `kit/primitives.css`, `components.css`, `views.css` | Primitive `ds-`, un blocco per componente, composizione delle viste |
| `kit/components/*.js` | Componenti Preact + htm, uno per file: `TopBar`, `TurnBanner`, `InitiativeRail`, `CombatantList`, `FightCard`, `EventLog`, `PlayerDock`, `MasterDock`, `Toasts` + primitive `ds.js` |
| `kit/icons.js` | 39 icone SVG inline (stroke) al posto delle emoji |
| `kit/aspetto.js` | Applica e persiste `data-palette`, `data-ornament`, `data-typeface` su `<html>` |
| `kit/demo.html` | Demo interattiva: 5 giocatori, 8 creature, 30 voci di log, turni e danni funzionanti |
| `kit/mockups/01…09` | Login · Home · **Combattimento 1440** · **Combattimento 1920** · Scheda · Nave · Modali · Mobile 390 · Stati |

## Gerarchia: tre livelli

1. **Adesso** (luce): chi è di turno e cosa puoi fare. Usa `gold`, `gold-bright`, `glow-turn`, il pulsante primario, il banner del turno. Un solo elemento «acceso» per zona.
2. **Posso fare** (contenuto): carte, HP, azioni disponibili. Usa `bone` su `bg2`/`bg1`, bordi `line-strong`.
3. **Contorno** (cenere): tutto il resto. Usa `mut`, `faint`, filetti `line`.

Se due cose emettono luce nella stessa zona, una è sbagliata.

## Colore

- Superfici: `bg0` pagina e campi, `bg1` pannelli, `bg2` carte e dock, `bg3` stati rialzati. Mai bianco puro: il testo è `bone`.
- Testo: `bone` primario, `mut` secondario, `faint` solo per orari e segnaposto. Su `bg0–bg3` reggono 4.5:1 in tutte e 4 le palette.
- `accent` varia con la palette (verderame, ambra, viola, rosa): condizioni, template d'area, link. Il pulsante primario non usa mai `accent`: è sempre oro.
- Danno `blood`, cura `heal`, HP bassi `ember`. Non affidarti mai al solo colore: danno ha sempre «−9» o la spada, cura «+8» o il cuore, morente ha sempre «Morente» e il teschio.
- Tipo di combattente: giocatore `kind-pc` anello pieno, alleato `kind-ally` anello tratteggiato, nemico `kind-enemy` anello pieno e nome in tinta, abbattuto `kind-dead` con teschio.
- Le 4 palette cambiano superfici, accento e semantici; oro e `kind-*` restano costanti, quindi la lettura del tavolo non cambia.

## Tipografia

- Nomi di personaggi e creature: Cormorant 700 (`name-md/lg/xl`). È la voce «fantasy» e sta solo sui nomi, i titoli di modale e gli stati vuoti.
- Numeri, etichette, pulsanti, banner del turno: **Sora** (`num-*`, `button`, `label`, `banner`). Numeri sempre tabulari e grandi: gli HP si leggono da un metro.
- Testo corrente: Alegreya Sans. Testo lungo di scheda e Cronache: EB Garamond (`tome`). Cinzel resta solo per titoli di scena. Con `data-typeface="grenze"` i nomi passano a Grenze Gotisch.
- Etichette di sezione: `label`, 10.5 px, MAIUSCOLO, spaziatura 0.1em. Pulsanti in maiuscole/minuscole di frase.

## Forma, spazio, luce

- Raggi morbidi: `r` 10 px (controlli), `r-md` 14 px (carte, dock, cornice mappa), `r-lg` 20 px (pannelli), `r-pill` per chip, barre e banner.
- Spaziatura a scala `s-1…s-12`; padding di carta `s-3`, di pannello `s-4`/`s-5`.
- Ombre: `sh-panel` ai pannelli, `sh-pop` a menu e modali, `glow-turn` solo al turno attivo. Mai ombre per singola cella o token della mappa.
- Bordi: i controlli usano `line-strong` (3:1); i filetti decorativi `line`.
- Focus: anello solido 2 px `gold-bright`, offset 2 px (≥3:1 su ogni superficie).
- Ornamento (`data-ornament`): **Essenziale** = piatto, senza glow né grana; **Standard** = pulito, glow sul turno; **Ricco** = cornici d'angolo, grana, rombi sui titoli. La grana è un'unica texture a schermo intero (`ds-fog`), mai sulla mappa.

## Layout

- Shell `ly`: 3 colonne a `100dvh`, scrollano solo i pannelli. A 1440 px: iniziativa ≈245 | mappa `1fr` | carte ≈418. Dock flottante da 96 px, topbar da 64 px.
- A ≥1680 px (`ly--wide`): iniziativa 304 | mappa | **carte 500** | **log + Cronache 420** sempre visibili. Lo spazio in più va dove si agisce, non solo alla griglia.
- Sotto 760 px: una vista alla volta con tabbar a 5 voci (Battaglia · Ordine · Carte · Diario · Cronache); il dock resta visibile con ritratto, HP e **Fine turno**. Il telefono non cambia nessuna scelta desktop.

## Movimento

Entrate e transizioni solo nei componenti Preact (DOM persistente). Nei render imperativi: cambi di stato istantanei e flash brevi (<2.5 s) via classe. Usa `transform` e `opacity`. La tabella completa con il regime di ogni animazione è in «Microinterazioni».

## Voce dell'interfaccia

Italiano, diretto, al presente. «Tocca a te», «Fine turno», «Il campo è vuoto». Frasi brevi, verbi d'azione sui pulsanti («Aggiungi creatura», «Sali di livello»), mai punti esclamativi, mai emoji. Il registro è quello di un master che parla al tavolo, non di un'app aziendale.

## Convenzione di naming

BEM con prefisso per area: `.prefisso-blocco__elemento--variante`, stati `is-*`/`has-*` sempre combinati con il blocco. Prefissi: `ds-` primitive, `ly-` layout, `tb-` topbar e banner, `ir-` iniziativa, `cl-` lista carte, `fc-` carta, `dk-` dock, `lg-` log, `cr-` cronache, `gr-` griglia SVG, `nt-` notifiche, `md-` modali, `hm-` home, `lo-` login, `sh-` scheda, `sp-` nave, `ap-` aspetto. Una regola CSS deve essere un token, una primitiva `ds-` o una classe col prefisso del proprio componente: niente selettori di tag annidati, id, `!important` (unica eccezione il reset `prefers-reduced-motion`). Questo elimina la necessità del blocco «Reset conflitti».
