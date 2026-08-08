import { CustomItem, sumStats, inheritedStats, materialDifficulty, tduBonus } from '../models/custom-item.js';
import { attachStatInfo, COMBAT_STAT_ORDER } from '../utils/stat-info.js';

export class LoadoutBuilder {
    constructor(gameData, onSlotEmptyClick, onSlotFilledClick, onNavigate) {
        this.gameData = gameData;
        this.onSlotEmptyClick = onSlotEmptyClick;
        this.onSlotFilledClick = onSlotFilledClick;
        this.onNavigate = onNavigate;
        this.recipeByName = new Map(gameData.recipes.map(recipe => [recipe.name, recipe]));
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
        this.restoreLoadout();
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
            this.persist();
            this.onNavigate('#/loadout');
        } else {
            alert("This item cannot be equipped.");
        }
    }

    removeItem(slot) {
        this.slots[slot] = null;
        this.refresh();
        this.persist();
    }

    // --- localStorage persistence (survives service-worker cache updates) ---

    persist() {
        try {
            const data = {};
            for (const slot in this.slots) {
                if (this.slots[slot]) data[slot] = this.slots[slot].toJSON();
            }
            localStorage.setItem('rf4-loadout', JSON.stringify(data));
        } catch (e) { /* storage unavailable */ }
    }

    restoreLoadout() {
        try {
            const saved = JSON.parse(localStorage.getItem('rf4-loadout') || 'null');
            if (!saved) return;
            for (const slot in this.slots) {
                if (saved[slot]) {
                    this.slots[slot] = CustomItem.fromJSON(saved[slot], this.gameData);
                }
            }
            this.refresh();
        } catch (e) { /* storage unavailable or corrupt data */ }
    }

    renderSlots() {
        this.slotsContainer.replaceChildren();
        const slotFragment = document.createDocumentFragment();
        Object.keys(this.slots).forEach(slot => {
            const item = this.slots[slot];
            const slotElement = document.createElement('div');
            slotElement.className = 'loadout-slot';
            
            const slotTitle = document.createElement('h4');
            slotTitle.textContent = slot;
            slotElement.appendChild(slotTitle);

            if (item) {
                const itemNameEl = document.createElement('div');
                itemNameEl.className = 'item-name';
                itemNameEl.textContent = item instanceof CustomItem ? item.baseRecipe.name : item.name;
                slotElement.appendChild(itemNameEl);

                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-btn';
                removeBtn.textContent = 'X';
                removeBtn.addEventListener('click', () => this.removeItem(slot));
                slotElement.appendChild(removeBtn);
            } else {
                const emptyLabel = document.createElement('div');
                emptyLabel.className = 'empty-text';
                emptyLabel.textContent = 'Empty — tap to equip';
                slotElement.appendChild(emptyLabel);
            }
            
            slotElement.addEventListener('click', (e) => {
                // Ignore if clicked the remove button
                if (e.target.classList.contains('remove-btn')) return;
                
                if (item) {
                    this.onSlotFilledClick(item);
                } else {
                    this.onSlotEmptyClick(slot);
                }
            });

            slotFragment.appendChild(slotElement);
        });
        this.slotsContainer.appendChild(slotFragment);
    }

    renderStats() {
        this.statsGrid.replaceChildren();

        // Game-accurate model:
        // - equipped item contributes its base stats (from the recipe)
        // - only player-inherited slots (max 3 extra items) contribute
        //   their upgrade stats; the recipe's required materials add none
        // - Total Difficulty Used (TDU) tier bonus adds ATK (weapons) or
        //   DEF (other equipment), applies at skill level >= 50
        const contributionParts = [];
        let tduAtk = 0;
        let tduDef = 0;
        Object.values(this.slots).forEach(item => {
            if (!item) return;
            const baseRecipe = item.baseRecipe;
            const isWeapon = this.weaponSubtypes.includes(baseRecipe.subtype);
            const inherited = inheritedStats(item, this.recipeByName);
            const bonus = tduBonus(materialDifficulty(item, this.recipeByName), isWeapon);
            if (isWeapon) tduAtk += bonus;
            else tduDef += bonus;
            const tduEntry = bonus > 0 ? { [isWeapon ? 'ATK' : 'DEF']: bonus } : null;
            contributionParts.push(baseRecipe.baseStats, inherited.stats, tduEntry);
        });
        const totalStats = sumStats(...contributionParts);

        // Show the complete stat list (zeros included) so nothing is hidden
        const boxFragment = document.createDocumentFragment();
        COMBAT_STAT_ORDER.forEach(stat => {
            const statBox = document.createElement('div');
            statBox.className = 'stat-box';
            
            const nameLabel = document.createElement('strong');
            nameLabel.textContent = `${stat}:`;
            
            statBox.appendChild(nameLabel);
            statBox.appendChild(document.createTextNode(` ${totalStats[stat] || 0}`));
            attachStatInfo(statBox, stat, 'general');
            boxFragment.appendChild(statBox);
        });

        if (tduAtk > 0 || tduDef > 0) {
            const note = document.createElement('div');
            note.className = 'stat-note';
            const parts = [];
            if (tduAtk > 0) parts.push(`+${tduAtk} ATK`);
            if (tduDef > 0) parts.push(`+${tduDef} DEF`);
            note.textContent = `Includes Total Difficulty bonus (skill ≥ 50): ${parts.join(', ')}`;
            boxFragment.appendChild(note);
        }

        this.statsGrid.appendChild(boxFragment);
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
        const modal = this.getModal();
        modal.title.textContent = mode === 'export' ? 'Your Loadout Code' : 'Import Loadout Code';
        modal.status.textContent = '';
        modal.status.className = 'modal-status';
        modal.overlay.hidden = false;
        document.getElementById('code-copy-btn').classList.toggle('primary', mode === 'export');
        document.getElementById('code-import-btn').classList.toggle('primary', mode === 'import');
    }

    closeModal() {
        const modal = this.getModal();
        modal.overlay.hidden = true;
        modal.status.textContent = '';
    }

    openExportModal() {
        const modal = this.getModal();
        modal.textarea.value = this.encodeLoadout();
        this.openModal('export');
        modal.textarea.focus();
        modal.textarea.select();
    }

    openImportModal() {
        const modal = this.getModal();
        modal.textarea.value = '';
        this.openModal('import');
        modal.textarea.focus();
    }

    encodeLoadout() {
        const loadoutData = {};
        for (const slot in this.slots) {
            if (this.slots[slot]) {
                loadoutData[slot] = this.slots[slot].toJSON();
            }
        }
        // Use encodeURIComponent to handle unicode safely before btoa
        return btoa(encodeURIComponent(JSON.stringify(loadoutData)));
    }

    decodeLoadout(loadoutCode) {
        const decodedJson = decodeURIComponent(atob(loadoutCode));
        return JSON.parse(decodedJson);
    }

    copyFromModal() {
        const modal = this.getModal();
        const loadoutCode = modal.textarea.value;
        if (!loadoutCode) {
            modal.status.className = 'modal-status error';
            modal.status.textContent = 'Nothing to copy — generate a code first.';
            return;
        }
        navigator.clipboard.writeText(loadoutCode).then(() => {
            modal.status.className = 'modal-status';
            modal.status.textContent = 'Copied to clipboard!';
        }).catch(() => {
            // Non-secure context (file:// or LAN): fall back to manual selection
            modal.textarea.focus();
            modal.textarea.select();
            modal.status.className = 'modal-status';
            modal.status.textContent = 'Copy failed — the text is selected, press copy on your device.';
        });
    }

    importFromModal() {
        const modal = this.getModal();
        const loadoutCode = modal.textarea.value.trim();
        if (!loadoutCode) {
            modal.status.className = 'modal-status error';
            modal.status.textContent = 'Paste a loadout code first.';
            return;
        }
        try {
            const importData = this.decodeLoadout(loadoutCode);
            for (const slot in this.slots) {
                if (importData[slot]) {
                    this.slots[slot] = CustomItem.fromJSON(importData[slot], this.gameData);
                } else {
                    this.slots[slot] = null;
                }
            }
            this.refresh();
            this.persist();
            this.closeModal();
            this.onNavigate('#/loadout');
        } catch (e) {
            console.error(e);
            modal.status.className = 'modal-status error';
            modal.status.textContent = 'Invalid loadout code.';
        }
    }
}
