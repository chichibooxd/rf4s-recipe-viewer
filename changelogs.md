# Changelog

All notable changes to RF4 Recipe Viewer are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to a cache-bumped version scheme (`rf4-recipes-vN` in `sw.js`).

## [v14] - 2026-08-08

### Added
- Hash-based routing (`#/search`, `#/recipe/<id>`, `#/loadout`) with browser history support; back/forward and Android hardware back now walk the screen stack.
- Visible inheritance pick banner on the search screen when picking a material for an empty recipe slot, with a Cancel action that preserves filters.
- Hamburger nav button on the recipe detail screen (global navigation from every screen, per spec).
- Empty states for the results list: filter hint when idle, "no matches" message when filtered out.
- Unified share/import modal for loadout codes (replaces `prompt()`/`alert()`, which are unreliable on iOS Safari).
- Active-page highlighting (`aria-current`) in the sidebar navigation.
- Click-to-open details for filled material slots that have their own recipe.

### Changed
- Back button on the detail screen now returns to the screen the user actually came from (search, loadout, or inheritance flow) instead of always search.
- Loadout stats re-render when returning to the Loadout screen (totals no longer stale after inheritance edits).
- Empty Weapon slot navigation now shows all Forging weapons instead of defaulting to Short Sword.
- Result list renders ingredients by their item category (e.g. Collectible, Dairy) without a misleading `Lv.0`.
- Screen state refactored behind an exported API from `initRecipeViewer`; all 12 direct screen toggles migrated to the hash router (`#/search`, `#/recipe/<id>`, `#/loadout`).
- Pick-mode navigation uses history replacement (no extra back entries); pick mode clears on any navigation away from the search screen.
- Loadout/equipment totals now include `upgradeStats` contributed by every slot material — plain materials (e.g. Iron, Gold) and inherited crafted items alike. Nested crafted items contribute their own upgrade value only (their materials no longer double-count).
- Recipe detail screen gained "Material Stats" and "Total Stats" sections (base + materials) alongside the existing base and inherited stats.
- Sidebar accessibility: `aria-hidden` toggles with visibility, Escape closes, focus returns to the trigger, `aria-expanded` on hamburger buttons, Tab contained within the open sidebar.

### Fixed
- Duplicate `.detail-slot` CSS rules removed (style.css).
- Loadout import no longer relies on `prompt()` (unsupported on iOS Safari); export/import share an in-app modal with inline error/status feedback.

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
