
const ENVIRONMENTS = [
    { key: 'savannah', label: 'Savannah', color: 'var(--savannah)', defaultPlots: 20, defaultFlame: 5000000, rewardPool: 7.59, globalCons: 25, localCons: 30 },
    { key: 'forest', label: 'Forest', color: 'var(--forest)', defaultPlots: 2, defaultFlame: 12000000, rewardPool: 24.11, globalCons: 75, localCons: 90 },
    { key: 'arctic', label: 'Arctic', color: 'var(--arctic)', defaultPlots: 8, defaultFlame: 15000000, rewardPool: 54.02, globalCons: 225, localCons: 270 },
    { key: 'mystic', label: 'Mystic', color: 'var(--mystic)', defaultPlots: 8, defaultFlame: 25000000, rewardPool: 66.67, globalCons: 500, localCons: 600 },
    { key: 'genesis', label: 'Genesis', color: 'var(--genesis)', defaultPlots: 0, defaultFlame: 50000000, rewardPool: 41.96, globalCons: 10000, localCons: 12000 },
    { key: 'luna', label: "Luna's Landing", color: 'var(--luna)', defaultPlots: 0, defaultFlame: 80000000, rewardPool: 13.99, globalCons: 30000, localCons: 36000 },
];

const COLLECTION_FLAME = {
    normal: 5, summer: 20, nightmare: 40, japanese: 60,
    shiny: 200, xmas: 200, meo: 200, origin: 400,
    mystic: 1000, agamo: 2000
};

const SPECIAL_GENES_MAP = {
    'summer2022': 'summer', 'japan': 'japanese', 'xmas2019': 'xmas',
    'nightmare': 'nightmare', 'summershiny2022': 'shiny', 'nightmareshiny': 'shiny',
    'mystic': 'mystic', 'origin': 'origin', 'meo': 'meo', 'agamo': 'agamo', 'agamogenesis': 'agamo'
};

// Unused legacy constant kept for reference (v1.0-era linear mult)
const EVOLVED_MULT_LEGACY = [1.0, 1.0252, 1.0504, 1.0756, 1.1008, 1.1260, 1.1512];

const ENV_MULT = {
    savannah: 1.2,
    forest: 1.2,
    arctic: 1.2,
    mystic: 1.5,
    genesis: 1.2,
    luna: 1.5
};

const RARITY_BOOST = { 'Common': 0.0005, 'Rare': 0.0010, 'Epic': 0.0075, 'Mystic': 0.0150 };

// Shrine / Fortune Slip +10% is NOT applied. It is a manual spend (not automatic),
// and with cloud rotation it would overstate flame on every hop.

// --- Versioned flame tables (V1.1 current / V1.2 Aug 19 2026) ---
// Index = evolved part count (0..6). 0 parts => no evolved boost.
const EVOLVED_MULT_BY_VERSION = {
    '1.1': [0, 1.0, 1.1, 1.2, 1.3, 1.45, 1.68],
    '1.2': [0, 1.0, 1.1, 1.3, 1.6, 2.0, 2.8]
};

// Atia's Flame boost per evolved collectible part (row = axie collection, col = part collection)
const PART_FLAME_BY_VERSION = {
    '1.1': {
        agamo:     { agamo: 40, shiny: 24, japanese: 20, nightmare: 16, normal: 8 },
        mystic:    { mystic: 30, shiny: 20, nightmare: 14, normal: 6 },
        origin:    { shiny: 18, nightmare: 12, normal: 6 },
        meo:       { shiny: 15, nightmare: 10, normal: 5 },
        xmas:      { xmas: 10, shiny: 10, nightmare: 8, normal: 4 },
        shiny:     { shiny: 10, japanese: 8, nightmare: 8, summer: 6, normal: 4 },
        japanese:  { japanese: 8, nightmare: 6, normal: 3 },
        nightmare: { nightmare: 6, summer: 4, normal: 3 },
        summer:    { summer: 4, normal: 2 },
        normal:    { normal: 2 }
    },
    '1.2': {
        // From official V1.2 infographic
        agamo:     { agamo: 800, shiny: 60, japanese: 40, nightmare: 30, normal: 20 },
        mystic:    { mystic: 150, shiny: 30, nightmare: 20, normal: 12 },
        origin:    { shiny: 20, nightmare: 12, normal: 8 },
        meo:       { shiny: 12, nightmare: 8, normal: 5 },
        xmas:      { xmas: 20, shiny: 12, japanese: 10, nightmare: 8, normal: 5 },
        shiny:     { shiny: 20, japanese: 10, nightmare: 8, summer: 6, normal: 5 },
        japanese:  { japanese: 9, nightmare: 6, normal: 3 },
        nightmare: { nightmare: 6, summer: 4, normal: 3 },
        summer:    { summer: 4, normal: 2 },
        normal:    { normal: 2 }
    }
};

// Estate boost (V1.2): Estate Boost % = 1% * Estate Size * Estate Multiplier
// Applies to ONE plot per estate (highest plot flame), auto-selected.
const ESTATE_MULTIPLIER_TIERS = [
    { min: 2, max: 3, mult: 1.00 },
    { min: 4, max: 5, mult: 1.02 },
    { min: 6, max: 9, mult: 1.05 },
    { min: 10, max: 19, mult: 1.08 },
    { min: 20, max: 59, mult: 1.12 },
    { min: 60, max: 139, mult: 1.16 },
    { min: 140, max: Infinity, mult: 1.20 }
];

function getEstateMultiplier(size) {
    if (!size || size < 2) return 0;
    for (const t of ESTATE_MULTIPLIER_TIERS) {
        if (size >= t.min && size <= t.max) return t.mult;
    }
    return 0;
}

function calcEstateBoostPct(size) {
    const mult = getEstateMultiplier(size);
    if (!mult) return 0;
    return 0.01 * size * mult; // e.g. 6 plots => 0.01*6*1.05 = 0.063 (6.3%)
}

// Cloud rotation (manager site): when a plot runs out of Lunium, its axies
// move to another plot in the list that is still burning. Cycle is 1 day
// burn + 5 days recharge. Manager misses 1 hour to activate, then runs 24h.
const ROTATION_RING_SIZE = 6;
const ROTATION_BURN_HOURS = 24;
const ROTATION_ACTIVATE_GAP_HOURS = 1;
const ROTATION_CYCLE_HOURS = ROTATION_BURN_HOURS + ROTATION_ACTIVATE_GAP_HOURS; // 25
const ROTATION_UPTIME = ROTATION_BURN_HOURS / ROTATION_CYCLE_HOURS; // 0.96
const SOLO_LOCAL_UPTIME = 1 / 6;
const BASIC_TEAM_FLAME = 150; // 30 normal axies × 5 flame

