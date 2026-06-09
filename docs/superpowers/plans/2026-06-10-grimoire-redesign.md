# Grimoire Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full visual redesign of the D&D Combat Tracker with the "Grimorio miniato" identity (Phase 1: design-system reskin, Phase 2: tactical dashboard for the combat view), per spec `docs/superpowers/specs/2026-06-10-grimoire-redesign-design.md`.

**Architecture:** Vanilla HTML/CSS/ES6 modules, no bundler. Phase 1 redefines the existing CSS custom properties in `:root` with the Grimoire palette (instantly recoloring ~80% of the 3700-line stylesheet that already consumes them), then restyles components section by section keeping all selector names. Phase 2 restructures `#view-combat` into a CSS-grid dashboard, evolving the existing `renderInitiativeList` + `state.selectedGridTokenId` into the turn rail + detail-panel selection.

**Tech Stack:** HTML, CSS custom properties, ES6 modules, Firebase Realtime DB (untouched), Google Fonts (Cinzel, UnifrakturMaguntia, EB Garamond, IM Fell English).

**Branch:** `redesign/grimoire` (already created, spec committed).

**No test framework exists.** Verification is manual: serve with `python3 -m http.server 8000` from the repo root, open `http://localhost:8000`. For combat-view checks create a session as master in one browser profile and join as player in a second (or use the saved session rejoin). Firebase config is in local `config.js`.

**Key constraint:** Never rename a JS-referenced id/class unless the task explicitly says so. All `data-path`, `data-action` attributes and Firebase logic stay untouched.

---

## Phase 1 — Design system + reskin (structure unchanged)

### Task 1: Fonts, theme-toggle removal, title cleanup

**Files:**
- Modify: `index.html:7-16` (favicon stays, fonts link, inline theme script)
- Modify: `index.html:50` and `index.html:152` (theme buttons)
- Modify: `index.html:25` (h1 text)
- Modify: `app.js:22-35` (theme management block)

- [ ] **Step 1: Replace the Google Fonts link** in `index.html` (line 9). Old link loads Cinzel + EB Garamond. New link:

```html
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=UnifrakturMaguntia&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=IM+Fell+English:ital@0;1&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Delete the inline theme script** (`index.html` lines 11–16, the `<script>` block reading `localStorage.getItem('theme')`).

- [ ] **Step 3: Delete both theme buttons**: `#btn-theme-toggle-home` (line 50) and `#btn-theme-toggle-combat` (line 152), including their whole `<button>…</button>` elements.

- [ ] **Step 4: Change the h1** from `<h1>⚔ Combat Tracker ⚔</h1>` to `<h1>Combat Tracker</h1>` (the blackletter font carries the weight; swords clutter it).

- [ ] **Step 5: Delete the theme block in `app.js`** (lines 22–35: `initTheme`, `toggleTheme`, the two `addEventListener` lines, and the `initTheme()` call, plus the `// --- Theme Management ---` comment).

- [ ] **Step 6: Verify.** `python3 -m http.server 8000`, open `http://localhost:8000`. Page loads, no console errors (especially no `Cannot read properties of null` from the removed buttons). Fonts tab in DevTools network shows the four families loading.

- [ ] **Step 7: Commit**

```bash
git add index.html app.js
git commit -m "feat(redesign): load Grimoire fonts, remove dual-theme toggle"
```

### Task 2: Token remap + base styles (variables, reset, typography, buttons, inputs)

**Files:**
- Modify: `style.css:1-263` (sections: Variabili e reset, Layout helper, Tipografia, Bottoni, Input, Errori)

- [ ] **Step 1: Replace `:root` (lines 4–38) and DELETE the whole `.theme-old` block (lines 40–73)** with:

```css
:root {
  /* ── Grimorio: palette ── */
  --bg-deep:       #14100a;   /* cuoio */
  --bg-page:       #1f1812;   /* pagina */
  --bg-card:       #171108;   /* pannello pieno */
  --bg-card-alt:   #221a0e;
  --bg-panel:      rgba(0, 0, 0, 0.28);
  --border-warm:   #5e4a20;
  --border-dim:    #4a3a1c;
  --gold:          #d4af5e;
  --gold-light:    #e3c87e;
  --gold-dim:      #8a6d32;
  --gold-glow:     rgba(212, 175, 94, 0.32);
  --text:          #dcc9a4;
  --text-muted:    #9c8a66;
  --wax:           #a83232;
  --wax-dark:      #7a1d1d;
  --red:           var(--wax-dark);
  --red-bright:    #c24040;
  --green:         #5e8f54;
  --arcane:        #6e4a8a;
  --radius:        8px;
  --radius-sm:     5px;
  --shadow:        0 4px 18px rgba(0,0,0,0.6);

  /* ── Componenti ── */
  --btn-primary-bg: linear-gradient(170deg, #3a2a10 0%, #241806 100%);
  --btn-primary-color: var(--gold-light);
  --btn-primary-border: var(--gold-dim);
  --btn-primary-radius: 6px;
  --btn-primary-shadow: 0 2px 10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06);
  --btn-primary-hover-shadow: 0 4px 18px var(--gold-glow), inset 0 1px 0 rgba(255,255,255,0.1);

  --active-turn-bg: #1a1306;
  --input-bg: #0e0a06;
  --hp-low: #c98a3a;
  --hp-bar-bg: #0a0703;
  --hp-bar-border: #3a2d12;
  --bg-hover:    #2a2010;
  --danger:      var(--red-bright);
  --purple-main: var(--arcane);

  /* ── Font ── */
  --font-display: 'UnifrakturMaguntia', serif;   /* SOLO titoli app/vista */
  --font-heading: 'Cinzel', serif;               /* sezioni, nomi, bottoni */
  --font-body:    'EB Garamond', Georgia, serif; /* testo e dati */
  --font-fell:    'IM Fell English', serif;      /* note, placeholder, log */
}
```

  Everything else in the file that consumes the old variable names recolors automatically. `--purple-main` and `--hp-low` are kept as aliases so old rules keep working.

