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
        getBoundingClientRect() {
            return { left: 0, top: 0, width: 100, height: 20, right: 100, bottom: 20 };
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

const documentListeners = {};
const document = {
    activeElement: null,
    body: null,
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
    contains() { return true; },
    addEventListener(type, fn) { (documentListeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) {
        if (documentListeners[type]) documentListeners[type] = documentListeners[type].filter(f => f !== fn);
    }
};

const hashListeners = [];
const historyEntries = [''];
const location = {
    _hash: '',
    get hash() { return this._hash; },
    set hash(v) {
        if (this._hash === v) return;
        this._hash = v;
        // like a browser: assigning location.hash adds a history entry
        historyEntries.push(v);
        hashListeners.forEach(fn => fn());
    }
};
const history = {
    replaceState(_state, _unused, url) {
        if (!url) return;
        historyEntries[historyEntries.length - 1] = url;
        location._hash = url;
    },
    pushState(_state, _unused, url) {
        if (!url) return;
        historyEntries.push(url);
        location._hash = url;
    },
    back() {
        if (historyEntries.length > 1) {
            historyEntries.pop();
            location._hash = historyEntries[historyEntries.length - 1];
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
globalThis.localStorage = {
    _store: {},
    getItem(k) { return this._store[k] ?? null; },
    setItem(k, v) { this._store[k] = String(v); }
};
globalThis.window = {
    innerWidth: 400,
    innerHeight: 800,
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
['search-screen', 'recipe-screen', 'loadout-screen', 'planner-screen'].forEach(id => {
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
    'code-modal-title', 'code-copy-btn', 'code-import-btn', 'code-close-btn',
    'planner-skills', 'planner-stats', 'planner-costs', 'planner-level', 'planner-notes'];
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

// --- 6b. Recipe materials do NOT contribute; only inherited slots do (game-accurate) ---
{
    skill.value = 'Forging';
    fire(skill, 'change', { target: skill });
    subtype.value = 'Dual Blade';
    fire(subtype, 'change', { target: subtype });
    const target = byId['recipe-list'].children.find(li => li.textContent.includes('Steel Edge'));
    if (target) {
        fire(byId['recipe-list'], 'click', { target });
        check('Steel Edge detail open', byId['detail-title'].textContent === 'Steel Edge');
        // Steel Edge recipe: Iron + Iron + Bronze — none of these impart stats
        const detailText = byId['stats-container'].children.map(c => c.textContent).join(' ');
        check('no Inheritance Effects section (recipe materials contribute nothing)', !detailText.includes('Inheritance Effects'));
        fire(byId['equip-btn'], 'click');
        const boxes = byId['loadout-stats-grid'].children.map(c => c.textContent).join(' ');
        // base ATK 58/Diz 3, no DEF at all; recipe Iron/Bronze DEF not counted;
        // TDU 19 (Iron2+Iron2+Bronze15) >= 10 grants the +10 ATK tier bonus
        check('recipe materials do not add stats (DEF 0)', /DEF:\s*0/.test(boxes));
        check('TDU bonus applied (+10 ATK at skill >= 50)', /ATK:\s*68/.test(boxes) && boxes.includes('Total Difficulty bonus'));
        console.log('    Steel Edge totals (no inheritance):', boxes.replace(/\s+/g, ' ').slice(0, 140));
    } else {
        check('Steel Edge found', false);
    }
}

// --- 6c. Inheritance adds upgrade stats (Iron DEF +1), capped at 3 ---
{
    // open Steel Edge detail from the search list (still on Dual Blade filter)
    const target = byId['recipe-list'].children.find(li => li.textContent.includes('Steel Edge'));
    if (target) {
        fire(byId['recipe-list'], 'click', { target });
        const emptySlot = byId['detail-grid'].children.find(c => c.classList.contains('empty-fillable'));
        check('empty slot is fillable on equipment', !!emptySlot);
        emptySlot.onclick();
        check('pick mode active for inheritance', !byId['pick-banner'].hidden);
        // find Iron: ingredient items pick up their Category value from the
        // data dump, which for Iron resolves to the 'Short Sword' subtype
        skill.value = 'All';
        fire(skill, 'change', { target: skill });
        subtype.value = 'Short Sword';
        fire(subtype, 'change', { target: subtype });
        const iron = byId['recipe-list'].children.find(li => li.textContent.startsWith('Iron —'));
        check('Iron found in results', !!iron);
        fire(byId['recipe-list'], 'click', { target: iron });
        check('returned to Steel Edge detail after pick', byId['detail-title'].textContent === 'Steel Edge');
        const detailText = byId['stats-container'].children.map(c => c.textContent).join(' ');
        check('Inheritance Effects shown (Iron DEF +1)', detailText.includes('Inheritance Effects') && detailText.includes('DEF: 1'));
        fire(byId['equip-btn'], 'click');
        const boxes = byId['loadout-stats-grid'].children.map(c => c.textContent).join(' ');
        const defMatch = boxes.match(/DEF:\s*(\d+)/);
        // Steel Edge has no base DEF; only the inherited Iron contributes DEF 1
        check('loadout total DEF 1 = inherited Iron only', defMatch && parseInt(defMatch[1], 10) === 1);
        // All stats are now shown (zeros included)
        check('loadout shows all stats incl. zeros (Fire Res%: 0)', /Fire Res%:\s*0/.test(boxes));
        check('loadout shows 37 stat boxes', byId['loadout-stats-grid'].children.filter(c => c.className.includes('stat-box')).length === 37);
        // Loadout persists to localStorage
        check('loadout persisted to localStorage', !!JSON.parse(globalThis.localStorage.getItem('rf4-loadout') || 'null').Weapon);
        console.log('    Steel Edge totals (with Iron inherited):', boxes.replace(/\s+/g, ' ').slice(0, 140));
    } else {
        check('Steel Edge found for inheritance', false);
    }
}

// --- 6d. Cooking stats: dish effects + ingredient cooking effects ---
{
    skill.value = 'Cooking';
    fire(skill, 'change', { target: skill });
    subtype.value = 'All';
    fire(subtype, 'change', { target: subtype });
    const salad = byId['recipe-list'].children.find(li => li.textContent.includes('Salad'));
    if (salad) {
        fire(byId['recipe-list'], 'click', { target: salad });
        check('Salad detail open', byId['detail-title'].textContent === 'Salad');
        const text = byId['stats-container'].children.map(c => c.textContent).join(' ');
        check('Salad shows Dish Effects (base)', text.includes('Dish Effects (base)') && text.includes('HP: 5000'));
        check('Salad shows Ingredient Cooking Effects', text.includes('Ingredient Cooking Effects') && text.includes('HP cook:'));
        const emptySlot = byId['detail-grid'].children.find(c => c.classList.contains('empty-fillable'));
        check('food slots are NOT fillable (no inheritance on food)', !emptySlot);
        // Craft cost from planner max RP appears on production recipes
        check('recipe detail shows craft RP cost from planner', /Crafting costs \d+ RP/.test(text) && /planner max RP/.test(text));
        console.log('    Salad detail:', text.replace(/\s+/g, ' ').slice(0, 160));
    } else {
        check('Salad found', false);
    }
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

// --- 11. Planner: stats editor + RP calc (clepe's guide examples) ---
{
    // navigate to the planner route
    location.hash = '#/planner';
    hashListeners.forEach(fn => fn());
    check('planner route active', byId['planner-screen'].classList.contains('active'));

    const findInput = (root, label) => {
        for (const child of root.children) {
            if (child.getAttribute && child.getAttribute('aria-label') === label) return child;
            if (child.children) {
                const found = findInput(child, label);
                if (found) return found;
            }
        }
        return null;
    };

    const statsText = () => byId['planner-stats'].children.map(c => c.textContent).join(' ');
    const costsText = () => byId['planner-costs'].children.map(c => c.textContent).join(' ');

    // Level 1, no skills → clepe's base stats
    check('planner: L1 base HP 25', /HP:\s*25/.test(statsText()));
    check('planner: L1 base RP 56', /RP:\s*56/.test(statsText()));
    check('planner: L1 base STR 5', /STR:\s*5/.test(statsText()));

    // Mining 50 → 75 HP (clepe's example)
    byId['planner-level'].value = '1';
    const mining = findInput(byId['planner-skills'], 'Mining level');
    check('planner: Mining input exists', !!mining);
    if (mining) {
        mining.value = '50';
        fire(mining, 'change', { target: mining });
        check('planner: Mining 50 → HP 75', /HP:\s*75/.test(statsText()));
        check('planner: Mining 50 → RP 106', /RP:\s*106/.test(statsText()));
    }

    // Craft RP costs at current max RP (56 at L1): Forge 16 + 4% = 20
    check('planner: Forge RP cost shown', /Forging:\s*\d+ RP/.test(costsText()));
    const forgeCost = parseInt(costsText().match(/Forging:\s*(\d+)/)?.[1] || '0', 10);
    const cookCost = parseInt(costsText().match(/Cooking:\s*(\d+)/)?.[1] || '999', 10);
    check('planner: cook cost cheaper than forge', cookCost < forgeCost);

    // pure functions also verified directly
    const { parseLevelUp, parseSkillStats, computeCharacterStats, craftRpCost } =
        await import(APP + 'js/components/planner.js');
    const raw = JSON.parse(readFileSync(APP + 'data/data.json', 'utf8'));
    const levels = parseLevelUp(raw);
    const skills = parseSkillStats(raw);
    check('planner: 38 skills parsed', skills.length === 38);
    check('planner: 200 levels parsed', levels.length - 1 === 200);
    const forge = skills.find(s => s.name === 'Forging');
    check('planner: Forging yields RP 0.25 STR 0.5', forge.rp === 0.25 && forge.str === 0.5);
    const zeros = skills.map(() => 0);
    const base = computeCharacterStats(1, zeros, levels, skills);
    check('planner: computeCharacterStats base matches data', base.hp === 25 && base.rp === 56 && base.str === 5 && base.int === 5 && base.vit === 4);
    check('planner: craftRpCost Forge@56 = 20', craftRpCost({ flat: 16, pct: 0.06349206349206349 }, 56) === 20);
}

// --- 10. Stat glossary + tooltip ---
{
    const { statDescription, attachStatInfo } = await import(APP + 'js/utils/stat-info.js');
    check('glossary: STR explains +1 ATK', statDescription('STR').includes('+1 ATK'));
    check('glossary: VIT explains 0.5 DEF/MDEF', statDescription('VIT').includes('0.5 DEF'));
    check('glossary: RP explained as rune points', statDescription('RP').includes('Rune'));
    check('glossary: cook fallback', statDescription('CustomStat', 'cook').includes('Cooking effect'));
    check('glossary: upgrade fallback', statDescription('CustomStat', 'upgrade').includes('Upgrade effect'));
    document.body = makeEl('body');
    const box = makeEl('div');
    attachStatInfo(box, 'STR', 'general');
    fire(box, 'click', { target: box, stopPropagation() {} });
    check('tooltip shown on stat click', !!document.body.children.find(c => c.className.includes('stat-tooltip')) &&
        document.body.children.find(c => c.className.includes('stat-tooltip')).textContent.includes('Strength'));
}

console.log(failures === 0 ? '\nSMOKE TEST PASSED' : `\nSMOKE TEST FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
