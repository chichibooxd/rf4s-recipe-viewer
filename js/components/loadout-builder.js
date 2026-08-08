import { CustomItem, slotUpgradeStats, sumStats } from '../models/custom-item.js';

export class LoadoutBuilder {
    constructor(appData, onSlotEmptyClick, onSlotFilledClick, onNavigate) {
        this.appData = appData;
        this.onSlotEmptyClick = onSlotEmptyClick;
        this.onSlotFilledClick = onSlotFilledClick;
        this.onNavigate = onNavigate;
        this.recipeByName = new Map(appData.recipes.map(r => [r.name, r]));
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
        
        document.getElementById('share-loadout-btn').addEventListener('click', () => this.openExportModal());
        document.getElementById('import-loadout-btn').addEventListener('click', () => this.openImportModal());
        document.getElementById('code-copy-btn').addEventListener('click', () => this.copyFromModal());
        document.getElementById('code-import-btn').addEventListener('click', () => this.importFromModal());
        document.getElementById('code-close-btn').addEventListener('click', () => this.closeModal());

        this.renderSlots();
        this.renderStats();
    }

    // Re-render slots and totals (called whenever the loadout screen is shown)
    refresh() {
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

    equipItem(item) {
        const baseRecipe = item instanceof CustomItem ? item.baseRecipe : item;
        const slot = this.getSlotForSubtype(baseRecipe.subtype);
        if (slot) {
            this.slots[slot] = item instanceof CustomItem ? item : new CustomItem(item);
            this.refresh();
            this.onNavigate('#/loadout');
        } else {
            alert("This item cannot be equipped.");
        }
    }

    removeItem(slot) {
        this.slots[slot] = null;
        this.refresh();
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
                nameEl.textContent = item instanceof CustomItem ? item.baseRecipe.name : item.name;
                slotEl.appendChild(nameEl);

                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-btn';
                removeBtn.textContent = 'X';
                removeBtn.addEventListener('click', () => this.removeItem(slot));
                slotEl.appendChild(removeBtn);
            } else {
                const emptyEl = document.createElement('div');
                emptyEl.className = 'empty-text';
                emptyEl.textContent = 'Empty — tap to equip';
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

        // Equipped item contributes its base stats; every slot material
        // (plain material or inherited crafted item) contributes its
        // upgrade stats.
        const contributionLists = [];
        Object.values(this.slots).forEach(item => {
            if (!item) return;
            const parts = [item.baseRecipe.baseStats];
            item.slots.forEach(slot => parts.push(slotUpgradeStats(slot, this.recipeByName)));
            contributionLists.push(parts);
        });
        const totalStats = sumStats(...contributionLists.flat());

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

    // --- Share / Import modal ---

    getModal() {
        if (!this.modal) {
            this.modal = {
                overlay: document.getElementById('code-modal'),
                textarea: document.getElementById('code-textarea'),
                status: document.getElementById('code-modal-status'),
                title: document.getElementById('code-modal-title')
            };
        }
        return this.modal;
    }

    openModal(mode) {
        const m = this.getModal();
        m.title.textContent = mode === 'export' ? 'Your Loadout Code' : 'Import Loadout Code';
        m.status.textContent = '';
        m.status.className = 'modal-status';
        m.overlay.hidden = false;
        document.getElementById('code-copy-btn').classList.toggle('primary', mode === 'export');
        document.getElementById('code-import-btn').classList.toggle('primary', mode === 'import');
    }

    closeModal() {
        const m = this.getModal();
        m.overlay.hidden = true;
        m.status.textContent = '';
    }

    openExportModal() {
        const m = this.getModal();
        m.textarea.value = this.encodeLoadout();
        this.openModal('export');
        m.textarea.focus();
        m.textarea.select();
    }

    openImportModal() {
        const m = this.getModal();
        m.textarea.value = '';
        this.openModal('import');
        m.textarea.focus();
    }

    encodeLoadout() {
        const exportData = {};
        for (const slot in this.slots) {
            if (this.slots[slot]) {
                exportData[slot] = this.slots[slot].toJSON();
            }
        }
        // Use encodeURIComponent to handle unicode safely before btoa
        return btoa(encodeURIComponent(JSON.stringify(exportData)));
    }

    decodeLoadout(code) {
        const jsonString = decodeURIComponent(atob(code));
        return JSON.parse(jsonString);
    }

    copyFromModal() {
        const m = this.getModal();
        const code = m.textarea.value;
        if (!code) {
            m.status.className = 'modal-status error';
            m.status.textContent = 'Nothing to copy — generate a code first.';
            return;
        }
        navigator.clipboard.writeText(code).then(() => {
            m.status.className = 'modal-status';
            m.status.textContent = 'Copied to clipboard!';
        }).catch(() => {
            // Non-secure context (file:// or LAN): fall back to manual selection
            m.textarea.focus();
            m.textarea.select();
            m.status.className = 'modal-status';
            m.status.textContent = 'Copy failed — the text is selected, press copy on your device.';
        });
    }

    importFromModal() {
        const m = this.getModal();
        const code = m.textarea.value.trim();
        if (!code) {
            m.status.className = 'modal-status error';
            m.status.textContent = 'Paste a loadout code first.';
            return;
        }
        try {
            const importData = this.decodeLoadout(code);
            for (const slot in this.slots) {
                if (importData[slot]) {
                    this.slots[slot] = CustomItem.fromJSON(importData[slot], this.appData);
                } else {
                    this.slots[slot] = null;
                }
            }
            this.refresh();
            this.closeModal();
            this.onNavigate('#/loadout');
        } catch (e) {
            console.error(e);
            m.status.className = 'modal-status error';
            m.status.textContent = 'Invalid loadout code.';
        }
    }
}
