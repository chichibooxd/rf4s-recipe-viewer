# RF4 Recipe Viewer — Implementation Plan (v14)

Plan for navigation, intuitiveness, and spec-alignment improvements identified in the code review, revised after senior-dev review of the original draft.

**Ordering note:** P0 is a hard prerequisite — the router (P1) cannot be built until state is reachable outside the `initRecipeViewer` closure. Items within P1–P4 are independent once P0 lands.

## P0 — Architecture prerequisite: state interface

The routing plan depends on state that is currently trapped inside the `initRecipeViewer()` closure (recipe-viewer.js:4–10): `loadoutBuilder`, `showRecipeDetail`, `filterRecipes`, `activeTargetSlot`. `initRecipeViewer()` is also invoked without `await` (app.js:19), so nothing is reachable from app.js today. **Without this step, P1 and P2.4 fail their acceptance criteria.**

- **Files:** `js/app.js`, `js/components/recipe-viewer.js`, `js/components/loadout-builder.js`
- `initRecipeViewer` returns an API object:
  ```js
  {
    showRecipeDetail(item),   // opens detail screen with the given CustomItem
    getDetailItem(),          // the currently displayed CustomItem (single-slot state, see P1.1)
    resetFilters(),           // current reset-btn behavior
    refreshLoadout(),         // loadoutBuilder.renderSlots() + renderStats()
    isPickMode(),             // true while activeTargetSlot is set
    cancelPickMode()          // clears activeTargetSlot + banner
  }
  ```
- app.js: `await initRecipeViewer()` before wiring nav; this also fixes a real race where nav clicks before data load render a blank loadout.
- **Alternative:** instead of an export, move the router into recipe-viewer.js where the state lives and let app.js own only the sidebar. Either is fine — decide once and make every call site use it.
- **Acceptance:** app.js can invoke all five methods; nav clicks before data load are inert or deferred.

## P1 — Navigation

### 1. Hash-based routing (single source of truth for screens)
- **Files:** `js/app.js`, `js/components/recipe-viewer.js`, `js/components/loadout-builder.js`
- Routes: `#/search`, `#/recipe/<id>`, `#/loadout`. Use `location.hash` + `popstate` (no library; vanilla JS PWA).
- **Migrate ALL direct screen toggles to the router — 12 call sites besides app.js:36:**
  - recipe-viewer.js:34–35 (loadout empty-slot → search), 507–509 (pick mode → search), 597–598 (detail open), 601–604 (back)
  - loadout-builder.js:54–55 (equip → loadout), 196–197 (import → loadout)
  - app.js:36–38 (`switchScreen`)
- **No custom back-stack.** The browser history IS the stack: detail `back-btn` calls `history.back()`, falling back to `#/search` when `history.length` is 1 (direct load / refresh).
- **Detail item identity:** do NOT build a registry keyed by recipe id — two CustomItems can share one id (e.g. two differently-inherited Steel Swords), and there is only ever one detail view. Use a single module-level `currentDetailItem` (exposed via `getDetailItem()` from P0). Router restore = `getDetailItem()` if it matches the id, else `new CustomItem(recipeById)`.
- **Pick-mode navigation must use `history.replaceState` (no push)** so back-from-search cannot return to the detail the user just left (history ping-pong). Entering pick mode never adds a history entry.
- **Known limitation (state it in code comment):** hard refresh on `#/recipe/<id>` renders base materials, losing slot edits.
  - **Alternative (out of scope unless requested):** persist loadout + last detail view to localStorage; fits the offline PWA story.
- **Acceptance:** Search → Detail → Loadout → back walks the same path in reverse. Refresh on `#/recipe/<id>` renders that recipe. Pick-mode entry adds no history entry. Refresh on any route re-renders correctly after the ui.html fetch + data load.

### 2. Inheritance pick mode UX
- **Files:** `js/components/recipe-viewer.js`, `ui.html`, `css/style.css`
- Add a banner placeholder in `search-screen` (below `.filter-bar`).
- Introduce a single `setPickMode(target|null)` that:
  - shows/hides the banner ("Select an item to inherit into <Slot name>"),
  - sets/clears `activeTargetSlot`,
  - is called by: empty-slot click (recipe-viewer.js:505), banner Cancel, `reset-btn`, and **any screen switch away from search** — pick mode must never silently survive navigation (hamburger to loadout, back, etc.).
- Banner Cancel clears only pick state, never filters (distinct from `reset-btn`).
- **Acceptance:** Banner appears on empty-slot click, persists across search↔detail back-and-forth, clears on pick/cancel/navigation. Filters are untouched by Cancel.

### 3. Hamburger on the detail screen
- **Files:** `ui.html`, `js/app.js`
- Add the `☰` button to the `recipe-screen` header (ui.html:29) so the global sidebar is reachable from every screen, per spec #4.
- **Acceptance:** Sidebar opens from all three screens.

## P2 — Correctness & intuitiveness

### 4. Loadout refresh-on-show
- **Files:** `js/app.js`, `js/components/loadout-builder.js`
- Router's `#/loadout` entry calls `refreshLoadout()` (from the P0 API) — not a direct app.js→loadoutBuilder call.
- Fixes stale totals after inheritance edits (mutation at recipe-viewer.js:468 never re-renders the loadout).
- **Acceptance:** Equip → detail → add inheritance → return to loadout → totals reflect the inheritance.

### 5. Weapon empty-slot default
- **Files:** `js/components/recipe-viewer.js` (onSlotEmptyClick, lines 38–49)
- From an empty Weapon slot: skill=Forging, subtype=All (show all 9 weapon types) instead of hard-coded `Short Sword`.
- **Acceptance:** Empty Weapon slot click shows all forgeable weapons.