function currentVersion() {
    return '1.2';
}

function usesV11Features(version) {
    // Land items and accessories exist in 1.1+. Shrine/fortune-slip buff is opt-in in-game and excluded here.
    return version === '1.1' || version === '1.2';
}

function usesEstates(version) {
    return version === '1.2';
}

let gAxies = [];
let gItems = [];
let gAccessories = [];

function init() {
    if (typeof USER_DATA === 'undefined') {
        alert("Please run fetch_user_data.py first to generate user_data.js");
        return;
    }
    
    document.getElementById('stat-axies').textContent = USER_DATA.axies.length;
    document.getElementById('stat-items').textContent = USER_DATA.items.length;
    
    gItems = USER_DATA.items || [];
    gAccessories = USER_DATA.accessories || [];

    localStorage.setItem('terrariumVersion', '1.2');

    processAxies();
    renderInputs();
    
    if (localStorage.getItem('baxsPrice')) {
        document.getElementById('baxs-price').value = localStorage.getItem('baxsPrice');
    }
    if (localStorage.getItem('luniumSale') !== null) {
        document.getElementById('lunium-sale').checked = localStorage.getItem('luniumSale') === 'true';
    }
    if (localStorage.getItem('tiebreakerMargin')) {
        document.getElementById('tiebreaker-margin').value = localStorage.getItem('tiebreakerMargin');
    }
    if (localStorage.getItem('minProfitMargin')) {
        document.getElementById('min-profit-margin').value = localStorage.getItem('minProfitMargin');
    }
    updateLuniumPrice();

    document.getElementById('btn-optimize').addEventListener('click', optimize);
}

async function fetchAxsPrice() {
    try {
        const btn = document.querySelector('button[onclick="fetchAxsPrice()"]');
        if (btn) btn.textContent = "↻ ...";
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=axie-infinity&vs_currencies=usd');
        const data = await res.json();
        const price = data['axie-infinity'].usd;
        document.getElementById('baxs-price').value = price;
        localStorage.setItem('baxsPrice', price);
        if (btn) btn.textContent = "↻ Update";
    } catch(e) {
        console.error("Failed to fetch AXS price", e);
        const btn = document.querySelector('button[onclick="fetchAxsPrice()"]');
        if (btn) btn.textContent = "Failed!";
        setTimeout(() => { if (btn) btn.textContent = "↻ Update"; }, 2000);
    }
}

function updateLuniumPrice() {
    const isSale = document.getElementById('lunium-sale').checked;
    localStorage.setItem('luniumSale', isSale);
    // Sale: 3,375,000 for $99.99 (50% bonus on 2,250,000)
    // Regular: 2,250,000 for $99.99
    const luniumPerPack = isSale ? 3375000 : 2250000;
    const pricePerLunium = 99.99 / luniumPerPack;
    document.getElementById('lunium-price').value = pricePerLunium.toFixed(8);
}

function processAxies() {
    let seenIds = new Set();
    let uniqueAxies = USER_DATA.axies.filter(a => {
        if (seenIds.has(a.id)) return false;
        seenIds.add(a.id);
        return true;
    });

    const version = currentVersion();
    const EVOLVED_MULT = EVOLVED_MULT_BY_VERSION[version] || EVOLVED_MULT_BY_VERSION['1.1'];
    const PART_FLAME_MATRIX = PART_FLAME_BY_VERSION[version] || PART_FLAME_BY_VERSION['1.1'];

    gAxies = uniqueAxies.map(axie => {
        let collection = 'normal';
        if (axie.title === 'Origin') {
            collection = 'origin';
        } else if (axie.title === 'MEO Corp' || axie.title === 'MEO Corp II') {
            collection = 'meo';
        } else if (axie.title === 'Agamogenesis') {
            collection = 'agamo';
        }
        
        let partCollections = [];

        if (axie.parts) {
            for (let p of axie.parts) {
                let sg = p.specialGenes ? p.specialGenes.toLowerCase() : '';
                let pname = p.name ? p.name.toLowerCase() : '';
                let mapped = 'normal';
                
                if (sg.includes('mystic')) mapped = 'mystic';
                else if (sg.includes('japan')) mapped = 'japanese';
                else if (sg.includes('xmas')) mapped = 'xmas';
                else if (sg.includes('summer')) mapped = 'summer';
                else if (sg.includes('nightmare')) mapped = 'nightmare';
                else if (sg.includes('agamogenesis')) mapped = 'agamo';
                
                if (sg.includes('shiny') || pname.includes('shiny')) mapped = 'shiny'; 
                
                partCollections.push(mapped);

                if (mapped !== 'normal') {
                    if (collection === 'normal' || (COLLECTION_FLAME[mapped] && COLLECTION_FLAME[collection] && COLLECTION_FLAME[mapped] > COLLECTION_FLAME[collection])) {
                        collection = mapped;
                    }
                }
            }
        }
        
        const base = COLLECTION_FLAME[collection] || 5;
        let evCount = axie.evolvedParts || 0;
        if (evCount > 6) evCount = 6;

        let partFlames = [];
        for (let pCol of partCollections) {
            let row = PART_FLAME_MATRIX[collection] || PART_FLAME_MATRIX["normal"];
            let val = row[pCol];
            if (val === undefined) val = row["normal"] || 2;
            partFlames.push(val);
        }
        
        partFlames.sort((a, b) => b - a);
        let boostSum = 0;
        for (let i = 0; i < evCount; i++) {
            if (i < partFlames.length) boostSum += partFlames[i];
        }

        const mult = EVOLVED_MULT[evCount] || 0;
        const evolvedBoost = boostSum * mult;
        const flame = base + evolvedBoost;
        
        return {
            ...axie,
            collection,
            flame,
            axClass: axie.class || 'Normal'
        };
    });
    
    gAxies.sort((a, b) => b.flame - a.flame);
}

