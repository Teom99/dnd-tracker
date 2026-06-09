# Square Grid with Master-Set Dimensions, Walls, and Creature Sizes

**Date**: 2026-06-09
**Status**: Approved, ready for implementation plan

## Goal

Replace the hexagonal battle grid with a **square** grid that:

1. Uses squares instead of hexagons.
2. Has a fixed size (width × height) the **master** sets during the session.
3. Lets the master draw **walls**; players cannot move onto wall cells.
4. Has a **reset** button that removes all tokens (players + creatures) **and** walls.
5. Supports per-token **size**: Small/Medium (1×1), Large (2×2), Huge (3×3), Gargantuan (4×4).

## Non-goals

- No diagonal-movement variant rules (use plain Chebyshev, diagonals = 1).
- No switch away from SVG to a DOM grid.
- No change to zoom/pan behavior beyond what square geometry requires.
- No line-of-sight / vision blocking from walls (walls only block movement).

---

## Data model (Firebase)

```
sessions/{code}/
  gridConfig/  { cols, rows }          // master-set dimensions, default 20×20
  grid/{combatantId}/  { col, row }    // anchor = top-left cell of the footprint
  walls/{cellKey}: true                // cellKey = "col_row"

combatants/{id}/  size: "medium"       // new field, default "medium"

characters/{uid}/{charId}/  size: "medium"   // new library field, default "medium"
```

### Size categories → footprint

| Category    | Footprint |
|-------------|-----------|
| tiny        | 1×1       |
| small       | 1×1       |
| medium      | 1×1       |
| large       | 2×2       |
| huge        | 3×3       |
| gargantuan  | 4×4       |

A token whose anchor is `(col, row)` with footprint side `n` occupies the cells
`col .. col+n-1` × `row .. row+n-1`. The anchor is the **top-left** cell.

The picker exposed in the UI offers **Small / Medium / Large / Huge / Gargantuan**
(default Medium). `tiny` is supported in the size→footprint map for completeness but
is not required in the picker.

### Defaults & migration

- `gridConfig` missing → treat as `{ cols: 20, rows: 20 }`.
- `combatant.size` / `character.size` missing → treat as `"medium"`.
- No destructive migration of existing sessions is required; missing fields fall back to defaults.

---

## Rendering approach

Keep the existing **SVG + CSS-transform** structure (zoom/pan code in `GridUI.js`
stays the same shape). Replace hex `<polygon>` cells with square `<rect>` cells.

