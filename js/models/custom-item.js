export class CustomItem {
    constructor(baseRecipe) {
        this.baseRecipe = baseRecipe;
        // Initialize 6 slots with base materials, rest are null
        this.slots = [null, null, null, null, null, null];
        // A slot is "inherited" when the player explicitly filled it.
        // In-game, only extra/inherited items (max 3) impart their upgrade
        // effects — the recipe's required materials contribute no stats.
        this.inherited = [false, false, false, false, false, false];
        for (let i = 0; i < (baseRecipe.materials || []).length; i++) {
            if (i < 6) this.slots[i] = baseRecipe.materials[i];
        }
    }

    // Set a slot (can be a string or another CustomItem)
    setSlot(index, item) {
        if (index >= 0 && index < 6) {
            this.slots[index] = item;
            this.inherited[index] = true;
        }
    }

    // Convert to a plain object for JSON serialization
    toJSON() {
        return {
            id: this.baseRecipe.id,
            slots: this.slots.map(slot => {
                if (slot instanceof CustomItem) return slot.toJSON();
                return slot; // string or null
            })
        };
    }

    // Reconstruct from JSON using the global appData
    static fromJSON(json, appData) {
        if (!json || !json.id) return null;
        const recipe = appData.recipes.find(r => r.id === json.id);
        if (!recipe) return null;

        const customItem = new CustomItem(recipe);
        if (json.slots && Array.isArray(json.slots)) {
            for (let i = 0; i < 6; i++) {
                const slotData = json.slots[i];
                if (slotData && typeof slotData === 'object') {
                    customItem.slots[i] = CustomItem.fromJSON(slotData, appData);
                    customItem.inherited[i] = true;
                } else {
                    customItem.slots[i] = slotData;
                    // Derived: a slot that differs from the recipe default
                    // was inherited by the player.
                    customItem.inherited[i] = slotData !== (recipe.materials[i] ?? null);
                }
            }
        }
        return customItem;
    }
}

// Stats a slot contributes when used as a crafting material.
// A plain material contributes its own upgrade stats; an inherited
// crafted item contributes its upgrade stats (its own materials do not
// carry over once the item is crafted).
export function slotUpgradeStats(slot, recipeByName) {
    if (slot instanceof CustomItem) {
        return slot.baseRecipe.upgradeStats || null;
    }
    if (typeof slot === 'string') {
        const recipe = recipeByName ? recipeByName.get(slot) : null;
        return (recipe && recipe.upgradeStats) || null;
    }
    return null;
}

// Sum of upgrade stats from the player-inherited slots only.
// In-game, at most 3 extra items impart their effects during crafting;
// the recipe's required materials contribute no stats.
export function inheritedStats(item, recipeByName, maxExtra = 3) {
    const totals = {};
    let count = 0;
    for (let i = 0; i < 6 && count < maxExtra; i++) {
        if (!item.inherited[i] || item.slots[i] == null) continue;
        const stats = slotUpgradeStats(item.slots[i], recipeByName);
        if (stats) {
            Object.entries(stats).forEach(([stat, val]) => {
                totals[stat] = (totals[stat] || 0) + val;
            });
        }
        count++;
    }
    return { stats: totals, count };
}

// Total Difficulty Used (TDU): sum of the difficulty of every material
// used to make the item (recipe materials + inherited items).
export function materialDifficulty(item, recipeByName) {
    let total = 0;
    for (let i = 0; i < 6; i++) {
        const slot = item.slots[i];
        if (slot == null) continue;
        const recipe = slot instanceof CustomItem ? slot.baseRecipe : (recipeByName ? recipeByName.get(slot) : null);
        if (recipe && recipe.difficulty) total += recipe.difficulty;
    }
    return total;
}

// Total Difficulty Used tier bonus (applies at skill level >= 50).
// Weapons gain ATK, other equipment gains DEF.
export function tduBonus(difficulty, isWeapon) {
    const weaponTiers = [10, 30, 80, 150, 300, 500, 1000, 2000];
    const craftTiers = [3, 10, 20, 50, 90, 150, 400, 800];
    const tiers = isWeapon ? weaponTiers : craftTiers;
    return tiers.reduce((bonus, tier) => (difficulty >= tier ? tier : bonus), 0);
}

// Sum numeric stat maps into a single stat map.
export function sumStats(...sources) {
    const totals = {};
    sources.forEach(source => {
        if (!source) return;
        Object.entries(source).forEach(([stat, val]) => {
            totals[stat] = (totals[stat] || 0) + val;
        });
    });
    return totals;
}
