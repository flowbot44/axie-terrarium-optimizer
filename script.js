/* Axie Terrarium Optimizer - script.js v2 with evolved parts */

// === CONSTANTS ===
const COLLECTION_FLAME = {
    normal: 5, summer: 20, nightmare: 40, japanese: 60,
    shiny: 200, xmas: 200, meo: 200, origin: 400,
    mystic: 1000, agamo: 2000
};
const COLLECTION_LABELS = {
    normal: 'Normal', summer: 'Summer', nightmare: 'Nightmare',
    japanese: 'Japanese', shiny: 'Shiny', xmas: 'Xmas',
    meo: 'Meo', origin: 'Origin', mystic: 'Mystic', agamo: 'Agamo Genesis'
};
const COLLECTION_RARITY = {
    normal: 0, summer: 1, nightmare: 1, japanese: 1,
    shiny: 2, xmas: 2, meo: 2, origin: 2, mystic: 3, agamo: 3
};
const EVOLVED_MULT = [1.0, 1.1, 1.2, 1.3, 1.45, 1.68]; // index 0 = 1 evo part, 1 = 2 parts, etc.
const ACCESSORY_MATRIX = [
    [0.1, 0.3, 1.0, 3.0], [0.2, 0.5, 1.5, 4.0],
    [0.5, 1.0, 2.5, 5.5], [1.0, 2.0, 4.5, 9.0]
];
const SPECIAL_GENES_MAP = {
    'summer2022': 'summer', 'japan': 'japanese', 'xmas2019': 'xmas',
    'nightmare': 'nightmare', 'summershiny2022': 'shiny', 'nightmareshiny': 'shiny',
    'mystic': 'mystic', 'origin': 'origin', 'meo': 'meo', 'agamo': 'agamo', 'agamogenesis': 'agamo'
};
const COLLECTION_PRIORITY = {
    mystic: 100, origin: 90, shiny: 80, xmas: 70, meo: 60,
    japanese: 50, nightmare: 40, summer: 30, normal: 0
};

// === GLOBAL STATE ===
let gAxies = [];       // All axie objects
let gPlots = [];       // Plot objects

// === COLLECTION DETECTION ===
function detectCollection(parts, title, name) {
    if (!parts || parts.length === 0) return 'normal';
    let foundCollections = [];
    for (const p of parts) {
        const gene = (p.specialGenes || '').toLowerCase().trim();
        if (!gene) continue;
        const mapped = SPECIAL_GENES_MAP[gene];
        if (mapped) foundCollections.push(mapped);
    }
    if (foundCollections.length > 0) {
        foundCollections.sort((a, b) => (COLLECTION_PRIORITY[b] || 0) - (COLLECTION_PRIORITY[a] || 0));
        return foundCollections[0];
    }
    const t = (title || '').trim().toLowerCase();
    const n = (name || '').trim().toLowerCase();
    if (t === 'origin') return 'origin';
    if (t === 'meo corp ii') return 'meo';
    if (t === 'agamo genesis') return 'agamo';
    if (n.includes('origin')) return 'origin';
    return 'normal';
}

// === FLAME CALCULATIONS ===
function formatNumber(n) { return Number(n).toLocaleString(); }

function calcEvolvedMultiplier(evolvedParts) {
    const idx = Math.min(Math.max(evolvedParts - 1, 0), 5);
    return EVOLVED_MULT[idx];
}

function calcIndividualFlame(axie) {
    const base = axie.baseFlame || COLLECTION_FLAME.normal;
    return Math.round(base * calcEvolvedMultiplier(axie.evolvedParts));
}

function calcPlotFlame(plot) {
    let total = plot.axies.reduce((s, a) => s + calcIndividualFlame(a), 0);
    if (plot.landItemBoost) total = Math.floor(total * (1 + plot.landItemBoost / 100));
    if (plot.fortuneSlipActive) total = Math.floor(total * 1.10);
    return total;
}

function calcGrandFlame() {
    return gPlots.reduce((s, p) => s + calcPlotFlame(p), 0);
}