- Cell geometry: a fixed cell size in px (analogous to today's `BASE_HEX_R`), e.g.
  `CELL = 40`. Cell `(col,row)` top-left = `(PAD + col*CELL, PAD + row*CELL)`.
- SVG width/height derived from `gridConfig.cols/rows` (not a hardcoded 60×40).
- Walls: rendered as filled cells with a distinct style (`.sq-wall`).
- Tokens with footprint `n` render as a single `n*CELL` square (rect + label),
  centered text, occupying their full footprint.
- Dead tokens keep the existing grey fill + 💀 marker treatment.
- Selection/active-turn highlight styles carried over (renamed hx-* → sq-*).

### Distance

- **Chebyshev** distance: `max(|dc|, |dr|)`, 1 square = 1 m.
- For sized tokens, distance between two tokens = the **minimum Chebyshev distance
  between their footprints** (edge-to-edge), i.e. `max(gapCols, gapRows)` where each
  gap is the separation between the two cell ranges on that axis (0 if they overlap
  or are adjacent-touching ranges). This matches how 5e measures between large
  creatures.
- Distance tooltips and the initiative-list distance column use this metric.

---

## Master controls (grid header)

1. **Dimensions**: two number inputs (width × height) + an "Apply" button. Visible to
   master only. Applying writes `gridConfig`. Resizable at any time; on resize, any
   token whose footprint no longer fits inside the new bounds is removed from `grid`,
   and any wall outside the new bounds is removed from `walls`.
   - Bounds: min 1×1; a sane max (e.g. 60×60) to avoid runaway render cost.
2. **Reset** (existing `#btn-grid-reset`, now shown for master): clears **all** token
   positions (`grid`) **and** all walls (`walls`). Keeps `gridConfig`.
3. **Walls** (modeless): when the master has **no token selected** and clicks an
   **empty** cell, toggle a wall there; clicking an existing wall cell removes it. To
   *move* a token, the master selects it first (token bar or click), then clicks the
   destination — selection state separates "move" from "wall paint." A cell occupied
   by a token cannot become a wall.

---

## Movement & collision rules

A move of a token to anchor `(col, row)` is allowed only if the **entire footprint**:

- (a) fits inside `[0, cols) × [0, rows)`,
- (b) contains no wall cell, and
- (c) does not overlap any **other** token's footprint.

Rules apply to both master and players. Players may still only move tokens they own
(`myOwnedIds` / `myCombatantId`), unchanged from today. If a move is invalid, it is
rejected (no Firebase write); selection behavior otherwise unchanged.

Wall placement (master) is rejected on any cell currently covered by a token footprint.

---

## Size editing

- **Library**: add a size `<select>` (Small/Medium/Large/Huge/Gargantuan) to the
  character sheet (`index.html` `#view-character`) and the library creature form.
  Persisted via the existing `data-path` mechanism (`CharacterSheet.setField`) /
  `CharacterLibrary` CRUD. Default `medium`.
- **Carry-in**: when a combatant is created from a library entry (and for the add-
  creature flow), copy `size` onto the combatant (`Combatant.add`), default `medium`.
- **Session override**: the **master** can change a selected token's size during the
  session via a small control (on the selected token / in the token bar). Writes
  `combatants/{id}/size`. Players cannot change size.
- If sync from sheet → combatant is desired for `size` (as already done for `armorClass`
  and `hpMax`), add it to `setupSheetListener` in `src/sheet.js` using the existing
  `prev*` guard pattern. (Master override still wins as the most recent write.)

---

## Files touched

| File | Change |
|---|---|
| `src/GridUI.js` | Rewrite: square cell geometry, square distance, multi-cell tokens, walls rendering, modeless wall-toggle in click handler, dimension-driven SVG size. Keep zoom/pan. |
| `src/grid.js` | Pass `gridConfig` and `walls` through to `GridUI.renderGrid`; wire wall-toggle and dimension callbacks. |
| `src/Session.js` | Add `setGridConfig(cols,rows)` (with out-of-bounds cleanup), `toggleWall(cellKey)`, `clearWalls()`; update reset to clear walls too. |
| `src/Combatant.js` | Add `size` on add; helper to set size (master override). |
| `src/CharacterSheet.js` / `src/SheetUI.js` | Size field render + persist. |
| `src/CharacterLibrary.js` | Carry `size` in creature/character CRUD. |
| `index.html` | Replace hex hint; add master dimension inputs + Apply; show reset for master; size selects in sheet/library forms. |
| `style.css` | Square cell styles (`.sq`, `.sq-wall`, `.sq-occ`, `.sq-sel*`, token/text), replacing hex (`.hx*`) styles. |
| `app.js` | Wire new master controls (dimensions/reset visibility), pass `gridConfig`/`walls` from snapshot into `renderGrid`. |
| `CLAUDE.md` | Update grid description (square, walls, sizes, gridConfig) and data model. |

---

## Testing

This project has no automated test harness; verification is manual in-browser
(master + player, two clients). Key scenarios:

1. Master sets dimensions; grid re-renders to new size; out-of-bounds tokens/walls dropped.
2. Master toggles walls on empty cells; players cannot move onto/through them.
3. Place Large/Huge/Gargantuan tokens; footprint occupies correct cells; collision and
   bounds checks reject invalid moves; distance measured edge-to-edge.
4. Reset clears tokens and walls, keeps dimensions.
5. Size set in library carries into the session; master override changes footprint live.
6. Real-time sync: a second client sees dimension/wall/token/size changes.