- [ ] **Step 2: Update `body` (lines 79–88):** change `font-family` to `var(--font-body)`, `background` to `radial-gradient(ellipse at 50% 0%, var(--bg-page) 0%, var(--bg-deep) 60%) fixed`. Keep the rest.

- [ ] **Step 3: Rewrite the typography section (lines 111–137):**

```css
h1 {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 2.6rem;
  color: var(--gold);
  text-align: center;
  letter-spacing: 0.01em;
  text-shadow: 0 0 24px var(--gold-glow), 0 2px 6px rgba(0,0,0,0.9);
  line-height: 1.15;
}

h2 {
  font-family: var(--font-heading);
  font-size: 1.05rem;
  color: var(--gold-light);
  margin-bottom: 0.5rem;
  letter-spacing: 0.04em;
}

h3 {
  font-family: var(--font-heading);
  font-size: 1rem;
  color: var(--gold-light);
  text-align: center;
  margin-bottom: 0.25rem;
}

p { line-height: 1.5; }

.subtitle {
  font-family: var(--font-fell);
  font-style: italic;
  color: var(--text-muted);
}
```

  (`.subtitle` already exists later in the file under HOME VIEW — when you get there in Task 3, remove the duplicate font declarations and keep layout-only rules.)

- [ ] **Step 4: Buttons.** In the Bottoni section (lines 142–200): set `.btn-primary` `font-family: var(--font-heading); letter-spacing: .06em; text-transform: uppercase; font-size: .9rem;` (background/border/shadow already flow from the remapped tokens). Style `.btn-secondary` as ghost: `background: transparent; border: 1px solid var(--border-dim); color: var(--text); border-radius: 6px;` hover `border-color: var(--gold-dim); color: var(--gold-light);`. Style `.btn-danger` as ceralacca: `background: linear-gradient(170deg,#3a1010,#240808); border:1px solid #7a2828; color:#e8b0b0; font-family: var(--font-heading);`.

- [ ] **Step 5: Inputs.** In the Input section (lines 204–231): background `var(--input-bg)`, border `1px solid var(--border-dim)`, radius `5px`, color `var(--text)`, and add:

```css
input::placeholder, textarea::placeholder {
  font-family: var(--font-fell);
  font-style: italic;
  color: #6e5f48;
}
input:focus, textarea:focus, select:focus {
  outline: none;
  border-color: var(--gold-dim);
  box-shadow: 0 0 0 2px var(--gold-glow);
}
```

- [ ] **Step 6: Error banner (lines 235–244):** ceralacca strip — `background: linear-gradient(170deg,#3a1010,#2a0a0a); border:1px solid #7a2828; border-left:3px solid var(--wax); color:#e8b0b0; font-family: var(--font-body);`.

- [ ] **Step 7: Verify in browser.** Whole site (home, combat via a test session, sheet) is already warm-black + gold everywhere; no purple remains. Buttons/inputs/errors match the approved mockups. Check there are no `var(--…)` typos: in DevTools console run `getComputedStyle(document.body).backgroundColor` and spot-check a `.btn-primary`.

- [ ] **Step 8: Commit**

```bash
git add style.css
git commit -m "feat(redesign): Grimoire design tokens, typography, buttons, inputs"
```

### Task 3: View frame + Home view

**Files:**
- Modify: `style.css` sections Layout helper (93–106), AUTH PANEL (248–364), HOME VIEW (368–505), LIBRERIA PERSONAGGI (2238–2296), CHARACTER PICKER (2300–2353)

- [ ] **Step 1: Double gold frame on views.** Extend `.view`:

```css
.view {
  position: relative;
  /* keep existing width/max-width/padding/flex rules; raise padding to 1.4rem */
}
.view::before, .view::after {
  content: '';
  position: absolute;
  pointer-events: none;
  z-index: 0;
}
.view::before { inset: 8px;  border: 1px solid var(--gold-dim);              border-radius: 6px; }
.view::after  { inset: 13px; border: 1px solid rgba(110, 85, 38, 0.32);      border-radius: 4px; }
.view > * { position: relative; z-index: 1; }

@media (max-width: 640px) {
  .view::after { display: none; }
  .view::before { inset: 5px; }
}
```

- [ ] **Step 2: Home cards as panels with fleurons.** Restyle `.home-card`:

```css
.home-card {
  background: var(--bg-panel);
  border: 1px solid var(--border-dim);
  border-radius: var(--radius);
  padding: 1.1rem 1rem;
  position: relative;
  box-shadow: inset 0 0 24px rgba(0,0,0,0.35);
}
.home-card::before, .home-card::after {
  content: '❧';
  position: absolute;
  top: 4px;
  font-size: 0.7rem;
  color: var(--gold-dim);
  opacity: 0.8;
}
.home-card::before { left: 8px; }
.home-card::after  { right: 8px; transform: scaleX(-1); }
.home-card h2::before { content: '⚜ '; font-size: 0.8em; }
```

- [ ] **Step 3: Divider.** Restyle `.divider` ("oppure") as a thin gradient filet with the word in `var(--font-fell)` italic (pattern from the approved mockup):

```css
.divider {
  display: flex; align-items: center; gap: 10px;
  color: #6e5f48; font-family: var(--font-fell); font-style: italic;
}
.divider::before, .divider::after {
  content: ''; flex: 1; height: 1px;
  background: linear-gradient(90deg, transparent, var(--border-dim), transparent);
}
```

