const ENVIRONMENTS = [
    { key: 'savannah', label: 'Savannah', color: 'var(--savannah)', defaultFlame: 5000000, rewardPool: 14000 },
    { key: 'forest', label: 'Forest', color: 'var(--forest)', defaultFlame: 12000000, rewardPool: 28000 },
    { key: 'arctic', label: 'Arctic', color: 'var(--arctic)', defaultFlame: 15000000, rewardPool: 40000 },
    { key: 'mystic', label: 'Mystic', color: 'var(--mystic)', defaultFlame: 25000000, rewardPool: 65000 },
    { key: 'genesis', label: 'Genesis', color: 'var(--genesis)', defaultFlame: 50000000, rewardPool: 150000 },
    { key: 'luna', label: "Luna's Landing", color: 'var(--luna)', defaultFlame: 80000000, rewardPool: 250000 },
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

const COLLECTION_PRIORITY = {
    mystic: 100, origin: 90, shiny: 80, xmas: 70, meo: 60,
    japanese: 50, nightmare: 40, summer: 30, normal: 0
};

const EVOLVED_MULT = [1.0, 1.1, 1.2, 1.3, 1.45, 1.68]; // 0=1 part, 5=6 parts

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
    
    processAxies();
    gItems = USER_DATA.items || [];
    gAccessories = USER_DATA.accessories || [];
    
    renderInputs();
    
    document.getElementById('btn-optimize').addEventListener('click', optimize);
}

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

function processAxies() {
    gAxies = USER_DATA.axies.map(axie => {
        const collection = detectCollection(axie.parts || [], axie.title, axie.name);
        const evoParts = axie.evolvedParts || 0;
        
        const base = COLLECTION_FLAME[collection] || 5;
        const idx = Math.min(Math.max(evoParts - 1, 0), 5);
        const flame = Math.round(base * (evoParts > 0 ? EVOLVED_MULT[idx] : 1.0));
        
        return {
            id: axie.id,
            name: axie.name,
            flame: flame
        };
    });
    // Sort axies by flame descending
    gAxies.sort((a, b) => b.flame - a.flame);
}

function renderInputs() {
    const container = document.getElementById('env-inputs');
    container.innerHTML = '';
    
    ENVIRONMENTS.forEach(env => {
        const row = document.createElement('div');
        row.className = 'input-row';
        row.style.borderLeft = `4px solid ${env.color}`;
        row.style.paddingLeft = '1rem';
        
        row.innerHTML = `
            <div class="env-label">
                ${env.label}
            </div>
            <div class="input-group">
                <label>Plots Owned</label>
                <input type="number" min="0" value="0" id="plots-${env.key}">
            </div>
            <div class="input-group">
                <label>Global Total Flame</label>
                <input type="number" min="1" value="${env.defaultFlame}" id="global-${env.key}">
            </div>
        `;
        container.appendChild(row);
    });
}

