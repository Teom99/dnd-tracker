---
date: 2026-07-06
topic: Project scaffolding — layer-based directory structure
status: approved
---

# Project Scaffolding — Layer-Based Directory Structure

## Goal

Reorganize the flat `src/` directory and monolithic `style.css` into a layer-based structure so that related files are grouped by responsibility, not accident of creation order. Also update `CLAUDE.md` with comprehensive per-feature documentation.

---

## JS Directory Structure

### Before (flat)
```
src/
  CharacterLibrary.js
  CharacterSheet.js
  CombatTracker.js
  Combatant.js
  DndApi.js
  GridUI.js
  LevelUp.js
  LevelUpUI.js
  Session.js
  SheetUI.js
  Ship.js
  ShipUI.js
  UI.js
  core.js
  grid.js
  home.js
  imageUtils.js
  sheet.js
  state.js
```

### After (layered)
```
src/
  data/       Firebase CRUD — no DOM, no pure logic
    Session.js
    Combatant.js
    CharacterLibrary.js
    CharacterSheet.js
    Ship.js

  ui/         Render functions — no Firebase writes
    UI.js
    GridUI.js
    SheetUI.js
    ShipUI.js
    LevelUpUI.js

  logic/      Pure computation — no Firebase, no DOM
    CombatTracker.js
    LevelUp.js
    grid.js

  utils/      Shared singletons and helpers
    state.js
    DndApi.js
    imageUtils.js

  views/      View orchestrators — wire data + ui + events
    home.js
    sheet.js
    core.js
```

`app.js` stays at root. No file is renamed — only moved.

---

## Import Path Changes

### `app.js` (root → imports from `./src/`)

| Old | New |
|---|---|
| `./src/DndApi.js` | `./src/utils/DndApi.js` |
| `./src/Session.js` | `./src/data/Session.js` |
| `./src/CharacterLibrary.js` | `./src/data/CharacterLibrary.js` |
| `./src/UI.js` | `./src/ui/UI.js` |
| `./src/GridUI.js` | `./src/ui/GridUI.js` |
| `./src/state.js` | `./src/utils/state.js` |
| `./src/core.js` | `./src/views/core.js` |
| `./src/CharacterSheet.js` | `./src/data/CharacterSheet.js` |
| `./src/grid.js` | `./src/logic/grid.js` |
| `./src/sheet.js` | `./src/views/sheet.js` |
| `./src/LevelUp.js` | `./src/logic/LevelUp.js` |
| `./src/LevelUpUI.js` | `./src/ui/LevelUpUI.js` |
| `./src/Ship.js` | `./src/data/Ship.js` |
| `./src/ShipUI.js` | `./src/ui/ShipUI.js` |
| `./src/home.js` | `./src/views/home.js` |

### Inter-module imports (relative paths inside `src/`)

| File | Old import | New import |
|---|---|---|
| `data/CharacterSheet.js` | `./imageUtils.js` | `../utils/imageUtils.js` |
| `ui/LevelUpUI.js` | `./LevelUp.js` | `../logic/LevelUp.js` |
| `logic/grid.js` | `./GridUI.js` | `../ui/GridUI.js` |
| `logic/grid.js` | `./state.js` | `../utils/state.js` |
| `views/home.js` | `./CharacterLibrary.js` | `../data/CharacterLibrary.js` |
| `views/home.js` | `./UI.js` | `../ui/UI.js` |
| `views/home.js` | `./state.js` | `../utils/state.js` |
| `views/home.js` | `./core.js` | `./core.js` (same dir) |
| `views/home.js` | `./sheet.js` | `./sheet.js` (same dir) |
| `views/core.js` | `./Combatant.js` | `../data/Combatant.js` |
| `views/core.js` | `./CombatTracker.js` | `../logic/CombatTracker.js` |
| `views/core.js` | `./UI.js` | `../ui/UI.js` |
| `views/core.js` | `./state.js` | `../utils/state.js` |
| `views/sheet.js` | `./SheetUI.js` | `../ui/SheetUI.js` |
| `views/sheet.js` | `./UI.js` | `../ui/UI.js` |
| `views/sheet.js` | `./CharacterSheet.js` | `../data/CharacterSheet.js` |
| `views/sheet.js` | `./state.js` | `../utils/state.js` |
| `views/sheet.js` | `./core.js` | `./core.js` (same dir) |
| `views/sheet.js` | `./LevelUp.js` | `../logic/LevelUp.js` |
| `views/sheet.js` | `./LevelUpUI.js` | `../ui/LevelUpUI.js` |

`data/CharacterLibrary.js` imports `./CharacterSheet.js` — both land in `data/`, so the path is unchanged.

---

## CSS Structure

### Before
```
style.css    3739 lines, monolithic
theme.css    separate theme overrides
```

### After
```
styles/
  base.css        CSS variables, theme colors (#0f0f1a, #c9a84c), typography
                  (Cinzel/Crimson Text), reset, scrollbar, global utilities
  home.css        #view-home, auth UI, character library picker, session cards
  combat.css      #view-combat, fight cards (.fc-*), player dock (.dock-*),
                  XP frame (.fc-pframe), condition chips, death saves
  character.css   #view-character, sheet sections (.tome, .cstat), spell slots
                  (diamond pips), attack rows, inventory, level-up panel
  grid.css        SVG grid, tokens (.sq-token), walls (.sq-wall), movement
                  reach (.sq-reach), ghost preview, zoom controls
  ship.css        ship panel, deck rooms, weapon cards, crew tokens
```

`theme.css` is dissolved into `styles/base.css` (it only contains color/font overrides that belong there).

### `index.html` change

Replace the two existing `<link>` tags with:
```html
<link rel="stylesheet" href="styles/base.css">
<link rel="stylesheet" href="styles/home.css">
<link rel="stylesheet" href="styles/combat.css">
<link rel="stylesheet" href="styles/character.css">
<link rel="stylesheet" href="styles/grid.css">
<link rel="stylesheet" href="styles/ship.css">
```

---

## CLAUDE.md Update

Add a **Per-feature documentation** section that covers each feature with:
- What it does (user-facing behavior)
- Which files own it (data / ui / logic / views)
- Key Firebase paths it reads/writes
- Known constraints or invariants

Features to document:
- Auth (Google + anonymous, upgrade flow)
- Sessions (create / join / rejoin)
- Character library (CRUD)
- Combat tracker (initiative, turns, HP, conditions)
- Character sheet (all tabs, sync to combatant)
- Grid & map (SVG, movement, walls, token sizes)
- Ship panel (Damselfly, crew, weapons)
- Level-up system
- Logs

Update the **Architettura file** table and the **Pattern ricorrenti** section to reflect the new paths.

---

## Execution Order

1. Create `src/data/`, `src/ui/`, `src/logic/`, `src/utils/`, `src/views/`, `styles/` directories
2. Move JS files (git mv — preserves history)
3. Update all import paths (app.js + inter-module)
4. Split style.css + theme.css into styles/*.css
5. Update index.html link tags and remove old link tags
6. Smoke-test in browser (home, join session, combat view, character sheet, grid)
7. Update CLAUDE.md (file table + per-feature section)
8. Commit
