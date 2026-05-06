export class LoadoutBuilder {
    constructor(appData, onSlotEmptyClick, onSlotFilledClick) {
        this.appData = appData;
        this.onSlotEmptyClick = onSlotEmptyClick;
        this.onSlotFilledClick = onSlotFilledClick;
        this.slots = {
            Weapon: null,
            Shield: null,
            Headgear: null,
            Armor: null,
            Shoes: null,
            Accessory: null
        };
        
        this.weaponSubtypes = [
            'Short Sword', 'Long Sword', 'Spear', 'Axe', 'Hammer', 
            'Dual Blade', 'Fist', 'Staff', 'Tool'
        ];

        this.initUI();
    }

    initUI() {
        this.slotsContainer = document.getElementById('loadout-slots');
        this.statsGrid = document.getElementById('loadout-stats-grid');
        
        document.getElementById('share-loadout-btn').addEventListener('click', () => this.exportLoadout());
        document.getElementById('import-loadout-btn').addEventListener('click', () => this.importLoadout());

        this.renderSlots();
        this.renderStats();
    }

    getSlotForSubtype(subtype) {
        if (this.weaponSubtypes.includes(subtype)) return 'Weapon';
        if (subtype === 'Shield') return 'Shield';
        if (subtype === 'Headgear') return 'Headgear';
        if (subtype === 'Armor') return 'Armor';
        if (subtype === 'Shoes') return 'Shoes';
        if (subtype === 'Accessory') return 'Accessory';
        return null;
    }

    equipItem(recipe) {
        const slot = this.getSlotForSubtype(recipe.subtype);
        if (slot) {
            this.slots[slot] = recipe;
            this.renderSlots();
            this.renderStats();
            // Switch to loadout screen
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('loadout-screen').classList.add('active');
        } else {
            alert("This item cannot be equipped.");
        }
    }

    removeItem(slot) {
        this.slots[slot] = null;
        this.renderSlots();
        this.renderStats();
    }

    renderSlots() {
        this.slotsContainer.replaceChildren();
        const fragment = document.createDocumentFragment();
        Object.keys(this.slots).forEach(slot => {
            const item = this.slots[slot];
            const slotEl = document.createElement('div');
            slotEl.className = 'loadout-slot';
            
            const titleEl = document.createElement('h4');
            titleEl.textContent = slot;
            slotEl.appendChild(titleEl);

            if (item) {
                const nameEl = document.createElement('div');
                nameEl.className = 'item-name';
                nameEl.textContent = item.name;
                slotEl.appendChild(nameEl);

                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-btn';
                removeBtn.textContent = 'X';
                removeBtn.addEventListener('click', () => this.removeItem(slot));
                slotEl.appendChild(removeBtn);
            } else {
                const emptyEl = document.createElement('div');
                emptyEl.className = 'empty-text';
                emptyEl.textContent = 'Empty';
                slotEl.appendChild(emptyEl);
            }
            
            slotEl.addEventListener('click', (e) => {
                // Ignore if clicked the remove button
                if (e.target.classList.contains('remove-btn')) return;
                
                if (item) {
                    this.onSlotFilledClick(item);
                } else {
                    this.onSlotEmptyClick(slot);
                }
            });

            fragment.appendChild(slotEl);
        });
        this.slotsContainer.appendChild(fragment);
    }

    renderStats() {
        this.statsGrid.replaceChildren();
        const totalStats = {};

        Object.values(this.slots).forEach(item => {
            if (item && item.stats) {
                Object.entries(item.stats).forEach(([stat, val]) => {
                    totalStats[stat] = (totalStats[stat] || 0) + val;
                });
            }
        });

        if (Object.keys(totalStats).length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'empty-text';
            emptyEl.textContent = 'No stats available';
            this.statsGrid.appendChild(emptyEl);
            return;
        }

        const fragment = document.createDocumentFragment();
        Object.entries(totalStats).forEach(([stat, val]) => {
            const statBox = document.createElement('div');
            statBox.className = 'stat-box';
            
            const strongEl = document.createElement('strong');
            strongEl.textContent = `${stat}:`;
            
            statBox.appendChild(strongEl);
            statBox.appendChild(document.createTextNode(` ${val}`));
            fragment.appendChild(statBox);
        });
        this.statsGrid.appendChild(fragment);
    }

    exportLoadout() {
        const ids = Object.keys(this.slots).map(slot => this.slots[slot] ? this.slots[slot].id : "");
        const code = btoa(ids.join('|'));
        navigator.clipboard.writeText(code).then(() => {
            alert('Loadout code copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy code: ', err);
            alert('Failed to copy code. Code: ' + code);
        });
    }

    importLoadout() {
        const code = prompt("Enter loadout code:");
        if (!code) return;
        try {
            const ids = atob(code).split('|');
            if (ids.length !== 6) throw new Error("Invalid loadout format");
            
            const slotKeys = Object.keys(this.slots);
            ids.forEach((id, index) => {
                if (id) {
                    const recipe = this.appData.recipes.find(r => r.id === id);
                    if (recipe) {
                        this.slots[slotKeys[index]] = recipe;
                    }
                } else {
                    this.slots[slotKeys[index]] = null;
                }
            });
            this.renderSlots();
            this.renderStats();
            this.toggleSidebar(true);
        } catch (e) {
            alert('Invalid loadout code.');
        }
    }
}