- [ ] **Step 4: Auth panel, user bar, sessions, library, picker.** Apply the `.home-card` panel pattern (background `var(--bg-panel)`, border `var(--border-dim)`, inner shadow) to: `.auth-panel`, `.user-info-bar`, `.user-sessions-list` rows, `.char-library-list` rows, `.char-picker`. Keep `.btn-google` white/recognizable but put it on the panel; `.btn-guest` stays ghost. Character preview name in `.character-preview`: add drop-cap via `::first-letter` on the name element if it is a block (check the actual markup rendered by `home.js` in DevTools; if the name is a `<span>`, wrap-free `::first-letter` does not apply — in that case skip the drop cap here, it lives in the log instead).

- [ ] **Step 5: Verify.** Home matches approved mockup: blackletter title with glow, fell-italic subtitle, panels with ❧, gold ⚜ headers, divider filet. Mobile 360px: single thin frame, no horizontal scroll.

- [ ] **Step 6: Commit**

```bash
git add style.css
git commit -m "feat(redesign): view frame and home view in Grimoire style"
```

### Task 4: Combat view — header, controls, combatant cards

**Files:**
- Modify: `style.css` sections COMBAT VIEW header (509–558), pannello master (562–573), LAYOUT 3 COLONNE (577–674), COMBATANT LIST (678–1172), MASTER CONTROLS (1176–1182), COMBAT HEADER aggiornamenti (1319–1341)
- Modify: `src/UI.js:478-485` (condition badge template)

- [ ] **Step 1: Chapter header.** `.combat-header`: bottom border filet (`border-bottom: 1px solid var(--border-dim)`), `.session-code` as a stamp: `font-family: var(--font-heading); color: var(--gold); border: 1px solid var(--gold-dim); padding: .15rem .6rem; border-radius: 4px; background: rgba(212,175,94,.07); letter-spacing: .1em;`. `.round-display` in Cinzel gold-light.

- [ ] **Step 2: Column titles.** `.col-title`: Cinzel with side filets:

```css
.col-title {
  display: flex; align-items: center; gap: 12px;
  font-family: var(--font-heading); color: var(--gold-light);
}
.col-title::before, .col-title::after {
  content: ''; flex: 1; height: 1px;
  background: linear-gradient(90deg, transparent, var(--border-dim), transparent);
}
```

- [ ] **Step 3: Combatant card.** Restyle `.combatant-card`:

```css
.combatant-card {
  background: linear-gradient(170deg, var(--bg-card), #0e0a05);
  border: 1px solid var(--border-warm);
  border-radius: var(--radius);
  box-shadow: inset 0 0 24px rgba(0,0,0,0.5), 0 4px 14px rgba(0,0,0,0.45);
}
.combatant-card.active-turn {
  border-color: var(--gold);
  box-shadow: 0 0 18px var(--gold-glow), inset 0 0 24px rgba(0,0,0,0.5);
  background: linear-gradient(170deg, var(--active-turn-bg), #0e0a05);
}
.combatant-card.knocked-out { filter: saturate(0.25) brightness(0.75); }
.combatant-name { font-family: var(--font-heading); color: var(--gold-light); }
```

  Then walk the COMBATANT LIST section top to bottom keeping every selector and restyling with tokens: `.turn-number` (small Cinzel medallion: round, border `var(--gold-dim)`), `.type-badge` (parchment pill), `.ac-badge`, `.initiative-value`, `.hp-bar-container` (bg `var(--hp-bar-bg)`, border `var(--hp-bar-border)`, radius 99px), `.hp-bar` keeps inline width/color from JS, `.temp-hp-bar`, `.xp-bar-track/.xp-bar-fill` (gold), `.action-panel` (inner panel `var(--bg-panel)`), `.target-chip` (ghost pill, `.selected` gold border + gold-glow), `.btn-apply-damage` (ceralacca like `.btn-danger`), `.btn-apply-heal` (green-tinted ghost: border `#3e5e38`, color `#9cc794`), `.btn-end-turn` (gold primary look), `.death-saves-inline` + `.ds-pip` (gold ○/●; failures row pips in `var(--wax)`), `.faction-btn`, `.btn-conditions`, `.btn-sheet`, `.btn-stat-block`, `.health-hint` levels (full→good greens, hurt gold, bad/critical wax).

- [ ] **Step 4: Condition badges → parchment pills.** In `src/UI.js` change the badge template (lines 480–483):

```js
${conditions.map(cond => {
  const meta = CONDITIONS.find(x => x.name === cond);
  return `<span class="condition-badge" style="--cond-color:${meta?.color ?? 'var(--gold-dim)'}">${cond}</span>`;
}).join('')}
```

  And in `style.css` restyle `.condition-badge`:

```css
.condition-badge {
  background: color-mix(in srgb, var(--cond-color) 14%, transparent);
  border: 1px solid var(--cond-color);
  color: var(--text);
  border-radius: 99px;
  font-family: var(--font-body);
}
```

  In the `CONDITIONS` array (`src/UI.js:4-20`) replace the two `'var(--gold)'` entries: `Avvelenato` → `'var(--arcane)'`, `Paralizzato`/`Pietrificato` → `'#8a8a93'` (stone). Leave the hex colors as they are.

- [ ] **Step 5: Master panels.** `.master-panel`, `.master-controls`: panel pattern (`var(--bg-panel)`, border-dim). `#btn-next-turn` keeps `.btn-primary`; `#btn-reset` is already `.btn-danger` (ceralacca from Task 2).

- [ ] **Step 6: Verify with a live session** (master + player). Active turn glows gold; KO card grey + 💀; damage/heal buttons distinct (wax vs green); conditions are bordered pills; death-save pips work and look right; XP bar gold; nothing overflows at 360px.

- [ ] **Step 7: Commit**

```bash
git add style.css src/UI.js
git commit -m "feat(redesign): combat header and combatant cards in Grimoire style"
```

### Task 5: Modals, notifications, toasts

