# Changelog

All notable changes to RF4 Recipe Viewer are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to a cache-bumped version scheme (`rf4-recipes-vN` in `sw.js`).

## [v17] - 2026-08-08

### Added
- **Crafting Planner panel** on equipment recipe details: material level inputs (1–10),
  "Extra" checkboxes (max 3 inherited items), skill level, and live prediction of
  Total Level Used (TLU) bonus (+10…+700 ATK / +5…+650 MATK weapons, +6…+350 DEF /
  +5…+350 M.DEF gear), TDU bonus, inherited effects, and totals. TLU/TDU bonuses flagged
  when the skill is below 50.
- **Elemental stones / elements:** weapons show their base element (from the data's
  `Attribute` column); the planner lets you apply an elemental-stone element (Fire/Water/
  Earth/Wind/Light/Dark) and shows the result.
- **Cores:** recipes using Green/Blue/Red/Yellow Cores are detected and show the
  "+10% resistance to non-elemental damage (all 4 cores)" bonus progress.
- **Overwrite / override planning:** the planner can replace the recipe's base stats with
  a same-category item's base stats (in-game overwrite rule), or any weapon via Light Ore
  (cross-category override).
- Loadout slots now show inherited items and the item's element at a glance
  ("Inherits: … · Element: …").
- `js/models/craft-calculator.js` — pure TLU/cores/element helpers.

### Note
- Craft success percentage and XP gained per craft remain pending formula research
  (see `plan/all-in-one-roadmap.md`). TLU is now computable via user-entered material
  levels (per-item levels are still absent from the dump).
- Service worker cache bumped `rf4-recipes-v16` → `rf4-recipes-v17` (new module cached).

---

## [v16] - 2026-08-08

### Added
- Recipe details now show the **craft RP cost** for production recipes, derived from the
  planner's current max RP (Forge/Craft 16 + 6.35%, Mix 12 + 4.76%, Cook 5 + 3.81%), with
  how many crafts the current max RP allows.
- **Loadout totals show the complete combat stat list** (37 stats, zeros included) instead
  of only non-zero sums; planner already shows the full character stat set.
- **Loadout persists to localStorage** (`rf4-loadout`) on every change and restores on
  startup — equipped items and inheritance survive service-worker cache updates
  (planner state was already persisted).

### Fixed
- Loadout total stats were cut off at the bottom by the tab bar — the stats section now
  scrolls clear of it.

---

## [v15] - 2026-08-08

### Added
- **Character Planner tab** (`#/planner`): skill levels → HP/RP/STR/INT/VIT calculator.
  - Base stats from the `Level Up` sheet (Lv.1 = 25 HP / 56 RP / 5 STR / 5 INT / 4 VIT).
  - Per-skill yields from the `Skill Stats` sheet (38 skills, exact float values incl.
    the documented floor-rounding quirks), with the in-game multipliers: HP doubles every
    50 skill levels, STR/INT/VIT every 300, RP caps at skill 100.
  - Derived combat stats: STR → +1 ATK, INT → +1 M.ATK, VIT → +0.5 DEF/+0.5 M.DEF.
  - Craft RP cost per action (Forge 16 RP + 6.35%, Craft 16 + 6.35%, Mix 12 + 4.76%,
    Cook 5 + 3.81% of max RP) plus crafts-until-empty at current max RP.
  - Planner state persisted in localStorage.
- Formulas verified against clepe's Stats Guide examples (Mining 50 → 75 HP, RP cap, etc.).

### Note
- Craft success percentage and XP gained per craft remain unimplemented — those formulas
  are game logic and are not present in the data dump or published guides (see
  `plan/all-in-one-roadmap.md`).
- Service worker cache bumped `rf4-recipes-v14` → `rf4-recipes-v15` (new planner module).

---

## [v14] - 2026-08-08

### Added
- Hash-based routing (`#/search`, `#/recipe/<id>`, `#/loadout`) with browser history support; back/forward and Android hardware back now walk the screen stack.
- Persistent bottom tab bar (Recipes / Loadout) replacing the hamburger sidebar — one-tap switching between the two main pages from any screen.
- Click-to-explore tooltips on every stat and effect box (equipment stats, dish effects, cooking effects, upgrade effects) explaining what the value does, backed by a stat glossary (`js/utils/stat-info.js`).
- Visible inheritance pick banner on the search screen when picking a material for an empty recipe slot, with a Cancel action that preserves filters.
- Empty states for the results list: filter hint when idle, "no matches" message when filtered out.
- Unified share/import modal for loadout codes (replaces `prompt()`/`alert()`, which are unreliable on iOS Safari).
- Click-to-open details for filled material slots that have their own recipe.
- `plan/all-in-one-roadmap.md`: research on all remaining RF4 resources (Stats Guide, Blacksmith guide, All Topics guide, rarity table) with a data-supported build plan for the all-in-one crafting tool.

