// Axie Terrarium Optimizer — script.js v3 (Optimizer Edition)
// Evolved parts removed from plot level. Flame-per-env inputs + land item optimizer.

// === CONSTANTS ===
const ENVIRONMENTS = [
    { key: 'forest',    label: 'Forest',    icon: '🌲', color: '#2ecc71' },
    { key: 'arctic',    label: 'Arctic',    icon: '❄️', color: '#85c1e9' },
    { key: 'savannah',  label: 'Savannah',  icon: '🏜️', color: '#e67e22' },
    { key: 'mystic',    label: 'Mystic',    icon: '✨', color: '#9b59b6' },
    { key: 'genesis',   label: 'Genesis',   icon: '🏛️', color: '#3498db' },
    { key: 'luna',      label: "Luna's Landing", icon: '🌙', color: '#e74c3c' },
];
const MAX_ITEMS_PER_PLOT = 8;

const COLLECTION_FLAME = {
    normal: 5, summer: 20, nightmare: 40, japanese: 60,
    shiny: 200, xmas: 200, meo: 200, origin: 400,
    mystic: 1000, agamo: 2000
};
const COLLECTION_LABELS = {
    normal: 'Normal', summer: 'Summer', nightmare: 'Nightmare',
    japanese: 'Japanese', shiny: 'Shiny',
    xmas: 'Xmas', meo: 'Meo', origin: 'Origin', mystic: 'Mystic', agamo: 'Agamo Genesis'
};
const SPECIAL_GENES_MAP = {
    'summer2022': 'summer', 'japan': 'japanese', 'xmas2019': 'xmas',
    'nightmare': 'nightmare', 'summershiny2022': 'shiny', 'nightmareshiny': 'shiny',
    'mystic': 'mystic', 'origin': 'origin', 'meo': 'meo', 'agamo': 'agamo', 'agamogenesis': 'agamo'
};
const COLLECTION_PRIORITY = {
    mystic: 100, origin: 90, shiny: 80, xmas: 70, meo: 60,
    japanese: 50, nightmare: 40, summer: 30, normal: 0
};

const EVOLVED_MULT = [1.0, 1.1, 1.2, 1.3, 1.45, 1.68]; // indexed at 0 = 1 part

// === GLOBAL STATE ===
let gAxies = [];
let gLandItems = [];
let gAllAxiesFlame = 0; // total flame of all axies loaded

// === HELPERS ===
function formatNumber(n) { return Number(n).toLocaleString(); }

function detectCollection(parts, title, name) {
    let found = [];
    for (const p of parts) {
        const gene = (p.specialGenes || '').toLowerCase().trim();
        if (!gene) continue;
        const mapped = SPECIAL_GENES_MAP[gene];
        if (mapped) found.push(mapped);
    }
    if (found.length > 0) {
        found.sort((a, b) => (COLLECTION_PRIORITY[b] || 0) - (COLLECTION_PRIORITY[a] || 0));
        return found[0];
    }
    const t = (title || '').trim().toLowerCase();
    const n = (name || '').trim().toLowerCase();
    if (t === 'origin') return 'origin';
    if (t === 'meo corp ii') return 'meo';
    if (t === 'agamo genesis') return 'agamo';
    if (n.includes('origin')) return 'origin';
    return 'normal';
}

function countEvolvedParts(parts) {
    if (!parts) return 0;
    return parts.filter(p => p.id && p.id.endsWith('-2')).length;
}

function calcIndividualFlame(axie) {
    const base = axie.baseFlame || COLLECTION_FLAME.normal;
    const idx = Math.min(Math.max(axie.evolvedParts - 1, 0), 5);
    return Math.round(base * EVOLVED_MULT[idx]);
}

function getBaseFlame(c) { return COLLECTION_FLAME[c] || 5; }