function renderInputs() {
    const container = document.getElementById('env-inputs');
    const version = currentVersion();
    const showEstate = usesEstates(version);

    container.innerHTML = `
        <div class="env-grid-header${showEstate ? ' with-estate' : ''}">
            <div>Environment</div>
            <div>Plots Owned</div>
            <div>Global Total Flame</div>
            ${showEstate ? '<div>Largest Estate</div>' : ''}
            <div>Break-Even FP</div>
        </div>
        <div id="env-grid-body"></div>
        ${showEstate ? `<p class="estate-hint">V1.2 Estates: enter the size of your largest connected group of plots per environment (same env, adjacent H/V, activated). Estate boost auto-applies to the highest-flame plot in that env. Formula: <code>1% × size × multiplier</code>.</p>` : ''}
    `;
    
    const tbody = document.getElementById('env-grid-body');
    
    ENVIRONMENTS.forEach(env => {
        const savedPlots = localStorage.getItem(`plots-${env.key}`);
        const savedFlame = localStorage.getItem(`global-${env.key}`);
        const savedEstate = localStorage.getItem(`estate-${env.key}`);
        
        const initialPlots = savedPlots !== null ? savedPlots : env.defaultPlots;
        const initialFlame = savedFlame !== null ? savedFlame : env.defaultFlame;
        // Default estate size = plots owned (assume fully connected); user can lower it
        const initialEstate = savedEstate !== null ? savedEstate : initialPlots;
        
        const row = document.createElement('div');
        row.className = 'env-grid-row' + (showEstate ? ' with-estate' : '');
        row.style.borderLeftColor = env.color;
        
        row.innerHTML = `
            <div class="env-label" style="color: ${env.color};">${env.label}</div>
            <input type="number" min="0" value="${initialPlots}" id="plots-${env.key}" class="grid-input" title="Plots Owned">
            <input type="number" min="1" value="${initialFlame}" id="global-${env.key}" class="grid-input" title="Global Total Flame">
            ${showEstate ? `<input type="number" min="0" value="${initialEstate}" id="estate-${env.key}" class="grid-input" title="Largest connected Estate size (min 2 for boost)">` : ''}
            <div id="breakeven-${env.key}" style="font-size: 0.85em; opacity: 0.8; text-align: center; padding-top: 0.4rem; white-space: nowrap;" title="Flame Power required for this plot to exactly cover its Global Lunium cost.">BE: -- FP</div>
        `;
        tbody.appendChild(row);
        
        const pInput = document.getElementById(`plots-${env.key}`);
        const fInput = document.getElementById(`global-${env.key}`);
        pInput.addEventListener('change', () => {
            localStorage.setItem(`plots-${env.key}`, pInput.value);
            // If estate wasn't manually set lower, keep it in sync when increasing plots
            const eInput = document.getElementById(`estate-${env.key}`);
            if (eInput && savedEstate === null) {
                eInput.value = pInput.value;
            }
            optimize();
        });
        fInput.addEventListener('change', () => {
            localStorage.setItem(`global-${env.key}`, fInput.value);
            optimize();
        });
        if (showEstate) {
            const eInput = document.getElementById(`estate-${env.key}`);
            eInput.addEventListener('change', () => {
                localStorage.setItem(`estate-${env.key}`, eInput.value);
                optimize();
            });
        }
    });
}

function onVersionChange() {
    localStorage.setItem('terrariumVersion', '1.2');
    renderInputs();
    optimize();
}

function rotationUptime(plotCount) {
    if (!plotCount || plotCount <= 0) return 0;
    if (plotCount >= ROTATION_RING_SIZE) return ROTATION_UPTIME;
    // N hops of 24h, then wait until the first plot finishes 5-day recharge + 1h activate.
    return (plotCount * ROTATION_BURN_HOURS) / (ROTATION_BURN_HOURS + 120 + ROTATION_ACTIVATE_GAP_HOURS);
}

function expectedRotatedBaxs(flame, globalFlame, rewardPool, uptime) {
    if (!globalFlame || globalFlame <= 0) return 0;
    return (flame / globalFlame) * rewardPool * uptime;
}

function chunkTeams(axies, size) {
    const teams = [];
    for (let i = 0; i < axies.length; i += size) {
        const group = axies.slice(i, i + size);
        teams.push({
            axies: group,
            flame: group.reduce((s, a) => s + (a.effectiveFlame || a.flame || 0), 0)
        });
    }
    return teams;
}

