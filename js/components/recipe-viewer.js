import { LoadoutBuilder } from './loadout-builder.js';
import { CustomItem, sumStats, inheritedStats, materialDifficulty, tduBonus } from '../models/custom-item.js';

// Base effects of usable items (dishes, medicine) from the Item Use Values sheet
const USE_COLS = [
    'HP', 'RP', 'HP %', 'RP %', 'HP Max', 'RP Max', 'STR', 'INT', 'VIT',
    'HP Max%', 'RP Max%', 'STR %', 'INT %', 'VIT %', 'Crit%',
    'Knock Res%', 'Crit Res%', 'Psn Res%', 'Seal Res%', 'Par Res%', 'Slp Res%', 'Ftg Res%', 'Sick Res%', 'Fnt Res%',
    'Psn Atk%', 'Seal Atk%', 'Par Atk%', 'Slp Atk%', 'Ftg Atk%', 'Sick Atk%', 'Fnt Atk%',
    'Fire Res%', 'Water Res%', 'Earth Res%', 'Wind Res%', 'Light Res%', 'Dark Res%', 'Love Res%',
    'Perm HP', 'Perm STR', 'Perm INT', 'Perm VIT'
];

// Hidden cooking effects of ingredients from the Upgrade Values sheet
const COOK_COLS = [
    'HP cook', 'RP cook', 'HP% cook', 'RP% cook', 'HP max cook', 'RP max cook',
    'STR cook', 'INT cook', 'VIT cook', 'HP max% cook', 'RP max% cook', 'STR% cook', 'INT% cook', 'VIT% cook',
    'Crit% cook', 'Knock Res% cook', 'Crit Res% cook',
    'Poison Res% cook', 'Seal Res% cook', 'Para Res% cook', 'Sleep Res% cook',
    'Fatigue Res% cook', 'Sick Res% cook', 'Faint Res% cook', 'Poison Atk% cook'
];

