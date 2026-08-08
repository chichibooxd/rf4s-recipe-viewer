// Stat/effect glossary for the click-to-explore tooltips.
// Descriptions follow the RF4 mechanics as documented in community research
// (clepe's Stats Guide, Kirbye2006's mechanic compilation).

const GLOSSARY = {
    // Combat stats (Equipment List / upgrade effects)
    'ATK': 'Attack. Damage of non-magical weapon attacks and weapon skills. Only found on weapons and equipment.',
    'MATK': 'Magic attack. Damage of spells and staff attacks. Only found on weapons and equipment.',
    'M.ATK': 'Magic attack. Damage of spells and staff attacks. Only found on weapons and equipment.',
    'DEF': 'Defense. Reduces damage taken from non-magical monster attacks and traps.',
    'MDEF': 'Magic defense. Reduces damage taken from magic attacks and elemental traps.',
    'M.DEF': 'Magic defense. Reduces damage taken from magic attacks and elemental traps.',
    'STR': 'Strength. Each point of STR adds +1 ATK.',
    'INT': 'Intelligence. Each point of INT adds +1 M.ATK.',
    'VIT': 'Vitality. Each point of VIT adds +0.5 DEF and +0.5 M.DEF.',
    'Diz': 'Chance to inflict Dizzy (trip) with attacks.',
    'Crit%': 'Chance to land a critical hit. Critical hits ignore enemy defense.',
    'Knock%': 'Chance to knock the enemy back with attacks.',
    'Stun%': 'Chance to stun the enemy with attacks.',
    'Psn Atk%': 'Chance to inflict Poison with attacks.',
    'Seal Atk%': 'Chance to inflict Seal (blocks magic) with attacks.',
    'Par Atk%': 'Chance to inflict Paralysis with attacks.',
    'Slp Atk%': 'Chance to inflict Sleep with attacks.',
    'Ftg Atk%': 'Chance to inflict Fatigue with attacks.',
    'Sick Atk%': 'Chance to inflict Sick with attacks.',
    'Faint Atk%': 'Chance to inflict Faint (instant knockout) with attacks.',
    'Drain Atk%': 'Chance to drain enemy HP with attacks.',
    'Fire Res%': 'Reduces fire damage taken. Total resistance over 100% absorbs the attack as HP.',
    'Water Res%': 'Reduces water damage taken. Total resistance over 100% absorbs the attack as HP.',
    'Earth Res%': 'Reduces earth damage taken. Total resistance over 100% absorbs the attack as HP.',
    'Wind Res%': 'Reduces wind damage taken. Total resistance over 100% absorbs the attack as HP.',
    'Light Res%': 'Reduces light damage taken. Total resistance over 100% absorbs the attack as HP.',
    'Dark Res%': 'Reduces dark damage taken. Total resistance over 100% absorbs the attack as HP.',
    'Love Res%': 'Reduces love-element damage taken.',
    'Diz Res%': 'Resistance to Dizzy (trip) status.',
    'Crt Res%': 'Resistance to critical hits.',
    'Knock Res%': 'Resistance to knockback.',
    'Psn Res%': 'Resistance to Poison status.',
    'Seal Res%': 'Resistance to Seal status.',
    'Par Res%': 'Resistance to Paralysis status.',
    'Slp Res%': 'Resistance to Sleep status.',
    'Ftg Res%': 'Resistance to Fatigue status.',
    'Sick Res%': 'Resistance to Sick status.',
    'Fnt Res%': 'Resistance to Faint (instant knockout).',
    'Drain Res%': 'Resistance to HP drain.',

    // Item Use Values (dishes, medicine, usable items)
    'HP': 'Maximum health.',
    'RP': 'Maximum Rune Points. Spent on crafting, upgrading, spells, and farm work.',
    'HP %': 'Restores this percentage of max HP when used.',
    'RP %': 'Restores this percentage of max RP when used.',
    'HP Max': 'Permanently raises max HP.',
    'RP Max': 'Permanently raises max RP.',
    'HP Max%': 'Temporarily raises max HP by this percentage.',
    'RP Max%': 'Temporarily raises max RP by this percentage.',
    'STR %': 'Temporarily raises STR by this percentage.',
    'INT %': 'Temporarily raises INT by this percentage.',
    'VIT %': 'Temporarily raises VIT by this percentage.',
    'Perm HP': 'Permanently raises max HP.',
    'Perm STR': 'Permanently raises STR.',
    'Perm INT': 'Permanently raises INT.',
    'Perm VIT': 'Permanently raises VIT.',

    // Cooking effects (hidden per-ingredient effects)
    'HP cook': 'Cooking effect — adds this HP restoration when used as an ingredient.',
    'RP cook': 'Cooking effect — adds this RP restoration when used as an ingredient.',
    'HP% cook': 'Cooking effect — adds this HP percentage when used as an ingredient.',
    'RP% cook': 'Cooking effect — adds this RP percentage when used as an ingredient.',
    'HP max cook': 'Cooking effect — adds this max-HP boost when used as an ingredient.',
    'RP max cook': 'Cooking effect — adds this max-RP boost when used as an ingredient.',
    'STR cook': 'Cooking effect — adds this STR boost when used as an ingredient.',
    'INT cook': 'Cooking effect — adds this INT boost when used as an ingredient.',
    'VIT cook': 'Cooking effect — adds this VIT boost when used as an ingredient.',
    'HP max% cook': 'Cooking effect — adds this max-HP percentage when used as an ingredient.',
    'RP max% cook': 'Cooking effect — adds this max-RP percentage when used as an ingredient.',
    'STR% cook': 'Cooking effect — adds this STR percentage when used as an ingredient.',
    'INT% cook': 'Cooking effect — adds this INT percentage when used as an ingredient.',
    'VIT% cook': 'Cooking effect — adds this VIT percentage when used as an ingredient.',
    'Crit% cook': 'Cooking effect — adds this critical-hit chance when used as an ingredient.',
    'Knock Res% cook': 'Cooking effect — adds this knockback resistance when used as an ingredient.',
    'Crit Res% cook': 'Cooking effect — adds this critical resistance when used as an ingredient.',
    'Poison Res% cook': 'Cooking effect — adds this Poison resistance when used as an ingredient.',
    'Seal Res% cook': 'Cooking effect — adds this Seal resistance when used as an ingredient.',
    'Para Res% cook': 'Cooking effect — adds this Paralysis resistance when used as an ingredient.',
    'Sleep Res% cook': 'Cooking effect — adds this Sleep resistance when used as an ingredient.',
    'Fatigue Res% cook': 'Cooking effect — adds this Fatigue resistance when used as an ingredient.',
    'Sick Res% cook': 'Cooking effect — adds this Sick resistance when used as an ingredient.',
    'Faint Res% cook': 'Cooking effect — adds this Faint resistance when used as an ingredient.',
    'Poison Atk% cook': 'Cooking effect — adds this Poison attack chance when used as an ingredient.'
};

