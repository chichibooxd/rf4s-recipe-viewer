import { LoadoutBuilder } from './loadout-builder.js';
import { CustomItem, sumStats, inheritedStats, materialDifficulty, tduBonus, slotUpgradeStats } from '../models/custom-item.js';
import { attachStatInfo } from '../utils/stat-info.js';
import { initPlanner, getCraftRpCostForSkill, getPlannerMaxRp, getSkillLevel } from './planner.js';
import { tluBonus, detectCores, ELEMENTS } from '../models/craft-calculator.js';

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
    let gameData = { materials: [], recipes: [] };
    let selectedMaterials = ["", "", "", "", "", ""];
    let selectedSkill = "All";
    let selectedSubtype = "All";
    let loadoutBuilder = null;
    let inheritanceTarget = null;
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
        
        gameData = processData(rawData);
        recipeById = new Map(gameData.recipes.map(r => [r.id, r]));
        recipeByName = new Map(gameData.recipes.map(r => [r.name, r]));

        initPlanner(rawData);

        loadoutBuilder = new LoadoutBuilder(gameData,
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
        const uniqueSkills = [...new Set(gameData.recipes.map(r => r.skill))].sort();
        const skillFragment = document.createDocumentFragment();
        uniqueSkills.forEach(skill => {
            const optionElement = document.createElement('option');
            optionElement.value = skill;
            optionElement.textContent = skill;
            skillFragment.appendChild(optionElement);
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
            selectedMaterials = ["", "", "", "", "", ""];
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
        if (h === '#/planner') return { screen: 'planner' };
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
        } else if (route.screen === 'planner') {
            document.getElementById('planner-screen').classList.add('active');
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
        inheritanceTarget = target;
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
        
        const stringToIndex = {};
        strings.forEach((s, i) => stringToIndex[s] = i);
        
        const recipes = [];
        const materialNames = new Set();
        const baseStatsByItem = {};
        const upgradeEffectsByItem = {};
        const useEffectsByItem = {};
        const cookEffectsByItem = {};
        const difficultyByItem = {};
        const elementByItem = {};
        
        // Parse Equipment List to get stats
        const equipmentSheetId = stringToIndex['Equipment List'];
        
        const statColumns = [
            'ATK', 'MATK', 'DEF', 'MDEF', 'STR', 'INT', 'VIT', 'Diz', 'Crit%', 'Knock%', 'Stun%',
            'Psn Atk%', 'Seal Atk%', 'Par Atk%', 'Slp Atk%', 'Ftg Atk%', 'Sick Atk%', 'Faint Atk%', 'Drain Atk%',
            'Fire Res%', 'Water Res%', 'Earth Res%', 'Wind Res%', 'Light Res%', 'Dark Res%', 'Love Res%',
            'Diz Res%', 'Crt Res%', 'Knock Res%', 'Psn Res%', 'Seal Res%', 'Par Res%', 'Slp Res%', 'Ftg Res%', 'Sick Res%', 'Fnt Res%', 'Drain Res%'
        ];

        if (equipmentSheetId !== undefined && sheets[equipmentSheetId]) {
            const equipmentRows = sheets[equipmentSheetId];
            const equipmentHeaders = equipmentRows[0].map(id => strings[id]);
            const itemColumnIndex = equipmentHeaders.indexOf('Item');
            const statColumnIndices = statColumns.map(col => ({ name: col, index: equipmentHeaders.indexOf(col) })).filter(c => c.index !== -1);
            const attributeColumnIndex = equipmentHeaders.indexOf('Attribute');
            
            for (let i = 1; i < equipmentRows.length; i++) {
                const row = equipmentRows[i];
                if (itemColumnIndex !== -1 && itemColumnIndex < row.length && row[itemColumnIndex] !== 0 && row[itemColumnIndex] !== undefined) {
                    const itemName = strings[row[itemColumnIndex]];
                    const statValues = {};
                    statColumnIndices.forEach(column => {
                        if (column.index < row.length) {
                            const value = row[column.index];
                            if (value !== 0 && value !== undefined && value !== null) {
                                statValues[column.name] = value;
                            }
                        }
                    });
                    if (Object.keys(statValues).length > 0) {
                        baseStatsByItem[itemName] = statValues;
                    }
                    if (attributeColumnIndex !== -1 && attributeColumnIndex < row.length && row[attributeColumnIndex]) {
                        elementByItem[itemName] = strings[row[attributeColumnIndex]];
                    }
                }
            }
        }

        // Parse Upgrade Values: per-item upgrade effects (combat stats),
        // hidden cooking effects, and difficulty (used for TDU bonuses)
        const upgradeSheetId = stringToIndex['Upgrade Values'];
        if (upgradeSheetId !== undefined && sheets[upgradeSheetId]) {
            const upgradeRows = sheets[upgradeSheetId];
            const readHeaders = rows => rows[0].map(id => strings[id]);
            const headers = readHeaders(upgradeRows);
            const itemColumnIndex = headers.indexOf('Item');
            const statColumnIndices = statColumns.map(col => ({ name: col, index: headers.indexOf(col) })).filter(c => c.index !== -1);
            const cookColumnIndices = COOK_COLS.map(col => ({ name: col, index: headers.indexOf(col) })).filter(c => c.index !== -1);
            const difficultyColumnIndex = headers.indexOf('Diff');
            
            for (let i = 1; i < upgradeRows.length; i++) {
                const row = upgradeRows[i];
                if (itemColumnIndex !== -1 && itemColumnIndex < row.length && row[itemColumnIndex] !== 0 && row[itemColumnIndex] !== undefined) {
                    const itemName = strings[row[itemColumnIndex]];
                    const statValues = {};
                    const cookValues = {};
                    statColumnIndices.forEach(column => {
                        if (column.index < row.length) {
                            const value = row[column.index];
                            if (value !== 0 && value !== undefined && value !== null) {
                                statValues[column.name] = value;
                            }
                        }
                    });
                    if (Object.keys(statValues).length > 0) {
                        upgradeEffectsByItem[itemName] = statValues;
                    }
                    cookColumnIndices.forEach(column => {
                        if (column.index < row.length) {
                            const value = row[column.index];
                            if (value !== 0 && value !== undefined && value !== null) {
                                cookValues[column.name] = value;
                            }
                        }
                    });
                    if (Object.keys(cookValues).length > 0) {
                        cookEffectsByItem[itemName] = cookValues;
                    }
                    if (difficultyColumnIndex !== -1 && difficultyColumnIndex < row.length && typeof row[difficultyColumnIndex] === 'number') {
                        difficultyByItem[itemName] = row[difficultyColumnIndex];
                    }
                }
            }
        }

        // Parse Item Use Values: base effects of usable items (dishes, medicine)
        const useValuesSheetId = stringToIndex['Item Use Values'];
        if (useValuesSheetId !== undefined && sheets[useValuesSheetId]) {
            const useValuesRows = sheets[useValuesSheetId];
            const useValuesHeaders = useValuesRows[0].map(id => strings[id]);
            const itemColumnIndex = useValuesHeaders.indexOf('Item');
            const useColumnIndices = USE_COLS.map(col => ({ name: col, index: useValuesHeaders.indexOf(col) })).filter(c => c.index !== -1);
            
            for (let i = 1; i < useValuesRows.length; i++) {
                const row = useValuesRows[i];
                if (itemColumnIndex !== -1 && itemColumnIndex < row.length && row[itemColumnIndex] !== 0 && row[itemColumnIndex] !== undefined) {
                    const itemName = strings[row[itemColumnIndex]];
                    const statValues = {};
                    useColumnIndices.forEach(column => {
                        if (column.index < row.length) {
                            const value = row[column.index];
                            if (value !== 0 && value !== undefined && value !== null) {
                                statValues[column.name] = value;
                            }
                        }
                    });
                    if (Object.keys(statValues).length > 0) {
                        useEffectsByItem[itemName] = statValues;
                    }
                }
            }
        }

        const recipeSheets = ['Craft Recipes', 'Forge Recipes', 'Cook & Chem Recipes'];
        
        recipeSheets.forEach(sheetName => {
            const sheetId = stringToIndex[sheetName];
            if (sheetId === undefined || !sheets[sheetId]) return;
            
            const rows = sheets[sheetId];
            const headers = rows[0].map(id => strings[id]);
            
            const typeColumnIndex = headers.indexOf('Type');
            const recipeColumnIndex = headers.indexOf('Recipe');
            const levelColumnIndex = headers.indexOf('Level');
            const subtypeColumnIndex = headers.indexOf('craftSubClass');
            
            const materialColumnIndices = [];
            for (let i = 1; i <= 6; i++) {
                const columnIndex = headers.indexOf(`Material ${i}`);
                if (columnIndex !== -1) materialColumnIndices.push(columnIndex);
            }
            
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                
                let typeName = typeColumnIndex !== -1 && typeColumnIndex < row.length && row[typeColumnIndex] !== 0 && row[typeColumnIndex] !== undefined ? strings[row[typeColumnIndex]] : "Unknown";
                let recipeName = recipeColumnIndex !== -1 && recipeColumnIndex < row.length && row[recipeColumnIndex] !== 0 && row[recipeColumnIndex] !== undefined ? strings[row[recipeColumnIndex]] : "Unknown";
                let subtypeName = subtypeColumnIndex !== -1 && subtypeColumnIndex < row.length && row[subtypeColumnIndex] !== 0 && row[subtypeColumnIndex] !== undefined ? strings[row[subtypeColumnIndex]] : "Unknown";

                if (!typeName) typeName = "Unknown";
                if (!recipeName || recipeName === "Unknown") continue; // Skip placeholders/empties
                
                let skill = "";
                if (sheetName === 'Craft Recipes') {
                    skill = 'Crafting';
                } else if (sheetName === 'Forge Recipes') {
                    skill = 'Forging';
                } else if (sheetName === 'Cook & Chem Recipes') {
                    if (typeName === 'Chemistry' || subtypeName === 'Medicine') {
                        skill = 'Chemistry';
                    } else {
                        skill = 'Cooking';
                    }
                }

                let level = levelColumnIndex !== -1 && levelColumnIndex < row.length ? row[levelColumnIndex] : 0;
                if (typeof level !== 'number') {
                    level = strings[level] || 0;
                    level = parseInt(level, 10) || 0;
                }
                
                const materials = [];
                materialColumnIndices.forEach(columnIndex => {
                    if (columnIndex < row.length) {
                        const materialValue = row[columnIndex];
                        if (materialValue !== 0 && materialValue !== undefined) {
                            const materialName = strings[materialValue];
                            if (materialName) {
                                materials.push(materialName);
                                materialNames.add(materialName);
                            }
                        }
                    }
                });
                
                recipes.push({
                    id: i + '_' + sheetId,
                    skill: skill,
                    type: typeName,
                    subtype: subtypeName,
                    name: recipeName,
                    level: level,
                    materials: materials,
                    baseStats: baseStatsByItem[recipeName] || null,
                    upgradeStats: upgradeEffectsByItem[recipeName] || null,
                    useStats: useEffectsByItem[recipeName] || null,
                    cookStats: cookEffectsByItem[recipeName] || null,
                    difficulty: difficultyByItem[recipeName] || 0,
                    element: elementByItem[recipeName] || null
                });
            }
        });
        
        const knownRecipeNames = new Set(recipes.map(r => r.name));
        
        // Parse Item Values to add all other items
        const itemValuesSheetId = stringToIndex['Item Values'];
        if (itemValuesSheetId !== undefined && sheets[itemValuesSheetId]) {
            const itemValuesRows = sheets[itemValuesSheetId];
            const itemValuesHeaders = itemValuesRows[0].map(id => strings[id]);
            const itemColumnIndex = itemValuesHeaders.indexOf('Item');
            const typeColumnIndex = itemValuesHeaders.indexOf('Item Type');
            const categoryColumnIndex = itemValuesHeaders.indexOf('Category');

            for (let i = 1; i < itemValuesRows.length; i++) {
                const row = itemValuesRows[i];
                if (itemColumnIndex !== -1 && itemColumnIndex < row.length && row[itemColumnIndex] !== 0 && row[itemColumnIndex] !== undefined) {
                    const itemName = strings[row[itemColumnIndex]];
                    if (!knownRecipeNames.has(itemName)) {
                        let typeStr = typeColumnIndex !== -1 && row[typeColumnIndex] ? strings[row[typeColumnIndex]] : 'Ingredient';
                        let catStr = categoryColumnIndex !== -1 && row[categoryColumnIndex] ? strings[row[categoryColumnIndex]] : 'Ingredient';
                        if (typeof typeStr === 'number') typeStr = strings[typeStr] || 'Ingredient';
                        if (typeof catStr === 'number') catStr = strings[catStr] || 'Ingredient';
                        
                        recipes.push({
                            id: 'item_' + (stringToIndex[itemName] || itemName.replace(/\s+/g, '_')),
                            skill: 'Ingredient',
                            type: typeStr,
                            subtype: catStr,
                            name: itemName,
                            level: 0,
                            materials: [],
                            baseStats: baseStatsByItem[itemName] || null,
                            upgradeStats: upgradeEffectsByItem[itemName] || null,
                            useStats: useEffectsByItem[itemName] || null,
                            cookStats: cookEffectsByItem[itemName] || null,
                            difficulty: difficultyByItem[itemName] || 0,
                    element: elementByItem[itemName] || null
                        });
                        knownRecipeNames.add(itemName);
                    }
                }
            }
        }

        // Add any remaining materials that weren't in Item Values
        materialNames.forEach(matName => {
            if (!knownRecipeNames.has(matName)) {
                recipes.push({
                    id: 'mat_' + (stringToIndex[matName] || matName.replace(/\s+/g, '_')),
                    skill: 'Ingredient',
                    type: 'Ingredient',
                    subtype: 'Ingredient',
                    name: matName,
                    level: 0,
                    materials: [],
                    baseStats: baseStatsByItem[matName] || null,
                    upgradeStats: upgradeEffectsByItem[matName] || null,
                    useStats: useEffectsByItem[matName] || null,
                    cookStats: cookEffectsByItem[matName] || null,
                    difficulty: difficultyByItem[matName] || 0,
                    element: elementByItem[matName] || null
                });
                knownRecipeNames.add(matName);
            }
        });

        // Add any remaining equipment
        Object.keys(baseStatsByItem).forEach(eqName => {
            if (!knownRecipeNames.has(eqName)) {
                recipes.push({
                    id: 'eq_' + (stringToIndex[eqName] || eqName.replace(/\s+/g, '_')),
                    skill: 'Ingredient',
                    type: 'Equipment',
                    subtype: 'Equipment',
                    name: eqName,
                    level: 0,
                    materials: [],
                    baseStats: baseStatsByItem[eqName] || null,
                    upgradeStats: upgradeEffectsByItem[eqName] || null,
                    useStats: useEffectsByItem[eqName] || null,
                    cookStats: cookEffectsByItem[eqName] || null,
                    difficulty: difficultyByItem[eqName] || 0,
                    element: elementByItem[eqName] || null
                });
                knownRecipeNames.add(eqName);
            }
        });

        return {
            materials: Array.from(materialNames).sort(),
            recipes: recipes
        };
    }

    function updateSubtypeDropdown() {
        let availableSubtypes = new Set();
        
        if (selectedSkill === "All") {
            gameData.recipes.forEach(recipe => availableSubtypes.add(recipe.subtype));
        } else {
            gameData.recipes.forEach(recipe => {
                if (recipe.skill === selectedSkill) {
                    availableSubtypes.add(recipe.subtype);
                }
            });
        }
        
        // Remove Unknown if present
        availableSubtypes.delete("Unknown");
        
        const subtypeOptions = Array.from(availableSubtypes).sort();
        
        // Securely replace children
        subtypeFilter.replaceChildren();
        const allOption = document.createElement('option');
        allOption.value = "All";
        allOption.textContent = "All Subtypes";
        subtypeFilter.appendChild(allOption);
        
        const optionFragment = document.createDocumentFragment();
        subtypeOptions.forEach(sub => {
            const optionElement = document.createElement('option');
            optionElement.value = sub;
            optionElement.textContent = sub;
            optionFragment.appendChild(optionElement);
        });
        
        subtypeFilter.appendChild(optionFragment);
        subtypeFilter.value = selectedSubtype;
    }

    function updateMaterialDropdowns() {
        let availableMaterials = new Set();
        
        gameData.recipes.forEach(recipe => {
            const skillMatch = selectedSkill === "All" || recipe.skill === selectedSkill;
            const subtypeMatch = selectedSubtype === "All" || recipe.subtype === selectedSubtype;
            
            if (skillMatch && subtypeMatch) {
                recipe.materials.forEach(material => availableMaterials.add(material));
            }
        });
        
        const materialOptions = Array.from(availableMaterials).sort();
        
        const selects = inputGrid.querySelectorAll('select');
        selects.forEach((select, i) => {
            const currentSelection = selectedMaterials[i];
            
            // Securely replace children
            select.replaceChildren();
            const emptyOption = document.createElement('option');
            emptyOption.value = "";
            emptyOption.textContent = "Empty";
            select.appendChild(emptyOption);
            
            const optionFragment = document.createDocumentFragment();
            materialOptions.forEach(mat => {
                const optionElement = document.createElement('option');
                optionElement.value = mat;
                optionElement.textContent = mat;
                optionFragment.appendChild(optionElement);
            });
            select.appendChild(optionFragment);
            
            if (materialOptions.includes(currentSelection)) {
                select.value = currentSelection;
            } else {
                select.value = "";
                selectedMaterials[i] = "";
            }
        });
    }

    function buildSearchGrid() {
        for (let i = 0; i < 6; i++) {
            const materialSelect = document.createElement('select');
            materialSelect.addEventListener('change', (e) => {
                selectedMaterials[i] = e.target.value;
                filterRecipes();
            });
            inputGrid.appendChild(materialSelect);
        }
        updateMaterialDropdowns();
    }

    function buildDetailGrid() {
        for (let i = 0; i < 6; i++) {
            const slotElement = document.createElement('div');
            slotElement.className = 'detail-slot';
            slotElement.textContent = 'Empty';
            detailGrid.appendChild(slotElement);
        }
    }

    function filterRecipes() {
        recipeList.replaceChildren();
        const selectedMaterialList = selectedMaterials.filter(val => val !== "");
        
        const noFilters = selectedMaterialList.length === 0 && selectedSkill === "All" && selectedSubtype === "All";
        if (noFilters) {
            resultsStatus.textContent = 'Pick a skill, subtype, or materials to search';
            resultsStatus.hidden = false;
            return;
        }

        const selectedMaterialCounts = {};
        selectedMaterialList.forEach(item => { selectedMaterialCounts[item] = (selectedMaterialCounts[item] || 0) + 1; });

        const matchingRecipes = gameData.recipes.filter(recipe => {
            if (selectedSkill !== "All" && recipe.skill !== selectedSkill) return false;
            if (selectedSubtype !== "All" && recipe.subtype !== selectedSubtype) return false;

            if (selectedMaterialList.length > 0) {
                const recipeMaterialCounts = {};
                recipe.materials.forEach(item => { recipeMaterialCounts[item] = (recipeMaterialCounts[item] || 0) + 1; });
                for (const item in selectedMaterialCounts) {
                    if (!recipeMaterialCounts[item] || recipeMaterialCounts[item] < selectedMaterialCounts[item]) return false; 
                }
            }
            return true;
        });

        matchingRecipes.sort((a, b) => a.level - b.level);

        if (matchingRecipes.length === 0) {
            resultsStatus.textContent = 'No recipes match your filters';
            resultsStatus.hidden = false;
            return;
        }
        resultsStatus.hidden = true;

        const resultFragment = document.createDocumentFragment();
        matchingRecipes.forEach(recipe => {
            const resultItem = document.createElement('li');
            resultItem.className = 'recipe-item';
            resultItem.dataset.id = recipe.id;
            const typeLabel = recipe.skill === 'Ingredient'
                ? (recipe.subtype !== 'Unknown' ? recipe.subtype : 'Ingredient')
                : (recipe.subtype !== 'Unknown' ? `${recipe.subtype} Lv.${recipe.level}` : `${recipe.skill} Lv.${recipe.level}`);
            resultItem.textContent = `${recipe.name} — ${typeLabel}`;
            resultFragment.appendChild(resultItem);
        });
        recipeList.appendChild(resultFragment);
    }

    recipeList.addEventListener('click', (e) => {
        const clickedElement = e.target.closest('.recipe-item');
        if (!clickedElement) return;
        const recipe = recipeById.get(clickedElement.dataset.id);
        if (!recipe) return;

        if (inheritanceTarget) {
            // Inheritance: Add item to target slot
            inheritanceTarget.targetItem.setSlot(inheritanceTarget.slotIndex, new CustomItem(recipe));
            const itemToView = inheritanceTarget.targetItem;
            setPickMode(null); // clear state
            openDetail(itemToView);
        } else {
            // Normal view
            openDetail(new CustomItem(recipe));
        }
    });

    let equipButtonClickHandler = null;

    // Crafting cost for this recipe, derived from the planner's max RP
    function renderCraftCost(recipe) {
        const rpCost = getCraftRpCostForSkill(recipe.skill);
        const maxRp = getPlannerMaxRp();
        if (rpCost === null || maxRp === null) return;

        const grid = document.createElement('div');
        grid.className = 'stats-grid';
        const crafts = Math.floor(maxRp / rpCost);
        appendStatNote(grid, `Crafting costs ${rpCost} RP (planner max RP ${maxRp} → ${crafts} crafts)`);
        statsContainer.appendChild(grid);
    }

    // Interactive crafting planner: material levels, extra items, elemental
    // stones, cores, Light Ore override → predicted final stats.
    function renderCraftPlanner(item, recipe, isEquipment, isWeapon) {
        const container = document.getElementById('craft-planner-container');
        if (!container) return;
        if (!isEquipment) {
            container.hidden = true;
            return;
        }
        container.hidden = false;
        container.replaceChildren();

        const details = document.createElement('details');
        details.className = 'craft-planner';
        const summary = document.createElement('summary');
        summary.textContent = 'Crafting Planner';
        details.appendChild(summary);

        const body = document.createElement('div');
        body.className = 'craft-planner-body';

        // Skill level for the craft
        const skillRow = document.createElement('label');
        skillRow.className = 'craft-field';
        skillRow.appendChild(document.createTextNode(`${recipe.skill} level: `));
        const skillInput = document.createElement('input');
        skillInput.type = 'number';
        skillInput.setAttribute("aria-label", `${recipe.skill} crafting level`);
        skillInput.min = 1;
        skillInput.max = 999;
        skillInput.value = getSkillLevel(recipe.skill) || 1;
        skillRow.appendChild(skillInput);
        body.appendChild(skillRow);

        // Material rows: name + level (1-10) + "Extra" checkbox (max 3)
        const materialList = document.createElement('div');
        materialList.className = 'craft-material-list';
        const slotControls = [];
        for (let i = 0; i < 6; i++) {
            const slotValue = item.slots[i];
            if (slotValue == null) continue;
            const slotName = slotValue instanceof CustomItem ? slotValue.baseRecipe.name : slotValue;

            const row = document.createElement('div');
            row.className = 'craft-material-row';
            const nameSpan = document.createElement('span');
            nameSpan.textContent = slotName;
            const levelInput = document.createElement('input');
            levelInput.type = 'number';
            levelInput.min = 1;
            levelInput.max = 10;
            levelInput.value = 1;
            levelInput.setAttribute('aria-label', `${slotName} level`);
            const extraLabel = document.createElement('label');
            const extraCheckbox = document.createElement('input');
            extraCheckbox.type = 'checkbox';
            extraCheckbox.checked = item.inherited[i];
            extraCheckbox.setAttribute('aria-label', `Use ${slotName} as extra item`);
            extraLabel.appendChild(extraCheckbox);
            extraLabel.appendChild(document.createTextNode(' Extra'));
            row.appendChild(nameSpan);
            row.appendChild(levelInput);
            row.appendChild(extraLabel);
            materialList.appendChild(row);
            slotControls.push({ levelInput, extraCheckbox });
        }
        body.appendChild(materialList);

        // Elemental stone
        const elementRow = document.createElement('label');
        elementRow.className = 'craft-field';
        elementRow.appendChild(document.createTextNode('Element (stone): '));
        const elementSelect = document.createElement('select');
        elementSelect.setAttribute('aria-label', 'Element stone');
        ['None', ...ELEMENTS].forEach(element => {
            const optionElement = document.createElement('option');
            optionElement.value = element;
            optionElement.textContent = element;
            elementSelect.appendChild(optionElement);
        });
        elementSelect.value = recipe.element || 'None';
        elementRow.appendChild(elementSelect);
        body.appendChild(elementRow);

        // Light Ore + override
        const lightOreRow = document.createElement('label');
        lightOreRow.className = 'craft-field';
        const lightOreCheckbox = document.createElement('input');
        lightOreCheckbox.type = 'checkbox';
        lightOreCheckbox.setAttribute('aria-label', 'Light Ore');
        lightOreRow.appendChild(lightOreCheckbox);
        lightOreRow.appendChild(document.createTextNode(' Light Ore (cross-category override)'));
        body.appendChild(lightOreRow);

        const overrideRow = document.createElement('label');
        overrideRow.className = 'craft-field';
        overrideRow.appendChild(document.createTextNode('Override base stats with: '));
        const overrideSelect = document.createElement('select');
        overrideSelect.setAttribute('aria-label', 'Override base stats');
        body.appendChild(overrideRow);
        overrideRow.appendChild(overrideSelect);

        function populateOverrideOptions() {
            overrideSelect.replaceChildren();
            const noneOption = document.createElement('option');
            noneOption.value = '';
            noneOption.textContent = 'None (recipe base stats)';
            overrideSelect.appendChild(noneOption);

            const useLightOre = lightOreCheckbox.checked && isWeapon;
            const candidates = gameData.recipes.filter(candidate =>
                candidate.id !== recipe.id &&
                (useLightOre
                    ? loadoutBuilder.weaponSubtypes.includes(candidate.subtype)
                    : candidate.subtype === recipe.subtype) &&
                candidate.baseStats && Object.keys(candidate.baseStats).length > 0);

            candidates.sort((a, b) => a.level - b.level);
            candidates.forEach(candidate => {
                const optionElement = document.createElement('option');
                optionElement.value = candidate.id;
                optionElement.textContent = `${candidate.name} (${candidate.subtype})`;
                overrideSelect.appendChild(optionElement);
            });
        }
        populateOverrideOptions();

        // Results
        const resultsGrid = document.createElement('div');
        resultsGrid.className = 'stats-grid craft-planner-results';
        body.appendChild(resultsGrid);
        details.appendChild(body);
        container.appendChild(details);

        const TLU_STAT_NAMES = { atk: 'ATK', matk: 'MATK', def: 'DEF', mdef: 'MDEF' };

        function renderStatBox(statName, statValue) {
            const statBox = document.createElement('div');
            statBox.className = 'stat-box';
            const nameLabel = document.createElement('strong');
            nameLabel.textContent = `${statName}:`;
            statBox.appendChild(nameLabel);
            statBox.appendChild(document.createTextNode(` ${statValue}`));
            attachStatInfo(statBox, statName, 'general');
            resultsGrid.appendChild(statBox);
        }

        function renderResultNote(text) {
            const note = document.createElement('div');
            note.className = 'stat-note';
            note.textContent = text;
            resultsGrid.appendChild(note);
        }

        function recompute() {
            resultsGrid.replaceChildren();

            const skillLevel = parseInt(skillInput.value, 10) || 1;
            const levels = slotControls.map(control => parseInt(control.levelInput.value, 10) || 1);
            const extraFlags = slotControls.map(control => control.extraCheckbox.checked);

            // Total Level Used from the entered material levels
            const totalLevelUsed = levels.reduce((sum, level) => sum + level, 0);
            const tluBonusStats = tluBonus(totalLevelUsed, isWeapon);

            // Total Difficulty Used from the data (unchanged by levels)
            const totalDifficulty = materialDifficulty(item, recipeByName);
            const tduBonusValue = tduBonus(totalDifficulty, isWeapon);
            const tduBonusStat = tduBonusValue > 0 ? { [isWeapon ? 'ATK' : 'DEF']: tduBonusValue } : null;

            // Inherited effects: checked extras, max 3 in-game
            const inheritedEffectValues = {};
            let extraCount = 0;
            slotControls.forEach((control, i) => {
                if (!extraFlags[i] || extraCount >= 3) return;
                const contributedStats = slotUpgradeStats(item.slots[i], recipeByName);
                if (contributedStats) {
                    Object.entries(contributedStats).forEach(([statName, statValue]) => {
                        inheritedEffectValues[statName] = (inheritedEffectValues[statName] || 0) + statValue;
                    });
                }
                extraCount++;
            });

            // Override base stats
            const overrideRecipe = overrideSelect.value ? recipeById.get(overrideSelect.value) : null;
            const baseStats = overrideRecipe ? overrideRecipe.baseStats : recipe.baseStats;
            const overrideElement = overrideRecipe && overrideRecipe.element;

            // Element: elemental stone overrides, otherwise the item's element
            const element = elementSelect.value === 'None'
                ? (overrideElement || recipe.element || null)
                : elementSelect.value;

            // Cores among the materials
            const coreDetection = detectCores(slotControls.map((control, i) =>
                item.slots[i] instanceof CustomItem ? item.slots[i].baseRecipe.name : item.slots[i]));

            const totalStats = sumStats(baseStats, inheritedEffectValues, tluBonusStats, tduBonusStat);

            renderStatBox('TLU', totalLevelUsed);
            Object.entries(tluBonusStats).forEach(([statName, statValue]) => renderStatBox(`TLU ${TLU_STAT_NAMES[statName] || statName}`, `+${statValue}`));
            if (tduBonusValue > 0) renderStatBox(`TDU ${isWeapon ? 'ATK' : 'DEF'}`, `+${tduBonusValue}`);
            if (extraCount > 0) {
                Object.entries(inheritedEffectValues).forEach(([statName, statValue]) => renderStatBox(`Extra ${statName}`, `+${statValue}`));
            }
            renderStatBox('Total Stats', Object.entries(totalStats)
                .map(([statName, statValue]) => `${TLU_STAT_NAMES[statName] || statName} ${statValue}`).join(', ') || '—');

            if (element) renderResultNote(`Element: ${element}${elementSelect.value !== 'None' ? ' (elemental stone)' : ''}`);
            if (coreDetection.count > 0) {
                renderResultNote(coreDetection.allFour
                    ? 'All 4 cores present — +10% resistance to non-elemental damage.'
                    : `${coreDetection.count}/4 cores present — all four grant +10% non-elemental resistance.`);
            }
            if ((skillLevel < 50) && (Object.keys(tluBonusStats).length > 0 || tduBonusValue > 0)) {
                renderResultNote(`TLU/TDU bonuses apply at skill ≥ 50 — current level ${skillLevel}.`);
            }
            const checkedExtras = extraFlags.filter(Boolean).length;
            if (checkedExtras > 3) {
                renderResultNote('In-game only 3 extra items impart their effects — extra slots beyond 3 are not counted.');
            }
            const rpCost = getCraftRpCostForSkill(recipe.skill);
            if (rpCost !== null) {
                renderResultNote(`Crafting costs ${rpCost} RP (planner max RP ${getPlannerMaxRp()}).`);
            }
        }

        const allInputs = [skillInput, elementSelect, lightOreCheckbox, overrideSelect,
            ...slotControls.flatMap(control => [control.levelInput, control.extraCheckbox])];
        allInputs.forEach(input => {
            input.addEventListener('change', () => {
                if (input === lightOreCheckbox) populateOverrideOptions();
                recompute();
            });
        });

        recompute();
    }

    // Render a stat grid section into the stats container
    function renderStatSection(heading, statValues, extraClass = '', context = 'general') {
        if (!statValues || Object.keys(statValues).length === 0) return;
        const sectionHeading = document.createElement('h3');
        sectionHeading.textContent = heading;
        statsContainer.appendChild(sectionHeading);
        
        const grid = document.createElement('div');
        grid.className = 'stats-grid';
        
        const boxFragment = document.createDocumentFragment();
        for (const [statName, statValue] of Object.entries(statValues)) {
            const statBox = document.createElement('div');
            statBox.className = 'stat-box' + (extraClass ? ' ' + extraClass : '');
            
            const nameLabel = document.createElement('strong');
            nameLabel.textContent = `${statName}:`;
            
            statBox.appendChild(nameLabel);
            statBox.appendChild(document.createTextNode(` ${statValue}`));
            attachStatInfo(statBox, statName, context);
            boxFragment.appendChild(statBox);
        }
        grid.appendChild(boxFragment);
        statsContainer.appendChild(grid);
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
        
        const slotElements = detailGrid.children;
        for (let i = 0; i < 6; i++) {
            const slotValue = item.slots[i];
            
            // Clear slot
            slotElements[i].textContent = '';
            slotElements[i].className = 'detail-slot'; // reset class
            slotElements[i].onclick = null; // clear previous handlers

            if (slotValue) {
                if (slotValue instanceof CustomItem) {
                    slotElements[i].textContent = `[Inherit] ${slotValue.baseRecipe.name}`;
                    slotElements[i].classList.add('filled-nested');
                } else {
                    slotElements[i].textContent = slotValue;
                    slotElements[i].classList.add('filled-base');
                    // Drill down into the material's own recipe if it has one
                    const materialRecipe = recipeByName.get(slotValue);
                    if (materialRecipe) {
                        slotElements[i].classList.add('clickable');
                        slotElements[i].title = 'View material details';
                        slotElements[i].onclick = () => openDetail(new CustomItem(materialRecipe));
                    }
                }
            } else if (isEquipment) {
                slotElements[i].textContent = 'Empty (+ Add Item)';
                slotElements[i].classList.add('empty-fillable');
                slotElements[i].onclick = () => {
                    setPickMode({ targetItem: item, slotIndex: i });
                    navigateTo('#/search', { replace: true });
                };
            } else {
                slotElements[i].textContent = 'Empty';
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

        if (recipe.element) {
            const elementBox = document.createElement('div');
            elementBox.className = 'stat-box';
            const elementStrong = document.createElement('strong');
            elementStrong.textContent = 'Element:';
            elementBox.appendChild(elementStrong);
            elementBox.appendChild(document.createTextNode(` ${recipe.element}`));
            baseStatsGrid.appendChild(elementBox);
        }

        statsContainer.appendChild(baseStatsGrid);

        if (isEquipment) {
            renderEquipmentStats(item, recipe, isWeapon);
        } else {
            renderFoodStats(recipe);
        }

        renderCraftCost(recipe);
        renderCraftPlanner(item, recipe, isEquipment, isWeapon);

        if (loadoutBuilder && isEquipment) {
            equipBtn.style.display = 'inline-block';
            if (equipButtonClickHandler) {
                equipBtn.removeEventListener('click', equipButtonClickHandler);
            }
            equipButtonClickHandler = () => loadoutBuilder.equipItem(item);
            equipBtn.addEventListener('click', equipButtonClickHandler);
        } else {
            equipBtn.style.display = 'none';
        }
    }

    // Equipment: base + inherited-only contributions (max 3 extra items in-game)
    // + Total Difficulty Used (TDU) tier bonus.
    function renderEquipmentStats(item, recipe, isWeapon) {
        renderStatSection('Base Combat Stats', recipe.baseStats, '', 'general');

        const inheritedContributions = inheritedStats(item, recipeByName);
        if (inheritedContributions.count > 0) {
            renderStatSection('Inheritance Effects', inheritedContributions.stats, '', 'upgrade');
            if (inheritedContributions.count >= 3) {
                const noteGrid = document.createElement('div');
                noteGrid.className = 'stats-grid';
                appendStatNote(noteGrid, 'In-game only 3 extra items impart their effects — further inherited items are not counted.');
                statsContainer.appendChild(noteGrid);
            }
        }

        // TDU tier bonus (applies at skill >= 50)
        const totalDifficulty = materialDifficulty(item, recipeByName);
        const tduBonusValue = tduBonus(totalDifficulty, isWeapon);
        const tduBonusStat = tduBonusValue > 0 ? { [isWeapon ? 'ATK' : 'DEF']: tduBonusValue } : null;

        const totalStatValues = sumStats(recipe.baseStats, inheritedContributions.stats, tduBonusStat);
        if (Object.keys(totalStatValues).length > 0 &&
            (Object.keys(inheritedContributions.stats).length > 0 || tduBonusValue > 0)) {
            const totalHeading = document.createElement('h3');
            totalHeading.textContent = 'Total Stats';
            statsContainer.appendChild(totalHeading);
            
            const totalGrid = document.createElement('div');
            totalGrid.className = 'stats-grid';
            
            const totalFragment = document.createDocumentFragment();
            for (const [statName, statValue] of Object.entries(totalStatValues)) {
                const statBox = document.createElement('div');
                statBox.className = 'stat-box';
                statBox.classList.add('stat-total');
                
                const nameLabel = document.createElement('strong');
                nameLabel.textContent = `${statName}:`;
                
                statBox.appendChild(nameLabel);
                statBox.appendChild(document.createTextNode(` ${statValue}`));
                totalFragment.appendChild(statBox);
            }
            totalGrid.appendChild(totalFragment);
            if (tduBonusValue > 0) {
                appendStatNote(totalGrid, `Includes Total Difficulty bonus (skill ≥ 50): +${tduBonusValue} ${isWeapon ? 'ATK' : 'DEF'} (TDU ${totalDifficulty})`);
            }
            statsContainer.appendChild(totalGrid);
        }

        // What this item contributes when used as a material in another item
        renderStatSection('As Upgrade Material', recipe.upgradeStats, '', 'upgrade');
    }

    // Food/medicine: base use effects + hidden cooking effects of ingredients.
    // Dish level in-game is the average ingredient level (level data is not
    // available in this dataset), so base effects are shown unscaled.
    function renderFoodStats(recipe) {
        const containsNonEdibleIngredient = recipe.materials.some(material => {
            const materialRecipe = recipeByName.get(material);
            return !materialRecipe || !materialRecipe.useStats;
        });

        if (containsNonEdibleIngredient) {
            const warningGrid = document.createElement('div');
            warningGrid.className = 'stats-grid';
            appendStatNote(warningGrid, 'This recipe contains non-edible ingredients — in-game the dish\'s base effects become negative (unbalanced).');
            statsContainer.appendChild(warningGrid);
        }

        renderStatSection('Dish Effects (base)', recipe.useStats, '', 'general');

        const totalCookEffects = sumStats(...recipe.materials.map(material => {
            const materialRecipe = recipeByName.get(material);
            return materialRecipe ? materialRecipe.cookStats : null;
        }));
        if (Object.keys(totalCookEffects).length > 0) {
            renderStatSection('Ingredient Cooking Effects', totalCookEffects, '', 'cook');
        }
    }

    return {
        getDetailItem: () => currentDetailItem,
        resetFilters: () => resetBtn.onclick(),
        refreshLoadout: () => loadoutBuilder.refresh(),
        isPickMode: () => !!inheritanceTarget,
        cancelPickMode: () => setPickMode(null)
    };
}
