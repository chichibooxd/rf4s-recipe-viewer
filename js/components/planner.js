// Character Planner: skill levels → HP/RP/STR/INT/VIT, craft RP costs.
// Formulas follow clepe's Stats Guide (GameFAQs FAQ 74139); base values
// and per-skill yields come from the data dump's Level Up / Skill Stats /
// Skill Action Exp sheets.

// Canonical skill order of the Skill Stats sheet (38 rows), verified
// against the ID sequence and clepe's table. The craftSubClass column
// is unreliable, so identity is by row index.
const SKILL_NAMES = [
    'Short Sword', 'Long Sword', 'Spear', 'Axe/Hammer', 'Dual Blades', 'Fist',
    'Fire', 'Water', 'Earth', 'Wind', 'Light', 'Dark', 'Love',
    'Farming', 'Logging', 'Mining', 'Fishing',
    'Cooking', 'Forging', 'Chemistry', 'Crafting',
    'Searching', 'Walking', 'Sleeping', 'Eating', 'Defense',
    'Resist Poison', 'Resist Seals', 'Resist Paralysis', 'Resist Sleep',
    'Resist Fatigue', 'Resist Cold', 'Resist Knockout',
    'Bathing', 'Taming', 'Throwing', 'Leadership', 'Bartering'
];

const PRODUCTION_SKILLS = ['Forging', 'Crafting', 'Chemistry', 'Cooking'];

// --- Data parsing (bounds-guarded: trailing zeros are stripped) ---

export function parseLevelUp(rawData) {
    const strings = rawData.strings;
    const sheets = rawData.data;
    const sheet = sheets[strToId(rawData, 'Level Up')];
    if (!sheet) return [];
    const headers = sheet[0].map(id => strings[id]);
    const idx = {
        level: headers.indexOf('Level'),
        xp: headers.indexOf('XP'),
        hp: headers.indexOf('HP'),
        rp: headers.indexOf('RP'),
        str: headers.indexOf('STR'),
        int: headers.indexOf('INT'),
        vit: headers.indexOf('VIT')
    };
    const stats = [null]; // 1-indexed
    for (let i = 1; i < sheet.length; i++) {
        const row = sheet[i];
        const get = (key) => idx[key] !== -1 && idx[key] < row.length ? row[idx[key]] : 0;
        const level = get('level');
        if (!Number.isFinite(level)) continue;
        stats[level] = {
            xp: get('xp'), hp: get('hp'), rp: get('rp'),
            str: get('str'), int: get('int'), vit: get('vit')
        };
    }
    return stats;
}

export function parseSkillStats(rawData) {
    const strings = rawData.strings;
    const sheets = rawData.data;
    const sheet = sheets[strToId(rawData, 'Skill Stats')];
    if (!sheet) return [];
    const headers = sheet[0].map(id => strings[id]);
    const idx = {
        hp: headers.indexOf('HP'),
        rp: headers.indexOf('RP'),
        str: headers.indexOf('STR'),
        int: headers.indexOf('INT'),
        vit: headers.indexOf('VIT')
    };
    const skills = [];
    for (let i = 1; i < sheet.length && i <= SKILL_NAMES.length; i++) {
        const row = sheet[i];
        const get = (key) => idx[key] !== -1 && idx[key] < row.length ? row[idx[key]] : 0;
        skills.push({
            name: SKILL_NAMES[i - 1],
            hp: get('hp'), rp: get('rp'), str: get('str'), int: get('int'), vit: get('vit')
        });
    }
    return skills;
}

export function parseCraftCosts(rawData) {
    const strings = rawData.strings;
    const sheets = rawData.data;
    const sheet = sheets[strToId(rawData, 'Skill Action Exp')];
    if (!sheet) return {};
    const headers = sheet[0].map(id => strings[id]);
    const actionIdx = headers.indexOf('Action');
    const flatIdx = headers.indexOf('RP Cost');
    const pctIdx = headers.indexOf('RP % Cost');
    const costs = {};
    for (let i = 1; i < sheet.length; i++) {
        const row = sheet[i];
        if (actionIdx === -1 || actionIdx >= row.length || !row[actionIdx]) continue;
        const action = strings[row[actionIdx]];
        if (action !== 'Forge' && action !== 'Craft' && action !== 'Mix' && action !== 'Cook') continue;
        if (costs[action]) continue; // keep the first occurrence
        costs[action] = {
            flat: flatIdx !== -1 && flatIdx < row.length ? row[flatIdx] : 0,
            pct: pctIdx !== -1 && pctIdx < row.length ? row[pctIdx] : 0
        };
    }
    return costs;
}

function strToId(rawData, name) {
    return rawData.strings.indexOf(name);
}

// --- Stat calculation ---

// Per-skill stat contribution. Yields floor individually before summing
// (clepe's rounding rule); HP yields double every 50 skill levels, STR/INT/VIT
// every 300; RP caps at skill level 100.
function contribution(yieldVal, level, multiplierEvery, cap) {
    const lvl = cap ? Math.min(level, cap) : level;
    const multiplier = 1 + Math.floor((level - 1) / multiplierEvery);
    return Math.floor(yieldVal * lvl * multiplier);
}