// Fallback explanation for stats not in the glossary
const DEFAULT_DESC = 'Stat value shown for this item.';
const COOK_FALLBACK = 'Cooking effect — applies when this item is used as an ingredient.';
const UPGRADE_FALLBACK = 'Upgrade effect — applies when this item is used as a crafting/upgrade material.';

export function statDescription(statName, context = 'general') {
    if (GLOSSARY[statName]) return GLOSSARY[statName];
    if (context === 'cook') return COOK_FALLBACK;
    if (context === 'upgrade') return UPGRADE_FALLBACK;
    return DEFAULT_DESC;
}

// Attach a click-to-explore tooltip to a stat box.
// The tooltip is a single shared element so only one can be open at a time.
let tooltipEl = null;

export function attachStatInfo(box, statName, context = 'general') {
    box.addEventListener('click', (e) => {
        e.stopPropagation();
        showTooltip(box, statName, context);
    });
}

function showTooltip(anchor, statName, context) {
    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'stat-tooltip';
        tooltipEl.setAttribute('role', 'tooltip');
        document.body.appendChild(tooltipEl);
        document.addEventListener('click', () => hideTooltip());
        window.addEventListener('routechange', () => hideTooltip());
    }
    tooltipEl.innerHTML = '';
    const nameEl = document.createElement('strong');
    nameEl.textContent = statName;
    tooltipEl.appendChild(nameEl);
    tooltipEl.appendChild(document.createTextNode(statDescription(statName, context)));

    const rect = anchor.getBoundingClientRect();
    const tooltipWidth = Math.min(280, window.innerWidth - 24);
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - tooltipWidth - 12));
    let top = rect.bottom + 6;
    tooltipEl.style.width = tooltipWidth + 'px';
    tooltipEl.style.left = left + 'px';
    tooltipEl.style.top = top + 'px';
    tooltipEl.style.visibility = 'hidden';
    tooltipEl.style.display = 'block';
    // Flip above if it would overflow the bottom
    if (top + tooltipEl.offsetHeight > window.innerHeight - 12) {
        top = Math.max(12, rect.top - tooltipEl.offsetHeight - 6);
        tooltipEl.style.top = top + 'px';
    }
    tooltipEl.style.visibility = 'visible';
}

function hideTooltip() {
    if (tooltipEl) tooltipEl.style.display = 'none';
}
