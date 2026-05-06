export class LoadoutBuilder {
    constructor(appData) {
        this.appData = appData;
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
        this.overlay = document.getElementById('loadout-overlay');
        this.sidebar = document.getElementById('loadout-sidebar');
        this.slotsContainer = document.getElementById('loadout-slots');
        this.statsGrid = document.getElementById('loadout-stats-grid');
        
        document.getElementById('toggle-loadout-btn').addEventListener('click', () => this.toggleSidebar(true));
        document.getElementById('close-loadout-btn').addEventListener('click', () => this.toggleSidebar(false));
        this.overlay.addEventListener('click', () => this.toggleSidebar(false));
        
        document.getElementById('share-loadout-btn').addEventListener('click', () => this.exportLoadout());
        document.getElementById('import-loadout-btn').addEventListener('click', () => this.importLoadout());

        this.renderSlots();
        this.renderStats();
    }

    toggleSidebar(show) {
        if (show) {
            this.sidebar.classList.add('active');
            this.overlay.classList.add('active');
        } else {
            this.sidebar.classList.remove('active');
            this.overlay.classList.remove('active');
        }
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
            this.toggleSidebar(true);
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
        this.slotsContainer.innerHTML = '';
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
            this.slotsContainer.appendChild(slotEl);
        });
    }

    renderStats() {
        this.statsGrid.innerHTML = '';
        const totalStats = {};

        Object.values(this.slots).forEach(item => {
            if (item && item.stats) {
                Object.entries(item.stats).forEach(([stat, val]) => {
                    totalStats[stat] = (totalStats[stat] || 0) + val;
                });
            }
        });

        if (Object.keys(totalStats).length === 0) {
            this.statsGrid.innerHTML = '<div class="empty-text">No stats available</div>';
            return;
        }

        Object.entries(totalStats).forEach(([stat, val]) => {
            const statBox = document.createElement('div');
            statBox.className = 'stat-box';
            statBox.innerHTML = `<strong>${stat}:</strong> ${val}`;
            this.statsGrid.appendChild(statBox);
        });
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