**Files:**
- Modify: `style.css` sections MODAL condizioni (1186–1252), NOTIFICHE POPUP (1256–1304), MODAL Stat Block (2740–2845), MODAL UPLOAD SCENA (2894–2952), Level-up modal styles (search `.levelup-modal-content`)
- Modify: `src/UI.js:35-66` (`showNotification`)

- [ ] **Step 1: Parchment modal.** `.modal` overlay: `background: rgba(8,5,2,0.75); backdrop-filter: blur(2px);`. `.modal-content`: page gradient `linear-gradient(175deg, var(--bg-page), var(--bg-deep))`, border `1px solid var(--border-warm)`, plus the double-frame pseudo-elements (same pattern as `.view::before/::after` with `inset: 5px/9px`). `h3` inside in Cinzel gold. `.condition-option`: parchment pill using its existing `--cond-color` custom property for the border (active = filled `color-mix` background).

- [ ] **Step 2: `showNotification` → CSS classes.** Replace the inline `cssText` block in `src/UI.js` (lines 41–57) with class-based styling, keeping position/animation logic:

```js
export function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.classList.add('notification-out');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}
```

  And in `style.css` (NOTIFICHE POPUP section, keeping the existing `slideIn`/`slideOut` keyframes):

```css
.notification {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  max-width: 300px;
  word-wrap: break-word;
  padding: 12px 16px 12px 14px;
  border-radius: 6px;
  background: linear-gradient(175deg, var(--bg-page), var(--bg-deep));
  border: 1px solid var(--border-warm);
  border-left: 4px solid var(--gold-dim);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 15px;
  box-shadow: var(--shadow);
  animation: slideIn 0.3s ease-out;
}
.notification-damage { border-left-color: var(--wax);   }
.notification-heal   { border-left-color: var(--green); }
.notification-out    { animation: slideOut 0.3s ease-in; }
```

- [ ] **Step 3: Other modals.** Stat-block, scene-upload, notes-archive and level-up modal contents inherit `.modal-content`; walk their sections replacing leftover hard-coded colors (`#12122a`-style values) with tokens. `.scene-drop-zone`: dashed `var(--border-dim)` border, fell-italic hint text.

- [ ] **Step 4: Verify.** Open condition modal (pills toggle), trigger a damage notification on the player (parchment toast, wax accent), open monster stat block and scene upload as master.

- [ ] **Step 5: Commit**

```bash
git add style.css src/UI.js
git commit -m "feat(redesign): parchment modals and notification toasts"
```

### Task 6: Character sheet as tome chapters + library

**Files:**
- Modify: `style.css` sections SCHEDA header (1345–1378), SCHEDA body e sezioni (1382–2234)

- [ ] **Step 1: Chapters.** Restyle `details.sheet-section`:

```css
.sheet-section {
  background: var(--bg-panel);
  border: 1px solid var(--border-dim);
  border-radius: var(--radius);
  overflow: hidden;
}
.sheet-section > summary {
  font-family: var(--font-heading);
  color: var(--gold-light);
  letter-spacing: 0.04em;
  padding: 0.7rem 0.9rem;
  cursor: pointer;
  list-style: none;
}
.sheet-section > summary::-webkit-details-marker { display: none; }
.sheet-section > summary::before { content: '⚜ '; color: var(--gold-dim); }
.sheet-section[open] > summary {
  border-bottom: 1px solid var(--border-dim);
  background: rgba(212, 175, 94, 0.05);
}
```

  Note: summaries in `index.html` start with emoji (📖, 💪, …). Leave them — the ⚜ prefix replaces nothing; if ⚜+emoji feels doubled when you view it, drop the `::before` rule rather than editing 15 summaries.

- [ ] **Step 2: Ability medallions.** `.ability-block`: gold-framed medallion — border `1px solid var(--border-warm)`, radius 10px, `.ability-label` in Cinzel gold-dim, `.ability-input` big EB Garamond centered, `.ability-mod` in gold-light.

- [ ] **Step 3: Walk the rest of the sheet section** with tokens, keeping selectors: `.field-row label` (small Cinzel, letter-spacing), skill/save rows (filet separators `border-bottom: 1px solid rgba(110,85,38,.18)`), spell-slot counters (gold +/− buttons, ghost style), attacks/inventory rows (panel pattern), `.inventory-list` bullets via `li::marker { content: '✒ '; color: var(--gold-dim); }` if items are `li`, otherwise prepend in the row CSS with `::before`. Death-saves block same pip style as Task 4.

- [ ] **Step 4: Verify.** Open the sheet from home (library) and from combat. Every `<details>` opens/closes, inputs still save (edit a field, check Firebase write in Network tab or reload), abilities show modifiers, slots +/− work.

- [ ] **Step 5: Commit**

```bash
git add style.css
git commit -m "feat(redesign): character sheet as tome chapters"
```

### Task 7: Grid, log chronicle, notes, scene, ship

**Files:**
- Modify: `src/GridUI.js:158-163` (token colors)
- Modify: `style.css` sections GRIGLIA (2357–2548), CRONACHE note (2552–2736), PANNELLO SCENA (2956–3002), AREA BATTAGLIA (3006–3018), LOG EVENTI (3022–3473), SHIP PANEL (3477–end)

- [ ] **Step 1: Token colors in `src/GridUI.js`.** Replace the fill/stroke block (lines 158–163) with Grimoire-consistent colors (same structure, new values):

```js
let fill, stroke;
if (isMyToken)      { fill = '#16240f'; stroke = isSelected ? '#9ccf6e' : '#5e8f54'; }
else if (isPlayer)  { fill = '#13241c'; stroke = isSelected ? '#d4af5e' : isActive ? '#e3c87e' : '#4a8a6e'; }
else if (occ.faction === 'good') { fill = 'rgba(138,109,50,0.35)'; stroke = isSelected ? '#d4af5e' : isActive ? '#e3c87e' : '#b8954a'; }
else                { fill = '#2a100c'; stroke = isSelected ? '#d4af5e' : isActive ? '#e3c87e' : '#a84a3a'; }
if (isDead) { fill = '#3a352c'; stroke = '#6e6657'; }
```

