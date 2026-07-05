/* Axie Terrarium Optimizer - script.js */

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

const RARITY_LABELS = ['Normal', 'Rare', 'Epic', 'Mystic'];

const EVOLVED_MULT = [1.0, 1.1, 1.2, 1.3, 1.45, 1.68];

// Accessory boost matrix: [axieRarityIdx][accRarity]
const ACCESSORY_MATRIX = [
    [0.1, 0.3, 1.0, 3.0],
    [0.2, 0.5, 1.5, 4.0],
    [0.5, 1.0, 2.5, 5.5],
    [1.0, 2.0, 4.5, 9.0]
];

// Maps API specialGenes values → internal collection key
const SPECIAL_GENES_MAP = {
    'summer2022': 'summer',
    'japan': 'japanese',
    'xmas2019': 'xmas',
    'nightmare': 'nightmare',
    'summershiny2022': 'shiny',
    'nightmareshiny': 'shiny',
    'mystic': 'mystic',
    'origin': 'origin',
    'meo': 'meo',
    'agamo': 'agamo',
    'agamogenesis': 'agamo',
};

// === COLLECTION DETECTION ===

function detectCollection(parts) {
    if (!parts || parts.length === 0) return 'normal';
    // Count specialGenes occurrences per collection
    const counts = {};
    let anySpecial = false;
    for (const p of parts) {
        const gene = (p.specialGenes || '').toLowerCase().trim();
        if (!gene) continue;
        // Map to known collection
        const mapped = SPECIAL_GENES_MAP[gene];
        if (mapped) {
            counts[mapped] = (counts[mapped] || 0) + 1;
            anySpecial = true;
        }
    }
    if (!anySpecial) return 'normal';
    // Pick the collection with the most matching parts
    let maxCount = 0, best = 'normal';
    for (const [key, count] of Object.entries(counts)) {
        if (count > maxCount) { maxCount = count; best = key; }
    }
    return best;
}

// === FLAME CALCULATIONS ===

function getBaseFlame(collection) { return COLLECTION_FLAME[collection] || 5; }

function getEvolvedBoost(evolvedParts) {
    const idx = Math.min(Math.max(evolvedParts - 1, 0), 5);
    return EVOLVED_MULT[idx];
}

function getAccessoryBoost(axieRarityIdx, accessories) {
    if (!accessories || accessories.length === 0) return 0;
    let total = 0;
    for (const acc of accessories) {
        const accRarity = Math.min(Math.max(acc.rarity, 0), 3);
        total += ACCESSORY_MATRIX[axieRarityIdx][accRarity];
    }
    return total;
}

function calcIndividualFlame(axie) {
    const base = axie.baseFlame || COLLECTION_FLAME.normal;
    return base * getEvolvedBoost(axie.evolvedParts) + getAccessoryBoost(axie.rarityIdx, axie.accessories);
}

function calcPlotFlame(axies, landItemBoost, fortuneSlipActive) {
    const totalIndividual = axies.reduce((sum, a) => sum + calcIndividualFlame(a), 0);
    return Math.floor(totalIndividual * (1 + (landItemBoost || 0) / 100) * (fortuneSlipActive ? 1.10 : 1.0));
}

function formatNumber(n) { return Number(n).toLocaleString(); }

// === PROCESS AXIES ===

function processAxies(results) {
    // Build axie objects
    const axies = results.map(axie => {
        const collection = detectCollection(axie.parts);
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
            accessories: [],
        };
    });

    // Calculate current flame
    axies.forEach(a => { a.currentFlame = calcIndividualFlame(a); });

    // Sort by flame descending, then name
    axies.sort((a, b) => b.currentFlame - a.currentFlame || a.name.localeCompare(b.name));

    // Group into plots of 30
    const PLOT_SIZE = 30;
    const plots = [];
    for (let i = 0; i < axies.length; i += PLOT_SIZE) {
        const chunk = axies.slice(i, i + PLOT_SIZE);
        plots.push({
            axies: chunk,
            totalFlame: chunk.reduce((s, a) => s + a.currentFlame, 0),
            index: plots.length
        });
    }

    // Summary stats
    const collectionStats = {};
    axies.forEach(a => {
        collectionStats[a.collectionLabel] = (collectionStats[a.collectionLabel] || 0) + 1;
    });

    renderResults(axies, plots, collectionStats);
}

// === RENDER ===