function optimize() {
    // 1. Gather Inputs
    const userPlots = [];
    ENVIRONMENTS.forEach(env => {
        const count = parseInt(document.getElementById(`plots-${env.key}`).value) || 0;
        const globalFlame = parseInt(document.getElementById(`global-${env.key}`).value) || env.defaultFlame;
        
        for (let i = 0; i < count; i++) {
            userPlots.push({
                envKey: env.key,
                label: env.label,
                color: env.color,
                rewardPool: env.rewardPool,
                globalFlame: globalFlame,
                items: [],
                axies: [],
                itemBoost: 0,
                baseFlame: 0,
                finalFlame: 0,
                expectedBaxs: 0
            });
        }
    });
    
    if (userPlots.length === 0) {
        alert("Please enter at least 1 plot.");
        return;
    }
    
    // 2. Assign Land Items greedily to maximize (1 + itemBoost) * (rewardPool / globalFlame)
    // Actually, land items only fit specific environments (or 'any').
    // Let's just assign highest boost items to each plot of that environment.
    let availableItems = [...gItems].sort((a, b) => b.boost - a.boost);
    
    userPlots.forEach(plot => {
        let itemsForPlot = [];
        // First try to fill with environment specific or 'any' items
        for (let i = 0; i < availableItems.length && itemsForPlot.length < 8; i++) {
            const item = availableItems[i];
            if (item.environment === plot.envKey || item.environment === 'any') {
                itemsForPlot.push(item);
                plot.itemBoost += item.boost;
                availableItems.splice(i, 1);
                i--; // adjust index after removal
            }
        }
        plot.items = itemsForPlot;
        // Multiplier = (1 + itemBoost) * (rewardPool / globalFlame)
        plot.multiplier = (1 + plot.itemBoost) * (plot.rewardPool / plot.globalFlame);
    });
    
    // 3. Sort plots by multiplier descending to assign Axies
    userPlots.sort((a, b) => b.multiplier - a.multiplier);
    
    // 4. Assign Axies
    let axieIdx = 0;
    userPlots.forEach(plot => {
        while (plot.axies.length < 30 && axieIdx < gAxies.length) {
            const axie = gAxies[axieIdx++];
            plot.axies.push(axie);
            plot.baseFlame += axie.flame;
        }
        plot.finalFlame = Math.floor(plot.baseFlame * (1 + plot.itemBoost));
        plot.expectedBaxs = (plot.finalFlame / plot.globalFlame) * plot.rewardPool;
    });
    
    // 5. Assign Accessories (greedy)
    const sortedAccessories = [...gAccessories].sort((a, b) => {
        const rarities = { 'Mystic': 4, 'Epic': 3, 'Rare': 2, 'Common': 1 };
        return (rarities[b.rarity] || 0) - (rarities[a.rarity] || 0);
    });
    
    let accAssignments = [];
    for (let i = 0; i < sortedAccessories.length && i < gAxies.length; i++) {
        accAssignments.push({
            accessory: sortedAccessories[i],
            axie: gAxies[i]
        });
    }
    
    renderResults(userPlots, accAssignments);
}

function renderResults(plots, accAssignments) {
    const container = document.getElementById('plots-grid');
    container.innerHTML = '';
    
    // Accessory layout
    if (accAssignments.length > 0) {
        const accSection = document.createElement('div');
        accSection.className = 'plot-card';
        accSection.style.gridColumn = '1 / -1';
        accSection.style.borderTopColor = 'var(--mystic)';
        
        let html = '<div class="plot-title">💎 Accessory Assignments</div><ul style="color: var(--text-secondary); margin-left: 1.5rem; margin-bottom: 1rem;">';
        accAssignments.forEach(a => {
            html += \`<li>Equip <strong>\${a.accessory.name}</strong> (\${a.accessory.rarity}) to <strong>\${a.axie.name}</strong> (\${a.axie.flame} Base Flame)</li>\`;
        });
        html += '</ul>';
        accSection.innerHTML = html;
        container.appendChild(accSection);
    }
    
    let totalBaxs = 0;
    
    plots.forEach((plot, index) => {
        totalBaxs += plot.expectedBaxs;
        
        const card = document.createElement('div');
        card.className = 'plot-card';
        card.style.borderTopColor = plot.color;
        
        card.innerHTML = `
            <div class="plot-title">
                <span>${plot.label} Plot #${index + 1}</span>
                <span class="baxs-value">+${plot.expectedBaxs.toFixed(2)} bAXS</span>
            </div>
            <div class="plot-detail">
                <span class="label">Assigned Axies</span>
                <span>${plot.axies.length} / 30</span>
            </div>
            <div class="plot-detail">
                <span class="label">Base Flame</span>
                <span>${plot.baseFlame.toLocaleString()}</span>
            </div>
            <div class="plot-detail">
                <span class="label">Land Items</span>
                <span>${plot.items.length} / 8</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                ${plot.items.length > 0 ? plot.items.map(i => `${i.name} (+${(i.boost*100)}%)`).join(', ') : 'None'}
            </div>
            <div class="plot-detail">
                <span class="label">Item Boost</span>
                <span style="color: #2ecc71;">+${(plot.itemBoost * 100).toFixed(0)}%</span>
            </div>
            <div class="plot-detail" style="margin-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 0.5rem;">
                <span class="label">Final Plot Flame</span>
                <span style="font-weight: bold; color: #fbbf24;">${plot.finalFlame.toLocaleString()}</span>
            </div>
        `;
        container.appendChild(card);
    });
    
    document.getElementById('total-baxs-val').textContent = totalBaxs.toFixed(2);
    document.getElementById('results-container').style.display = 'block';
    document.getElementById('results-container').scrollIntoView({ behavior: 'smooth' });
}

window.onload = init;