export function computeCharacterStats(level, skillLevels, levelStats, skillStats) {
    const base = (levelStats && levelStats[level]) || { hp: 0, rp: 0, str: 0, int: 0, vit: 0 };
    const totals = { hp: base.hp, rp: base.rp, str: base.str, int: base.int, vit: base.vit };
    (skillStats || []).forEach((skill, i) => {
        const lvl = skillLevels[i] || 0;
        if (lvl <= 0) return;
        totals.hp += contribution(skill.hp, lvl, 50, null);
        totals.rp += contribution(skill.rp, lvl, Infinity, 100);
        totals.str += contribution(skill.str, lvl, 300, null);
        totals.int += contribution(skill.int, lvl, 300, null);
        totals.vit += contribution(skill.vit, lvl, 300, null);
    });
    // Derived combat stats (equipment adds on top)
    totals.atk = totals.str;
    totals.matk = totals.int;
    totals.def = Math.floor(totals.vit / 2);
    totals.mdef = Math.floor(totals.vit / 2);
    return totals;
}

export function craftRpCost(cost, maxRp) {
    return cost.flat + Math.round(maxRp * cost.pct);
}

// --- UI ---

export function initPlanner(rawData) {
    const levelStats = parseLevelUp(rawData);
    const skillStats = parseSkillStats(rawData);
    const craftCosts = parseCraftCosts(rawData);

    const skillsContainer = document.getElementById('planner-skills');
    const statsGrid = document.getElementById('planner-stats');
    const costsGrid = document.getElementById('planner-costs');
    const levelInput = document.getElementById('planner-level');
    const notes = document.getElementById('planner-notes');

    // Keyed by skill name so UI grouping never breaks the canonical order
    const skillInputs = new Map();

    function buildSkillInputs() {
        // Production skills first, then the rest in a collapsible group
        const production = skillStats.filter(s => PRODUCTION_SKILLS.includes(s.name));
        const others = skillStats.filter(s => !PRODUCTION_SKILLS.includes(s.name));

        const groups = [
            { title: 'Production Skills', skills: production, open: true },
            { title: 'Other Skills', skills: others, open: false }
        ];

        groups.forEach(group => {
            const details = document.createElement('details');
            details.className = 'planner-group';
            details.open = group.open;
            const summary = document.createElement('summary');
            summary.textContent = group.title;
            details.appendChild(summary);

            const list = document.createElement('div');
            list.className = 'planner-skill-list';
            group.skills.forEach(skill => {
                const row = document.createElement('label');
                row.className = 'planner-skill';
                row.textContent = skill.name;

                const input = document.createElement('input');
                input.type = 'number';
                input.min = 0;
                input.max = 999;
                input.value = 0;
                input.setAttribute('aria-label', `${skill.name} level`);
                input.addEventListener('change', () => {
                    saveState();
                    recompute();
                });
                skillInputs.set(skill.name, input);
                row.appendChild(input);
                list.appendChild(row);
            });
            details.appendChild(list);
            skillsContainer.appendChild(details);
        });
    }

    function recompute() {
        const level = Math.max(1, Math.min(200, parseInt(levelInput.value, 10) || 1));
        const skillLevels = skillStats.map(skill => parseInt(skillInputs.get(skill.name).value, 10) || 0);
        const stats = computeCharacterStats(level, skillLevels, levelStats, skillStats);

        statsGrid.replaceChildren();
        const entries = [
            ['HP', stats.hp], ['RP', stats.rp], ['STR', stats.str], ['INT', stats.int],
            ['VIT', stats.vit], ['ATK', stats.atk], ['M.ATK', stats.matk],
            ['DEF', stats.def], ['M.DEF', stats.mdef]
        ];
        const fragment = document.createDocumentFragment();
        entries.forEach(([name, value]) => {
            const box = document.createElement('div');
            box.className = 'stat-box';
            const strong = document.createElement('strong');
            strong.textContent = `${name}:`;
            box.appendChild(strong);
            box.appendChild(document.createTextNode(` ${value}`));
            // import lazily to avoid circular imports
            import('../utils/stat-info.js').then(({ attachStatInfo }) => attachStatInfo(box, name, 'general'));
            fragment.appendChild(box);
        });
        statsGrid.appendChild(fragment);

        // Craft RP costs
        costsGrid.replaceChildren();
        const skillNames = {
            Forge: 'Forging', Craft: 'Crafting', Mix: 'Chemistry', Cook: 'Cooking'
        };
        Object.entries(craftCosts).forEach(([action, cost]) => {
            const rpCost = craftRpCost(cost, stats.rp);
            const perCraft = document.createElement('div');
            perCraft.className = 'stat-box';
            const strong = document.createElement('strong');
            strong.textContent = `${skillNames[action]}:`;
            perCraft.appendChild(strong);
            perCraft.appendChild(document.createTextNode(` ${rpCost} RP (${Math.floor(stats.rp / rpCost)} crafts)`));
            costsGrid.appendChild(perCraft);
        });

        notes.textContent = 'Craft success percentage and XP gained per craft are not yet available — those formulas are game logic and still under research.';
    }

    // Persist the planner state so it survives reloads
    function saveState() {
        try {
            localStorage.setItem('rf4-planner', JSON.stringify({
                level: levelInput.value,
                skills: skillStats.map(skill => skillInputs.get(skill.name).value)
            }));
        } catch (e) { /* storage unavailable */ }
    }

    function restoreState() {
        try {
            const saved = JSON.parse(localStorage.getItem('rf4-planner') || 'null');
            if (!saved) return;
            if (saved.level) levelInput.value = saved.level;
            (saved.skills || []).forEach((v, i) => {
                const name = skillStats[i] && skillStats[i].name;
                if (name && skillInputs.get(name)) skillInputs.get(name).value = v;
            });
        } catch (e) { /* storage unavailable */ }
    }

    levelInput.addEventListener('change', () => {
        saveState();
        recompute();
    });

    buildSkillInputs();
    restoreState();
    recompute();
}