function evaluateCloudRotation(userPlots, axiesWithFlame) {
    const assignedIds = new Set();
    userPlots.forEach(p => (p.axies || []).forEach(a => assignedIds.add(String(a.id))));
    const leftoverAxies = (axiesWithFlame || []).filter(a => !assignedIds.has(String(a.id)));
    leftoverAxies.sort((a, b) => (b.effectiveFlame || 0) - (a.effectiveFlame || 0));
    const leftoverTeams = chunkTeams(leftoverAxies, 30);

    const envRows = ENVIRONMENTS.map(env => {
        const plots = userPlots.filter(p => p.env.key === env.key);
        const idlePlots = plots.filter(p => (!p.axies || p.axies.length === 0) && !p.isRotationSlave);
        const activePlots = plots.filter(p => p.axies && p.axies.length > 0);
        const plotCount = idlePlots.length;
        const globalFlame = (plots[0] && plots[0].globalFlame) || env.defaultFlame;
        const rewardPool = (plots[0] && plots[0].rewardPool) || env.rewardPool;
        const rings = Math.floor(plotCount / ROTATION_RING_SIZE);
        const remainder = plotCount % ROTATION_RING_SIZE;
        return {
            env,
            totalPlots: plots.length,
            activePlots: activePlots.length,
            idlePlots: plotCount,
            globalFlame,
            rewardPool,
            rings,
            remainder
        };
    }).filter(r => r.totalPlots > 0);

    // Allocate leftover teams per env: first fill full 6-plot rings, then remainder.
    const teams = leftoverTeams.map(t => ({ ...t, used: false }));
    const takeTeam = () => {
        const t = teams.find(x => !x.used);
        if (!t) return null;
        t.used = true;
        return t;
    };

    envRows.forEach(row => {
        row.rotateGroups = [];
        for (let i = 0; i < row.rings; i++) {
            const team = takeTeam();
            const flame = team ? team.flame : BASIC_TEAM_FLAME;
            const staffed = !!team;
            const uptime = ROTATION_UPTIME;
            const baxs = expectedRotatedBaxs(flame, row.globalFlame, row.rewardPool, uptime);
            row.rotateGroups.push({
                plots: ROTATION_RING_SIZE,
                kind: 'full-ring',
                staffed,
                flame,
                uptime,
                baxs
            });
        }
        if (row.remainder > 0) {
            const team = takeTeam();
            const flame = team ? team.flame : BASIC_TEAM_FLAME;
            const staffed = !!team;
            const uptime = rotationUptime(row.remainder);
            const baxs = expectedRotatedBaxs(flame, row.globalFlame, row.rewardPool, uptime);
            row.rotateGroups.push({
                plots: row.remainder,
                kind: row.remainder === 1 ? 'solo' : 'partial-ring',
                staffed,
                flame,
                uptime,
                baxs
            });
        }

        // Fully-staffed solo (one parked team per idle plot) vs rotation using 1 team per ring.
        const soloFlame = BASIC_TEAM_FLAME;
        row.soloIfFullyStaffed = {
            teams: row.idlePlots,
            uptime: SOLO_LOCAL_UPTIME,
            baxs: row.idlePlots * expectedRotatedBaxs(soloFlame, row.globalFlame, row.rewardPool, SOLO_LOCAL_UPTIME)
        };
        row.rotateIfUsingBasics = {
            teams: row.rings + (row.remainder > 0 ? 1 : 0),
            baxs: 0
        };
        // Recalc rotate-with-basics independently of leftover staffing (decision math).
        for (let i = 0; i < row.rings; i++) {
            row.rotateIfUsingBasics.baxs += expectedRotatedBaxs(soloFlame, row.globalFlame, row.rewardPool, ROTATION_UPTIME);
        }
        if (row.remainder > 0) {
            row.rotateIfUsingBasics.baxs += expectedRotatedBaxs(soloFlame, row.globalFlame, row.rewardPool, rotationUptime(row.remainder));
        }

        // If every idle plot already has a parked basic team, solo wins because
        // 6 parked teams at 16.7% beat 1 rotated team at 96% (1.0 vs 0.96 team-days).
        // Rotation wins when you cannot staff every plot.
        row.canStaffEveryIdle = leftoverTeams.length >= row.idlePlots;
        if (row.idlePlots === 0) {
            row.verdict = 'none';
            row.verdictLabel = 'No idle plots';
            row.reason = 'All plots in this environment already have a profitable working team.';
        } else if (row.idlePlots < 2) {
            row.verdict = 'solo';
            row.verdictLabel = 'Keep parked / solo';
            row.reason = 'Need at least 2 plots to rotate. One plot stays 1 day on / 5 days recharge (16.7% uptime, plus the 1h activate gap if you hop).';
        } else if (leftoverTeams.length >= row.idlePlots) {
            row.verdict = 'solo';
            row.verdictLabel = 'Do not rotate — park a team on each plot';
            row.reason = `You have enough leftover teams (${leftoverTeams.length}) to staff all ${row.idlePlots} idle ${row.env.label} plots. Six parked teams at 16.7% beat one 6-plot ring at 96% (1.00 vs 0.96 team-days). Cloud rotate is for plots that would otherwise sit empty.`;
        } else {
            row.verdict = 'rotate';
            row.verdictLabel = 'Cloud-rotate in 6-plot rings';
            const cover = row.rings * ROTATION_RING_SIZE;
            row.reason = `Only ${leftoverTeams.length} leftover team(s) for ${row.idlePlots} idle plots. A 6-plot ring keeps one team burning ~96% of the time (24h on, 1h activate gap) instead of 16.7% parked. ${row.rings} full ring(s) cover ${cover} plots.`;
        }
        row.leftoverTeams = leftoverTeams.length;
    });

    const savannah = envRows.find(r => r.env.key === 'savannah') || null;
    return {
        leftoverAxies: leftoverAxies.length,
        leftoverTeams: leftoverTeams.length,
        leftoverFlame: leftoverTeams.reduce((s, t) => s + t.flame, 0),
        envRows,
        savannah
    };
}

