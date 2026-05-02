let appData = { materials: [], recipes: [] };
let selectedInputs = ["", "", "", "", "", ""];

const inputGrid = document.getElementById('input-grid');
const recipeList = document.getElementById('recipe-list');
const detailGrid = document.getElementById('detail-grid');
const searchScreen = document.getElementById('search-screen');
const recipeScreen = document.getElementById('recipe-screen');
const detailTitle = document.getElementById('detail-title');
const backBtn = document.getElementById('back-btn');
const resetBtn = document.getElementById('reset-btn');

async function init() {
    try {
        const res = await fetch('data.json');
        if (!res.ok) throw new Error("Network response was not ok");
        appData = await res.json();
        
        buildSearchGrid();
        buildDetailGrid();
    } catch (error) {
        console.error("Failed to load database:", error);
        alert("Failed to load recipe database. Please refresh.");
    }
}

function buildSearchGrid() {
    let optionsHTML = `<option value="">Empty</option>`;
    appData.materials.forEach(mat => { optionsHTML += `<option value="${mat}">${mat}</option>`; });

    for (let i = 0; i < 6; i++) {
        const select = document.createElement('select');
        select.innerHTML = optionsHTML; 
        select.addEventListener('change', (e) => {
            selectedInputs[i] = e.target.value;
            filterRecipes();
        });
        inputGrid.appendChild(select);
    }
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
    if (activeFilters.length === 0) return;

    const userCounts = {};
    activeFilters.forEach(item => { userCounts[item] = (userCounts[item] || 0) + 1; });

    const filtered = appData.recipes.filter(recipe => {
        const recipeCounts = {};
        recipe.materials.forEach(item => { recipeCounts[item] = (recipeCounts[item] || 0) + 1; });
        for (const item in userCounts) {
            if (!recipeCounts[item] || recipeCounts[item] < userCounts[item]) return false; 
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
    inputGrid.querySelectorAll('select').forEach(select => select.selectedIndex = 0);
    recipeList.innerHTML = '';
};

init();
