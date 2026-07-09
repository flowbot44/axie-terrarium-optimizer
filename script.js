
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

const EVOLVED_MULT = [1.0, 1.1, 1.2, 1.3, 1.45, 1.68];

const ENV_MULT = {
    savannah: 1.2,
    forest: 1.2,
    arctic: 1.2,
    mystic: 1.5,
    genesis: 1.2,
    luna: 1.5
};

const RARITY_BOOST = { 'Common': 0.0005, 'Rare': 0.0010, 'Epic': 0.0075, 'Mystic': 0.0150 };

const FORTUNE_SLIPS = { savannah: 3, forest: 8, arctic: 22, mystic: 48, genesis: 960, luna: 2880 };

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
    
    // Load economy settings
    const savedBaxs = localStorage.getItem('baxsPrice');
    if (savedBaxs) document.getElementById('baxs-price').value = savedBaxs;
    
    const savedSale = localStorage.getItem('luniumSale');
    if (savedSale !== null) {
        document.getElementById('lunium-sale').checked = (savedSale === 'true');
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
    gAxies = USER_DATA.axies.map(axie => {
        let collection = 'normal';
        let isMystic = false;
        
        if (axie.title === 'Mystic') {
            collection = 'mystic';
            isMystic = true;
        } else if (axie.title === 'Origin') {
            collection = 'origin';
        } else if (axie.title === 'MEO Corp') {
            collection = 'meo';
        } else if (axie.title === 'Agamogenesis') {
            collection = 'agamo';
        }
        
        if (axie.parts) {
                for (let p of axie.parts) {
                    if (p.specialGenes) {
                        let mapped = SPECIAL_GENES_MAP[p.specialGenes.toLowerCase()];
                        if (mapped) {
                            if (collection === 'normal' || COLLECTION_FLAME[mapped] > COLLECTION_FLAME[collection]) {
                                collection = mapped;
                            }
                        }
                    }
                }
            }
        
        const base = COLLECTION_FLAME[collection] || 5;
        let evCount = axie.evolvedParts || 0;
        if (evCount > 5) evCount = 5;
        const mult = EVOLVED_MULT[evCount];
        const flame = base * mult;
        
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
    container.innerHTML = `
        <div class="env-grid-header">
            <div>Environment</div>
            <div>Plots Owned</div>
            <div>Global Total Flame</div>
            <div>Reward Pool (bAXS)</div>
        </div>
        <div id="env-grid-body"></div>
    `;
    
    const tbody = document.getElementById('env-grid-body');
    
    ENVIRONMENTS.forEach(env => {
        const row = document.createElement('div');
        row.className = 'env-grid-row';
        row.style.borderLeftColor = env.color;
        
        let savedPlots = localStorage.getItem(`plots-${env.key}`);
        let savedFlame = localStorage.getItem(`global-${env.key}`);
        let savedPool = localStorage.getItem(`pool-${env.key}`);
        
        const initialPlots = savedPlots !== null ? savedPlots : (env.defaultPlots || 0);
        const initialFlame = savedFlame !== null ? savedFlame : env.defaultFlame;
        const initialPool = savedPool !== null ? savedPool : env.rewardPool;
        
        row.innerHTML = `
            <div class="env-label" style="color: ${env.color};">${env.label}</div>
            <input type="number" min="0" value="${initialPlots}" id="plots-${env.key}" class="grid-input" title="Plots Owned">
            <input type="number" min="1" value="${initialFlame}" id="global-${env.key}" class="grid-input" title="Global Total Flame">
            <input type="number" min="0" step="0.01" value="${initialPool}" id="pool-${env.key}" class="grid-input" title="Reward Pool">
        `;
        tbody.appendChild(row);
        
        const pInput = document.getElementById(`plots-${env.key}`);
        const fInput = document.getElementById(`global-${env.key}`);
        const rInput = document.getElementById(`pool-${env.key}`);
        pInput.addEventListener('input', () => localStorage.setItem(`plots-${env.key}`, pInput.value));
        fInput.addEventListener('input', () => localStorage.setItem(`global-${env.key}`, fInput.value));
        rInput.addEventListener('input', () => localStorage.setItem(`pool-${env.key}`, rInput.value));
    });
}

function optimize() {
    const baxsPrice = parseFloat(document.getElementById('baxs-price').value) || 0;
    const luniumPrice = parseFloat(document.getElementById('lunium-price').value) || 0;
    localStorage.setItem('baxsPrice', baxsPrice);
    localStorage.setItem('luniumPrice', luniumPrice);
    window.baxsPrice = baxsPrice;
    window.luniumPrice = luniumPrice;
    
    const userPlots = [];
    ENVIRONMENTS.forEach(env => {
        const plotsStr = document.getElementById(`plots-${env.key}`).value;
        const flameStr = document.getElementById(`global-${env.key}`).value;
        const poolStr = document.getElementById(`pool-${env.key}`).value;
        const plotsCount = parseInt(plotsStr) || 0;
        const globalFlame = parseInt(flameStr) || env.defaultFlame;
        const dynamicPool = parseFloat(poolStr) || env.rewardPool;
        
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
                expectedBaxs: 0
            });
        }
    });
    
    if (userPlots.length === 0) {
        alert("You have no plots configured.");
        return;
    }
    
    let availableItems = [...gItems];
    availableItems.forEach(i => {
        i.baseBoost = RARITY_BOOST[i.rarity] || 0.0005;
    });
    
    const TIER_ORDER = { luna: 6, genesis: 5, mystic: 4, arctic: 3, forest: 2, savannah: 1 };
    userPlots.sort((a, b) => TIER_ORDER[b.env.key] - TIER_ORDER[a.env.key]);
    
    userPlots.forEach(plot => {
        let envKey = plot.env.key;
        let envMult = ENV_MULT[envKey] || 1.0;
        
        // Genesis and Luna match all items
        let isUniversal = (envKey === 'genesis' || envKey === 'luna');
        
        availableItems.sort((a, b) => {
            const matchA = (isUniversal || (a.environment && a.environment.toLowerCase() === envKey)) ? envMult : 1.0;
            const matchB = (isUniversal || (b.environment && b.environment.toLowerCase() === envKey)) ? envMult : 1.0;
            const finalA = a.baseBoost * matchA;
            const finalB = b.baseBoost * matchB;
            return finalB - finalA;
        });
        
        let boost = 0;
        plot.items = [];
        for (let j = 0; j < 8; j++) {
            if (availableItems.length > 0) {
                let item = availableItems.shift();
                plot.items.push(item);
            }
        }
        
        plot.items.forEach(i => {
            const match = (isUniversal || (i.environment && i.environment.toLowerCase() === envKey)) ? envMult : 1.0;
            i.finalBoost = i.baseBoost * match;
            boost += i.finalBoost;
        });
        plot.itemBoost = boost;
    });
    
    // 1. Assign accessories to the top Axies
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
    
    // 4. Assign chunks to the most profitable plot
    let availablePlots = [...userPlots];
    
    for (let chunk of chunks) {
        let bestPlot = null;
        let bestPlotIndex = -1;
        let bestProfit = -Infinity;
        
        for (let j = 0; j < availablePlots.length; j++) {
            let plot = availablePlots[j];
            let finalFlame = Math.floor(chunk.baseFlame * (1 + plot.itemBoost) * 1.10);
            let expectedBaxs = (finalFlame / plot.globalFlame) * plot.rewardPool;
            let passiveBaxs = (150 / plot.globalFlame) * plot.rewardPool * (1/6);
            
            let netProfit;
            let passiveProfit;
            let threshold;
            if (window.baxsPrice > 0) {
                let baxsRevenue = expectedBaxs * window.baxsPrice;
                let globalCons = plot.env.globalCons || 0;
                let globalCost = globalCons * window.luniumPrice;
                netProfit = baxsRevenue - globalCost;
                passiveProfit = passiveBaxs * window.baxsPrice;
                threshold = passiveProfit + (globalCost * 0.25); // Require margin of 1/4 of global cost
            } else {
                netProfit = expectedBaxs; // Fallback if prices are 0
                passiveProfit = passiveBaxs;
                threshold = passiveBaxs;
            }
            
            if (netProfit > bestProfit && netProfit > threshold) {
                bestProfit = netProfit;
                bestPlot = plot;
                bestPlotIndex = j;
            }
        }
        
        // Only assign if it's profitable and better than passive
        if (bestPlot && bestProfit > 0) {
            bestPlot.axies = chunk.axies;
            bestPlot.baseFlame = chunk.baseFlame;
            bestPlot.finalFlame = Math.floor(chunk.baseFlame * (1 + bestPlot.itemBoost) * 1.10);
            bestPlot.expectedBaxs = (bestPlot.finalFlame / bestPlot.globalFlame) * bestPlot.rewardPool;
            availablePlots.splice(bestPlotIndex, 1);
        } else {
            // No profitable plots left for remaining chunks
            break;
        }
    }
    
    // Sort plots by final flame power descending
    userPlots.sort((a, b) => b.finalFlame - a.finalFlame);
    
    renderResults(userPlots, accAssignments);
}

