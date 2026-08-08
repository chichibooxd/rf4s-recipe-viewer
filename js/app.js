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

        const navOverlay = document.getElementById('nav-overlay');
        const navSidebar = document.getElementById('nav-sidebar');
        const navButtons = [
            document.getElementById('toggle-nav-search-btn'),
            document.getElementById('toggle-nav-recipe-btn'),
            document.getElementById('toggle-nav-loadout-btn')
        ].filter(Boolean);
        const closeNavBtn = document.getElementById('close-nav-btn');
        const navRecipeViewer = document.getElementById('nav-recipe-viewer');
        const navLoadoutEditor = document.getElementById('nav-loadout-editor');
        let openerBtn = null;

        const sidebarFocusables = [closeNavBtn, navRecipeViewer, navLoadoutEditor];

        function toggleNav(show, btn = null) {
            if (show) {
                openerBtn = btn;
                navSidebar.classList.add('active');
                navOverlay.classList.add('active');
                navSidebar.setAttribute('aria-hidden', 'false');
                navOverlay.setAttribute('aria-hidden', 'false');
                navButtons.forEach(b => b.setAttribute('aria-expanded', String(b === btn)));
                closeNavBtn.focus();
            } else {
                navSidebar.classList.remove('active');
                navOverlay.classList.remove('active');
                navSidebar.setAttribute('aria-hidden', 'true');
                navOverlay.setAttribute('aria-hidden', 'true');
                navButtons.forEach(b => b.setAttribute('aria-expanded', 'false'));
                if (openerBtn && document.contains(openerBtn)) {
                    openerBtn.focus();
                    openerBtn = null;
                }
            }
        }

        navButtons.forEach(btn => btn.addEventListener('click', () => toggleNav(true, btn)));
        closeNavBtn.addEventListener('click', () => toggleNav(false));
        navOverlay.addEventListener('click', () => toggleNav(false));

        document.addEventListener('keydown', (e) => {
            const open = navSidebar.classList.contains('active');
            if (!open) return;
            if (e.key === 'Escape') {
                toggleNav(false);
                return;
            }
            // Lightweight focus trap: keep Tab within the sidebar
            if (e.key === 'Tab') {
                const first = sidebarFocusables[0];
                const last = sidebarFocusables[sidebarFocusables.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        });

        // Navigation: the hash is the single source of truth for screens
        navRecipeViewer.addEventListener('click', () => {
            location.hash = '#/search';
            toggleNav(false);
        });
        navLoadoutEditor.addEventListener('click', () => {
            location.hash = '#/loadout';
            toggleNav(false);
        });

        // Highlight the active page in the sidebar
        function updateNavState(screen) {
            navRecipeViewer.classList.toggle('active', screen === 'search' || screen === 'recipe');
            navLoadoutEditor.classList.toggle('active', screen === 'loadout');
            navRecipeViewer.setAttribute('aria-current', (screen === 'search' || screen === 'recipe') ? 'page' : 'false');
            navLoadoutEditor.setAttribute('aria-current', screen === 'loadout' ? 'page' : 'false');
        }
        updateNavState(location.hash === '#/loadout' ? 'loadout' : 'search');
        window.addEventListener('routechange', (e) => updateNavState(e.detail));
    } catch (error) {
        console.error('Error initializing application:', error);
        document.getElementById('app').textContent = 'Failed to initialize the application.';
    }
});
