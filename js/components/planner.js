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
    const sheetRows = sheets[stringIndex(rawData, 'Level Up')];
    if (!sheetRows) return [];
    const headers = sheetRows[0].map(id => strings[id]);
    const columnIndices = {
        level: headers.indexOf('Level'),
        xp: headers.indexOf('XP'),
        hp: headers.indexOf('HP'),
        rp: headers.indexOf('RP'),
        str: headers.indexOf('STR'),
        int: headers.indexOf('INT'),
        vit: headers.indexOf('VIT')
    };
    const levelStatsByLevel = [null]; // 1-indexed
    for (let i = 1; i < sheetRows.length; i++) {
        const row = sheetRows[i];
        const readCell = (key) => columnIndices[key] !== -1 && columnIndices[key] < row.length ? row[columnIndices[key]] : 0;
        const level = readCell('level');
        if (!Number.isFinite(level)) continue;
        levelStatsByLevel[level] = {
            xp: readCell('xp'), hp: readCell('hp'), rp: readCell('rp'),
            str: readCell('str'), int: readCell('int'), vit: readCell('vit')
        };
    }
    return levelStatsByLevel;
}

export function parseSkillStats(rawData) {
    const strings = rawData.strings;
    const sheets = rawData.data;
    const sheetRows = sheets[stringIndex(rawData, 'Skill Stats')];
    if (!sheetRows) return [];
    const headers = sheetRows[0].map(id => strings[id]);
    const columnIndices = {
        hp: headers.indexOf('HP'),
        rp: headers.indexOf('RP'),
        str: headers.indexOf('STR'),
        int: headers.indexOf('INT'),
        vit: headers.indexOf('VIT')
    };
    const skillStats = [];
    for (let i = 1; i < sheetRows.length && i <= SKILL_NAMES.length; i++) {
        const row = sheetRows[i];
        const readCell = (key) => columnIndices[key] !== -1 && columnIndices[key] < row.length ? row[columnIndices[key]] : 0;
        skillStats.push({
            name: SKILL_NAMES[i - 1],
            hp: readCell('hp'), rp: readCell('rp'), str: readCell('str'), int: readCell('int'), vit: readCell('vit')
        });
    }
    return skillStats;
}

export function parseCraftCosts(rawData) {
    const strings = rawData.strings;
    const sheets = rawData.data;
    const sheetRows = sheets[stringIndex(rawData, 'Skill Action Exp')];
    if (!sheetRows) return {};
    const headers = sheetRows[0].map(id => strings[id]);
    const actionColumnIndex = headers.indexOf('Action');
    const flatCostColumnIndex = headers.indexOf('RP Cost');
    const pctCostColumnIndex = headers.indexOf('RP % Cost');
    const craftCostsByAction = {};
    for (let i = 1; i < sheetRows.length; i++) {
        const row = sheetRows[i];
        if (actionColumnIndex === -1 || actionColumnIndex >= row.length || !row[actionColumnIndex]) continue;
        const action = strings[row[actionColumnIndex]];
        if (action !== 'Forge' && action !== 'Craft' && action !== 'Mix' && action !== 'Cook') continue;
        if (craftCostsByAction[action]) continue; // keep the first occurrence
        craftCostsByAction[action] = {
            flat: flatCostColumnIndex !== -1 && flatCostColumnIndex < row.length ? row[flatCostColumnIndex] : 0,
            pct: pctCostColumnIndex !== -1 && pctCostColumnIndex < row.length ? row[pctCostColumnIndex] : 0
        };
    }
    return craftCostsByAction;
}

function stringIndex(rawData, name) {
    return rawData.strings.indexOf(name);
}

// --- Stat calculation ---

// Per-skill stat contribution. Yields floor individually before summing
// (clepe's rounding rule); HP yields double every 50 skill levels, STR/INT/VIT
// every 300; RP caps at skill level 100.
function skillStatContribution(yieldPerLevel, skillLevel, multiplierInterval, levelCap) {
    const cappedLevel = levelCap ? Math.min(skillLevel, levelCap) : skillLevel;
    const multiplier = 1 + Math.floor((skillLevel - 1) / multiplierInterval);
    return Math.floor(yieldPerLevel * cappedLevel * multiplier);
}

