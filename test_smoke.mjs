// Minimal DOM/history/fetch stub to smoke-test recipe-viewer + loadout-builder in Node.
import { readFileSync } from 'node:fs';

const listeners = {};
const screens = [];
const byId = {};

function makeEl(tag = 'div') {
    let ownText = '';
    const el = {
        tagName: tag.toUpperCase(),
        isSelect: tag === 'select',
        children: [],
        className: '',
        style: {},
        dataset: {},
        _listeners: {},
        hidden: false,
        title: '',
        value: '',
        onclick: null,
        innerHTML: '',
        get textContent() {
            if (ownText) return ownText;
            return el.children.map(c => c.textContent || c.text || '').join('');
        },
        set textContent(v) { ownText = String(v); },
        appendChild(child) {
            if (child && child.tagName === '#FRAGMENT') {
                this.children.push(...child.children);
            } else {
                this.children.push(child);
            }
            return child;
        },
        append(...kids) { kids.forEach(k => this.children.push(k)); },
        replaceChildren(...kids) { this.children = [...kids]; },
        addEventListener(type, fn) { (this._listeners[type] ||= []).push(fn); },
        removeEventListener(type, fn) {
            if (this._listeners[type]) this._listeners[type] = this._listeners[type].filter(f => f !== fn);
        },
        setAttribute(k, v) { this['attr_' + k] = String(v); },
        getAttribute(k) { return this['attr_' + k]; },
        focus() { document.activeElement = this; },
        select() {},
        closest(sel) {
            if (sel === '.recipe-item' && this.className.includes('recipe-item')) return this;
            return null;
        },
        classList: {
            add(...cs) { cs.forEach(c => { if (!this.contains(c)) el.className += (el.className ? ' ' : '') + c; }); },
            remove(...cs) { el.className = el.className.split(/\s+/).filter(c => !cs.includes(c)).join(' '); },
            toggle(c, force) {
                const has = el.classList.contains(c);
                const want = force === undefined ? !has : force;
                if (want) el.classList.add(c); else el.classList.remove(c);
            },
            contains(c) { return el.className.split(/\s+/).includes(c); }
        },
        querySelectorAll(sel) {
            if (sel === 'select') return el.children.filter(c => c.isSelect);
            return [];
        }
    };
    return el;
}

const document = {
    activeElement: null,
    getElementById(id) {
        if (!byId[id]) byId[id] = makeEl('div');
        return byId[id];
    },
    querySelectorAll(sel) {
        if (sel === '.screen') return screens;
        return [];
    },
    createElement(tag) { return makeEl(tag); },
    createDocumentFragment() { return makeEl('#fragment'); },
    createTextNode(t) { return { text: String(t), textContent: String(t) }; },
    contains() { return true; }
};

const hashListeners = [];
const location = {
    _hash: '',
    get hash() { return this._hash; },
    set hash(v) {
        if (this._hash !== v) { this._hash = v; hashListeners.forEach(fn => fn()); }
    }
};
const history = {
    _stack: [''],
    replaceState(_state, _unused, url) {
        if (!url) return;
        this._stack[this._stack.length - 1] = url;
        location._hash = url;
    },
    pushState(_state, _unused, url) {
        if (!url) return;
        this._stack.push(url);
        location._hash = url;
    },
    back() {
        if (this._stack.length > 1) {
            this._stack.pop();
            location._hash = this._stack[this._stack.length - 1];
            hashListeners.forEach(fn => fn());
        }
    }
};
const navigator = { clipboard: { writeText: async () => { /* noop */ } } };
globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
};

globalThis.document = document;
globalThis.location = location;
globalThis.history = history;
Object.defineProperty(globalThis, 'navigator', { value: navigator, configurable: true, writable: true });
globalThis.window = {
    addEventListener(type, fn) { if (type === 'hashchange') hashListeners.push(fn); },
    dispatchEvent(ev) {
        if (ev.type === 'routechange') routeListeners.forEach(fn => fn(ev));
        return true;
    }
};
const routeListeners = [];
globalThis.window.addEventListener = (type, fn) => {
    if (type === 'hashchange') hashListeners.push(fn);
    if (type === 'routechange') routeListeners.push(fn);
};
globalThis.alert = msg => console.log('[alert]', msg);

// Build the screens and register ids used by the UI template
['search-screen', 'recipe-screen', 'loadout-screen'].forEach(id => {
    const el = makeEl('div');
    el.id = id;
    byId[id] = el;
    screens.push(el);
    el.classList.add('screen');
});
byId['search-screen'].classList.add('active');

