# RF4S Recipe Viewer — Formula Reference

Every calculation the app performs, its exact formula, the data it reads, and the
community research it is based on. Data references are to the compressed dump in
`data/data.json` (sheet names resolve via the global `strings` table). Community
references are listed in full in [sources.md](sources.md).

---

## 1. Equipment Stats (Recipe Detail & Loadout Totals)

### 1.1 Base stats

```
baseStats(item) = non-zero combat stat columns of the item's row in the 'Equipment List' sheet
```

- **Data:** `Equipment List` sheet, columns ATK, MATK, DEF, MDEF, STR, INT, VIT, Diz,
  Crit%, Knock%, Stun%, status/attack chances, elemental and status resistances.
- **Source:** Kirbye2006 §1 — "The recipe used to create an item determine the Base Stats."

### 1.2 Inherited (extra-item) contributions

```
inheritedStats(item) = Σ upgradeStats(slot)  for each slot where item.inherited[i] is true
                       capped at the first 3 inherited slots
slotUpgradeStats(slot) =
    slot is a crafted item  → that item's recipe.upgradeStats   (its own materials do NOT carry over)
    slot is a plain material → upgradeStats of that material
required recipe materials contribute 0  (they are not inherited)
```

- A slot is flagged inherited when the player fills it (pick mode), or — on loadout
  import — when the stored slot value differs from the recipe's default material.
