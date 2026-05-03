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

async function init() {
    try {
        const res = await fetch('data.json');
        if (!res.ok) throw new Error("Network response was not ok");
        appData = await res.json();
        
        // Populate Skill Filter dynamically from data
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
}

function updateMaterialDropdowns() {
    let validMaterials = new Set();
    
    // If "All", allow everything. If a skill is picked, find only materials used in that skill.
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

    // Update all 6 select boxes without resetting valid selections
    const selects = inputGrid.querySelectorAll('select');
    selects.forEach((select, i) => {
        const currentVal = selectedInputs[i];
        select.innerHTML = optionsHTML;
        
        // If they had an item selected that is STILL valid in this skill, keep it
        if (validArray.includes(currentVal)) {
            select.value = currentVal;
        } else {
            select.value = "";
            selectedInputs[i] = ""; // wipe invalid selection
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
    
    // If matrix is empty AND skill is "All", show nothing to save performance.
    if (activeFilters.length === 0 && selectedSkill === "All") return;

    const userCounts = {};
    activeFilters.forEach(item => { userCounts[item] = (userCounts[item] || 0) + 1; });

    const filtered = appData.recipes.filter(recipe => {
        // 1. Must match skill filter if one is active
        if (selectedSkill !== "All" && recipe.skill !== selectedSkill) return false;

        // 2. Must contain all active ingredients in the grid
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
    const recipe = appData.recipes.find(r => r.id === parseInt(item.dataset.id));
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

init();