export async function initRecipeViewer() {
    let appData = { materials: [], recipes: [] };
    let selectedInputs = ["", "", "", "", "", ""];
    let selectedSkill = "All";
    let selectedSubtype = "All";
    let loadoutBuilder = null;
    let activeTargetSlot = null;
    let currentDetailItem = null;
    let pendingDetailItem = null;
    let recipeById = new Map();
    let recipeByName = new Map();
    let currentRoute = null;
    let previousRoute = null;
    let navigatedSinceLoad = false;

    const inputGrid = document.getElementById('input-grid');
    const recipeList = document.getElementById('recipe-list');
    const detailGrid = document.getElementById('detail-grid');
    const detailTitle = document.getElementById('detail-title');
    const backBtn = document.getElementById('back-btn');
    const resetBtn = document.getElementById('reset-btn');
    const equipBtn = document.getElementById('equip-btn');
    const skillFilter = document.getElementById('skill-filter');
    const subtypeFilter = document.getElementById('subtype-filter');
    const statsContainer = document.getElementById('stats-container');
    const resultsStatus = document.getElementById('results-status');
    const pickBanner = document.getElementById('pick-banner');
    const pickBannerText = document.getElementById('pick-banner-text');

    try {
        const res = await fetch('data/data.json');
        if (!res.ok) throw new Error("Network response was not ok");
        const rawData = await res.json();
        
        appData = processData(rawData);
        recipeById = new Map(appData.recipes.map(r => [r.id, r]));
        recipeByName = new Map(appData.recipes.map(r => [r.name, r]));

        loadoutBuilder = new LoadoutBuilder(appData,
            (slotName) => {
                // Empty slot clicked: navigate to search, filter by subtype
                setPickMode(null);
                if (slotName === 'Weapon') {
                    skillFilter.value = 'Forging';
                    selectedSkill = 'Forging';
                    selectedSubtype = 'All';
                } else {
                    skillFilter.value = 'Crafting';
                    selectedSkill = 'Crafting';
                    selectedSubtype = slotName;
                }
                updateSubtypeDropdown();
                updateMaterialDropdowns();
                filterRecipes();
                navigateTo('#/search');
            },
            (item) => {
                // Filled slot clicked: show recipe details
                openDetail(item);
            },
            (path) => navigateTo(path)
        );

        // Populate Skill Filter
        const uniqueSkills = [...new Set(appData.recipes.map(r => r.skill))].sort();
        const skillFragment = document.createDocumentFragment();
        uniqueSkills.forEach(skill => {
            const opt = document.createElement('option');
            opt.value = skill;
            opt.textContent = skill;
            skillFragment.appendChild(opt);
        });
        skillFilter.appendChild(skillFragment);

        skillFilter.addEventListener('change', (e) => {
            selectedSkill = e.target.value;
            selectedSubtype = "All"; // Reset subtype when skill changes
            updateSubtypeDropdown();
            updateMaterialDropdowns();
            filterRecipes();
        });

        subtypeFilter.addEventListener('change', (e) => {
            selectedSubtype = e.target.value;
            updateMaterialDropdowns();
            filterRecipes();
        });
        
        updateSubtypeDropdown();
        buildSearchGrid();
        buildDetailGrid();
        filterRecipes();

        document.getElementById('pick-cancel-btn').addEventListener('click', () => setPickMode(null));
        backBtn.onclick = () => {
            if (navigatedSinceLoad) {
                history.back();
            } else {
                // App was loaded directly on a detail route: nothing to go back to
                navigateTo('#/search', { replace: true });
            }
        };

        resetBtn.onclick = () => {
            setPickMode(null);
            selectedInputs = ["", "", "", "", "", ""];
            skillFilter.value = "All";
            selectedSkill = "All";
            selectedSubtype = "All";
            updateSubtypeDropdown();
            updateMaterialDropdowns();
            filterRecipes();
        };

        window.addEventListener('hashchange', renderRoute);
        if (!location.hash) {
            history.replaceState(null, '', '#/search');
        }
        renderRoute();
    } catch (error) {
        console.error("Failed to load database:", error);
        alert("Failed to load recipe database. Please refresh.");
    }

    // --- Routing (single source of truth for screen visibility) ---

    function parseHash() {
        const h = location.hash;
        if (h.startsWith('#/recipe/')) {
            return { screen: 'recipe', id: decodeURIComponent(h.slice('#/recipe/'.length)) };
        }
        if (h === '#/loadout') return { screen: 'loadout' };
        return { screen: 'search' };
    }

    function navigateTo(path, { replace = false } = {}) {
        if (location.hash === path) {
            renderRoute();
            return;
        }
        navigatedSinceLoad = true;
        if (replace) {
            history.replaceState(null, '', path);
            renderRoute();
        } else {
            location.hash = path;
        }
    }

    function renderRoute() {
        const route = parseHash();
        previousRoute = currentRoute;
        currentRoute = route;

        // Pick mode never survives navigation away from the search screen
        if (route.screen !== 'search') {
            setPickMode(null);
        }

        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

        if (route.screen === 'recipe') {
            const item = resolveDetailItem(route.id);
            if (!item) {
                navigateTo('#/search', { replace: true });
                return;
            }
            currentDetailItem = item;
            document.getElementById('recipe-screen').classList.add('active');
            showRecipeDetail(item);
        } else if (route.screen === 'loadout') {
            document.getElementById('loadout-screen').classList.add('active');
            loadoutBuilder.refresh();
        } else {
            document.getElementById('search-screen').classList.add('active');
        }

        window.dispatchEvent(new CustomEvent('routechange', { detail: route.screen }));
    }

    // Opens the detail view for the given CustomItem. The item itself is
    // carried through navigation so slot edits (inheritance) survive the
    // pick flow and mutate the original object (e.g. an equipped item).
    function openDetail(item) {
        pendingDetailItem = item;
        navigateTo('#/recipe/' + encodeURIComponent(item.baseRecipe.id));
    }

    function resolveDetailItem(id) {
        const recipe = recipeById.get(id);
        if (!recipe) return null;
        if (pendingDetailItem && pendingDetailItem.baseRecipe.id === id) {
            const item = pendingDetailItem;
            pendingDetailItem = null;
            return item;
        }
        // Same-item back/forward navigation keeps the in-memory instance
        if (currentDetailItem && currentDetailItem.baseRecipe.id === id &&
            previousRoute && previousRoute.screen === 'recipe' && previousRoute.id === id) {
            return currentDetailItem;
        }
        return new CustomItem(recipe);
    }

    // --- Inheritance pick mode ---

    function setPickMode(target) {
        activeTargetSlot = target;
        if (target) {
            pickBannerText.textContent = `Select an item to inherit into material slot ${target.slotIndex + 1}`;
            pickBanner.hidden = false;
        } else {
            pickBanner.hidden = true;
        }
    }

    // --- Data processing ---

    function processData(rawData) {
        const strings = rawData.strings;
        const sheets = rawData.data;
        
        const strToId = {};
        strings.forEach((s, i) => strToId[s] = i);
        
        const recipes = [];
        const materialsSet = new Set();
        const equipmentStats = {};
        const upgradeStats = {};
        const useStats = {};
        const cookStats = {};
        const difficulty = {};
        
        // Parse Equipment List to get stats
        const eqSheetId = strToId['Equipment List'];
        
        const statCols = [
            'ATK', 'MATK', 'DEF', 'MDEF', 'STR', 'INT', 'VIT', 'Diz', 'Crit%', 'Knock%', 'Stun%',
            'Psn Atk%', 'Seal Atk%', 'Par Atk%', 'Slp Atk%', 'Ftg Atk%', 'Sick Atk%', 'Faint Atk%', 'Drain Atk%',
            'Fire Res%', 'Water Res%', 'Earth Res%', 'Wind Res%', 'Light Res%', 'Dark Res%', 'Love Res%',
            'Diz Res%', 'Crt Res%', 'Knock Res%', 'Psn Res%', 'Seal Res%', 'Par Res%', 'Slp Res%', 'Ftg Res%', 'Sick Res%', 'Fnt Res%', 'Drain Res%'
        ];

        if (eqSheetId !== undefined && sheets[eqSheetId]) {
            const eqRows = sheets[eqSheetId];
            const eqHeaders = eqRows[0].map(id => strings[id]);
            const itemIdx = eqHeaders.indexOf('Item');
            const statIndices = statCols.map(col => ({ name: col, idx: eqHeaders.indexOf(col) })).filter(c => c.idx !== -1);
            
            for (let i = 1; i < eqRows.length; i++) {
                const row = eqRows[i];
                if (itemIdx !== -1 && itemIdx < row.length && row[itemIdx] !== 0 && row[itemIdx] !== undefined) {
                    const itemName = strings[row[itemIdx]];
                    const stats = {};
                    statIndices.forEach(col => {
                        if (col.idx < row.length) {
                            const val = row[col.idx];
                            if (val !== 0 && val !== undefined && val !== null) {
                                stats[col.name] = val;
                            }
                        }
                    });
                    if (Object.keys(stats).length > 0) {
                        equipmentStats[itemName] = stats;
                    }
                }
            }
        }

        // Parse Upgrade Values: per-item upgrade effects (combat stats),
        // hidden cooking effects, and difficulty (used for TDU bonuses)
        const upSheetId = strToId['Upgrade Values'];
        if (upSheetId !== undefined && sheets[upSheetId]) {
            const upRows = sheets[upSheetId];
            const upHeaders = rows => rows[0].map(id => strings[id]);
            const headers = upHeaders(upRows);
            const itemIdx = headers.indexOf('Item');
            const statIndices = statCols.map(col => ({ name: col, idx: headers.indexOf(col) })).filter(c => c.idx !== -1);
            const cookIndices = COOK_COLS.map(col => ({ name: col, idx: headers.indexOf(col) })).filter(c => c.idx !== -1);
            const diffIdx = headers.indexOf('Diff');
            
            for (let i = 1; i < upRows.length; i++) {
                const row = upRows[i];
                if (itemIdx !== -1 && itemIdx < row.length && row[itemIdx] !== 0 && row[itemIdx] !== undefined) {
                    const itemName = strings[row[itemIdx]];
                    const stats = {};
                    const cook = {};
                    statIndices.forEach(col => {
                        if (col.idx < row.length) {
                            const val = row[col.idx];
                            if (val !== 0 && val !== undefined && val !== null) {
                                stats[col.name] = val;
                            }
                        }
                    });
                    if (Object.keys(stats).length > 0) {
                        upgradeStats[itemName] = stats;
                    }
                    cookIndices.forEach(col => {
                        if (col.idx < row.length) {
                            const val = row[col.idx];
                            if (val !== 0 && val !== undefined && val !== null) {
                                cook[col.name] = val;
                            }
                        }
                    });
                    if (Object.keys(cook).length > 0) {
                        cookStats[itemName] = cook;
                    }
                    if (diffIdx !== -1 && diffIdx < row.length && typeof row[diffIdx] === 'number') {
                        difficulty[itemName] = row[diffIdx];
                    }
                }
            }
        }

        // Parse Item Use Values: base effects of usable items (dishes, medicine)
        const ivsSheetId = strToId['Item Use Values'];
        if (ivsSheetId !== undefined && sheets[ivsSheetId]) {
            const ivsRows = sheets[ivsSheetId];
            const ivsHeaders = ivsRows[0].map(id => strings[id]);
            const itemIdx = ivsHeaders.indexOf('Item');
            const useIndices = USE_COLS.map(col => ({ name: col, idx: ivsHeaders.indexOf(col) })).filter(c => c.idx !== -1);
            
            for (let i = 1; i < ivsRows.length; i++) {
                const row = ivsRows[i];
                if (itemIdx !== -1 && itemIdx < row.length && row[itemIdx] !== 0 && row[itemIdx] !== undefined) {
                    const itemName = strings[row[itemIdx]];
                    const stats = {};
                    useIndices.forEach(col => {
                        if (col.idx < row.length) {
                            const val = row[col.idx];
                            if (val !== 0 && val !== undefined && val !== null) {
                                stats[col.name] = val;
                            }
                        }
                    });
                    if (Object.keys(stats).length > 0) {
                        useStats[itemName] = stats;
                    }
                }
            }
        }

        const targetSheets = ['Craft Recipes', 'Forge Recipes', 'Cook & Chem Recipes'];
        
        targetSheets.forEach(sheetName => {
            const sheetId = strToId[sheetName];
            if (sheetId === undefined || !sheets[sheetId]) return;
            
            const rows = sheets[sheetId];
            const headers = rows[0].map(id => strings[id]);
            
            const typeIdx = headers.indexOf('Type');
            const recipeIdx = headers.indexOf('Recipe');
            const levelIdx = headers.indexOf('Level');
            const subIdx = headers.indexOf('craftSubClass');
            
            const matIndices = [];
            for (let i = 1; i <= 6; i++) {
                const idx = headers.indexOf(`Material ${i}`);
                if (idx !== -1) matIndices.push(idx);
            }
            
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                
                let typeStr = typeIdx !== -1 && typeIdx < row.length && row[typeIdx] !== 0 && row[typeIdx] !== undefined ? strings[row[typeIdx]] : "Unknown";
                let nameStr = recipeIdx !== -1 && recipeIdx < row.length && row[recipeIdx] !== 0 && row[recipeIdx] !== undefined ? strings[row[recipeIdx]] : "Unknown";
                let subtypeStr = subIdx !== -1 && subIdx < row.length && row[subIdx] !== 0 && row[subIdx] !== undefined ? strings[row[subIdx]] : "Unknown";

                if (!typeStr) typeStr = "Unknown";
                if (!nameStr || nameStr === "Unknown") continue; // Skip placeholders/empties
                
                let skill = "";
                if (sheetName === 'Craft Recipes') {
                    skill = 'Crafting';
                } else if (sheetName === 'Forge Recipes') {
                    skill = 'Forging';
                } else if (sheetName === 'Cook & Chem Recipes') {
                    if (typeStr === 'Chemistry' || subtypeStr === 'Medicine') {
                        skill = 'Chemistry';
                    } else {
                        skill = 'Cooking';
                    }
                }

                let level = levelIdx !== -1 && levelIdx < row.length ? row[levelIdx] : 0;
                if (typeof level !== 'number') {
                    level = strings[level] || 0;
                    level = parseInt(level, 10) || 0;
                }
                
                const materials = [];
                matIndices.forEach(idx => {
                    if (idx < row.length) {
                        const matVal = row[idx];
                        if (matVal !== 0 && matVal !== undefined) {
                            const matName = strings[matVal];
                            if (matName) {
                                materials.push(matName);
                                materialsSet.add(matName);
                            }
                        }
                    }
                });
                
                recipes.push({
                    id: i + '_' + sheetId,
                    skill: skill,
                    type: typeStr,
                    subtype: subtypeStr,
                    name: nameStr,
                    level: level,
                    materials: materials,
                    baseStats: equipmentStats[nameStr] || null,
                    upgradeStats: upgradeStats[nameStr] || null,
                    useStats: useStats[nameStr] || null,
                    cookStats: cookStats[nameStr] || null,
                    difficulty: difficulty[nameStr] || 0
                });
            }
        });
        
        const recipeNames = new Set(recipes.map(r => r.name));
        
        // Parse Item Values to add all other items
        const ivSheetId = strToId['Item Values'];
        if (ivSheetId !== undefined && sheets[ivSheetId]) {
            const ivRows = sheets[ivSheetId];
            const ivHeaders = ivRows[0].map(id => strings[id]);
            const itemIdx = ivHeaders.indexOf('Item');
            const typeIdx = ivHeaders.indexOf('Item Type');
            const catIdx = ivHeaders.indexOf('Category');

            for (let i = 1; i < ivRows.length; i++) {
                const row = ivRows[i];
                if (itemIdx !== -1 && itemIdx < row.length && row[itemIdx] !== 0 && row[itemIdx] !== undefined) {
                    const itemName = strings[row[itemIdx]];
                    if (!recipeNames.has(itemName)) {
                        let typeStr = typeIdx !== -1 && row[typeIdx] ? strings[row[typeIdx]] : 'Ingredient';
                        let catStr = catIdx !== -1 && row[catIdx] ? strings[row[catIdx]] : 'Ingredient';
                        if (typeof typeStr === 'number') typeStr = strings[typeStr] || 'Ingredient';
                        if (typeof catStr === 'number') catStr = strings[catStr] || 'Ingredient';
                        
                        recipes.push({
                            id: 'item_' + (strToId[itemName] || itemName.replace(/\s+/g, '_')),
                            skill: 'Ingredient',
                            type: typeStr,
                            subtype: catStr,
                            name: itemName,
                            level: 0,
                            materials: [],
                            baseStats: equipmentStats[itemName] || null,
                            upgradeStats: upgradeStats[itemName] || null,
                            useStats: useStats[itemName] || null,
                            cookStats: cookStats[itemName] || null,
                            difficulty: difficulty[itemName] || 0
                        });
                        recipeNames.add(itemName);
                    }
                }
            }
        }

        // Add any remaining materials that weren't in Item Values
        materialsSet.forEach(matName => {
            if (!recipeNames.has(matName)) {
                recipes.push({
                    id: 'mat_' + (strToId[matName] || matName.replace(/\s+/g, '_')),
                    skill: 'Ingredient',
                    type: 'Ingredient',
                    subtype: 'Ingredient',
                    name: matName,
                    level: 0,
                    materials: [],
                    baseStats: equipmentStats[matName] || null,
                    upgradeStats: upgradeStats[matName] || null,
                    useStats: useStats[matName] || null,
                    cookStats: cookStats[matName] || null,
                    difficulty: difficulty[matName] || 0
                });
                recipeNames.add(matName);
            }
        });

        // Add any remaining equipment
        Object.keys(equipmentStats).forEach(eqName => {
            if (!recipeNames.has(eqName)) {
                recipes.push({
                    id: 'eq_' + (strToId[eqName] || eqName.replace(/\s+/g, '_')),
                    skill: 'Ingredient',
                    type: 'Equipment',
                    subtype: 'Equipment',
                    name: eqName,
                    level: 0,
                    materials: [],
                    baseStats: equipmentStats[eqName] || null,
                    upgradeStats: upgradeStats[eqName] || null,
                    useStats: useStats[eqName] || null,
                    cookStats: cookStats[eqName] || null,
                    difficulty: difficulty[eqName] || 0
                });
                recipeNames.add(eqName);
            }
        });

        return {
            materials: Array.from(materialsSet).sort(),
            recipes: recipes
        };
    }

    function updateSubtypeDropdown() {
        let validSubtypes = new Set();
        
        if (selectedSkill === "All") {
            appData.recipes.forEach(r => validSubtypes.add(r.subtype));
        } else {
            appData.recipes.forEach(r => {
                if (r.skill === selectedSkill) {
                    validSubtypes.add(r.subtype);
                }
            });
        }
        
        // Remove Unknown if present
        validSubtypes.delete("Unknown");
        
        const validArray = Array.from(validSubtypes).sort();
        
        // Securely replace children
        subtypeFilter.replaceChildren();
        const allOpt = document.createElement('option');
        allOpt.value = "All";
        allOpt.textContent = "All Subtypes";
        subtypeFilter.appendChild(allOpt);
        
        const fragment = document.createDocumentFragment();
        validArray.forEach(sub => {
            const opt = document.createElement('option');
            opt.value = sub;
            opt.textContent = sub;
            fragment.appendChild(opt);
        });
        
        subtypeFilter.appendChild(fragment);
        subtypeFilter.value = selectedSubtype;
    }

    function updateMaterialDropdowns() {
        let validMaterials = new Set();
        
        appData.recipes.forEach(r => {
            const skillMatch = selectedSkill === "All" || r.skill === selectedSkill;
            const subtypeMatch = selectedSubtype === "All" || r.subtype === selectedSubtype;
            
            if (skillMatch && subtypeMatch) {
                r.materials.forEach(m => validMaterials.add(m));
            }
        });
        
        const validArray = Array.from(validMaterials).sort();
        
        const selects = inputGrid.querySelectorAll('select');
        selects.forEach((select, i) => {
            const currentVal = selectedInputs[i];
            
            // Securely replace children
            select.replaceChildren();
            const emptyOpt = document.createElement('option');
            emptyOpt.value = "";
            emptyOpt.textContent = "Empty";
            select.appendChild(emptyOpt);
            
            const fragment = document.createDocumentFragment();
            validArray.forEach(mat => {
                const opt = document.createElement('option');
                opt.value = mat;
                opt.textContent = mat;
                fragment.appendChild(opt);
            });
            select.appendChild(fragment);
            
            if (validArray.includes(currentVal)) {
                select.value = currentVal;
            } else {
                select.value = "";
                selectedInputs[i] = "";
            }
        });
    }

    function buildSearchGrid() {
        for (let i = 0; i < 6; i++) {
            const select = document.createElement('select');
            select.addEventListener('change', (e) => {
                selectedInputs[i] = e.target.value;
                filterRecipes();
            });
            inputGrid.appendChild(select);
        }
        updateMaterialDropdowns();
    }

    function buildDetailGrid() {
        for (let i = 0; i < 6; i++) {
            const slot = document.createElement('div');
            slot.className = 'detail-slot';
            slot.textContent = 'Empty';
            detailGrid.appendChild(slot);
        }
    }

    function filterRecipes() {
        recipeList.replaceChildren();
        const activeFilters = selectedInputs.filter(val => val !== "");
        
        const noFilters = activeFilters.length === 0 && selectedSkill === "All" && selectedSubtype === "All";
        if (noFilters) {
            resultsStatus.textContent = 'Pick a skill, subtype, or materials to search';
            resultsStatus.hidden = false;
            return;
        }

        const userCounts = {};
        activeFilters.forEach(item => { userCounts[item] = (userCounts[item] || 0) + 1; });

        const filtered = appData.recipes.filter(recipe => {
            if (selectedSkill !== "All" && recipe.skill !== selectedSkill) return false;
            if (selectedSubtype !== "All" && recipe.subtype !== selectedSubtype) return false;

            if (activeFilters.length > 0) {
                const recipeCounts = {};
                recipe.materials.forEach(item => { recipeCounts[item] = (recipeCounts[item] || 0) + 1; });
                for (const item in userCounts) {
                    if (!recipeCounts[item] || recipeCounts[item] < userCounts[item]) return false; 
                }
            }
            return true;
        });

        filtered.sort((a, b) => a.level - b.level);

        if (filtered.length === 0) {
            resultsStatus.textContent = 'No recipes match your filters';
            resultsStatus.hidden = false;
            return;
        }
        resultsStatus.hidden = true;

        const fragment = document.createDocumentFragment();
        filtered.forEach(recipe => {
            const li = document.createElement('li');
            li.className = 'recipe-item';
            li.dataset.id = recipe.id;
            const typeLabel = recipe.skill === 'Ingredient'
                ? (recipe.subtype !== 'Unknown' ? recipe.subtype : 'Ingredient')
                : (recipe.subtype !== 'Unknown' ? `${recipe.subtype} Lv.${recipe.level}` : `${recipe.skill} Lv.${recipe.level}`);
            li.textContent = `${recipe.name} — ${typeLabel}`;
            fragment.appendChild(li);
        });
        recipeList.appendChild(fragment);
    }

    recipeList.addEventListener('click', (e) => {
        const el = e.target.closest('.recipe-item');
        if (!el) return;
        const recipe = recipeById.get(el.dataset.id);
        if (!recipe) return;

        if (activeTargetSlot) {
            // Inheritance: Add item to target slot
            activeTargetSlot.customItem.setSlot(activeTargetSlot.slotIndex, new CustomItem(recipe));
            const currentItemToView = activeTargetSlot.customItem;
            setPickMode(null); // clear state
            openDetail(currentItemToView);
        } else {
            // Normal view
            openDetail(new CustomItem(recipe));
        }
    });

    let currentEquipHandler = null;

    // Render a stat grid section into the stats container
    function renderStatSection(heading, entries, extraClass = '') {
        if (!entries || Object.keys(entries).length === 0) return;
        const statsHeading = document.createElement('h3');
        statsHeading.textContent = heading;
        statsContainer.appendChild(statsHeading);
        
        const statsGrid = document.createElement('div');
        statsGrid.className = 'stats-grid';
        
        const fragment = document.createDocumentFragment();
        for (const [statName, statValue] of Object.entries(entries)) {
            const statBox = document.createElement('div');
            statBox.className = 'stat-box' + (extraClass ? ' ' + extraClass : '');
            
            const strongEl = document.createElement('strong');
            strongEl.textContent = `${statName}:`;
            
            statBox.appendChild(strongEl);
            statBox.appendChild(document.createTextNode(` ${statValue}`));
            fragment.appendChild(statBox);
        }
        statsGrid.appendChild(fragment);
        statsContainer.appendChild(statsGrid);
    }

    // Render a full-width note inside a stats grid
    function appendStatNote(grid, text) {
        const note = document.createElement('div');
        note.className = 'stat-note';
        note.textContent = text;
        grid.appendChild(note);
    }

    function showRecipeDetail(item) {
        // item is now always a CustomItem when viewing details
        const recipe = item.baseRecipe;
        detailTitle.textContent = recipe.name;

        // Only equipment supports inheritance in-game (weapons/armor/accessories);
        // food and medicine cannot have items added to them.
        const isEquipment = !!loadoutBuilder && !!loadoutBuilder.getSlotForSubtype(recipe.subtype);
        const isWeapon = isEquipment && loadoutBuilder.weaponSubtypes.includes(recipe.subtype);
        
        const slots = detailGrid.children;
        for (let i = 0; i < 6; i++) {
            const slotVal = item.slots[i];
            
            // Clear slot
            slots[i].textContent = '';
            slots[i].className = 'detail-slot'; // reset class
            slots[i].onclick = null; // clear previous handlers

            if (slotVal) {
                if (slotVal instanceof CustomItem) {
                    slots[i].textContent = `[Inherit] ${slotVal.baseRecipe.name}`;
                    slots[i].classList.add('filled-nested');
                } else {
                    slots[i].textContent = slotVal;
                    slots[i].classList.add('filled-base');
                    // Drill down into the material's own recipe if it has one
                    const matRecipe = recipeByName.get(slotVal);
                    if (matRecipe) {
                        slots[i].classList.add('clickable');
                        slots[i].title = 'View material details';
                        slots[i].onclick = () => openDetail(new CustomItem(matRecipe));
                    }
                }
            } else if (isEquipment) {
                slots[i].textContent = 'Empty (+ Add Item)';
                slots[i].classList.add('empty-fillable');
                slots[i].onclick = () => {
                    setPickMode({ customItem: item, slotIndex: i });
                    navigateTo('#/search', { replace: true });
                };
            } else {
                slots[i].textContent = 'Empty';
            }
        }
        
        statsContainer.replaceChildren();
        
        const baseStatsGrid = document.createElement('div');
        baseStatsGrid.className = 'stats-grid';
        baseStatsGrid.style.marginBottom = '15px';

        const skillBox = document.createElement('div');
        skillBox.className = 'stat-box';
        const skillStrong = document.createElement('strong');
        skillStrong.textContent = 'Skill:';
        skillBox.appendChild(skillStrong);
        skillBox.appendChild(document.createTextNode(` ${recipe.skill}`));
        baseStatsGrid.appendChild(skillBox);

        const levelBox = document.createElement('div');
        levelBox.className = 'stat-box';
        const levelStrong = document.createElement('strong');
        levelStrong.textContent = 'Level:';
        levelBox.appendChild(levelStrong);
        levelBox.appendChild(document.createTextNode(` ${recipe.level}`));
        baseStatsGrid.appendChild(levelBox);

        statsContainer.appendChild(baseStatsGrid);

        if (isEquipment) {
            renderEquipmentStats(item, recipe, isWeapon);
        } else {
            renderFoodStats(recipe);
        }

        if (loadoutBuilder && isEquipment) {
            equipBtn.style.display = 'inline-block';
            if (currentEquipHandler) {
                equipBtn.removeEventListener('click', currentEquipHandler);
            }
            currentEquipHandler = () => loadoutBuilder.equipItem(item);
            equipBtn.addEventListener('click', currentEquipHandler);
        } else {
            equipBtn.style.display = 'none';
        }
    }

    // Equipment: base + inherited-only contributions (max 3 extra items in-game)
    // + Total Difficulty Used (TDU) tier bonus.
    function renderEquipmentStats(item, recipe, isWeapon) {
        renderStatSection('Base Combat Stats', recipe.baseStats);

        const inherited = inheritedStats(item, recipeByName);
        if (inherited.count > 0) {
            renderStatSection('Inheritance Effects', inherited.stats);
            if (inherited.count >= 3) {
                const noteGrid = document.createElement('div');
                noteGrid.className = 'stats-grid';
                appendStatNote(noteGrid, 'In-game only 3 extra items impart their effects — further inherited items are not counted.');
                statsContainer.appendChild(noteGrid);
            }
        }

        // TDU tier bonus (applies at skill >= 50)
        const tdu = materialDifficulty(item, recipeByName);
        const bonus = tduBonus(tdu, isWeapon);
        const tduEntry = bonus > 0 ? { [isWeapon ? 'ATK' : 'DEF']: bonus } : null;

        const totalStats = sumStats(recipe.baseStats, inherited.stats, tduEntry);
        if (Object.keys(totalStats).length > 0 &&
            (Object.keys(inherited.stats).length > 0 || bonus > 0)) {
            const totalHeading = document.createElement('h3');
            totalHeading.textContent = 'Total Stats';
            statsContainer.appendChild(totalHeading);
            
            const totalGrid = document.createElement('div');
            totalGrid.className = 'stats-grid';
            
            const totalFragment = document.createDocumentFragment();
            for (const [statName, statValue] of Object.entries(totalStats)) {
                const statBox = document.createElement('div');
                statBox.className = 'stat-box';
                statBox.classList.add('stat-total');
                
                const strongEl = document.createElement('strong');
                strongEl.textContent = `${statName}:`;
                
                statBox.appendChild(strongEl);
                statBox.appendChild(document.createTextNode(` ${statValue}`));
                totalFragment.appendChild(statBox);
            }
            totalGrid.appendChild(totalFragment);
            if (bonus > 0) {
                appendStatNote(totalGrid, `Includes Total Difficulty bonus (skill ≥ 50): +${bonus} ${isWeapon ? 'ATK' : 'DEF'} (TDU ${tdu})`);
            }
            statsContainer.appendChild(totalGrid);
        }

        // What this item contributes when used as a material in another item
        renderStatSection('As Upgrade Material', recipe.upgradeStats);
    }

    // Food/medicine: base use effects + hidden cooking effects of ingredients.
    // Dish level in-game is the average ingredient level (level data is not
    // available in this dataset), so base effects are shown unscaled.
    function renderFoodStats(recipe) {
        const nonEdible = recipe.materials.some(material => {
            const matRecipe = recipeByName.get(material);
            return !matRecipe || !matRecipe.useStats;
        });

        if (nonEdible) {
            const warningGrid = document.createElement('div');
            warningGrid.className = 'stats-grid';
            appendStatNote(warningGrid, 'This recipe contains non-edible ingredients — in-game the dish\'s base effects become negative (unbalanced).');
            statsContainer.appendChild(warningGrid);
        }

        renderStatSection('Dish Effects (base)', recipe.useStats);

        const cookTotal = sumStats(...recipe.materials.map(material => {
            const matRecipe = recipeByName.get(material);
            return matRecipe ? matRecipe.cookStats : null;
        }));
        if (Object.keys(cookTotal).length > 0) {
            renderStatSection('Ingredient Cooking Effects', cookTotal);
        }
    }

    return {
        getDetailItem: () => currentDetailItem,
        resetFilters: () => resetBtn.onclick(),
        refreshLoadout: () => loadoutBuilder.refresh(),
        isPickMode: () => !!activeTargetSlot,
        cancelPickMode: () => setPickMode(null)
    };
}
