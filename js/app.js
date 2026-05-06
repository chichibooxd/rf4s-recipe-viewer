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

        // Initialize core logic
        initRecipeViewer();
        
        const navOverlay = document.getElementById('nav-overlay');
        const navSidebar = document.getElementById('nav-sidebar');
        const screens = document.querySelectorAll('.screen');

        function toggleNav(show) {
            if (show) {
                navSidebar.classList.add('active');
                navOverlay.classList.add('active');
            } else {
                navSidebar.classList.remove('active');
                navOverlay.classList.remove('active');
            }
        }

        function switchScreen(screenId) {
            screens.forEach(s => s.classList.remove('active'));
            document.getElementById(screenId).classList.add('active');
            toggleNav(false);
        }

        document.getElementById('toggle-nav-search-btn').addEventListener('click', () => toggleNav(true));
        document.getElementById('toggle-nav-loadout-btn').addEventListener('click', () => toggleNav(true));
        document.getElementById('close-nav-btn').addEventListener('click', () => toggleNav(false));
        navOverlay.addEventListener('click', () => toggleNav(false));

        document.getElementById('nav-recipe-viewer').addEventListener('click', () => switchScreen('search-screen'));
        document.getElementById('nav-loadout-editor').addEventListener('click', () => switchScreen('loadout-screen'));
    } catch (error) {
        console.error('Error initializing application:', error);
        document.getElementById('app').textContent = 'Failed to initialize the application.';
    }
});