### Changed
- Back button on the detail screen now returns to the screen the user actually came from (search, loadout, or inheritance flow) instead of always search.
- Loadout stats re-render when returning to the Loadout screen (totals no longer stale after inheritance edits).
- Empty Weapon slot navigation now shows all Forging weapons instead of defaulting to Short Sword.
- Result list renders ingredients by their item category (e.g. Collectible, Dairy) without a misleading `Lv.0`.
- Screen state refactored behind an exported API from `initRecipeViewer`; all 12 direct screen toggles migrated to the hash router (`#/search`, `#/recipe/<id>`, `#/loadout`).
- Navigation simplified: hamburger sidebar removed in favor of a persistent bottom tab bar; active tab highlighted with `aria-current`.
- Pick-mode navigation uses history replacement (no extra back entries); pick mode clears on any navigation away from the search screen.
- Loadout/equipment totals now include `upgradeStats` contributed by every slot material — plain materials (e.g. Iron, Gold) and inherited crafted items alike. Nested crafted items contribute their own upgrade value only (their materials no longer double-count).
- Recipe detail screen gained "Material Stats" and "Total Stats" sections (base + materials) alongside the existing base and inherited stats.
- Sidebar accessibility: `aria-hidden` toggles with visibility, Escape closes, focus returns to the trigger, `aria-expanded` on hamburger buttons, Tab contained within the open sidebar. (Superseded by the bottom tab bar.)

### Fixed
- Duplicate `.detail-slot` CSS rules removed (style.css).
- Loadout import no longer relies on `prompt()` (unsupported on iOS Safari); export/import share an in-app modal with inline error/status feedback.

### Corrected to match in-game mechanics (verified against the RF4 datamine and Kirbye2006's mechanic compilation)
- **Stat contributions:** only player-inherited slots (max 3 extra items, as in-game) contribute their upgrade stats to equipment totals. The recipe's required materials no longer add stats — Steel Edge forged from Iron/Iron/Bronze now shows no DEF from the ore. The previous model overcounted every recipe material's upgrade values.
- **Total Difficulty Used (TDU) bonus:** items now gain the TDU tier bonus (+10…+2000 ATK for weapons, +3…+800 DEF for other equipment), computed from the sum of material difficulty (`Diff` column), shown with the "applies at skill ≥ 50" condition. Total Level Used (TLU) bonuses remain impossible: item levels are not in this dataset (documented limitation).
- **Cooking/Chemistry stats:** dishes and medicine now show their base effects (from the `Item Use Values` sheet) and the hidden ingredient cooking effects (`HP cook`, `STR cook`, … from `Upgrade Values`) that always apply when used as ingredients. Recipes containing non-edible ingredients are flagged (in-game their base effects turn negative/unbalanced). Dish level = average ingredient level cannot be computed (level data unavailable); base effects are shown unscaled.
- **Inheritance restricted to equipment:** food and medicine no longer offer fillable material slots (in-game you cannot add items to cooked food).

### Changed (docs)
- `implementation.md` updated to match the actual repo layout (`data/data.json`, loadout-builder module, missing scripts dir) and the new routing model.
- Test harness added: `package.json` (Node ESM), `test_custom_item.js` runnable via `npm test`, plus `test_smoke.mjs` — a DOM-stub end-to-end pass over routing, filtering, pick mode, loadout totals, and the share/import modal.

### Version
- Service worker cache bumped `rf4-recipes-v13` → `rf4-recipes-v14` to force client cache refresh.

---

## [v13] - unreleased

### Added
- Loadout Editor with 6 equipment slots, cumulative stat totals, and Base64 export/import.
- Global hamburger sidebar navigation between Recipe Viewer and Loadout Editor.
- Inheritance support: empty recipe slots navigate back to search to pick inherited items.
- Offline PWA support (manifest + service worker cache).
