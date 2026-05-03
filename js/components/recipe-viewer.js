export async function initRecipeViewer() {
    let appData = { materials: [], recipes: [] };
    let selectedInputs = ["", "", "", "", "", ""];
    let selectedSkill = "All";

    const inputGrid = document.getElementById('input-grid');
    const recipeList = document.getElementById('recipe-list');
    const detailGrid = document.getElementById('detail-grid');
    const searchScreen = document.getElementById('search-screen');
    const recipeScreen = document.getElementById('recipe-screen');
    const detailTitle = document.getElementById('detail-title');
    const backBtn = document.getElementById('back-btn');
    const resetBtn = document.getElementById('reset-btn');
    const skillFilter = document.getElementById('skill-filter');

    try {
        const res = await fetch('data.json');
        if (!res.ok) throw new Error("Network response was not ok");
        const rawData = await res.json();
        
        appData = processData(rawData);

        // Populate Skill Filter
        const uniqueSkills = [...new Set(appData.recipes.map(r => r.skill))].sort();
        uniqueSkills.forEach(skill => {
            skillFilter.innerHTML += `<option value="${skill}">${skill}</option>`;
        });

        skillFilter.addEventListener('change', (e) => {
            selectedSkill = e.target.value;
            updateMaterialDropdowns();
            filterRecipes();
        });
        
        buildSearchGrid();
        buildDetailGrid();
    } catch (error) {
        console.error("Failed to load database:", error);
        alert("Failed to load recipe database. Please refresh.");
    }

    function processData(rawData) {
        const strings = rawData.strings;
        const sheets = rawData.data;
        
        const strToId = {};
        strings.forEach((s, i) => strToId[s] = i);
        
        const recipes = [];
        const materialsSet = new Set();
        
        const targetSheets = ['Craft Recipes', 'Forge Recipes', 'Cook & Chem Recipes'];
        
        targetSheets.forEach(sheetName => {
            const sheetId = strToId[sheetName];
            if (sheetId === undefined || !sheets[sheetId]) return;
            
            const rows = sheets[sheetId];
            const headers = rows[0].map(id => strings[id]);
            
            const typeIdx = headers.indexOf('Type');
            const recipeIdx = headers.indexOf('Recipe');
            const levelIdx = headers.indexOf('Level');
            
            const matIndices = [];
            for (let i = 1; i <= 6; i++) {
                const idx = headers.indexOf(`Material ${i}`);
                if (idx !== -1) matIndices.push(idx);
            }
            
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                
                let typeStr = typeIdx !== -1 && row[typeIdx] !== 0 && row[typeIdx] !== undefined ? strings[row[typeIdx]] : "Unknown";
                let nameStr = recipeIdx !== -1 && row[recipeIdx] !== 0 && row[recipeIdx] !== undefined ? strings[row[recipeIdx]] : "Unknown";
                
                // If it evaluates to empty string, handle it
                if (!typeStr) typeStr = "Unknown";
                if (!nameStr) nameStr = "Unknown";

                let level = levelIdx !== -1 ? row[levelIdx] : 0;
                if (typeof level !== 'number') {
                    level = strings[level] || 0;
                    level = parseInt(level, 10) || 0;
                }
                
                const materials = [];
                matIndices.forEach(idx => {
                    const matVal = row[idx];
                    if (matVal !== 0 && matVal !== undefined) {
                        const matName = strings[matVal];
                        if (matName) {
                            materials.push(matName);
                            materialsSet.add(matName);
                        }
                    }
                });
                
                recipes.push({
                    id: i + '_' + sheetId,
                    skill: sheetName.replace(' Recipes', ''),
                    type: typeStr,
                    name: nameStr,
                    level: level,
                    materials: materials
                });
            }
        });
        
        return {
            materials: Array.from(materialsSet).sort(),
            recipes: recipes
        };
    }

    function updateMaterialDropdowns() {
        let validMaterials = new Set();
        
        if (selectedSkill === "All") {
            validMaterials = new Set(appData.materials);
        } else {
            appData.recipes.forEach(r => {
                if (r.skill === selectedSkill) {
                    r.materials.forEach(m => validMaterials.add(m));
                }
            });
        }
        
        const validArray = Array.from(validMaterials).sort();
        let optionsHTML = `<option value="">Empty</option>`;
        validArray.forEach(mat => { optionsHTML += `<option value="${mat}">${mat}</option>`; });

        const selects = inputGrid.querySelectorAll('select');
        selects.forEach((select, i) => {
            const currentVal = selectedInputs[i];
            select.innerHTML = optionsHTML;
            
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
        recipeList.innerHTML = '';
        const activeFilters = selectedInputs.filter(val => val !== "");
        
        if (activeFilters.length === 0 && selectedSkill === "All") return;

        const userCounts = {};
        activeFilters.forEach(item => { userCounts[item] = (userCounts[item] || 0) + 1; });

        const filtered = appData.recipes.filter(recipe => {
            if (selectedSkill !== "All" && recipe.skill !== selectedSkill) return false;

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

        filtered.forEach(recipe => {
            const li = document.createElement('li');
            li.className = 'recipe-item';
            li.dataset.id = recipe.id;
            li.textContent = `${recipe.name} - ${recipe.skill} Lv.${recipe.level}`;
            recipeList.appendChild(li);
        });
    }

    recipeList.addEventListener('click', (e) => {
        const item = e.target.closest('.recipe-item');
        if (!item) return;
        const recipe = appData.recipes.find(r => r.id === item.dataset.id);
        if (recipe) showRecipeDetail(recipe);
    });

    function showRecipeDetail(recipe) {
        detailTitle.textContent = `${recipe.name} (Lv.${recipe.level})`;
        const slots = detailGrid.children;
        for (let i = 0; i < 6; i++) {
            slots[i].textContent = recipe.materials[i] || 'Empty';
        }
        searchScreen.classList.remove('active');
        recipeScreen.classList.add('active');
    }

    backBtn.onclick = () => {
        recipeScreen.classList.remove('active');
        searchScreen.classList.add('active');
    };

    resetBtn.onclick = () => {
        selectedInputs = ["", "", "", "", "", ""];
        skillFilter.value = "All";
        selectedSkill = "All";
        updateMaterialDropdowns();
        filterRecipes();
    };
}