### 6. Empty states and result labels
- **Files:** `js/components/recipe-viewer.js`, `css/style.css`
- No filters active → hint in `#results-container` ("Pick a skill, subtype, or materials to search").
- Filters active, zero matches → "No recipes match your filters".
- **Labels:** keep `name — <subtype> Lv.X` for craftable recipes; for ingredients show the *subtype* (Collectible, Dairy, Nutrient — it exists in the data and is more informative) with no `Lv.0`. Formula: `r.skill === 'Ingredient' ? (r.subtype !== 'Unknown' ? r.subtype : 'Ingredient') : r.subtype + ' Lv.' + r.level`.
- **Acceptance:** Empty/no-match states render; ingredient rows show category without `Lv.0`.

### 7. DONE — stat model corrected to match in-game mechanics
- **Verified against** the RF4 datamine and Kirbye2006's mechanic compilation (GameFAQs board
  thread 67717309; Fandom used only as secondary cross-check).
- **Inherited-only contributions:** only player-inherited slots (max 3 extra items in-game)
  contribute their `upgradeStats`; the recipe's required materials add no stats.
  Implemented via per-slot `inherited` flags on `CustomItem` (derived on import by
  comparing against recipe defaults).
- **TDU tier bonus:** +10…+2000 ATK (weapons) / +3…+800 DEF (other equipment), computed from
  summed material `Diff` (present in the dump), shown with the skill ≥ 50 condition.
- **Cooking/chemistry stats:** dish base effects (`Item Use Values`) + hidden ingredient
  cooking effects (`Upgrade Values` cook columns); non-edible ingredients flagged
  (in-game base effects go negative/unbalanced).
- **Inheritance restricted to equipment** (food slots are inert).
- **Known data limitations:** Total Level Used (TLU) bonuses and dish level
  (= average ingredient level) are not computable — per-item levels (1–10) are absent
  from this dataset.

## P3 — Mobile & accessibility

### 8. Unified loadout share/import modal (iOS-safe)
- **Files:** `ui.html`, `js/components/loadout-builder.js`, `css/style.css`
- Replace `prompt()` (loadout-builder.js:181 — unsupported on iOS Safari) **and** the `alert()`-based copy feedback with one modal: textarea + Copy / Import / Close.
  - Export: generate code, populate textarea, "Copy" button (`navigator.clipboard`; keep a select-all fallback for non-HTTPS contexts like `file://`/LAN).
  - Import: paste into the same textarea, Import applies with existing try/catch validation.
- **Acceptance:** Export and import work on iOS Safari without `prompt`/`alert`; invalid codes show an inline error, not a crash.

### 9. Sidebar active state + a11y
- **Files:** `js/app.js`, `ui.html`, `css/style.css`
- `.active` + `aria-current="page"` on the current nav button.
- Toggle `aria-hidden` with visibility; `aria-expanded` on both hamburger buttons; **track which button opened the menu and restore focus to it on close**; Escape closes.
- **Focus trap scope:** a lightweight Tab-trap keydown handler inside the sidebar is enough for two buttons — do not build a library.
- **Acceptance:** Screen reader announces current page; Escape closes and focus returns to the opener; Tab is contained in the sidebar while open.

### 10. Filled material slot drill-down
- **Files:** `js/components/recipe-viewer.js`
- Filled base-material slots (strings) become clickable when the material has its own recipe (`find(r => r.name === matName)` — recipe names are unique per processData's `recipeNames` set): show `showRecipeDetail(new CustomItem(recipe))`.
- Scope limit: nested (inherited) CustomItem slots stay non-interactive — deep tree navigation belongs to the loadout flow.
- **Acceptance:** Tapping a material with a recipe opens its detail; nested slots unchanged.

## P4 — Cleanup

### 11. CSS dedup
- **Files:** `css/style.css`
- Remove duplicated `.detail-slot.empty-fillable` / `.filled-nested` blocks (lines 54–66 and 110–123); keep one copy.
- **Acceptance:** No duplicate rules; styling unchanged.

### 12. Docs sync
- **Files:** `implementation.md`, `README.md`
- Match the actual repo: `data/data.json` location, `js/components/loadout-builder.js`, `js/models/custom-item.js`, missing `scripts/convert.py`. Note the router in the architecture section.
- **Acceptance:** implementation.md matches the repository tree.

### 13. Test harness
- **Files:** `test_custom_item.js`, (optional) `package.json`
- `test_custom_item.js` uses ESM `import assert from 'assert'` and nothing runs it — it is an orphan. Wire it up: Node ≥22 runs ESM natively (`node test_custom_item.js`); add a `package.json` with `"type": "module"` and a `test` script only if the repo wants one.
- **Acceptance:** `node test_custom_item.js` passes; file is either executed or deleted.

## Verification

No lint/CI exists; verification is manual. Per-item acceptance criteria above, plus a smoke pass:
1. Installable PWA loads offline from a clean cache (SW v14).
2. Full flow: search → detail → equip → loadout → inheritance → refresh loadout totals → export → import on another device profile.
3. iOS Safari: no `prompt`/`alert` anywhere; import/export via modal.
4. Android hardware back walks the screen stack; refresh on each route re-renders correctly.

## Out of scope (noted for future)
- Result sorting controls, search-by-name.
- localStorage persistence of loadout/detail state (alternative to P1.1 limitation).
- Name-based recipe ids to make share codes version-proof (P4.12 alternative if data.json regenerates with reordered rows, imported codes break silently).