- [ ] **Step 2: Grid board CSS.** In the GRIGLIA section find the `.sq`/`.sq-wall`/`.sq-hover`/`.sq-name`/`.sq-dist`/`.sq-tooltip-name` rules and restyle: cells `fill: #181208; stroke: rgba(212,175,94,0.13);`, hover `fill: #241b0e;`, walls `fill: #3c372e; stroke: #57503f;` (stone), names/labels `fill: #dcc9a4;` with `font-family: var(--font-body)` where the rule allows it (SVG text uses the page font-family if set in CSS). `.grid-section`, `.grid-token-chip`, `.grid-initiative-*`, `.grid-zoom-btn` get the panel/ghost patterns (replace hard-coded `#12122a`, `#2a2040`, `rgba(124,58,237,…)` leftovers).

- [ ] **Step 3: Log chronicle.** `.event-log-section` panel pattern; entries:

```css
.event-entry {
  font-family: var(--font-fell);
  font-style: italic;
  color: var(--text);
  border-bottom: 1px solid rgba(110, 85, 38, 0.15);
  position: relative;
  padding-left: 1.3rem;
}
.event-entry::before {
  content: '✒';
  position: absolute;
  left: 0.15rem;
  color: var(--wax);
  font-style: normal;
}
.event-timestamp {
  font-family: var(--font-body);
  font-style: normal;
  font-size: 0.72rem;
  color: var(--text-muted);
}
```

  Keep the existing `.animate-new` animation and per-type accents (`event-damage` → wax left tint, `event-heal` → green) by recoloring the existing type rules.

- [ ] **Step 4: Session notes, scene, ship.** Apply panel pattern + tokens to `.session-notes-section`, `.note-entry` (title input in Cinzel; keep `--lock-color` behavior untouched), `.scene-section`, and the SHIP PANEL section (replace leftover hex purples with tokens; this panel is functional, a full token sweep is enough).

- [ ] **Step 5: Verify.** Grid: parchment board, stone walls (toggle edit mode as master and paint), gold ring on active token, green on own token, distances readable, dead token grey. Log: write actions (hit a creature), entries appear as chronicle lines. Notes expand/edit. Ship panel opens (🚢) and is legible.

- [ ] **Step 6: Commit**

```bash
git add style.css src/GridUI.js
git commit -m "feat(redesign): grid board, log chronicle, notes and panels"
```

### Task 8: Phase 1 closure — responsive pass + smoke checklist

**Files:**
- Modify: `style.css` (fixes only)

- [ ] **Step 1: Sweep for leftovers.** `grep -n "7c3aed\|8b48f0\|b472ff\|6030b8\|12122a\|181840\|07071a\|0d0d24\|121236\|2c1f60" style.css` — every hit is an old-theme leftover; replace with tokens.

- [ ] **Step 2: Responsive pass** at 360px, 768px, 1100px on home, combat (master and player), sheet. Fix overflow/cramped spots. Frames thin on mobile (Task 3 media query) — verify.

- [ ] **Step 3: Phase 1 smoke checklist** (two browsers, master + player):
  1. Google/guest auth, create session, join, rejoin on reload
  2. Add creature (manual + library + API search), turn cycle, damage/heal with toast, conditions, KO + death saves + revive
  3. Sheet: edit a field per section type (text/number/slot), confirm persistence on reload
  4. Grid: place/move tokens with sizes, paint walls, reset
  5. Log written on actions, clear-log works

- [ ] **Step 4: Commit**

```bash
git add style.css
git commit -m "feat(redesign): phase 1 polish — leftover sweep and responsive fixes"
```

---

## Phase 2 — Tactical dashboard (combat view restructure)

**Selection model (locked):** `state.selectedGridTokenId` stays the single selection source (grid movement + rail + detail). The detail panel shows `detailId = state.selectedGridTokenId ?? currentTurnId`. On turn change the listener resets `state.selectedGridTokenId = null`, so the detail follows the new active combatant. No second selection field.

### Task 9: Restructure `#view-combat` markup

**Files:**
- Modify: `index.html:145-330` and `index.html:523-590` (combat view, battle area)

- [ ] **Step 1: Move master controls into the header.** Move the whole `#master-controls` div (lines 165–182) inside `<header class="combat-header">`, after `.combat-header-right`. Keep all ids.

- [ ] **Step 2: Create the add-combatant modal.** Immediately before the condition modal (line ~600), add:

```html
<div id="add-combatant-modal" class="modal hidden" role="dialog" aria-modal="true" aria-label="Aggiungi alla battaglia">
  <div class="modal-content add-combatant-content">
    <h3>Aggiungi alla battaglia</h3>
    <!-- master-add-form e player-pet-form vengono spostati qui -->
    <button id="btn-add-combatant-close" class="btn-secondary">Chiudi</button>
  </div>
</div>
```

  Then MOVE (cut/paste, unchanged) `<section id="master-add-form">…</section>` (lines 192–245) and `<section id="player-pet-form">…</section>` (lines 253–264) into it, above the close button. `UI.renderMasterPanel` keeps toggling their `hidden` by role — unchanged.

- [ ] **Step 3: Reshape the dashboard body.** Replace the current sibling order inside `#view-combat` so the direct children are (keep every id and inner markup; this is re-parenting only):

