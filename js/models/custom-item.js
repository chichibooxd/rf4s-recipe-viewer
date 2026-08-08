export class CustomItem {
    constructor(baseRecipe) {
        this.baseRecipe = baseRecipe;
        // Initialize 6 slots with base materials, rest are null
        this.slots = [null, null, null, null, null, null];
        for (let i = 0; i < baseRecipe.materials.length; i++) {
            if (i < 6) this.slots[i] = baseRecipe.materials[i];
        }
    }

    // Set a slot (can be a string or another CustomItem)
    setSlot(index, item) {
        if (index >= 0 && index < 6) {
            this.slots[index] = item;
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
                } else {
                    customItem.slots[i] = slotData;
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
