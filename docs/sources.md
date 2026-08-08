# Sources

Annotated list of every external source used to implement the app's mechanics, with
what each contributed. Primary sources are community datamine/experimentation threads;
Fandom wiki pages are used only as secondary cross-checks.

## Primary sources (GameFAQs, Rune Factory 4 board)

### Kirbye2006 — "RF4 Forging/Crafting/Cooking Mechanic Compilation"
- **URL:** https://gamefaqs.gamespot.com/boards/635388-rune-factory-4/67717309
- **Used for:** the stat model — base stats from recipe (§1), recipe materials only
  feeding Total Level/Difficulty (§2), up-to-3 extra items imparting upgrade effects (§3),
  overwrite mechanics (§4), upgrade effects (§5), and the TLU/TDU tier tables (§6).
- **Status:** the foundation of the equipment stat model; verified by Anketam.

### clepe — "Stats Guide" (GameFAQs FAQ)
- **URL:** https://gamefaqs.gamespot.com/3ds/635388-rune-factory-4/faqs/74139
- **Used for:** the Planner — full stat definitions (STR→ATK, INT→M.ATK, VIT→0.5 DEF +
  0.5 M.DEF), the complete per-skill yield table, the every-50-levels HP multiplier,
  every-300 STR/INT/VIT multiplier, the RP cap at skill 100, per-skill floor rounding,
  and the float-precision note (values slightly below the rounded table).
- **Status:** verified against the data dump's `Skill Stats` sheet row-by-row.

### NeoZephyre — "How to be a Smart(er) Blacksmith Mini-Guide"
- **URL:** https://gamefaqs.gamespot.com/boards/635388-rune-factory-4/68229810
- **Used for:** confirmation of TLU tiers (incl. M.ATK/M.DEF values and the
  "not cumulative" note), the 3-extra-item inheritance rule, rarity tiers (25…200),
  Double Steel (×2) / 10-Fold Steel (×8) behavior, and repeat-upgrade halving.

### ANelson — "RF4 All Topics Mini-Guide: Tips, Descriptions, and Helpful Links"
- **URL:** https://gamefaqs.gamespot.com/boards/635388-rune-factory-4/68399954
- **Used for:** the Broadsword + Iron inheritance example, shield scaling by weapon
  type, RP crafting notes, element stones, and general crafting tips.

### Anketam — "Item Rarity Table" (GameFAQs FAQ)
- **URL:** https://gamefaqs.gamespot.com/3ds/635388-rune-factory-4/faqs/68669
- **Used for:** rarity values (hidden 1–15 per item) and the follow-up armor TDU
  tiers (90/150/400/800 DEF) quoted in Kirbye2006's thread.

## Data dump

- `data/data.json` — compressed game data dump (sheets listed in
  [formulas.md](formulas.md) §4). The authoritative source for all numeric values;
  the community guides were used to interpret it.

## Secondary (cross-checks only)

- Rune Factory Wiki (Fandom) — Crafting/Forging/Upgrading (RF4) pages. Used to
  corroborate mechanics (e.g. 6 craft + 9 upgrade materials, diminishing returns),
  not as a primary authority.

## In the Reddit FAQ post but not (yet) used

- "RF4 All Topics Mini-Guide" follow-ups, the fogu town-event guide, wiki recipe
  lists, and Paladin_Rolan's full Recipe List (candidate for cross-validating the
  recipe data). See `plan/all-in-one-roadmap.md` for what is planned.