export function computeCharacterStats(level, skillLevels, levelStats, skillStats) {
    const base = (levelStats && levelStats[level]) || { hp: 0, rp: 0, str: 0, int: 0, vit: 0 };
    const totals = { hp: base.hp, rp: base.rp, str: base.str, int: base.int, vit: base.vit };
    (skillStats || []).forEach((skill, i) => {
        const skillLevel = skillLevels[i] || 0;
        if (skillLevel <= 0) return;
        totals.hp += skillStatContribution(skill.hp, skillLevel, 50, null);
        totals.rp += skillStatContribution(skill.rp, skillLevel, Infinity, 100);
        totals.str += skillStatContribution(skill.str, skillLevel, 300, null);
        totals.int += skillStatContribution(skill.int, skillLevel, 300, null);
        totals.vit += skillStatContribution(skill.vit, skillLevel, 300, null);
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

// Action key per skill (matches the Skill Action Exp sheet)
const SKILL_ACTION = {
    Forging: 'Forge',
    Crafting: 'Craft',
    Chemistry: 'Mix',
    Cooking: 'Cook'
};

// Shared state so the recipe detail can show craft costs from the planner
let lastComputedStats = null;
let craftCostsByAction = {};
let lastSkillLevels = null;

export function getPlannerMaxRp() {
    return lastComputedStats ? lastComputedStats.rp : null;
}

// Current skill level of the given skill (0 if not set)
export function getSkillLevel(skillName) {
    return lastSkillLevels ? (lastSkillLevels[skillName] || 0) : 0;
}

// RP cost to craft the given skill with the planner's current max RP
export function getCraftRpCostForSkill(skill) {
    const maxRp = getPlannerMaxRp();
    const action = SKILL_ACTION[skill];
    if (maxRp === null || !action || !craftCostsByAction[action]) return null;
    return craftRpCost(craftCostsByAction[action], maxRp);
}

// --- UI ---

export function initPlanner(rawData) {
    const levelStats = parseLevelUp(rawData);
    const skillStats = parseSkillStats(rawData);
    const craftCosts = parseCraftCosts(rawData);
    craftCostsByAction = craftCosts;

    const skillsContainer = document.getElementById('planner-skills');
    const statsGrid = document.getElementById('planner-stats');
    const costsGrid = document.getElementById('planner-costs');
    const levelInput = document.getElementById('planner-level');
    const notes = document.getElementById('planner-notes');

    // Keyed by skill name so UI grouping never breaks the canonical order
    const skillInputs = new Map();

    function buildSkillInputs() {
        // Production skills first, then the rest in a collapsible group
        const production = skillStats.filter(skill => PRODUCTION_SKILLS.includes(skill.name));
        const others = skillStats.filter(skill => !PRODUCTION_SKILLS.includes(skill.name));

        const groups = [
            { title: 'Production Skills', skills: production, open: true },
            { title: 'Other Skills', skills: others, open: false }
        ];

        groups.forEach(group => {
            const groupDetails = document.createElement('details');
            groupDetails.className = 'planner-group';
            groupDetails.open = group.open;
            const groupSummary = document.createElement('summary');
            groupSummary.textContent = group.title;
            groupDetails.appendChild(groupSummary);

            const skillList = document.createElement('div');
            skillList.className = 'planner-skill-list';
            group.skills.forEach(skill => {
                const skillRow = document.createElement('label');
                skillRow.className = 'planner-skill';
                skillRow.textContent = skill.name;

                const levelInputEl = document.createElement('input');
                levelInputEl.type = 'number';
                levelInputEl.min = 0;
                levelInputEl.max = 999;
                levelInputEl.value = 0;
                levelInputEl.setAttribute('aria-label', `${skill.name} level`);
                levelInputEl.addEventListener('change', () => {
                    saveState();
                    recompute();
                });
                skillInputs.set(skill.name, levelInputEl);
                skillRow.appendChild(levelInputEl);
                skillList.appendChild(skillRow);
            });
            groupDetails.appendChild(skillList);
            skillsContainer.appendChild(groupDetails);
        });
    }

    function recompute() {
        const level = Math.max(1, Math.min(200, parseInt(levelInput.value, 10) || 1));
        const skillLevels = skillStats.map(skill => parseInt(skillInputs.get(skill.name).value, 10) || 0);
        const computedStats = computeCharacterStats(level, skillLevels, levelStats, skillStats);
        lastComputedStats = computedStats;
        lastSkillLevels = Object.fromEntries(skillStats.map((skill, i) => [skill.name, skillLevels[i]]));

        statsGrid.replaceChildren();
        const statEntries = [
            ['HP', computedStats.hp], ['RP', computedStats.rp], ['STR', computedStats.str], ['INT', computedStats.int],
            ['VIT', computedStats.vit], ['ATK', computedStats.atk], ['M.ATK', computedStats.matk],
            ['DEF', computedStats.def], ['M.DEF', computedStats.mdef]
        ];
        const boxFragment = document.createDocumentFragment();
        statEntries.forEach(([statName, statValue]) => {
            const statBox = document.createElement('div');
            statBox.className = 'stat-box';
            const nameLabel = document.createElement('strong');
            nameLabel.textContent = `${statName}:`;
            statBox.appendChild(nameLabel);
            statBox.appendChild(document.createTextNode(` ${statValue}`));
            // import lazily to avoid circular imports
            import('../utils/stat-info.js').then(({ attachStatInfo }) => attachStatInfo(statBox, statName, 'general'));
            boxFragment.appendChild(statBox);
        });
        statsGrid.appendChild(boxFragment);

        // Craft RP costs
        costsGrid.replaceChildren();
        const actionSkillNames = {
            Forge: 'Forging', Craft: 'Crafting', Mix: 'Chemistry', Cook: 'Cooking'
        };
        Object.entries(craftCosts).forEach(([action, cost]) => {
            const rpCost = craftRpCost(cost, computedStats.rp);
            const costBox = document.createElement('div');
            costBox.className = 'stat-box';
            const nameLabel = document.createElement('strong');
            nameLabel.textContent = `${actionSkillNames[action]}:`;
            costBox.appendChild(nameLabel);
            costBox.appendChild(document.createTextNode(` ${rpCost} RP (${Math.floor(computedStats.rp / rpCost)} crafts)`));
            costsGrid.appendChild(costBox);
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