function optimize() {
    processAxies();
    const version = currentVersion();
    window.terrariumVersion = version;

    const baxsPriceStr = document.getElementById('baxs-price').value;
    const luniumPriceStr = document.getElementById('lunium-price').value;
    const tiebreakerMarginStr = document.getElementById('tiebreaker-margin').value;
    const minProfitMarginStr = document.getElementById('min-profit-margin').value;
    
    const baxsPrice = parseFloat(baxsPriceStr) || 0;
    const luniumPrice = parseFloat(luniumPriceStr) || 0;
    const tiebreakerMargin = parseFloat(tiebreakerMarginStr) || 0;
    const minProfitMargin = parseFloat(minProfitMarginStr) || 0;
    
    localStorage.setItem('baxsPrice', baxsPrice);
    localStorage.setItem('luniumSale', document.getElementById('lunium-sale').checked);
    localStorage.setItem('tiebreakerMargin', tiebreakerMargin);
    localStorage.setItem('minProfitMargin', minProfitMargin);
    window.baxsPrice = baxsPrice;
    window.luniumPrice = luniumPrice;
    window.tiebreakerMargin = tiebreakerMargin;
    window.minProfitMargin = minProfitMargin;
    
    const userPlots = [];
    const estateSizeByEnv = {};
    ENVIRONMENTS.forEach(env => {
        const plotsStr = document.getElementById(`plots-${env.key}`).value;
        const flameStr = document.getElementById(`global-${env.key}`).value;
        const plotsCount = parseInt(plotsStr) || 0;
        const globalFlame = parseInt(flameStr) || env.defaultFlame;
        const dynamicPool = env.rewardPool;
        const estateEl = document.getElementById(`estate-${env.key}`);
        let estateSize = estateEl ? (parseInt(estateEl.value) || 0) : 0;
        // Cap estate size at plots owned
        if (estateSize > plotsCount) estateSize = plotsCount;
        estateSizeByEnv[env.key] = usesEstates(version) ? estateSize : 0;
        const estateBoostPct = calcEstateBoostPct(estateSizeByEnv[env.key]);
        
        let breakevenDisplay = 'BE: -- FP';
        if (baxsPrice > 0) {
            const breakevenFlame = (env.globalCons * luniumPrice * globalFlame) / (dynamicPool * baxsPrice);
            if (breakevenFlame >= 1000000) {
                breakevenDisplay = 'BE: ' + (breakevenFlame / 1000000).toFixed(2) + 'M FP';
            } else if (breakevenFlame >= 1000) {
                breakevenDisplay = 'BE: ' + (breakevenFlame / 1000).toFixed(1) + 'k FP';
            } else {
                breakevenDisplay = 'BE: ' + Math.round(breakevenFlame).toString() + ' FP';
            }
        }
        document.getElementById(`breakeven-${env.key}`).innerText = breakevenDisplay;
        
        for (let i = 0; i < plotsCount; i++) {
            userPlots.push({
                env,
                globalFlame,
                rewardPool: dynamicPool,
                items: [],
                axies: [],
                itemBoost: 0,
                baseFlame: 0,
                finalFlame: 0,
                expectedBaxs: 0,
                estateSize: estateSizeByEnv[env.key],
                estateBoostPct: 0, // applied later to strongest plot only
                estateBoostApplied: false
            });
        }
        // stash for UI
        env._estateBoostPct = estateBoostPct;
        env._estateSize = estateSizeByEnv[env.key];
    });
    
    if (userPlots.length === 0) {
        alert("You have no plots configured.");
        return;
    }
    
    // NOTE: Do NOT pre-seed land items onto higher-tier plots before assignment.
    // That biased teams onto Mystic even when Arctic was more profitable (esp. with
    // large V1.2 estates). Items are distributed after teams are placed (step 5).
    userPlots.forEach(plot => {
        plot.items = [];
        plot.itemBoost = 0;
    });

    // Track which envs still have an unused Estate boost (applies to first/strongest team only)
    const estateUsedByEnv = {};
    ENVIRONMENTS.forEach(env => { estateUsedByEnv[env.key] = false; });

    function estateMultForPlot(plot) {
        if (!usesEstates(version)) return 1.0;
        const key = plot.env.key;
        if (estateUsedByEnv[key]) return 1.0;
        const pct = calcEstateBoostPct(estateSizeByEnv[key] || 0);
        return pct > 0 ? (1 + pct) : 1.0;
    }
    
    // 1. Assign accessories to the top Axies
    const sortedAccessories = usesV11Features(version) ? [...gAccessories].sort((a, b) => {
        const rarities = { 'Mystic': 4, 'Epic': 3, 'Rare': 2, 'Common': 1 };
        return (rarities[b.rarity] || 0) - (rarities[a.rarity] || 0);
    }) : [];
    
    let accAssignments = [];
    for (let i = 0; i < sortedAccessories.length && i < gAxies.length; i++) {
        accAssignments.push({
            accessory: sortedAccessories[i],
            axie: gAxies[i]
        });
    }
    
    // 2. Compute effective flame for all Axies
    let axiesWithFlame = gAxies.map(axie => {
        let axieFlame = axie.flame;
        let eq = accAssignments.find(a => a.axie.id === axie.id);
        if (eq) {
            if (eq.accessory.rarity === 'Common') axieFlame += 0.1;
            else if (eq.accessory.rarity === 'Rare') axieFlame += 0.3;
            else if (eq.accessory.rarity === 'Epic') axieFlame += 1.0;
            else if (eq.accessory.rarity === 'Mystic') axieFlame += 3.0;
        }
        return { ...axie, effectiveFlame: axieFlame };
    });
    
    // Sort Axies by effective flame descending
    axiesWithFlame.sort((a, b) => b.effectiveFlame - a.effectiveFlame);
    
    // 3. Group Axies into chunks of 30
    let chunks = [];
    for (let i = 0; i < axiesWithFlame.length; i += 30) {
        let chunkAxies = axiesWithFlame.slice(i, i + 30);
        let chunkFlame = chunkAxies.reduce((sum, a) => sum + a.effectiveFlame, 0);
        chunks.push({ axies: chunkAxies, baseFlame: chunkFlame });
    }
    
    // 4. Assign chunks to the most profitable option (Global vs Rotation)
    let availablePlots = [...userPlots];
    
    for (let chunk of chunks) {
        let bestOption = null;
        let eligibleOptions = [];
        
        // --- A. Evaluate Individual Global Plots ---
        for (let j = 0; j < availablePlots.length; j++) {
            let plot = availablePlots[j];
            const eMult = estateMultForPlot(plot);
            let finalFlame = Math.floor(chunk.baseFlame * (1 + plot.itemBoost) * eMult);
            let expectedBaxs = (finalFlame / plot.globalFlame) * plot.rewardPool;
            let passiveBaxs = (150 / plot.globalFlame) * plot.rewardPool * (1/6);
            
            let netProfit, passiveProfit, threshold, globalCost = 0;
            
            if (window.baxsPrice > 0) {
                let baxsRevenue = expectedBaxs * window.baxsPrice;
                let globalCons = plot.env.globalCons || 0;
                globalCost = globalCons * window.luniumPrice;
                netProfit = baxsRevenue - globalCost;
                passiveProfit = passiveBaxs * window.baxsPrice;
                threshold = passiveProfit + (globalCost * (window.minProfitMargin / 100));
            } else {
                netProfit = expectedBaxs;
                passiveProfit = passiveBaxs;
                threshold = passiveBaxs;
            }
            
            if (netProfit > 0 && netProfit > threshold) {
                eligibleOptions.push({
                    type: 'global',
                    index: j,
                    plot: plot,
                    netProfit: netProfit,
                    marginalProfit: netProfit - passiveProfit,
                    globalCost: globalCost,
                    expectedBaxs: expectedBaxs,
                    finalFlame: finalFlame,
                    estateMult: eMult
                });
            }
        }

        // --- B. Evaluate Mixed Virtual Rotation Ring (Top 6 plots, local lunium) ---
        if (availablePlots.length >= 6) {
            let sortedForRotation = availablePlots.map((plot, idx) => {
                const eMult = estateMultForPlot(plot);
                let finalFlame = Math.floor(chunk.baseFlame * (1 + plot.itemBoost) * eMult);
                let baxsFactor = (1 / plot.globalFlame) * plot.rewardPool * (1/6);
                let expectedBaxs = finalFlame * baxsFactor * 0.96;
                let passiveBaxs = (150 / plot.globalFlame) * plot.rewardPool * (1/6);
                
                let baxsRevenue = expectedBaxs * (window.baxsPrice || 1);
                let passiveProfit = passiveBaxs * (window.baxsPrice || 1);
                
                return {
                    plotIndex: idx,
                    plot: plot,
                    expectedBaxs: expectedBaxs,
                    baxsFactor: baxsFactor,
                    passiveBaxs: passiveBaxs,
                    baxsRevenue: baxsRevenue,
                    passiveProfit: passiveProfit,
                    marginalProfit: baxsRevenue - passiveProfit,
                    finalFlame: finalFlame,
                    estateMult: eMult
                };
            });
            
            // Sort by marginal profit descending
            sortedForRotation.sort((a, b) => b.marginalProfit - a.marginalProfit);
            
            // Take top 6
            let top6 = sortedForRotation.slice(0, 6);
            let sumNetProfit = top6.reduce((sum, item) => sum + item.baxsRevenue, 0); // 0 global cost
            let sumPassiveProfit = top6.reduce((sum, item) => sum + item.passiveProfit, 0);
            let sumExpectedBaxs = top6.reduce((sum, item) => sum + item.expectedBaxs, 0);
            let sumBaxsFactor = top6.reduce((sum, item) => sum + item.baxsFactor, 0);
            
            // the threshold is just beating the passive profit
            if (sumNetProfit > 0 && sumNetProfit > sumPassiveProfit) {
                eligibleOptions.push({
                    type: 'rotation_mixed',
                    indices: top6.map(item => item.plotIndex),
                    netProfit: sumNetProfit,
                    marginalProfit: sumNetProfit - sumPassiveProfit,
                    globalCost: 0,
                    expectedBaxs: sumExpectedBaxs,
                    sumBaxsFactor: sumBaxsFactor,
                    finalFlame: top6[0].finalFlame, // Just for display
                    estateMult: top6[0].estateMult // Just for display
                });
            }
        }
        
        if (eligibleOptions.length > 0) {
            let maxMarginal = Math.max(...eligibleOptions.map(o => o.marginalProfit));
            let competitive = eligibleOptions.filter(o => o.marginalProfit >= maxMarginal - window.tiebreakerMargin);
            
            competitive.sort((a, b) => {
                if (b.marginalProfit !== a.marginalProfit) return b.marginalProfit - a.marginalProfit;
                if (a.globalCost !== b.globalCost) return a.globalCost - b.globalCost;
                return b.expectedBaxs - a.expectedBaxs;
            });
            
            bestOption = competitive[0];
        }
        
        if (bestOption && bestOption.marginalProfit > 0) {
            if (bestOption.type === 'global') {
                let bestPlot = bestOption.plot;
                bestPlot.axies = chunk.axies;
                bestPlot.baseFlame = chunk.baseFlame;
                bestPlot.finalFlame = Math.floor(chunk.baseFlame * (1 + bestPlot.itemBoost));
                bestPlot.expectedBaxs = (bestPlot.finalFlame / bestPlot.globalFlame) * bestPlot.rewardPool;
                
                if (usesEstates(version) && (bestOption.estateMult || 1) > 1) {
                    estateUsedByEnv[bestPlot.env.key] = true;
                }
                availablePlots.splice(bestOption.index, 1);
            } else if (bestOption.type === 'rotation_mixed') {
                let sortedIndices = [...bestOption.indices].sort((a, b) => b - a);
                
                // Calculate composition BEFORE splicing, since splicing changes array indices
                let envCounts = {};
                bestOption.indices.forEach(idx => {
                    let label = availablePlots[idx].env.label;
                    envCounts[label] = (envCounts[label] || 0) + 1;
                });
                let ringComposition = Object.entries(envCounts).map(([label, count]) => `${count} ${label}`).join(', ');
                
                let masterPlot = null;
                sortedIndices.forEach((idx, i) => {
                    let p = availablePlots.splice(idx, 1)[0];
                    if (i === 0) { // arbitrary master plot represents the whole ring
                        masterPlot = p;
                        masterPlot.axies = chunk.axies;
                        masterPlot.baseFlame = chunk.baseFlame;
                        masterPlot.finalFlame = bestOption.finalFlame;
                        masterPlot.expectedBaxs = bestOption.expectedBaxs;
                        masterPlot.isRotationMaster = true;
                        masterPlot._renderGlobalCons = 0; // zero out global cost for this specific plot rendering
                        masterPlot._rotationComposition = ringComposition;
                        masterPlot._rotationBaxsFactor = bestOption.sumBaxsFactor;
                    } else {
                        p.axies = []; 
                        p.isRotationSlave = true;
                    }
                });
                if (usesEstates(version) && (bestOption.estateMult || 1) > 1) {
                    estateUsedByEnv[masterPlot.env.key] = true;
                }
            }
        } else {
            // No profitable options left for remaining chunks
            break;
        }
    }
    
    // 5. Re-assign items based on the actual base flame of the assigned Axie teams
    availableItems = usesV11Features(version) ? [...gItems] : [];
    availableItems.forEach(i => {
        i.baseBoost = RARITY_BOOST[i.rarity] || 0.0005;
    });
    
    // Sort active plots by baseFlame descending, so strongest Axie teams get best items
    let activePlots = userPlots.filter(p => p.axies.length > 0);
    activePlots.sort((a, b) => b.baseFlame - a.baseFlame);
    
    let passivePlots = userPlots.filter(p => p.axies.length === 0 && !p.isRotationSlave);
    
    // Helper function to assign items to a sorted list of plots
    const distributeItems = (plotList) => {
        plotList.forEach(plot => {
            plot.items = [];
            let envKey = plot.env.key;
            let envMult = ENV_MULT[envKey] || 1.0;
            let isUniversal = (envKey === 'genesis' || envKey === 'luna');
            
            availableItems.sort((a, b) => {
                const matchA = (isUniversal || (a.environment && a.environment.toLowerCase() === envKey)) ? envMult : 1.0;
                const matchB = (isUniversal || (b.environment && b.environment.toLowerCase() === envKey)) ? envMult : 1.0;
                return (b.baseBoost * matchB) - (a.baseBoost * matchA);
            });
            
            let boost = 0;
            for (let j = 0; j < 8; j++) {
                if (availableItems.length > 0) {
                    let item = availableItems.shift();
                    plot.items.push(item);
                    const match = (isUniversal || (item.environment && item.environment.toLowerCase() === envKey)) ? envMult : 1.0;
                    item.finalBoost = item.baseBoost * match;
                    boost += item.finalBoost;
                }
            }
            plot.itemBoost = boost;
            if (plot.axies.length > 0) {
                plot.finalFlame = Math.floor(plot.baseFlame * (1 + plot.itemBoost));
                if (plot.isRotationMaster) {
                    plot.expectedBaxs = plot.finalFlame * plot._rotationBaxsFactor * 0.96;
                } else {
                    plot.expectedBaxs = (plot.finalFlame / plot.globalFlame) * plot.rewardPool;
                }
            }
        });
    };
    
    let stable = false;
    while (!stable) {
        // Reset available items for redistribution
        availableItems = usesV11Features(version) ? [...gItems] : [];
        availableItems.forEach(i => i.baseBoost = RARITY_BOOST[i.rarity] || 0.0005);
        
        distributeItems(activePlots);
        
        stable = true;
        for (let i = activePlots.length - 1; i >= 0; i--) {
            let plot = activePlots[i];
            let globalCons = plot.env.globalCons || 0;
            let globalCost = globalCons * window.luniumPrice;
            let passiveBaxs = (150 / plot.globalFlame) * plot.rewardPool * (1/6);
            
            let netProfit;
            let threshold;
            if (window.baxsPrice > 0) {
                netProfit = (plot.expectedBaxs * window.baxsPrice) - globalCost;
                let passiveProfit = passiveBaxs * window.baxsPrice;
                threshold = passiveProfit + (globalCost * (window.minProfitMargin / 100));
            } else {
                netProfit = plot.expectedBaxs;
                threshold = passiveBaxs;
            }
            
            if (netProfit <= threshold) {
                plot.axies = [];
                plot.baseFlame = 0;
                plot.finalFlame = 0;
                plot.expectedBaxs = 0;
                plot.items = [];
                plot.itemBoost = 0;
                passivePlots.push(plot);
                activePlots.splice(i, 1);
                stable = false; // Need to redistribute items among remaining plots
            }
        }
    }
    distributeItems(passivePlots); // Give leftover items to passive plots
    
    // V1.2 Estates: apply Estate Boost to the single highest-flame plot per environment
    if (usesEstates(version)) {
        const byEnv = {};
        userPlots.forEach(p => {
            if (!byEnv[p.env.key]) byEnv[p.env.key] = [];
            byEnv[p.env.key].push(p);
        });
        Object.keys(byEnv).forEach(key => {
            const size = estateSizeByEnv[key] || 0;
            const boostPct = calcEstateBoostPct(size);
            if (boostPct <= 0) return;
            // Prefer active (working) plots; if none, skip
            const candidates = byEnv[key].filter(p => p.axies && p.axies.length > 0);
            if (!candidates.length) return;
            candidates.sort((a, b) => b.finalFlame - a.finalFlame);
            const top = candidates[0];
            top.estateBoostPct = boostPct;
            top.estateBoostApplied = true;
            top.estateSize = size;
            top.finalFlame = Math.floor(top.finalFlame * (1 + boostPct));
            if (top.isRotationMaster) {
                top.expectedBaxs = top.finalFlame * top._rotationBaxsFactor * 0.96;
            } else {
                top.expectedBaxs = (top.finalFlame / top.globalFlame) * top.rewardPool;
            }
        });
    }

    // Sort all plots by final flame power descending for rendering
    userPlots.sort((a, b) => b.finalFlame - a.finalFlame);
    
    const rotationData = evaluateCloudRotation(userPlots, axiesWithFlame);
    renderRotationResults(rotationData);

    renderResults(userPlots, accAssignments, availableItems);
}

