# All-in-One RF4S Crafting Tool — Research & Roadmap

Sources reviewed (from the r/runefactory FAQ list): Kirbye2006's mechanic compilation
(GameFAQs 67717309), NeoZephyre's "Smart(er) Blacksmith" guide (GameFAQs 68229810),
ANelson's All Topics Mini-Guide (GameFAQs 68399954), clepe's Stats Guide (GameFAQs FAQ 74139),
Anketam's Item Rarity Table (GameFAQs FAQ 68669). Cross-checked against the app's data dump.

## Data-supported features (ready to build)

### 1. Character Stats Editor + RP/HP/STR/INT/VIT calculation — DATA COMPLETE
- `Level Up` sheet: base stats (Lv.1: 25 HP, 56 RP, 5 STR, 5 INT, 4 VIT) + per-level gains
  (HP Diff / RP Diff / …) and XP-per-level thresholds.
- `Skill Stats` sheet: exact per-skill-level yields (RP 0.25, STR 0.25 for Short Sword,
  Forging RP 0.25/STR 0.5/VIT 0.1, etc.) — including the real float values
  (0.199951 for "0.2", 0.099854 for "0.1") that cause the documented floor-rounding quirks.
- **RP = base RP + Σ(skill level × skill's RP yield)** — matches clepe's formulas exactly.
  Same for HP/STR/INT/VIT (with the every-50-levels HP multiplier and every-300 STR/INT/VIT
  multiplier; RP caps at skill 100).
- STR→ATK, INT→MATK, VIT→0.5 DEF+0.5 MDEF conversions are confirmed by clepe's guide.
- **Note:** skill names in the `Skill Stats` sheet must be taken from row order/IDs, not the
  `craftSubClass` column (it's missing for most rows).

### 2. Crafting RP cost — DATA COMPLETE
- `Skill Action Exp` sheet: Forge 16 RP (6.35% of max RP), Craft 16 RP (6.35%),
  Mix/Chemistry 12 RP (4.76%), Cook 5 RP (3.81%).
- The game's RP cost = flat cost + % of max RP, so max RP (from #1) feeds this directly.

### 3. Upgrade-cost / stat relationships — DATA COMPLETE
- Per-item `diff` (difficulty) and upgrade effects already parsed by the app.
- TDU tier bonus already implemented (skill ≥ 50).

## Features needing formula research (blocked)

### 4. Craft success percentage — FORMULA NOT IN DATA
- Not in any guide or the data dump; it is in-game logic. Community knowledge: success
  depends on skill level vs recipe level + material difficulty (you can attempt recipes
  above your level with reduced odds, and failures can produce Scrap Metal+).
- **Options:** (a) research the decompiled game code, (b) ship an approximation with a
  "approx." label until verified, (c) expose skill/level inputs and show the app's
  confidence range.

### 5. Skill XP gained per craft — FORMULA NOT IN DATA
- `Skill Action Exp` rows for Forge/Craft/Cook/Mix have `Skill XP = 0` — the sheet encodes
  action costs but not XP; the real XP formula (level-difference-based) is game logic.
- `Skill Level Up` sheet has the XP-to-next-level thresholds, so once the per-craft XP
  formula is known, level-up prediction is fully data-supported.

### 6. TLU (Total Level Used) tier bonus — IMPLEMENTED via user-entered levels
- Per-item levels (1–10) are absent from the dump, so the crafting planner lets users
  enter material levels and computes the TLU tiers (30/60/90/120/150 → +10/+25/+70/+200/+700
  ATK weapons; +6/+15/+36/+180/+350 DEF armor, incl. M.ATK/M.DEF).

## Implemented additions (2026-08-08)

- **Full crafting planner view** (on equipment recipe details): material levels (1–10),
  Extra/inheritance checkboxes (max 3), skill level input, and live output of TLU bonus
  (now computable via entered levels), TDU bonus, inherited effects, totals, and RP cost.
- **Elemental stones / cores:** weapon base elements parsed from the `Attribute` column;
  elemental-stone element selection in the planner; Green/Blue/Red/Yellow Core detection
  with the all-four +10% non-elemental resistance note.
- **Overwrite / override planning:** same-category base-stat override, plus Light Ore
  cross-category override (weapons only).
- **Inherited info dissemination:** loadout slots show inherited items and element;
  detail screen keeps the full sections.

## Other aspects worth implementing (from the guides)

- **Double Steel (×2) / 10-Fold Steel (×8)** upgrade multipliers and repeat-upgrade
  halving (50%/25%/12.5%…) — relevant if the tool ever models post-craft upgrading.
- **Recipe lists cross-check:** GameFAQs Recipe List (Paladin_Rolan) can validate the
  recipe data used by the app.

## Suggested build order
1. Stats editor (skill levels → HP/RP/STR/INT/VIT + ATK/DEF/MATK/MDEF conversions) — data-ready
2. Craft RP cost calculator (uses max RP from #1 + Skill Action Exp) — data-ready
3. Crafting planner: recipe + materials + skill → stats, RP cost, inheritance preview — mostly data-ready
4. XP/level-up tracker — needs formula research (#5) or an approximation
5. Success rate — needs formula research (#4)

## Open questions for the user
- Success-rate and XP formulas: research the decompiled code, ship approximations, or wait?
- Should the stats editor live in the loadout tab or become a third tab ("Planner")? *(resolved: dedicated Planner tab)*

## Upcoming changes (requested, in order)
1. **Recipe RP requirement from planner stats:** the recipe detail screen shows the RP cost
   to craft that recipe, computed from the planner's current max RP (Forge/Craft 16 + 6.35%,
   Mix 12 + 4.76%, Cook 5 + 3.81%), including how many crafts the current max RP allows.
2. **Show all stats on Loadout and Planner:** the loadout totals render the complete combat
   stat list (including zero values) instead of only non-zero sums; planner already shows
   the full character stat set.
3. **Persist values in cache (localStorage):** loadout (equipped items + inheritance) saved
   on every change and restored on startup, alongside the already-persisted planner state —
   values survive service-worker cache updates.
4. **Bug — loadout total stats cut off at the bottom:** the totals grid is clipped by the
   bottom tab bar; needs bottom padding inside the scrollable stats section.