function refreshAllFlame() {
    gAxies.forEach(a => { a.currentFlame = calcIndividualFlame(a); });
    sortAndRegroup();
}

function sortAndRegroup() {
    gAxies.sort((a, b) => b.currentFlame - a.currentFlame || a.name.localeCompare(b.name));
    const PLOT_SIZE = 30;
    const newPlots = [];
    for (let i = 0; i < gAxies.length; i += PLOT_SIZE) {
        const chunk = gAxies.slice(i, i + PLOT_SIZE);
        newPlots.push({
            axies: chunk,
            index: newPlots.length,
            landItemBoost: 0,
            fortuneSlipActive: false
        });
    }
    // Preserve landItemBoost/fortuneSlip from existing plots if same count
    if (gPlots.length > 0 && gPlots.length === newPlots.length) {
        for (let i = 0; i < newPlots.length; i++) {
            newPlots[i].landItemBoost = gPlots[i].landItemBoost || 0;
            newPlots[i].fortuneSlipActive = gPlots[i].fortuneSlipActive || false;
        }
    }
    gPlots = newPlots;
    renderAll();
}

function renderAll() {
    document.getElementById('main-results').style.display = 'block';
    const grandFlame = calcGrandFlame();
    document.getElementById('total-axies').textContent = gAxies.length;
    document.getElementById('total-plots').textContent = gPlots.length;
    document.getElementById('grand-flame').textContent = formatNumber(grandFlame);

    // Collection breakdown
    const stats = {};
    gAxies.forEach(a => { stats[a.collectionLabel] = (stats[a.collectionLabel] || 0) + 1; });
    const statsDiv = document.getElementById('collection-stats');
    statsDiv.innerHTML = '';
    Object.entries(stats).sort((a, b) => b[1] - a[1]).forEach(([label, count]) => {
        const flame = COLLECTION_FLAME[Object.keys(COLLECTION_LABELS).find(k => COLLECTION_LABELS[k] === label)] || 5;
        const chip = document.createElement('span');
        chip.className = 'stat-chip';
        chip.innerHTML = `<strong>${label}</strong> ×${count} <span class="chip-flame">${flame}🔥</span>`;
        statsDiv.appendChild(chip);
    });

    // Plot cards
    const plotContainer = document.getElementById('plot-container');
    plotContainer.innerHTML = '';
    gPlots.forEach((plot, idx) => {
        const plotFlame = calcPlotFlame(plot);
        const top3 = plot.axies.slice(0, 3).map(a =>
            `${a.name} (${a.collectionLabel}, ${a.currentFlame}🔥)`
        ).join(', ');

        const card = document.createElement('div');
        card.className = 'plot-card';

        // Header
        const header = document.createElement('div');
        header.className = 'plot-header';
        header.innerHTML = `
            <h3>Plot ${idx + 1}</h3>
            <div class="plot-summary">
                <span class="plot-flame">${formatNumber(plotFlame)} 🔥</span>
                <span class="plot-count">${plot.axies.length} Axies</span>
            </div>
            <div class="plot-preview">Top: ${top3}</div>
        `;

        // Controls bar
        const controls = document.createElement('div');
        controls.className = 'plot-controls';
        controls.innerHTML = `
            <div class="ctrl-group">
                <label>Evolved:</label>
                <button class="evo-btn btn-sm" data-action="batch-evo" data-plot="${idx}" data-evo="0">0</button>
                <button class="evo-btn btn-sm" data-action="batch-evo" data-plot="${idx}" data-evo="1">1</button>
                <button class="evo-btn btn-sm" data-action="batch-evo" data-plot="${idx}" data-evo="2">2</button>
                <button class="evo-btn btn-sm" data-action="batch-evo" data-plot="${idx}" data-evo="3">3</button>
                <button class="evo-btn btn-sm" data-action="batch-evo" data-plot="${idx}" data-evo="4">4</button>
                <button class="evo-btn btn-sm" data-action="batch-evo" data-plot="${idx}" data-evo="5">5</button>
                <button class="evo-btn btn-sm" data-action="batch-evo" data-plot="${idx}" data-evo="6">6</button>
            </div>
            <div class="ctrl-group">
                <label>Land Item:</label>
                <input type="range" class="land-slider" min="0" max="100" value="${plot.landItemBoost || 0}" data-plot="${idx}">
                <span class="land-val">${plot.landItemBoost || 0}%</span>
            </div>
            <div class="ctrl-group">
                <label>Fortune Slip:</label>
                <input type="checkbox" class="slip-check" data-plot="${idx}" ${plot.fortuneSlipActive ? 'checked' : ''}>
            </div>
        `;

        // Axies grid
        const grid = document.createElement('div');
        grid.className = 'plot-axies-grid';
        const PLOT_SIZE = 30;
        const from = idx * PLOT_SIZE;
        const to = Math.min(from + PLOT_SIZE, gAxies.length);
        for (let i = from; i < to; i++) {
            const a = gAxies[i];
            const cardDiv = document.createElement('div');
            cardDiv.className = 'axie-card';
            cardDiv.dataset.axieIdx = i;
            cardDiv.innerHTML = `
                <img src="${a.image}" alt="${a.name}" loading="lazy" onerror="this.src='https://axieinfinity.com/static/media/default-axie.png'">
                <div class="axie-name" title="${a.name}">${a.name}</div>
                <div class="axie-stats">
                    <span class="axie-collection">${a.collectionLabel}</span>
                    <span class="axie-flame">${a.currentFlame}🔥</span>
                </div>
                <div class="axie-class">${a.class}</div>
                <div class="evo-selector">
                    <span class="evo-label">Evo:</span>
                    ${[0,1,2,3,4,5,6].map(n =>
                        `<span class="evo-dot ${a.evolvedParts === n ? 'active' : ''}" data-idx="${i}" data-evo="${n}">${n}</span>`
                    ).join('')}
                </div>
            `;
            grid.appendChild(cardDiv);
        }

        card.appendChild(header);
        card.appendChild(controls);
        card.appendChild(grid);
        plotContainer.appendChild(card);
    });

    // Attach event listeners
    document.querySelectorAll('.evo-dot').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.idx);
            const evo = parseInt(el.dataset.evo);
            gAxies[idx].evolvedParts = evo;
            gAxies[idx].currentFlame = calcIndividualFlame(gAxies[idx]);
            renderAll();
        });
    });

    document.querySelectorAll('[data-action="batch-evo"]').forEach(el => {
        el.addEventListener('click', () => {
            const plotIdx = parseInt(el.dataset.plot);
            const evo = parseInt(el.dataset.evo);
            const from = plotIdx * 30;
            const to = Math.min(from + 30, gAxies.length);
            for (let i = from; i < to; i++) {
                gAxies[i].evolvedParts = evo;
                gAxies[i].currentFlame = calcIndividualFlame(gAxies[i]);
            }
            renderAll();
        });
    });

    document.querySelectorAll('.land-slider').forEach(el => {
        el.addEventListener('input', () => {
            const plotIdx = parseInt(el.dataset.plot);
            gPlots[plotIdx].landItemBoost = parseInt(el.value);
            el.nextElementSibling.textContent = el.value + '%';
            renderAll();
        });
    });

    document.querySelectorAll('.slip-check').forEach(el => {
        el.addEventListener('change', () => {
            const plotIdx = parseInt(el.dataset.plot);
            gPlots[plotIdx].fortuneSlipActive = el.checked;
            renderAll();
        });
    });

    // Loading state
    document.getElementById('loading-indicator').style.display = 'none';
}