const IDS = ['input-grid', 'recipe-list', 'detail-grid', 'detail-title', 'back-btn', 'reset-btn',
    'equip-btn', 'skill-filter', 'subtype-filter', 'stats-container', 'results-status',
    'pick-banner', 'pick-banner-text', 'pick-cancel-btn', 'loadout-slots', 'loadout-stats-grid',
    'share-loadout-btn', 'import-loadout-btn', 'code-modal', 'code-textarea', 'code-modal-status',
    'code-modal-title', 'code-copy-btn', 'code-import-btn', 'code-close-btn'];
IDS.forEach(id => { if (!byId[id]) byId[id] = makeEl('div'); });
byId['pick-banner'].hidden = true; // ui.html starts with hidden attribute
byId['results-status'].hidden = true;
byId['code-modal'].hidden = true;
byId['skill-filter'].isSelect = true;
byId['subtype-filter'].isSelect = true;
byId['recipe-list'].classList.add('recipe-list');

// Stub fetch to return the real data.json
globalThis.fetch = async () => ({ ok: true, json: async () => JSON.parse(readFileSync(APP + '/data/data.json', 'utf8')) });

function fire(el, type, ev = {}) {
    (el._listeners[type] || []).forEach(fn => fn({ target: el, ...ev }));
}

const APP = new URL('./', import.meta.url).pathname;
const { initRecipeViewer } = await import(APP + 'js/components/recipe-viewer.js');
const api = await initRecipeViewer();
console.log('    after init: hash =', JSON.stringify(location.hash), 'history =', typeof history);
console.log('    globalThis.location === location:', globalThis.location === location);
console.log('    globalThis.history === history:', globalThis.history === history);
history.replaceState(null, '', '#/manual');
console.log('    after manual replaceState:', JSON.stringify(location.hash));
history.replaceState(null, '', '#/search');

let failures = 0;
function check(name, cond, extra = '') {
    if (cond) console.log(`  ok  ${name}`);
    else { failures++; console.log(` FAIL ${name} ${extra}`); }
}

// --- 1. Initial state ---
check('search screen active', byId['search-screen'].classList.contains('active'));
check('loadout screen hidden', !byId['loadout-screen'].classList.contains('active'));
check('hint shown with no filters', !byId['results-status'].hidden && byId['results-status'].textContent.includes('Pick a skill'));
check('hash normalized to #/search', location.hash === '#/search');
check('pick banner hidden', byId['pick-banner'].hidden);

// --- 2. Filtering ---
const skill = byId['skill-filter'];
const subtype = byId['subtype-filter'];
fire(skill, 'change', { target: skill });
// Force a change event with value 'Forging'
skill.value = 'Forging';
fire(skill, 'change', { target: skill });
check('subtype dropdown has options', subtype.children.length > 1);
check('results populated for Forging', byId['recipe-list'].children.length > 0);

// --- 3. Open a detail from the list ---
const listItem = byId['recipe-list'].children[0];
console.log('    first result text:', JSON.stringify(listItem.textContent), 'id:', JSON.stringify(listItem.dataset.id));
check('result label has Lv', listItem.textContent.includes('Lv.') && !/Lv\.0$/.test(listItem.textContent));
fire(byId['recipe-list'], 'click', { target: listItem });
console.log('    after click, hash:', JSON.stringify(location.hash));
check('navigated to #/recipe/', location.hash.startsWith('#/recipe/'));
check('recipe screen active', byId['recipe-screen'].classList.contains('active'));
check('detail title set', byId['detail-title'].textContent.length > 0);

// --- 3b. Material drill-down (P3.10) ---
{
    const clickable = byId['detail-grid'].children.find(c => c.classList.contains('clickable'));
    if (clickable) {
        clickable.onclick();
        check('material drill-down navigates to its recipe', location.hash.startsWith('#/recipe/') && location.hash !== '#/recipe/' + encodeURIComponent('2_2997'));
        // navigate back to the Broadsword detail for the pick-mode test
        byId['back-btn'].onclick();
        check('back from material detail', location.hash.startsWith('#/recipe/'));
    } else {
        check('material slot clickable found', false);
    }
}