function renderResults(axies, plots, collectionStats) {
    document.getElementById('main-results').style.display = 'block';
    document.getElementById('total-axies').textContent = axies.length;
    document.getElementById('total-plots').textContent = plots.length;
    document.getElementById('grand-flame').textContent = formatNumber(plots.reduce((s, p) => s + p.totalFlame, 0));

    // Collection breakdown
    const statsDiv = document.getElementById('collection-stats');
    statsDiv.innerHTML = '';
    const sorted = Object.entries(collectionStats).sort((a, b) => b[1] - a[1]);
    sorted.forEach(([label, count]) => {
        const flame = COLLECTION_FLAME[Object.keys(COLLECTION_LABELS).find(k => COLLECTION_LABELS[k] === label)] || 5;
        const chip = document.createElement('span');
        chip.className = 'stat-chip';
        chip.innerHTML = `<strong>${label}</strong> ×${count} <span class="chip-flame">${flame}🔥</span>`;
        statsDiv.appendChild(chip);
    });

    // Plot cards
    const plotContainer = document.getElementById('plot-container');
    plotContainer.innerHTML = '';
    plots.forEach((plot, idx) => {
        const div = document.createElement('div');
        div.className = 'plot-card';
        const top3 = plot.axies.slice(0, 3).map(a =>
            `${a.name} (${a.collectionLabel}, ${a.currentFlame.toFixed(1)}🔥)`
        ).join(', ');

        div.innerHTML = `
            <div class="plot-header" onclick="this.nextElementSibling.classList.toggle('collapsed')">
                <h3>Plot ${idx + 1}</h3>
                <div class="plot-summary">
                    <span class="plot-flame">${formatNumber(plot.totalFlame)} 🔥</span>
                    <span class="plot-count">${plot.axies.length} Axies</span>
                </div>
                <div class="plot-preview">Top: ${top3}</div>
            </div>
            <div class="plot-axies-grid">
                ${plot.axies.map(axie => `
                    <div class="axie-card">
                        <img src="${axie.image}" alt="${axie.name}" onerror="this.src='https://axieinfinity.com/static/media/default-axie.png'" loading="lazy">
                        <div class="axie-name">${axie.name}</div>
                        <div class="axie-stats">
                            <span class="axie-collection">${axie.collectionLabel}</span>
                            <span class="axie-flame">${axie.currentFlame.toFixed(1)}🔥</span>
                        </div>
                        <div class="axie-class">${axie.class}</div>
                    </div>
                `).join('')}
            </div>
        `;
        plotContainer.appendChild(div);
    });

    // Loading state
    document.getElementById('loading-indicator').style.display = 'none';
}

// === INITIALIZATION ===

document.addEventListener('DOMContentLoaded', () => {

    // Load from saved dataset (data.js provides AXIES_DATASET)
    document.getElementById('load-btn').addEventListener('click', () => {
        const loading = document.getElementById('loading-indicator');
        loading.style.display = 'flex';
        loading.querySelector('.load-status').textContent = 'Loading 1,188 Axies from dataset...';
        document.getElementById('load-error').textContent = '';

        try {
            if (typeof AXIES_DATASET === 'undefined' || !AXIES_DATASET.axies) {
                throw new Error('AXIES_DATASET not found. data.js may not have loaded.');
            }
            const data = AXIES_DATASET;
            loading.querySelector('.load-status').textContent =
                `✅ Loaded ${data.axies.length} Axies (${data.owner}) — optimizing...`;
            setTimeout(() => processAxies(data.axies), 100);
        } catch (err) {
            loading.style.display = 'none';
            document.getElementById('load-error').textContent = '❌ ' + err.message;
            console.error(err);
        }
    });

    // Live fetch (CORS may block)
    document.getElementById('fetch-btn').addEventListener('click', async () => {
        const addr = document.getElementById('ronin-address').value.trim();
        if (!addr) { alert('Enter your Ronin address'); return; }
        const status = document.getElementById('fetch-status');
        status.textContent = '⏳ Fetching (CORS may block)...';
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
            if (!data || !data.results || data.results.length === 0) {
                status.textContent = 'No Axies found.';
                return;
            }
            status.textContent = `✅ Fetched ${data.total} Axies!`;
            document.getElementById('loading-indicator').style.display = 'flex';
            document.getElementById('loading-indicator').querySelector('.load-status').textContent = 'Processing...';
            setTimeout(() => processAxies(data.results), 100);
        } catch (err) {
            console.warn('Direct fetch failed (CORS):', err);
            status.textContent = '❌ CORS blocked. Use the manual paste option or click "Load from saved dataset".';
        }
    });

    // Paste handler
    document.getElementById('paste-btn').addEventListener('click', () => {
        const raw = document.getElementById('paste-data').value.trim();
        if (!raw) { alert('Paste the JSON output first.'); return; }
        try {
            const parsed = JSON.parse(raw);
            const data = parsed?.data?.axies || parsed;
            if (!data || !data.results) throw new Error('Missing .data.axies.results');
            document.getElementById('fetch-status').textContent = `✅ Loaded ${data.total || data.results.length} Axies via paste!`;
            document.getElementById('loading-indicator').style.display = 'flex';
            document.getElementById('loading-indicator').querySelector('.load-status').textContent = 'Processing pasted data...';
            setTimeout(() => processAxies(data.results), 100);
        } catch (e) {
            alert('Invalid JSON: ' + e.message);
        }
    });

    // Pre-fill address
    document.getElementById('ronin-address').value = '0xdf8b35668c8fcf82b1d1707875c98cd05b6927c4';
});

function generateCurlCommand(address) {
    const inner = `query GetAxieBriefList($owner: String,$from: Int,$size: Int){axies(owner:$owner,from:$from,size:$size){total results{id name stage class breedCount image title parts{id name class type specialGenes}}}}`;
    const vars = `{"owner":"${address}","from":0,"size":200}`;
    return `curl -s -X POST https://graphql-gateway.axieinfinity.com/graphql \\\n  -H "Content-Type: application/json" \\\n  -H "User-Agent: Mozilla/5.0" \\\n  -d '{"query":"${inner}","variables":${vars}}'`;
}