// === PROCESS AXIES ===
function processAxies(results) {
    gAxies = results.map(axie => {
        const collection = detectCollection(axie.parts, axie.title, axie.name);
        const evoParts = (axie.evolvedParts !== undefined) ? axie.evolvedParts : countEvolvedParts(axie.parts);
        return {
            id: axie.id,
            name: axie.name,
            image: axie.image,
            class: axie.class,
            collection,
            collectionLabel: COLLECTION_LABELS[collection] || 'Normal',
            baseFlame: getBaseFlame(collection),
            evolvedParts: evoParts,
            currentFlame: 0,
        };
    });
    gAxies.forEach(a => { a.currentFlame = calcIndividualFlame(a); });
    gAllAxiesFlame = gAxies.reduce((s, a) => s + a.currentFlame, 0);
    renderSummary();
    renderCollectionBreakdown();
    renderLandInventory();
    renderFlameInputs();
    document.getElementById('main-results').style.display = 'block';
    document.getElementById('loading-indicator').style.display = 'none';
}

// === RENDER: Summary ===
function renderSummary() {
    document.getElementById('total-axies').textContent = gAxies.length;
    document.getElementById('total-flame').textContent = formatNumber(gAllAxiesFlame);
    document.getElementById('land-total').textContent = gLandItems.length;
}

// === RENDER: Collection Breakdown ===
function renderCollectionBreakdown() {
    const stats = {};
    gAxies.forEach(a => { stats[a.collectionLabel] = (stats[a.collectionLabel] || 0) + 1; });
    const div = document.getElementById('collection-stats');
    div.innerHTML = '';
    Object.entries(stats).sort((a, b) => b[1] - a[1]).forEach(([label, count]) => {
        const key = Object.keys(COLLECTION_LABELS).find(k => COLLECTION_LABELS[k] === label);
        const flame = COLLECTION_FLAME[key] || 5;
        const chip = document.createElement('span');
        chip.className = 'stat-chip';
        chip.innerHTML = `<strong>${label}</strong> ×${count} <span class="chip-flame">${flame}🔥</span>`;
        div.appendChild(chip);
    });
}