function toggleDetails(element) {
    const details = element.nextElementSibling;
    if (details.style.display === 'none' || details.style.display === '') {
        details.style.display = 'block';
    } else {
        details.style.display = 'none';
    }
}

function renderResults(plots, accAssignments, availableItems = []) {
    const container = document.getElementById('plots-grid');
    container.innerHTML = '';
    
    if (accAssignments && accAssignments.length > 0) {
        const accSection = document.createElement('div');
        accSection.className = 'plot-card';
        accSection.style.gridColumn = '1 / -1';
        accSection.style.borderTopColor = 'var(--mystic)';
        
        let html = '<div class="plot-title">💎 Accessory Assignments</div><ul style="color: var(--text-secondary); margin-left: 1.5rem; margin-bottom: 1rem;">';
        accAssignments.forEach(a => {
            html += `<li>Equip <strong>${a.accessory.name}</strong> (${a.accessory.rarity}) to <strong>${a.axie.name}</strong> (${a.axie.flame} Base Flame)</li>`;
        });
        html += '</ul>';
        accSection.innerHTML = html;
        container.appendChild(accSection);
    }
    
    let totalBaxs = 0;
    
    plots.forEach((plot, index) => {
        if (plot.axies.length === 0) return;
        
        totalBaxs += plot.expectedBaxs;
        
        const card = document.createElement('div');
        card.className = 'plot-card';
        card.style.borderTopColor = plot.env.color;
        
        let itemsHtml = plot.items.map(i => `<li>${i.name} (+${(i.finalBoost*100).toFixed(2)}%)</li>`).join('');
        if (!itemsHtml) itemsHtml = "<li>None</li>";
        
        // Show just the top 5 axies to keep it clean, or all of them in a scrollable list
        let axiesHtml = plot.axies.map(a => `<li>${a.name} (${a.flame.toFixed(1)} Flame)</li>`).join('');
        
        let globalCons = plot._renderGlobalCons !== undefined ? plot._renderGlobalCons : (plot.env.globalCons || 0);
        let localCons = plot.env.localCons || 0;
        
        let baxsRevenue = plot.expectedBaxs * (window.baxsPrice || 0);
        let globalCost = globalCons * (window.luniumPrice || 0);
        let netGlobal = baxsRevenue - globalCost;
        let profitColor = netGlobal < 0 ? '#e74c3c' : (netGlobal < 0.05 ? '#f39c12' : '#2ecc71');
        
        let titleHtml = plot.isRotationMaster ? 
            `Cloud Rotation (${plot._rotationComposition || '6 Plots'}) <span style="font-size: 0.8em; opacity: 0.7;">(96% uptime)</span>` : 
            `${plot.env.label} Plot #${index + 1} <span style="font-size: 0.8em; opacity: 0.7;">(Click for details)</span>`;

        card.innerHTML = `
            <div class="plot-summary" style="cursor: pointer;" onclick="toggleDetails(this)">
                <div class="plot-title">${titleHtml}</div>
                ${usesV11Features(window.terrariumVersion) ? `
                <div class="plot-detail">
                    <span class="label">Item Boost</span>
                    <span style="color: #2ecc71;">+${(plot.itemBoost * 100).toFixed(2)}%</span>
                </div>
                ` : ''}
                ${plot.estateBoostApplied ? `
                <div class="plot-detail">
                    <span class="label">Estate Boost</span>
                    <span style="color: #e056fd;">+${(plot.estateBoostPct * 100).toFixed(2)}% <span style="opacity:0.7;font-size:0.85em;">(size ${plot.estateSize})</span></span>
                </div>` : ''}
                <div class="plot-detail">
                    <span class="label">Working Axies</span>
                    <span>${plot.axies.length}</span>
                </div>
                <div class="plot-detail" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 0.5rem; margin-top: 0.5rem;">
                    <span class="label" style="color: var(--text-primary); font-weight: 600;">Final Plot Flame</span>
                    <span style="color: #f39c12; font-weight: 800;">${plot.finalFlame.toLocaleString()}</span>
                </div>
                <div class="plot-detail">
                    <span class="label" style="color: #3498db;">Expected Reward</span>
                    <span style="color: #3498db; font-weight: 800;">~${plot.expectedBaxs.toFixed(4)} bAXS/tick</span>
                </div>
                <div class="plot-detail" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 0.5rem; margin-top: 0.5rem;">
                    <span class="label">Earnings ($)</span>
                    <span style="color: #2ecc71;">+$${baxsRevenue.toFixed(3)}</span>
                </div>
                <div class="plot-detail">
                    <span class="label">Global Lunium Cost ($)</span>
                    <span style="color: ${plot.isRotationMaster ? '#2ecc71' : '#e74c3c'};">
                        ${plot.isRotationMaster ? 'Free (Local Lunium)' : `-$${globalCost.toFixed(3)} (${globalCons}/Tick)`}
                    </span>
                </div>
                <div class="plot-detail" style="margin-bottom: 0.5rem;">
                    <span class="label">Net Profit ($)</span>
                    <span style="color: ${profitColor}; font-weight: bold;">$${netGlobal.toFixed(3)}</span>
                </div>
                <div class="plot-detail">
                    <span class="label" style="font-size: 0.75em; color: var(--text-secondary);">Local Lunium Cons.</span>
                    <span style="font-size: 0.75em; color: var(--text-secondary);">${localCons}/Tick (Free Limit)</span>
                </div>
            </div>
            <div class="plot-expanded" style="display: none; margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed rgba(255,255,255,0.1);">
                ${usesV11Features(window.terrariumVersion) ? `
                <div style="margin-bottom: 1rem;">
                    <strong>Land Items (${plot.items.length}/8)</strong>
                    <ul style="color: var(--text-secondary); margin-left: 1.2rem; font-size: 0.85rem; margin-top: 0.3rem;">
                        ${itemsHtml}
                    </ul>
                </div>
                ` : ''}
                <div>
                    <strong>Assigned Axies (${plot.axies.length}/30)</strong>
                    <ul style="color: var(--text-secondary); margin-left: 1.2rem; font-size: 0.85rem; margin-top: 0.3rem; max-height: 150px; overflow-y: auto;">
                        ${axiesHtml}
                    </ul>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
    
    let passivePlots = plots.filter(p => p.axies.length === 0 && !p.isRotationSlave);
    if (passivePlots.length > 0) {
        const passiveHeader = document.createElement('div');
        passiveHeader.style.gridColumn = '1 / -1';
        passiveHeader.style.marginTop = '2rem';
        passiveHeader.innerHTML = `
            <div style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem; margin-bottom: 1rem;">
                <h3 style="margin: 0; color: var(--text-primary); font-size: 1.2rem;">Passive Plots (Unused)</h3>
                <p style="margin: 0.2rem 0 0 0; color: var(--text-secondary); font-size: 0.9rem;">
                    These plots are more profitable running passively on free Local Lunium. (150 Base Flame, 16.6% Uptime)
                </p>
            </div>
        `;
        container.appendChild(passiveHeader);
        
        let totalPassiveBaxs = 0;
        passivePlots.forEach((plot, index) => {
            let passiveBaxs = (150 / plot.globalFlame) * plot.rewardPool * (1/6);
            let passiveRevenue = passiveBaxs * (window.baxsPrice || 0);
            totalPassiveBaxs += passiveBaxs;
            totalBaxs += passiveBaxs; // ADDED to fix the bug where passive baxs wasn't in the total
            
            const pCard = document.createElement('div');
            pCard.className = 'plot-card';
            pCard.style.borderTopColor = plot.env.color;
            pCard.style.opacity = '0.85';
            
            pCard.innerHTML = `
                <div class="plot-title">${plot.env.label} Plot (Passive)</div>
                <div class="plot-detail">
                    <span class="label">Assumed FP</span>
                    <span>150</span>
                </div>
                <div class="plot-detail">
                    <span class="label">Uptime (Local Lunium)</span>
                    <span>16.67% (1 Day On / 5 Off)</span>
                </div>
                <div class="plot-detail" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 0.5rem; margin-top: 0.5rem;">
                    <span class="label" style="color: #3498db;">Passive Reward</span>
                    <span style="color: #3498db; font-weight: bold;">~${passiveBaxs.toFixed(4)} bAXS/tick</span>
                </div>
                <div class="plot-detail">
                    <span class="label">Earnings ($)</span>
                    <span style="color: #2ecc71;">+$${passiveRevenue.toFixed(3)}</span>
                </div>
                <div class="plot-detail">
                    <span class="label">Global Cost ($)</span>
                    <span style="color: #bdc3c7;">$0.00 (Free)</span>
                </div>
            `;
            container.appendChild(pCard);
        });
    }
    
    if (availableItems && availableItems.length > 0) {
        const unusedHeader = document.createElement('div');
        unusedHeader.style.gridColumn = '1 / -1';
        unusedHeader.style.marginTop = '2rem';
        
        const itemCounts = {};
        availableItems.forEach(i => {
            itemCounts[i.name] = (itemCounts[i.name] || 0) + 1;
        });
        
        let unusedHtml = `
            <div style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem; margin-bottom: 1rem;">
                <h3 style="margin: 0; color: var(--text-primary); font-size: 1.2rem;">Unused Items (${availableItems.length} Total)</h3>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; font-size: 0.9em; color: var(--text-secondary);">
        `;
        
        for (const [name, count] of Object.entries(itemCounts)) {
            unusedHtml += `<span style="background: rgba(255,255,255,0.05); padding: 5px 10px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);">${name} x${count}</span>`;
        }
        
        unusedHtml += `</div>`;
        unusedHeader.innerHTML = unusedHtml;
        container.appendChild(unusedHeader);
    }
    
    document.getElementById('total-baxs-val').innerHTML = `${totalBaxs.toFixed(4)}`;
    document.getElementById('total-baxs-daily').innerHTML = `(~${(totalBaxs * 24).toFixed(4)}/day)`;
    document.getElementById('results-container').style.display = 'block';
}

function renderRotationResults(data) {
    const container = document.getElementById('rotation-results');
    if (!container) return;
    container.innerHTML = '';
    
    if (data.envRows.length === 0) return;
    
    let hasIdle = data.envRows.some(r => r.idlePlots > 0);
    if (!hasIdle) return; // don't show if no idle plots at all

    let html = `
        <div class="plot-card" style="border-top-color: #9b59b6; margin-bottom: 2rem;">
            <div class="plot-title">☁️ Cloud Rotation Verdict</div>
            <div style="color: var(--text-secondary); margin-bottom: 1rem; font-size: 0.9em;">
                You have ${data.leftoverTeams} leftover team(s) after active plots are assigned.
            </div>
    `;
    
    data.envRows.forEach(row => {
        if (row.idlePlots === 0) return;
        html += `
            <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid ${row.verdict === 'rotate' ? '#2ecc71' : (row.verdict === 'none' ? 'var(--text-secondary)' : '#f39c12')}">
                <h4 style="margin-top: 0; margin-bottom: 0.5rem; color: var(--text-primary);">${row.env.label} (${row.idlePlots} idle plots)</h4>
                <strong>Verdict: </strong>
                <span style="color: ${row.verdict === 'rotate' ? '#2ecc71' : (row.verdict === 'none' ? 'var(--text-secondary)' : '#f39c12')}">${row.verdictLabel}</span>
                <p style="margin-top: 0.5rem; margin-bottom: 0; font-size: 0.9em; color: var(--text-secondary); line-height: 1.4;">${row.reason}</p>
            </div>
        `;
    });
    
    html += `</div>`;
    container.innerHTML = html;
}

window.onload = init;
