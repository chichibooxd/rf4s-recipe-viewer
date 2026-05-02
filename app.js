let appData = { materials: [], recipes: [] };
let selectedInputs = ["", "", "", "", "", ""];

// Elements
const inputGrid = document.getElementById('input-grid');
const recipeList = document.getElementById('recipe-list');
const detailGrid = document.getElementById('detail-grid');
const searchScreen = document.getElementById('search-screen');
const recipeScreen = document.getElementById('recipe-screen');
const detailTitle = document.getElementById('detail-title');
const backBtn = document.getElementById('back-btn');

// Initialize App
async function init() {
    const res = await fetch('data.json');
    appData = await res.json();
    
    buildSearchGrid();
    buildDetailGrid();
    
    // Register Service Worker for PWA (GitHub Pages Safe)
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js', { scope: './' })
                .then(reg => console.log('SW registered!', reg))
                .catch(err => console.log('SW failed!', err));
        });
    }
}

// Build the 2x3 Input Matrix
function buildSearchGrid() {
    for (let i = 0; i < 6; i++) {
        const select = document.createElement('select');
        select.innerHTML = `<option value="">Empty</option>`;
        appData.materials.forEach(mat => {
            select.innerHTML += `<option value="${mat}">${mat}</option>`;
        });
        
        select.addEventListener('change', (e) => {
            selectedInputs[i] = e.target.value;
            filterRecipes();
        });
        
        inputGrid.appendChild(select);
    }
}

// Build the 2x3 Output Matrix
function buildDetailGrid() {
    for (let i = 0; i < 6; i++) {
        const slot = document.createElement('div');
        slot.className = 'detail-slot';
        slot.textContent = 'Empty';
        detailGrid.appendChild(slot);
    }
}

// Filter and display recipes
function filterRecipes() {
    recipeList.innerHTML = '';
    const activeFilters = selectedInputs.filter(val => val !== "");
    
    if (activeFilters.length === 0) return;

    const filtered = appData.recipes.filter(recipe => {
        return activeFilters.every(item => recipe.materials.includes(item));
    });

    filtered.sort((a, b) => a.level - b.level);

    filtered.forEach(recipe => {
        const li = document.createElement('li');
        li.className = 'recipe-item';
        li.textContent = `${recipe.name} - ${recipe.skill} Lv.${recipe.level}`;
        li.onclick = () => showRecipeDetail(recipe);
        recipeList.appendChild(li);
    });
}

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

init();
