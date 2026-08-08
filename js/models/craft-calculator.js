// Crafting-plan calculator: TLU (Total Level Used) bonuses, elemental
// stones, and core resistances. Formulas follow Kirbye2006 §6 and
// NeoZephyre's Blacksmith guide (GameFAQs 67717309 / 68229810).

// Total Level Used tiers (bonuses are not cumulative — the largest
// reached tier applies). Weapons gain ATK/MATK, crafted gear DEF/MDEF.
const TLU_WEAPON_TIERS = [
    { tlu: 30, atk: 10, matk: 5 },
    { tlu: 60, atk: 25, matk: 10 },
    { tlu: 90, atk: 70, matk: 40 },
    { tlu: 120, atk: 200, matk: 180 },
    { tlu: 150, atk: 700, matk: 650 }
];
const TLU_CRAFT_TIERS = [
    { tlu: 30, def: 6, mdef: 5 },
    { tlu: 60, def: 15, mdef: 12 },
    { tlu: 90, def: 36, mdef: 28 },
    { tlu: 120, def: 180, mdef: 170 },
    { tlu: 150, def: 350, mdef: 350 }
];

export function tluBonus(totalLevelUsed, isWeapon) {
    const tiers = isWeapon ? TLU_WEAPON_TIERS : TLU_CRAFT_TIERS;
    const reached = tiers.filter(tier => totalLevelUsed >= tier.tlu).pop();
    if (!reached) return {};
    const { tlu, ...bonus } = reached;
    return bonus;
}

// Items used as elemental stones (change the weapon's element) and the
// cores that grant non-elemental resistance when all four are present.
export const ELEMENTAL_STONES = ['Fire Stone', 'Water Stone', 'Earth Stone', 'Wind Stone'];
export const ELEMENTS = ['Fire', 'Water', 'Earth', 'Wind', 'Light', 'Dark', 'Love'];
export const CORE_ITEMS = ['Green Core', 'Blue Core', 'Red Core', 'Yellow Core'];

// Count how many distinct core types are among the given materials.
export function detectCores(materials) {
    const present = new Set((materials || []).filter(m => CORE_ITEMS.includes(m)));
    return {
        count: present.size,
        allFour: present.size === 4
    };
}
