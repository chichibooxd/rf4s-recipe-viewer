import { initRecipeViewer } from './components/recipe-viewer.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('ui.html');
        if (!response.ok) throw new Error('Failed to load UI template');
        const appTemplate = await response.text();
        
        // Inject the application skeleton
        document.getElementById('app').innerHTML = appTemplate;

        // Register Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js', { scope: './' })
                .catch(err => console.log('SW fail', err));
        }

        // Initialize core logic (router, data, loadout)
        await initRecipeViewer();

        // Bottom tab navigation: the hash is the single source of truth
        const tabRecipes = document.getElementById('tab-recipes');
        const tabLoadout = document.getElementById('tab-loadout');

        tabRecipes.addEventListener('click', () => { location.hash = '#/search'; });
        tabLoadout.addEventListener('click', () => { location.hash = '#/loadout'; });

        // Highlight the active tab
        function updateTabs(screen) {
            const recipesActive = screen === 'search' || screen === 'recipe';
            tabRecipes.classList.toggle('active', recipesActive);
            tabLoadout.classList.toggle('active', screen === 'loadout');
            tabRecipes.setAttribute('aria-current', recipesActive ? 'page' : 'false');
            tabLoadout.setAttribute('aria-current', screen === 'loadout' ? 'page' : 'false');
        }
        updateTabs(location.hash === '#/loadout' ? 'loadout' : 'search');
        window.addEventListener('routechange', (e) => updateTabs(e.detail));
    } catch (error) {
        console.error('Error initializing application:', error);
        document.getElementById('app').textContent = 'Failed to initialize the application.';
    }
});