```html
<header class="combat-header">…(+ master-controls)…</header>
<div id="error-message-combat" class="error-banner hidden"></div>

<div class="dashboard">
  <aside id="turn-rail" class="turn-rail">
    <div id="grid-initiative-list-container" class="grid-initiative-list-container">
      <h3 class="grid-initiative-list-title">Iniziativa</h3>
      <ol id="grid-initiative-list" class="grid-initiative-list"></ol>
    </div>
  </aside>

  <div id="combat-center" class="combat-center">
    <div id="ship-panel" class="hidden"></div>
    <section id="scene-section" class="scene-section hidden">…</section>
    <section id="grid-section" class="grid-section">…(senza grid-initiative-list-container, vedi sotto)…</section>
  </div>

  <section id="event-log-section" class="event-log-section">…</section>
</div>

<div class="detail-area">
  <ol id="detail-list" class="combatant-list combatant-detail"></ol>
  <p id="empty-detail-msg" class="empty-msg hidden">Seleziona un combattente.</p>
</div>

<div class="combat-cols">…(col-creatures senza master-add-form, col-players senza player-pet-form, col-sheet invariata)…</div>

<section id="session-notes-section" class="session-notes-section">…</section>
```

  Concretely: move `#grid-initiative-list-container` out of `.grid-layout` (which keeps only `#grid-container`); move `#ship-panel` and the old `.battle-area` children (`#scene-section`, `#grid-section`) into `#combat-center`; move `#event-log-section` next to it; delete the now-empty `.battle-area` wrapper; add the `detail-area` block.

- [ ] **Step 4: Verify nothing broke functionally.** Load a session: lists render in `.combat-cols`, grid renders, initiative list renders in the rail, log renders, ship toggle still swaps with `.combat-cols` (`app.js:561` keeps working since `.combat-cols` still exists). Modal opens nothing yet (wired in Task 10) — but conditions modal still works.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(dashboard): restructure combat view markup into dashboard areas"
```

### Task 10: JS wiring — detail panel, selection reset, add-combatant modal

**Files:**
- Modify: `app.js:1004-1025` (listener) and top-level listeners area
- Modify: `src/core.js` (esc handling, optional)

- [ ] **Step 1: Render the detail panel.** In `_startListening`, right after the two existing `renderCombatantList` calls (app.js:1014–1015), add:

```js
// Pannello dettaglio (dashboard): selezione griglia/rail, fallback sul turno attivo
const detailId   = state.selectedGridTokenId ?? data.currentTurnId ?? null;
const detailComb = detailId ? sorted.filter(c => c.id === detailId) : [];
UI.renderCombatantList(detailComb, data.currentTurnId ?? null, state.myUid, state.session.masterUid, callbacks, state.acMap, state.sheetData?.deathSaves ?? null, progressionData, 'detail-list', 'empty-detail-msg', sorted);
```

- [ ] **Step 2: Reset selection on turn change.** Above that, in the same listener (before `sorted` is used is fine), add a module-scope tracker near the top of `app.js` (`let _lastTurnIdSeen = null;`) and in the listener:

```js
if (data.currentTurnId !== _lastTurnIdSeen) {
  _lastTurnIdSeen = data.currentTurnId ?? null;
  state.selectedGridTokenId = null;
}
```

  Place this BEFORE the `renderGrid`/detail computations so the new turn renders unselected.

- [ ] **Step 3: Re-render detail on local selection change.** Grid/rail selection re-renders only the grid today (`reRender` in `src/grid.js`). Extend: in `src/grid.js`, both `onSelect` callbacks (lines 38 and 54) and the token-bar click (line 108) currently call only the grid re-render; add a custom event so `app.js` re-renders the detail without circular imports:

```js
// in src/grid.js, dopo state.selectedGridTokenId = id; (tutte e tre le occorrenze)
document.dispatchEvent(new CustomEvent('dnd:selection-changed'));
```

  In `app.js` (top-level listeners area), add:

```js
document.addEventListener('dnd:selection-changed', () => {
  const data = state.snapshot;
  if (!data) return;
  const sorted    = state.tracker.sortedCombatants(data.combatants);
  const callbacks = makeCallbacks();
  const progressionData = { mode: data.progressionMode ?? 'xp', xp: data.xp ?? {}, levelUpGranted: data.levelUpGranted ?? {} };
  const detailId   = state.selectedGridTokenId ?? data.currentTurnId ?? null;
  const detailComb = detailId ? sorted.filter(c => c.id === detailId) : [];
  UI.renderCombatantList(detailComb, data.currentTurnId ?? null, state.myUid, state.session.masterUid, callbacks, state.acMap, state.sheetData?.deathSaves ?? null, progressionData, 'detail-list', 'empty-detail-msg', sorted);
});
```

  (Same pattern as the existing `dnd:rejoin` event used by `home.js`.)

- [ ] **Step 4: Add-combatant modal open/close.** Top-level in `app.js`:

```js
document.getElementById('btn-add-combatant-close')?.addEventListener('click', () =>
  document.getElementById('add-combatant-modal')?.classList.add('hidden'));
document.addEventListener('dnd:add-combatant', () =>
  document.getElementById('add-combatant-modal')?.classList.remove('hidden'));
```

  The rail "+" button dispatches `dnd:add-combatant` (Task 11). In `src/core.js`, if the Escape handler closes the condition modal, extend it to also add `hidden` to `#add-combatant-modal` (read `esc` there first; follow its existing pattern).