- **Data:** `Upgrade Values` sheet = each item's upgrade effect.
- **Sources:** Kirbye2006 §3 ("Extra items… impart their Upgrade Effect… as if they were
  used to upgrade"), §5; NeoZephyre §III ("Up to three items can be added");
  ANelson (All Topics, Crafting section — Broadsword example: 3 extra Iron → DEF+3).
- **Implementation:** `js/models/custom-item.js` (`inherited` flags, `inheritedStats`).

### 1.3 Total Difficulty Used (TDU) tier bonus

```
TDU = Σ difficulty(material)   over all 6 slots (required materials AND inherited items)
      difficulty from the 'Diff' column of the 'Upgrade Values' sheet

bonus = largest weapon tier ≤ TDU  →  ATK+   (weapons)
      = largest craft tier   ≤ TDU  →  DEF+  (shields, headgear, armor, shoes, accessories)
weapon tiers: 10 → +10, 30 → +30, 80 → +80, 150 → +150, 300 → +300, 500 → +500, 1000 → +1000, 2000 → +2000 ATK
craft tiers:   3 → +3,  10 → +10, 20 → +20, 50 → +50, 90 → +90, 150 → +150, 400 → +400, 800 → +800 DEF

The bonus only applies in-game when the corresponding skill is ≥ 50; the app shows it with that condition.
```

- **Data:** `Diff` column of `Upgrade Values` (e.g. Iron = 2, Bronze = 15).
- **Sources:** Kirbye2006 §6 (weapon tiers + crafting tiers 3/10/20/50), Anketam's
  follow-up (craft tiers 90/150/400/800), NeoZephyre §II (bonuses "are not cumulative").
- **Implementation:** `materialDifficulty`, `tduBonus` in `js/models/custom-item.js`.

### 1.4 Total Level Used (TLU) tier bonus — NOT implemented

```
TLU = Σ level(material)  — thresholds 30/60/90/120/150
weapons: +10/+25/+70/+200/+700 ATK and +5/+10/+40/+180/+650 MATK
craft:   +6/+15/+36/+180/+350 DEF and +5/+12/+28/+170/+350 MDEF
```

- **Why not implemented:** per-item levels (1–10) are absent from the data dump.
- **Sources:** Kirbye2006 §6; NeoZephyre §II (full tables incl. M.ATK/M.DEF).

---

## 2. Cooking & Medicine (Recipe Detail)

### 2.1 Dish base effects

```
useStats(item) = non-zero value columns of the item's row in the 'Item Use Values' sheet
                 (HP, RP, HP %, RP %, HP Max, RP Max, STR/INT/VIT, percentage buffs, resistances, perm bonuses)
```

- Shown unscaled: in-game the dish's base effects scale with the dish level, and the
  dish level is the **average of the ingredient levels** — per-item levels are not in the
  dump, so exact scaling is not computed.
- **Source:** Kirbye2006, Part Two §1–2 (level = average ingredient level; recipe
  determines base stats).

### 2.2 Ingredient cooking effects

```
cookTotal(recipe) = Σ cookStats(ingredient)   for all recipe materials
cookStats(item) = the '... cook' columns of the item's row in the 'Upgrade Values' sheet
                  (HP cook, RP cook, STR cook, INT cook, VIT cook, …)
```

- Every item has a hidden cooking effect that always applies when used as an ingredient;
  the dish's total effect = base + Σ ingredient effects.
- **Data:** `Upgrade Values` cook columns (e.g. Cabbage `HP cook: 140, INT cook: 2`,
  Cucumber `HP cook: 55, VIT cook: 2`).
- **Source:** Kirbye2006, Part Two §3.

### 2.3 Non-edible ingredients

```
nonEdible(recipe) = any material with no 'Item Use Values' entry
```

- When a recipe contains a non-edible ingredient (ores, monster parts, etc.), the app
  flags it: in-game the dish's base stats are overwritten with a negative effect that
  scales with level ("unbalanced").
- **Source:** Kirbye2006, Part Two §3 ("If even one of these is included in a recipe,
  the Base Stats of the cooked item are over-written to have a negative effect").

---

## 3. Character Planner (`#/planner`)

### 3.1 Base stats at character level

```
levelStats[level] = row of the 'Level Up' sheet
                    { xp, hp, rp, str, int, vit }
```

- Level 1 = 25 HP / 56 RP / 5 STR / 5 INT / 4 VIT; 200 levels in the sheet.
- **Data:** `Level Up` sheet. **Source:** clepe §"How does one raise STR, VIT and INT?"

### 3.2 Skill stat yields

```
contribution(stat) per skill =
    floor( yield × level × multiplier )

yield  = the skill's per-level stat value from the 'Skill Stats' sheet (38 skills,
         identified by row index; the craftSubClass column is unreliable)
multiplier (HP)      = 1 + floor((level − 1) / 50)      — HP yields double every 50 skill levels
multiplier (STR/INT/VIT) = 1 + floor((level − 1) / 300) — double every 300
multiplier (RP)      = 1, with the level capped at 100  — RP yields cap at skill level 100

Final stat = levelStats[level].stat + Σ contributions over all skills
```

- Per-skill contributions floor **individually** before summing (clepe's rounding rule).
- The sheet stores the true in-game float values (e.g. `0.199951` for "0.2",
  `0.099854` for "0.1", `0.299805` for "0.3") — slightly below the rounded table
  values, which is what produces the documented rounding behavior.
- **Data:** `Skill Stats` sheet. **Sources:** clepe (full table + multipliers +
  cap/rounding rules); verified against his worked examples (Mining 50 → 75 HP;
  Axe/Hammer 600 → 605 STR; 601 → 1206 STR).
- **Implementation:** `computeCharacterStats` in `js/components/planner.js`.

### 3.3 Derived combat stats

```
ATK  = STR            (1 STR = +1 ATK)
M.ATK = INT           (1 INT = +1 M.ATK)
DEF  = floor(VIT / 2) (1 VIT = +0.5 DEF)
M.DEF = floor(VIT / 2)(1 VIT = +0.5 M.DEF)
```

- Equipment ATK/DEF/MATK/MDEF add on top of these.
- **Source:** clepe §"Stats: What are they?".

### 3.4 Craft RP cost

```
craftRpCost(action, maxRP) = flat + round(maxRP × pct)

action        flat RP   % of max RP      source row
Forge         16        6.349206349206%  'Skill Action Exp' (Action = "Forge")
Craft         16        6.349206349206%  (Action = "Craft")
Mix (Chem.)   12        4.761904761905%  (Action = "Mix")
Cook           5        3.809523809524%  (Action = "Cook")

crafts until empty = floor(maxRP / craftRpCost)
```

- **Data:** `Skill Action Exp` sheet (RP Cost + RP % Cost columns). The exact
  integer rounding (floor vs round) is not documented; `Math.round` is used.
- **Implementation:** `parseCraftCosts`, `craftRpCost` in `js/components/planner.js`.

### 3.5 Craft success percentage & XP gained — NOT implemented

- The `Skill Action Exp` rows for Forge/Craft/Mix/Cook carry `Skill XP = 0`, and no
  success-rate or XP formula is published in the guides or present in the dump —
  both are in-game logic. The `Skill Level Up` sheet (99 rows) does provide the
  XP-to-next-level thresholds, so once the per-craft XP formula is known, level-up
  prediction becomes fully data-supported.
- **Sources:** Kirbye2006, NeoZephyre, ANelson (none publish the formulas);
  see `plan/all-in-one-roadmap.md` §4–5.

---

## 4. Data sheets used

| Sheet                    | Used for                                        |
|--------------------------|-------------------------------------------------|
| `Equipment List`         | base combat stats (baseStats)                   |
| `Upgrade Values`         | upgrade effects, cooking effects, difficulty    |
| `Item Use Values`        | dish/medicine base effects, edibility           |
| `Item Values`            | ingredient/equipment item registry              |
| `Craft/Forge/Cook & Chem Recipes` | recipes, materials, levels, subtypes   |
| `Level Up`               | character base stats + per-level gains          |
| `Skill Stats`            | per-skill stat yields (38 skills)               |
| `Skill Action Exp`       | craft RP costs (flat + % of max RP)             |
| `Skill Level Up`         | XP-to-next-level thresholds (planner future use)|

## 5. Known approximations

- Craft RP cost integer rounding (`Math.round`) — exact game rounding undocumented.
- Dish base effects shown unscaled (level scaling needs ingredient levels, absent from
  the dump).
- In-game, recipes with 4+ required materials randomly promote one of them to an
  "extra" item; the app deterministically counts only player-inherited slots.
- TDU bonus shown unconditionally with the "skill ≥ 50" condition (the app cannot know
  the player's skill).