// === PROCESS AXIES ===
function processAxies(results) {
    gAxies = results.map(axie => {
        const collection = detectCollection(axie.parts, axie.title, axie.name);
        const rarityIdx = COLLECTION_RARITY[collection] || 0;
        return {
            id: axie.id,
            name: axie.name,
            image: axie.image,
            class: axie.class,
            collection,
            collectionLabel: COLLECTION_LABELS[collection] || 'Normal',
            rarityIdx,
            baseFlame: getBaseFlame(collection),
            evolvedParts: 0,
            currentFlame: 0,
            accessories: [],
        };
    });
    gAxies.forEach(a => { a.currentFlame = calcIndividualFlame(a); });
    sortAndRegroup();
}

function getBaseFlame(c) { return COLLECTION_FLAME[c] || 5; }

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('load-btn').addEventListener('click', () => {
        const loading = document.getElementById('loading-indicator');
        loading.style.display = 'flex';
        loading.querySelector('.load-status').textContent = 'Loading 1,188 Axies from dataset...';
        document.getElementById('load-error').textContent = '';
        try {
            if (typeof AXIES_DATASET === 'undefined' || !AXIES_DATASET.axies)
                throw new Error('AXIES_DATASET not found.');
            const data = AXIES_DATASET;
            loading.querySelector('.load-status').textContent =
                `✅ Loaded ${data.axies.length} Axies — optimizing...`;
            setTimeout(() => processAxies(data.axies), 100);
        } catch (err) {
            loading.style.display = 'none';
            document.getElementById('load-error').textContent = '❌ ' + err.message;
        }
    });

    document.getElementById('fetch-btn').addEventListener('click', async () => {
        const addr = document.getElementById('ronin-address').value.trim();
        if (!addr) { alert('Enter your Ronin address'); return; }
        const status = document.getElementById('fetch-status');
        status.textContent = '⏳ Fetching...';
        document.getElementById('manual-section').style.display = 'block';
        document.getElementById('curl-command').value = generateCurlCommand(addr);
        try {
            const resp = await fetch('https://graphql-gateway.axieinfinity.com/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `query GetAxieBriefList($owner: String, $from: Int, $size: Int) {
                        axies(owner: $owner, from: $from, size: $size) {
                            total results { id name stage class breedCount image title
                            parts { id name class type specialGenes } } }
                    }`,
                    variables: { owner: addr, from: 0, size: 200 }
                })
            });
            const result = await resp.json();
            if (result.errors) throw new Error(result.errors.map(e => e.message).join(', '));
            const data = result.data?.axies;
            if (!data || !data.results || data.results.length === 0) { status.textContent = 'No Axies found.'; return; }
            status.textContent = `✅ Fetched ${data.total} Axies!`;
            document.getElementById('loading-indicator').style.display = 'flex';
            setTimeout(() => processAxies(data.results), 100);
        } catch (err) {
            status.textContent = '❌ CORS blocked. Use "Load from saved dataset" or paste below.';
        }
    });

    document.getElementById('paste-btn').addEventListener('click', () => {
        const raw = document.getElementById('paste-data').value.trim();
        if (!raw) { alert('Paste JSON first.'); return; }
        try {
            const parsed = JSON.parse(raw);
            const data = parsed?.data?.axies || parsed;
            if (!data || !data.results) throw new Error('Missing results');
            document.getElementById('fetch-status').textContent = `✅ Loaded ${data.total || data.results.length} Axies!`;
            document.getElementById('loading-indicator').style.display = 'flex';
            setTimeout(() => processAxies(data.results), 100);
        } catch (e) { alert('Invalid JSON: ' + e.message); }
    });

    document.getElementById('ronin-address').value = '0xdf8b35668c8fcf82b1d1707875c98cd05b6927c4';
});

function generateCurlCommand(address) {
    const inner = `query GetAxieBriefList($owner: String,$from: Int,$size: Int){axies(owner:$owner,from:$from,size:$size){total results{id name stage class breedCount image title parts{id name class type specialGenes}}}}`;
    const vars = `{"owner":"${address}","from":0,"size":200}`;
    return `curl -s -X POST https://graphql-gateway.axieinfinity.com/graphql \\\n  -H "Content-Type: application/json" \\\n  -H "User-Agent: Mozilla/5.0" \\\n  -d '{"query":"${inner}","variables":${vars}}'`;
}