- [ ] **Step 5: Verify.** Detail panel shows the active combatant by default; clicking a token selects it and the detail follows; next turn resets to the new active combatant; damage/heal/conditions from the detail card work (it's the same template + delegation); death saves render for own KO card in detail.

- [ ] **Step 6: Commit**

```bash
git add app.js src/grid.js src/core.js
git commit -m "feat(dashboard): detail panel driven by grid selection with turn-reset"
```

### Task 11: Turn rail with portraits and HP

**Files:**
- Modify: `src/GridUI.js:286-329` (`renderInitiativeList`)
- Modify: `src/grid.js:30-40` (pass master add callback)

- [ ] **Step 1: Rewrite `renderInitiativeList`** keeping signature compatible (add one trailing param `onAddCombatant`):

```js
export function renderInitiativeList(container, sortedCombatants, gridPos, myCombatantId, selectedId, currentTurnId, isMaster, onSelect, combatants, onAddCombatant) {
  if (!container) return;

  const pos  = gridPos || {};
  const comb = combatants || {};
  const referenceId = selectedId || myCombatantId;
  const refPos  = referenceId ? pos[referenceId] : null;
  const refSide = referenceId ? footprintOf(comb[referenceId]?.size) : 1;

  let html = '';
  for (const c of sortedCombatants) {
    const isActive   = c.id === currentTurnId;
    const isSelected = c.id === selectedId;
    const isKO       = c.hpCurrent === 0;
    const cPos = pos[c.id];

    let distText = '';
    if (refPos && cPos && c.id !== referenceId) {
      const d = squareDistance(refPos.col, refPos.row, refSide, cPos.col, cPos.row, footprintOf(c.size));
      distText = `<span class="rail-dist">${fmtM(d)}</span>`;
    }

    // HP visibile: master sempre; per i player solo PG/pet (le creature restano nascoste)
    const hpVisible = isMaster || c.type !== 'creature';
    const hpPct = c.hpMax > 0 ? Math.max(0, Math.min(100, (c.hpCurrent / c.hpMax) * 100)) : 0;
    const hpBar = hpVisible
      ? `<div class="rail-hp"><div class="rail-hp-fill${c.type === 'creature' ? '' : ' pg'}" style="width:${hpPct}%"></div></div>`
      : '<div class="rail-hp rail-hp-hidden"></div>';

    let cls = 'rail-item';
    if (isActive)   cls += ' active-turn';
    if (isSelected) cls += ' selected';
    if (isKO)       cls += ' ko';
    if (c.type === 'player' || c.type === 'pet') cls += ' pg';

    html += `
      <li class="${cls}" data-id="${c.id}" title="${esc(c.name)}">
        <span class="rail-portrait">${isKO ? '💀' : esc((c.name || '?').slice(0, 2).toUpperCase())}</span>
        ${hpBar}
        <span class="rail-name">${esc(c.name)}</span>
        ${distText}
      </li>`;
  }

  if (isMaster && onAddCombatant) {
    html += `<li class="rail-item rail-add" data-action="add-combatant" title="Aggiungi alla battaglia"><span class="rail-portrait">＋</span></li>`;
  } else if (!isMaster && onAddCombatant) {
    html += `<li class="rail-item rail-add" data-action="add-combatant" title="Aggiungi compagno"><span class="rail-portrait">🐾</span></li>`;
  }

  container.innerHTML = html;
  container.onclick = (e) => {
    const add = e.target.closest('[data-action="add-combatant"]');
    if (add) { onAddCombatant?.(); return; }
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    onSelect(li.dataset.id === selectedId ? null : li.dataset.id);
  };
}
```

  Note: the old item classes (`grid-initiative-item` etc.) are replaced by `rail-*`; their CSS is rewritten in Task 12.

- [ ] **Step 2: Pass the callback.** In `src/grid.js` `renderGrid`, extend the `renderInitiativeList` call with the trailing argument:

```js
() => document.dispatchEvent(new CustomEvent('dnd:add-combatant'))
```

- [ ] **Step 3: Verify.** Rail shows everyone in initiative order: gold ring on active, green tint on PG, skull on KO, HP minibars (none on creatures for players), distance labels still appear relative to selection, ＋ opens the add modal for the master and the pet form for players. Clicking a portrait selects (grid + detail follow); clicking again deselects.

- [ ] **Step 4: Commit**

```bash
git add src/GridUI.js src/grid.js
git commit -m "feat(dashboard): turn rail with portraits, hp minibars and add button"
```

### Task 12: Dashboard CSS — desktop grid + mobile stack

**Files:**
- Modify: `style.css` (new DASHBOARD section after LAYOUT 3 COLONNE; rewrite `.grid-initiative-*` rules into `.rail-*`)

- [ ] **Step 1: Desktop layout.**

```css
/* ═══════════════════════════════════════════
   DASHBOARD COMBATTIMENTO (Fase 2)
═══════════════════════════════════════════ */
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

.turn-rail { min-width: 0; }

.combat-center { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }

.combatant-detail .combatant-card { margin: 0; }

@media (min-width: 1100px) {
  .dashboard {
    display: grid;
    grid-template-columns: 84px minmax(0, 1fr) 280px;
    align-items: start;
  }
  .turn-rail { position: sticky; top: 0.5rem; }
  #event-log-section { max-height: min(70vh, 640px); overflow-y: auto; }
  /* su desktop le colonne card sono ridondanti col rail+dettaglio */
  .combat-cols { display: none; }
  /* tranne la scheda del player, che vive in #col-sheet: resta raggiungibile
     perché openCharacterSheet mostra #view-character; verificare e, se serve,
     togliere .combat-cols da display:none e nascondere solo #col-creatures e #col-players */
  .detail-area { max-width: 900px; margin: 0 auto; width: 100%; }
}
```

  **Attention point (verify, don't assume):** the character sheet `#view-character` lives inside `#col-sheet` inside `.combat-cols`. If hiding `.combat-cols` on desktop breaks opening the sheet from the detail card, hide only `#col-creatures` and `#col-players` instead:

```css
@media (min-width: 1100px) {
  #col-creatures, #col-players { display: none; }
}
```

  Use whichever keeps the sheet working — test by clicking "📜 Scheda Personaggio" from the detail panel at ≥1100px.

- [ ] **Step 2: Rail styles.**

```css
.grid-initiative-list-container {
  width: auto;
  background: var(--bg-panel);
  border: 1px solid var(--border-dim);
  border-radius: var(--radius);
  padding: 0.5rem 0.35rem;
}
.grid-initiative-list { display: flex; flex-direction: column; gap: 0.55rem; list-style: none; }

.rail-item {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  cursor: pointer;
  min-width: 52px;
}
.rail-portrait {
  width: 42px; height: 42px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-card);
  border: 2px solid var(--border-warm);
  font-family: var(--font-heading);
  font-size: 0.85rem;
  color: var(--text);
  transition: border-color .15s, box-shadow .15s;
}
.rail-item.pg .rail-portrait     { border-color: #4a7a42; }
.rail-item.active-turn .rail-portrait {
  border-color: var(--gold);
  box-shadow: 0 0 12px var(--gold-glow);
}
.rail-item.selected .rail-portrait { border-color: var(--gold-light); border-style: double; }
.rail-item.ko { opacity: 0.45; }

.rail-hp { width: 42px; height: 4px; background: var(--hp-bar-bg); border-radius: 99px; overflow: hidden; }
.rail-hp-fill     { height: 100%; background: linear-gradient(90deg, #5e1e1e, #9c3030); }
.rail-hp-fill.pg  { background: linear-gradient(90deg, #3e5e38, #5e8f54); }
.rail-hp-hidden   { visibility: hidden; }

.rail-name {
  font-size: 0.62rem; color: var(--text-muted);
  max-width: 64px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.rail-dist { font-size: 0.6rem; color: var(--gold-dim); }
.rail-add .rail-portrait { border-style: dashed; color: var(--gold); }

/* Mobile: rail orizzontale scorrevole in cima */
@media (max-width: 1099px) {
  .grid-initiative-list { flex-direction: row; overflow-x: auto; padding-bottom: 4px; }
  .grid-initiative-list-title { display: none; }
}
```

- [ ] **Step 3: Mobile order.** `#view-combat` children stack naturally; enforce the approved order (Turni → Mia card → Griglia → Altri → Cronaca) with flex order on mobile:

```css
@media (max-width: 1099px) {
  #view-combat { display: flex; flex-direction: column; }
  /* display:contents fa partecipare rail/center/cronaca direttamente
     all'ordine flex di #view-combat (il dettaglio è fuori da .dashboard) */
  .dashboard       { display: contents; }
  .combat-header   { order: 0; }
  #error-message-combat { order: 1; }
  .turn-rail       { order: 2; }
  .detail-area     { order: 3; }   /* la card del combattente attivo/selezionato = "mia card" quando tocca a te */
  .combat-center   { order: 4; }   /* griglia (+ nave/scena) */
  .combat-cols     { order: 5; }   /* altri combattenti */
  #event-log-section { order: 6; } /* cronaca */
  #session-notes-section { order: 7; }
}
```

  Note the spec nuance "la mia card fissa": on mobile the detail panel defaults to the active combatant; the player's own full card is always available in `.combat-cols` (player list). Tapping a rail portrait selects it → detail shows it right under the rail. This satisfies "tocca un ritratto → la card si apre qui" with zero extra render paths.

- [ ] **Step 4: Old initiative-list CSS cleanup.** Delete now-unused `.grid-initiative-item`, `.grid-initiative-name`, `.grid-initiative-meta`, `.grid-initiative-ko`, `.grid-initiative-dist` rules (grep first: `grep -n "grid-initiative-item\|grid-initiative-dist" style.css src/*.js` must return only style.css hits before deleting).

- [ ] **Step 5: Verify** at 1280px (master): header with controls, rail | grid | chronicle, detail below, no `.combat-cols`; sheet opens from detail card. At 390px (player): rail horizontal scroll, detail under rail, grid, other combatants, chronicle. Ship toggle still swaps correctly.

- [ ] **Step 6: Commit**

```bash
git add style.css
git commit -m "feat(dashboard): desktop grid layout and mobile stacking order"
```

### Task 13: Final pass — full checklist, docs, wrap-up

**Files:**
- Modify: `CLAUDE.md` (Stato implementazione + file table)

- [ ] **Step 1: Run the full spec checklist** (spec §Collaudo), two browsers (master desktop ≥1100px + player mobile emulation):
  1. Auth Google/ospite, creazione e join sessione, rejoin al reload
  2. Turni: KO player resta per death saves, creature KO saltate; selezione si resetta a ogni cambio turno
  3. Danni/cure con notifiche; condizioni; revive a 3 successi
  4. Aggiunta creatura dal modal (libreria + ricerca API + manuale); compagno player
  5. Griglia: movimento con taglie, muri in edit mode, reset; selezione token ↔ rail ↔ dettaglio coerenti
  6. Pannello nave e immagine scena nello slot centrale
  7. Log: scrittura su azioni, svuota condiviso
  8. Visibilità HP per ruolo (rail e card); scheda: campi `data-path` persistono
  9. XP award, level-up badge, milestone grant
  10. Responsive 360/768/1100+

- [ ] **Step 2: Fix anything found**, committing fixes as `fix(dashboard): …` / `fix(redesign): …`.

- [ ] **Step 3: Update `CLAUDE.md`:** in "Stato implementazione → Completato" add a bullet: redesign Grimorio (tema unico, design system in `style.css`, dashboard tattica con rail/dettaglio/cronaca, modal aggiungi-combattente, selezione `selectedGridTokenId` con reset al cambio turno); update the `src/GridUI.js` row of the file table to mention `renderInitiativeList` → turn rail; remove the sentence about the dual theme if present.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for Grimoire redesign"
```

- [ ] **Step 5: Wrap up the branch** — use the superpowers:finishing-a-development-branch skill (merge/PR decision belongs to the user).
