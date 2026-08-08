import assert from 'node:assert';
import { CustomItem } from './js/models/custom-item.js';

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
    
    // Test 2: setSlot
    item.setSlot(2, 'Silver');
    assert.deepStrictEqual(item.slots, ['Iron', 'Bronze', 'Silver', null, null, null]);
    
    const subItem = new CustomItem({id: 2, materials: ['Gold']});
    item.setSlot(3, subItem);
    assert.strictEqual(item.slots[3], subItem);
    
    // Test 3: toJSON
    const json = item.toJSON();
    assert.deepStrictEqual(json, {
        id: 1,
        slots: ['Iron', 'Bronze', 'Silver', {
            id: 2,
            slots: ['Gold', null, null, null, null, null]
        }, null, null]
    });
    
    // Test 4: fromJSON
    const appData = {
        recipes: [
            { id: 1, materials: ['Iron', 'Bronze'] },
            { id: 2, materials: ['Gold'] }
        ]
    };
    const reconstructed = CustomItem.fromJSON(json, appData);
    assert.strictEqual(reconstructed.baseRecipe.id, 1);
    assert.deepStrictEqual(reconstructed.slots[0], 'Iron');
    assert.strictEqual(reconstructed.slots[3] instanceof CustomItem, true);
    assert.strictEqual(reconstructed.slots[3].baseRecipe.id, 2);
    assert.deepStrictEqual(reconstructed.slots[3].slots[0], 'Gold');
    
    console.log("All tests passed!");
}

runTests();