function toggleDetails(element) {
    const details = element.nextElementSibling;
    if (details.style.display === 'none' || details.style.display === '') {
        details.style.display = 'block';
    } else {
        details.style.display = 'none';
    }
}

function renderResults(plots, accAssignments) {
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
    let totalSlips = 0;
    
    plots.forEach((plot, index) => {
        if (plot.axies.length === 0) return;
        
        totalBaxs += plot.expectedBaxs;
        let slipsCost = FORTUNE_SLIPS[plot.env.key] || 0;
        totalSlips += slipsCost;
        
        const card = document.createElement('div');
        card.className = 'plot-card';
        card.style.borderTopColor = plot.env.color;
        
        let itemsHtml = plot.items.map(i => `<li>${i.name} (+${(i.finalBoost*100).toFixed(2)}%)</li>`).join('');
        if (!itemsHtml) itemsHtml = "<li>None</li>";
        
        // Show just the top 5 axies to keep it clean, or all of them in a scrollable list
        let axiesHtml = plot.axies.map(a => `<li>${a.name} (${a.flame.toFixed(1)} Flame)</li>`).join('');
        
        let globalCons = plot.env.globalCons || 0;
        let localCons = plot.env.localCons || 0;
        let baxsRevenue = plot.expectedBaxs * (window.baxsPrice || 0);
        let globalCost = globalCons * (window.luniumPrice || 0);
        let netGlobal = baxsRevenue - globalCost;
        let profitColor = netGlobal < 0 ? '#e74c3c' : (netGlobal < 0.05 ? '#f39c12' : '#2ecc71');
        
        card.innerHTML = `
            <div class="plot-summary" style="cursor: pointer;" onclick="toggleDetails(this)">
                <div class="plot-title">${plot.env.label} Plot #${index + 1} <span style="font-size: 0.8em; opacity: 0.7;">(Click for details)</span></div>
                <div class="plot-detail">
                    <span class="label">Item Boost</span>
                    <span style="color: #2ecc71;">+${(plot.itemBoost * 100).toFixed(2)}%</span>
                </div>
                <div class="plot-detail">
                    <span class="label">Fortune Slips Buff</span>
                    <span style="color: #f1c40f;">+10% (-${slipsCost}/day)</span>
                </div>
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
                    <span style="color: #3498db; font-weight: 800;">~${plot.expectedBaxs.toFixed(2)} bAXS</span>
                </div>
                <div class="plot-detail" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 0.5rem; margin-top: 0.5rem;">
                    <span class="label">Earnings ($)</span>
                    <span style="color: #2ecc71;">+$${baxsRevenue.toFixed(3)}</span>
                </div>
                <div class="plot-detail">
                    <span class="label">Global Lunium Cost ($)</span>
                    <span style="color: #e74c3c;">-$${globalCost.toFixed(3)} (${globalCons}/Tick)</span>
                </div>
                <div class="plot-detail" style="margin-bottom: 0.5rem;">
                    <span class="label">Global Net Profit ($)</span>
                    <span style="color: ${profitColor}; font-weight: bold;">$${netGlobal.toFixed(3)}</span>
                </div>
                <div class="plot-detail">
                    <span class="label" style="font-size: 0.75em; color: var(--text-secondary);">Local Lunium Cons.</span>
                    <span style="font-size: 0.75em; color: var(--text-secondary);">${localCons}/Tick (Free Limit)</span>
                </div>
            </div>
            <div class="plot-expanded" style="display: none; margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed rgba(255,255,255,0.1);">
                <div style="margin-bottom: 1rem;">
                    <strong>Land Items (${plot.items.length}/8)</strong>
                    <ul style="color: var(--text-secondary); margin-left: 1.2rem; font-size: 0.85rem; margin-top: 0.3rem;">
                        ${itemsHtml}
                    </ul>
                </div>
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
    
    let passivePlots = plots.filter(p => p.axies.length === 0);
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
                    <span style="color: #3498db; font-weight: bold;">~${passiveBaxs.toFixed(3)} bAXS</span>
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
    
    document.getElementById('total-baxs-val').innerHTML = `${totalBaxs.toFixed(2)} <span style="font-size:0.6em; color:var(--text-secondary); font-weight:normal;">(Costs ${totalSlips} Slips/day)</span>`;
    document.getElementById('results-container').style.display = 'block';
}

window.onload = init;