// --- 4. Pick mode: click an empty slot ---
let emptySlot = null;
for (const child of byId['detail-grid'].children) {
    if (child.classList.contains('empty-fillable')) { emptySlot = child; break; }
}
if (emptySlot) {
    emptySlot.onclick();
    check('pick mode navigates to #/search', location.hash === '#/search');
    check('pick banner visible', !byId['pick-banner'].hidden);
    check('banner text mentions slot', byId['pick-banner-text'].textContent.includes('material slot'));
    // Cancel
    fire(byId['pick-cancel-btn'], 'click');
    check('cancel hides banner', byId['pick-banner'].hidden);
}

// --- 5. Back button ---
fire(byId['back-btn'], 'click');
check('back returns to search', location.hash === '#/search' && byId['search-screen'].classList.contains('active'));

// --- 6. Loadout: equip a weapon with materials that have stats ---
// Find Steel Sword recipe, open it, equip
const steelSword = api && null;
{
    // simulate: navigate by clicking the Steel Sword entry through the full data is complex;
    // instead open via the api's internal path is not exposed. Use search instead.
}
check('api exposes getDetailItem', typeof api.getDetailItem === 'function');
check('api exposes isPickMode', typeof api.isPickMode === 'function');

// Equip flow: fire equip button on a detail view of Steel Sword
// Find the Steel Sword recipe row via Forging + subtype Short Sword
{
    skill.value = 'Forging';
    fire(skill, 'change', { target: skill });
    subtype.value = 'Short Sword';
    fire(subtype, 'change', { target: subtype });
    const target = byId['recipe-list'].children.find(li => li.textContent.includes('Steel Sword'));
    if (target) {
        fire(byId['recipe-list'], 'click', { target });
        check('Steel Sword detail open', byId['detail-title'].textContent === 'Steel Sword');
        check('equip button visible', byId['equip-btn'].style.display !== 'none');
        fire(byId['equip-btn'], 'click');
        check('navigated to #/loadout', location.hash === '#/loadout');
        check('loadout screen active', byId['loadout-screen'].classList.contains('active'));
        const statsChildren = byId['loadout-stats-grid'].children;
        console.log('    stats children:', statsChildren.length, statsChildren.map(c => JSON.stringify(c.textContent)).join(' | ').slice(0, 200));
        console.log('    slots children:', byId['loadout-slots'].children.length);
        const statsText = (statsChildren.map(c => c.textContent).join(' ')) || '';
        check('loadout totals include ATK/DEF from base+materials', /ATK:/.test(statsText) && !/No stats/.test(statsText));
        console.log('    loadout stats sample:', statsText.slice(0, 120));
    } else {
        check('Steel Sword found', false);
    }
}

// --- 6b. Material upgrade stats flow into totals (P2.7) ---
{
    skill.value = 'Forging';
    fire(skill, 'change', { target: skill });
    subtype.value = 'Dual Blade';
    fire(subtype, 'change', { target: subtype });
    const target = byId['recipe-list'].children.find(li => li.textContent.includes('Steel Edge'));
    if (target) {
        fire(byId['recipe-list'], 'click', { target });
        fire(byId['equip-btn'], 'click');
        const boxes = byId['loadout-stats-grid'].children.map(c => c.textContent).join(' ');
        // Steel Edge: base ATK/Diz + 2x Iron (DEF+1 each = DEF 2) + Claws
        const defMatch = boxes.match(/DEF:\s*(\d+)/);
        check('material upgrade stats (2x Iron DEF) in loadout totals', defMatch && parseInt(defMatch[1], 10) >= 2);
        console.log('    Steel Edge totals:', boxes.slice(0, 160));
    } else {
        check('Steel Edge found', false);
    }
    // back to Steel Sword for the modal tests
    skill.value = 'Forging';
    fire(skill, 'change', { target: skill });
}

// --- 7. Modal export ---
fire(byId['share-loadout-btn'], 'click');
check('modal opens for export', !byId['code-modal'].hidden);
check('textarea has code', byId['code-textarea'].value.length > 5);
fire(byId['code-close-btn'], 'click');
check('modal closes', byId['code-modal'].hidden);

// --- 8. Import invalid code ---
fire(byId['import-loadout-btn'], 'click');
check('modal opens for import', !byId['code-modal'].hidden);
byId['code-textarea'].value = '!!!not-a-code!!!';
fire(byId['code-import-btn'], 'click');
check('invalid code shows error', byId['code-modal-status'].className.includes('error'));
fire(byId['code-close-btn'], 'click');

// --- 9. Route refresh restore: direct load on detail route ---
hashListeners.forEach(fn => fn());

console.log(failures === 0 ? '\nSMOKE TEST PASSED' : `\nSMOKE TEST FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