// === RENDER: Land Items Inventory ===
function renderLandInventory() {
    if (!gLandItems.length) return;
    const grid = document.getElementById('land-items-body');
    grid.innerHTML = '';

    const envOrder = ['mystic', 'genesis', 'arctic', 'forest', 'savannah', 'luna', 'any'];
    const envLabels = {
        mystic: 'Mystic ✨', genesis: 'Genesis 🏛️', arctic: 'Arctic ❄️',
        forest: 'Forest 🌲', savannah: 'Savannah 🏜️', luna: "Luna's Landing 🌙", any: 'Universal'
    };
    const envColors = {
        mystic: '#9b59b6', genesis: '#3498db', arctic: '#85c1e9',
        forest: '#2ecc71', savannah: '#e67e22', luna: '#e74c3c', any: '#95a5a6'
    };

    const groups = {};
    for (const item of gLandItems) {
        const env = item.environment || 'any';
        if (!groups[env]) groups[env] = [];
        groups[env].push(item);
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'land-items-grid';

    for (const env of envOrder) {
        if (!groups[env]) continue;
        const items = groups[env];
        const color = envColors[env] || '#95a5a6';
        const totalBoost = items.reduce((s, i) => s + i.boost, 0);

        const byRarity = {};
        for (const item of items) {
            const r = item.rarity || 'Unknown';
            if (!byRarity[r]) byRarity[r] = [];
            byRarity[r].push(item);
        }
        const rarityOrder = ['Mystic', 'Epic', 'Rare', 'Common'];
        const details = rarityOrder.filter(r => byRarity[r]).map(r =>
            `<span class="rarity-${r.toLowerCase()}">${r} ×${byRarity[r].length}</span>`
        ).join(' · ');

        const block = document.createElement('div');
        block.className = 'land-rarity-group';
        block.innerHTML = `
            <h4 class="land-rarity-title" style="border-left: 3px solid ${color}; padding-left: 8px;">
                ${envLabels[env] || env}
                <span class="land-count">×${items.length}</span>
                <span class="land-boost-sum">+${totalBoost.toFixed(2)}%</span>
            </h4>
            <div class="land-meta">${details}</div>
            <div class="land-item-list">
                ${items.slice(0, 30).map(item =>
                    `<span class="land-item-tag">${item.name} <span class="boost-pct">+${item.boost}%</span></span>`
                ).join('')}
                ${items.length > 30 ? `<span class="land-item-tag more">+${items.length - 30} more</span>` : ''}
            </div>
        `;
        wrapper.appendChild(block);
    }
    grid.appendChild(wrapper);
}

// === RENDER: Flame Inputs ===
function renderFlameInputs() {
    const div = document.getElementById('flame-inputs');
    div.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'flame-input-grid';

    for (const env of ENVIRONMENTS) {
        const row = document.createElement('div');
        row.className = 'flame-input-row';
        row.style.borderLeft = `3px solid ${env.color}`;
        row.innerHTML = `
            <span class="env-label"><span class="env-icon">${env.icon}</span>${env.label}</span>
            <div class="input-group">
                <span class="input-label">Flame 🔥</span>
                <input type="number" min="0" step="1000" value="0"
                       class="flame-val" data-env="${env.key}" placeholder="0">
            </div>
            <div class="input-group">
                <span class="input-label">Plots 🏕️</span>
                <input type="number" min="0" max="99" value="0"
                       class="plots-val" data-env="${env.key}" placeholder="0">
            </div>
        `;
        grid.appendChild(row);
    }
    div.appendChild(grid);
}

// === OPTIMIZER ===
function getEnvIndex(key) {
    return ENVIRONMENTS.findIndex(e => e.key === key);
}

function optimize() {
    // 1. Read inputs
    const flameByEnv = {};
    const plotsByEnv = {};
    let hasAny = false;
    for (const env of ENVIRONMENTS) {
        const fEl = document.querySelector(`.flame-val[data-env="${env.key}"]`);
        const pEl = document.querySelector(`.plots-val[data-env="${env.key}"]`);
        const flame = parseInt(fEl.value) || 0;
        const plots = parseInt(pEl.value) || 0;
        flameByEnv[env.key] = flame;
        plotsByEnv[env.key] = plots;
        if (flame > 0) hasAny = true;
    }

    if (!hasAny) {
        document.getElementById('optimize-error').textContent = 'Enter at least one environment with flame > 0.';
        return;
    }
    document.getElementById('optimize-error').textContent = '';

    // 2. Calculate total item slots per environment
    const slotsByEnv = {};
    let totalSlots = 0;
    for (const env of ENVIRONMENTS) {
        slotsByEnv[env.key] = (plotsByEnv[env.key] || 0) * MAX_ITEMS_PER_PLOT;
        totalSlots += slotsByEnv[env.key];
    }

    if (totalSlots === 0) {
        document.getElementById('optimize-error').textContent = 'Enter at least 1 plot.';
        return;
    }

    // 3. Prepare land items
    const items = gLandItems.map(item => ({ ...item }));
    items.sort((a, b) => b.boost - a.boost); // highest boost first

    // 4. Greedy allocation
    //    Phase A: Assign matching items to their environment
    //    Phase B: Assign remaining items (universal + unmatched leftovers) to highest-marginal-value environment
    const assigned = {}; // env.key -> [{item, matched: bool}]
    for (const env of ENVIRONMENTS) {
        assigned[env.key] = [];
    }
    const unassigned = [];

    // Phase A: matching items
    const remaining = [];
    for (const item of items) {
        const env = item.environment;
        if (env && env !== 'any') {
            const key = env;
            if (assigned[key] && assigned[key].length < slotsByEnv[key]) {
                assigned[key].push({ item, matched: true });
            } else {
                remaining.push(item); // env-specific but no room → try elsewhere
            }
        } else {
            remaining.push(item); // universal
        }
    }

    // Phase B: assign remaining items to best environment
    for (const item of remaining) {
        const isUniversal = item.environment === 'any' || !item.environment;
        let bestEnv = null;
        let bestValue = -1;

        for (const env of ENVIRONMENTS) {
            const key = env.key;
            if (assigned[key].length >= slotsByEnv[key]) continue;
            const flame = flameByEnv[key];
            if (flame === 0) continue;

            const isMatch = env.key === item.environment;
            // marginal benefit = flame × boost (×2 if matched)
            let marginal;
            if (isMatch) {
                marginal = flame * (item.boost * 2 / 100);
            } else {
                marginal = flame * (item.boost / 100);
            }
            if (marginal > bestValue) {
                bestValue = marginal;
                bestEnv = key;
            }
        }

        if (bestEnv) {
            const isMatch = bestEnv === item.environment && !isUniversal;
            assigned[bestEnv].push({ item, matched: isMatch || false });
        } else {
            unassigned.push(item);
        }
    }

    // 5. Calculate results
    const results = [];
    let totalOriginalFlame = 0;
    let totalOptimizedFlame = 0;
    for (const env of ENVIRONMENTS) {
        const key = env.key;
        const flame = flameByEnv[key];
        const slots = slotsByEnv[key];
        const items = assigned[key];
        let boostSum = 0;
        let matchedBoostSum = 0;
        let unmatchedBoostSum = 0;
        for (const a of items) {
            boostSum += a.item.boost;
            if (a.matched) matchedBoostSum += a.item.boost;
            else unmatchedBoostSum += a.item.boost;
        }
        // Effective boost: matching gets ×2, non-matching gets ×1
        const effectiveBoost = matchedBoostSum * 2 + unmatchedBoostSum;
        const originalFlame = flame;
        const optimizedFlame = Math.floor(flame * (1 + effectiveBoost / 100));
        totalOriginalFlame += originalFlame;
        totalOptimizedFlame += optimizedFlame;

        results.push({
            env,
            flame,
            slots,
            totalSlots: slots,
            usedSlots: items.length,
            items,
            matchedBoostSum,
            unmatchedBoostSum,
            effectiveBoost,
            originalFlame,
            optimizedFlame,
        });
    }

    renderOptimizationResults(results, unassigned, totalOriginalFlame, totalOptimizedFlame);
}

// === RENDER: Optimization Results ===
function renderOptimizationResults(results, unassigned, totalOriginal, totalOptimized) {
    const section = document.getElementById('optimization-results');
    section.style.display = 'block';

    // Summary bar
    const summary = document.getElementById('opt-summary');
    const pctGain = totalOriginal > 0 ? ((totalOptimized - totalOriginal) / totalOriginal * 100).toFixed(1) : 0;
    summary.innerHTML = `
        <div class="stat-item"><span class="stat-num">${formatNumber(totalOriginal)}</span><span class="stat-label">Base Flame</span></div>
        <div class="stat-item"><span class="stat-num" style="color:#2ecc71">${formatNumber(totalOptimized)}</span><span class="stat-label">Optimized Flame</span></div>
        <div class="stat-item"><span class="stat-num" style="color:#f1c40f">+${pctGain}%</span><span class="stat-label">Gain</span></div>
        <div class="stat-item"><span class="stat-num">${gLandItems.length - unassigned.length}</span><span class="stat-label">Items Used</span></div>
    `;

    // Detail cards
    const details = document.getElementById('opt-details');
    details.innerHTML = '';

    for (const r of results) {
        if (r.flame === 0 && r.items.length === 0) continue;

        const card = document.createElement('div');
        card.className = 'opt-env-card';

        // Header
        const header = document.createElement('div');
        header.className = 'opt-env-header';
        header.innerHTML = `
            <h3>${r.env.icon} ${r.env.label}</h3>
            <div class="opt-numbers">
                <span class="opt-base">${formatNumber(r.flame)}🔥</span>
                <span class="opt-boost-total">+${r.effectiveBoost.toFixed(2)}%</span>
                <span class="opt-result">→ ${formatNumber(r.optimizedFlame)}🔥</span>
                <span class="opt-slots">${r.usedSlots}/${r.totalSlots} slots</span>
            </div>
        `;
        card.appendChild(header);

        // Slot visual bar
        if (r.totalSlots > 0) {
            const bar = document.createElement('div');
            bar.className = 'opt-slot-bar';
            for (let i = 0; i < r.totalSlots; i++) {
                const slot = document.createElement('div');
                slot.className = 'opt-slot';
                if (i < r.items.length) {
                    slot.classList.add('filled');
                    if (r.items[i].matched) slot.classList.add('matched');
                }
                bar.appendChild(slot);
            }
            card.appendChild(bar);
        }

        // Items table
        if (r.items.length > 0) {
            const itemsDiv = document.createElement('div');
            itemsDiv.className = 'opt-items-list';
            let tableHTML = `
                <table class="opt-items-table">
                    <thead><tr><th>Item</th><th>Rarity</th><th>Boost</th><th>Match</th></tr></thead>
                    <tbody>
            `;
            for (const a of r.items) {
                const rarityClass = a.item.rarity ? `rarity-${a.item.rarity.toLowerCase()}` : '';
                tableHTML += `
                    <tr>
                        <td class="opt-item-name">${a.item.name}</td>
                        <td class="opt-item-rarity ${rarityClass}">${a.item.rarity || '—'}</td>
                        <td class="opt-item-boost">+${a.item.boost}%</td>
                        <td>${a.matched
                            ? '<span class="opt-item-matched">✓ ×2</span>'
                            : '<span class="opt-item-not-matched">×1</span>'
                        }</td>
                    </tr>
                `;
            }
            tableHTML += '</tbody></table>';
            itemsDiv.innerHTML = tableHTML;
            card.appendChild(itemsDiv);
        } else {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'opt-items-list';
            emptyDiv.innerHTML = '<p style="color:#555; font-size:0.75rem; text-align:center;">No items assigned (no flame entered or no slots available)</p>';
            card.appendChild(emptyDiv);
        }

        details.appendChild(card);
    }

    // Unassigned items
    if (unassigned.length > 0) {
        const uDiv = document.createElement('div');
        uDiv.className = 'opt-unassigned';
        uDiv.innerHTML = `
            <h4>📦 Unassigned Items (${unassigned.length})</h4>
            <p style="color:#555; font-size:0.7rem; margin-bottom:0.5rem;">
                These items couldn't be assigned — all plot slots are filled, or no matching environment with flame was available.
            </p>
            <div class="opt-unassigned-list">
                ${unassigned.sort((a,b) => b.boost - a.boost).slice(0, 20).map(item =>
                    `<span class="land-item-tag">${item.name} +${item.boost}%</span>`
                ).join('')}
                ${unassigned.length > 20 ? `<span class="land-item-tag more">+${unassigned.length - 20} more</span>` : ''}
            </div>
        `;
        details.appendChild(uDiv);
    }

    // Scroll to results
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('load-btn').addEventListener('click', () => {
        const loading = document.getElementById('loading-indicator');
        loading.style.display = 'flex';
        loading.querySelector('.load-status').textContent = 'Loading 1,188 Axies from dataset...';
        document.getElementById('load-error').textContent = '';
        try {
            if (typeof AXIES_DATASET === 'undefined' || !AXIES_DATASET.axies)
                throw new Error('AXIES_DATASET not found in data.js');
            if (typeof LAND_ITEMS_DATA === 'undefined' || !LAND_ITEMS_DATA.items)
                throw new Error('LAND_ITEMS_DATA not found in land_data.js');

            const data = AXIES_DATASET;
            gLandItems = LAND_ITEMS_DATA.items;

            loading.querySelector('.load-status').textContent =
                `✅ Loaded ${data.axies.length} Axies + ${gLandItems.length} Land Items`;

            setTimeout(() => processAxies(data.axies), 100);
        } catch (err) {
            loading.style.display = 'none';
            document.getElementById('load-error').textContent = '❌ ' + err.message;
        }
    });

    document.getElementById('optimize-btn').addEventListener('click', optimize);
});