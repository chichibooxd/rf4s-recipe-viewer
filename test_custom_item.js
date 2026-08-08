import assert from 'node:assert';
import { CustomItem, inheritedStats, materialDifficulty, tduBonus, slotUpgradeStats, sumStats } from './js/models/custom-item.js';

function runTests() {
    console.log("Running CustomItem tests...");
    
    // Test 1: Instantiation
    const baseRecipe = {
        id: 1,
        materials: ['Iron', 'Bronze']
    };
    
    const item = new CustomItem(baseRecipe);
    assert.strictEqual(item.baseRecipe, baseRecipe);
    assert.deepStrictEqual(item.slots, ['Iron', 'Bronze', null, null, null, null]);
    assert.deepStrictEqual(item.inherited, [false, false, false, false, false, false]);
    
    // Test 2: setSlot
    item.setSlot(2, 'Silver');
    assert.deepStrictEqual(item.slots, ['Iron', 'Bronze', 'Silver', null, null, null]);
    assert.deepStrictEqual(item.inherited, [false, false, true, false, false, false]);
    
    const subItem = new CustomItem({id: 2, materials: ['Gold']});
    item.setSlot(3, subItem);
    assert.strictEqual(item.slots[3], subItem);
    assert.strictEqual(item.inherited[3], true);
    
    // Test 3: toJSON
    const json = item.toJSON();
    assert.deepStrictEqual(json, {
        id: 1,
        slots: ['Iron', 'Bronze', 'Silver', {
            id: 2,
            slots: ['Gold', null, null, null, null, null]
        }, null, null]
    });
    
    // Test 4: fromJSON (inherited flags derived from non-default slots)
    const appData = {
        recipes: [
            { id: 1, materials: ['Iron', 'Bronze'] },
            { id: 2, materials: ['Gold'], upgradeStats: { DEF: 10 } }
        ]
    };
    const reconstructed = CustomItem.fromJSON(json, appData);
    assert.strictEqual(reconstructed.baseRecipe.id, 1);
    assert.deepStrictEqual(reconstructed.slots[0], 'Iron');
    assert.strictEqual(reconstructed.slots[3] instanceof CustomItem, true);
    assert.strictEqual(reconstructed.slots[3].baseRecipe.id, 2);
    assert.deepStrictEqual(reconstructed.slots[3].slots[0], 'Gold');
    // recipe default slots are not inherited; modified/extra slots are
    assert.deepStrictEqual(reconstructed.inherited, [false, false, true, true, false, false]);

    // Test 5: inheritedStats — only inherited slots contribute, capped at 3
    const recipeByName = new Map([
        ['Iron', { upgradeStats: { DEF: 1 } }],
        ['Bronze', { upgradeStats: { DEF: 4 } }],
        ['Silver', { upgradeStats: { DEF: 7 } }],
        ['Gold', { upgradeStats: { DEF: 10 } }]
    ]);
    let res = inheritedStats(reconstructed, recipeByName);
    assert.deepStrictEqual(res.stats, { DEF: 17 }); // Silver (7) + Gold as material (10)
    assert.strictEqual(res.count, 2);
    // Recipe materials (Iron, Bronze) contribute nothing

    // Test 6: inherited cap at 3
    const crowded = new CustomItem({ id: 3, materials: ['Iron'] });
    ['Gold', 'Silver', 'Bronze', 'Iron'].forEach((m, i) => crowded.setSlot(i, m));
    res = inheritedStats(crowded, recipeByName);
    assert.deepStrictEqual(res.stats, { DEF: 21 }); // 10 + 7 + 4, 4th ignored
    assert.strictEqual(res.count, 3);

    // Test 7: nested CustomItem contributes its own upgrade stats only
    const nestedAppData = {
        recipes: [{ id: 9, materials: ['Gold', 'Iron'], upgradeStats: { ATK: 5 } }]
    };
    const nested = new CustomItem({ id: 8, materials: ['Iron'] });
    nested.setSlot(1, CustomItem.fromJSON({ id: 9, slots: ['Gold', 'Iron', null, null, null, null] }, nestedAppData));
    const nestedByName = new Map([
        ['Iron', { upgradeStats: { DEF: 1 } }],
        ['Gold', { upgradeStats: { DEF: 10 } }]
    ]);
    res = inheritedStats(nested, nestedByName);
    // inherited slot 1 = crafted item with upgradeStats ATK 5; its own slots (Gold/Iron) do not carry over
    assert.deepStrictEqual(res.stats, { ATK: 5 });

    // Test 8: materialDifficulty — all materials (recipe + inherited) count
    const diffData = new Map([
        ['Iron', { difficulty: 2 }],
        ['Bronze', { difficulty: 2 }],
        ['Silver', { difficulty: 4 }]
    ]);
    assert.strictEqual(materialDifficulty(reconstructed, diffData), 8); // Iron(2) + Bronze(2) + Silver(4) + nested item(0)

    // Test 9: tduBonus tiers
    assert.strictEqual(tduBonus(4, true), 0);
    assert.strictEqual(tduBonus(10, true), 10);
    assert.strictEqual(tduBonus(45, true), 30);
    assert.strictEqual(tduBonus(2000, true), 2000);
    assert.strictEqual(tduBonus(49, false), 20);
    assert.strictEqual(tduBonus(800, false), 800);

    // Test 10: sumStats and slotUpgradeStats
    assert.deepStrictEqual(sumStats({ ATK: 5 }, { DEF: 1 }, { ATK: 2 }), { ATK: 7, DEF: 1 });
    assert.deepStrictEqual(slotUpgradeStats('Iron', recipeByName), { DEF: 1 });
    assert.deepStrictEqual(slotUpgradeStats(new CustomItem({ id: 9, upgradeStats: { ATK: 5 } }, ), recipeByName), { ATK: 5 });
    assert.strictEqual(slotUpgradeStats('Missing', recipeByName), null);
    
    console.log("All tests passed!");
}

runTests();
