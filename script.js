/* Axie Terrarium Optimizer - script.js */

// Base flame values from official in-game infographic
const COLLECTION_FLAME = {
    normal: 5, summer: 20, nightmare: 40, japanese: 60,
    shiny: 200, xmas: 200, meo: 200, origin: 400,
    mystic: 1000, agamo: 2000
};

const EVOLVED_MULT = [1.0, 1.1, 1.2, 1.3, 1.45, 1.68];

const ACCESSORY_MATRIX = [
    [0.1, 0.3, 1.0, 3.0],
    [0.2, 0.5, 1.5, 4.0],
    [0.5, 1.0, 2.5, 5.5],
    [1.0, 2.0, 4.5, 9.0]
];

const COLLECTION_RARITY = {
    normal: 0, summer: 1, nightmare: 1, japanese: 1,
    shiny: 2, xmas: 2, meo: 2, origin: 2, mystic: 3, agamo: 3
};

const SPECIES_MAP = {
    'mystic': 'mystic', 'summer': 'summer', 'nightmare': 'nightmare',
    'japanese': 'japanese', 'shiny': 'shiny', 'xmas': 'xmas',
    'meo': 'meo', 'origin': 'origin', 'agamo': 'agamo'
};

const RARITY_LABELS = ['Normal', 'Rare', 'Epic', 'Mystic'];

function detectCollection(parts) {
    if (!parts || parts.length === 0) return 'normal';
    const counts = {};
    let totalSpecial = 0;
    for (const p of parts) {
        const gene = p.specialGenes ? p.specialGenes.toLowerCase().trim() : '';
        if (gene && SPECIES_MAP[gene]) {
            const key = SPECIES_MAP[gene];
            counts[key] = (counts[key] || 0) + 1;
            totalSpecial++;
        }
    }
    if (totalSpecial === 0) return 'normal';
    let maxCount = 0, best = 'normal';
    for (const [key, count] of Object.entries(counts)) {
        if (count > maxCount) { maxCount = count; best = key; }
    }
    return best;
}

function getBaseFlame(collection) { return COLLECTION_FLAME[collection] || 5; }

function getEvolvedBoost(evolvedParts) {
    if (evolvedParts < 1) return 1.0;
    return EVOLVED_MULT[Math.min(evolvedParts - 1, 5)];
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
    return axie.baseFlame * getEvolvedBoost(axie.evolvedParts) + getAccessoryBoost(axie.rarityIdx, axie.accessories);
}

function calcPlotFlame(axies, landItemBoost, fortuneSlipActive) {
    const totalIndividual = axies.reduce((sum, a) => sum + calcIndividualFlame(a), 0);
    return Math.floor(totalIndividual * (1 + landItemBoost / 100) * (fortuneSlipActive ? 1.10 : 1.0));
}

function formatNumber(n) { return n.toLocaleString(); }

function processAxies(results) {
    const axies = results.map(axie => {
        const collection = detectCollection(axie.parts);
        const rarityIdx = COLLECTION_RARITY[collection] || 0;
        return {
            id: axie.id,
            name: axie.name,
            image: axie.image,
            class: axie.class,
            collection, rarityIdx,
            baseFlame: getBaseFlame(collection),
            evolvedParts: 0,
            accessories: [],
        };
    });
    axies.forEach(a => { a.currentFlame = calcIndividualFlame(a); });
    axies.sort((a, b) => b.currentFlame - a.currentFlame || a.name.localeCompare(b.name));

    const PLOT_SIZE = 30;
    const plots = [];
    for (let i = 0; i < axies.length; i += PLOT_SIZE) {
        const chunk = axies.slice(i, i + PLOT_SIZE);
        plots.push({ axies: chunk, totalFlame: chunk.reduce((s, a) => s + a.currentFlame, 0) });
    }

    renderResults(axies, plots);
}

function renderResults(axies, plots) {
    document.getElementById('total-axies').textContent = axies.length;
    document.getElementById('total-plots').textContent = plots.length;
    document.getElementById('total-flame').textContent = formatNumber(plots.reduce((s, p) => s + p.totalFlame, 0));
    document.getElementById('optimizer-results').style.display = 'block';
    document.getElementById('fetch-status').textContent = '';

    const plotContainer = document.getElementById('plot-container');
    plotContainer.innerHTML = '';
    plots.forEach((plot, idx) => {
        const div = document.createElement('div');
        div.className = 'plot-card';
        div.innerHTML = `<h3>Plot ${idx + 1} <span class="plot-flame">${formatNumber(plot.totalFlame)} Flame</span></h3><div class="plot-axies axies-grid"></div>`;
        const grid = div.querySelector('.plot-axies');
        plot.axies.forEach(axie => {
            const card = document.createElement('div');
            card.className = 'axie-card';
            card.innerHTML = `<img src="${axie.image}" alt="${axie.name}" onerror="this.src='https://axieinfinity.com/static/media/default-axie.png'">
                <div class="axie-name">${axie.name}</div>
                <div class="axie-stats"><span>${axie.collection}</span><span>Flame: ${axie.currentFlame.toFixed(1)}</span></div>`;
            grid.appendChild(card);
        });
        plotContainer.appendChild(div);
    });

    const allGrid = document.getElementById('all-axies-grid');
    allGrid.innerHTML = '';
    axies.forEach(axie => {
        const card = document.createElement('div');
        card.className = 'axie-card';
        card.innerHTML = `<img src="${axie.image}" alt="${axie.name}" onerror="this.src='https://axieinfinity.com/static/media/default-axie.png'">
            <div class="axie-name">${axie.name}</div>
            <div class="axie-stats"><span>${axie.collection}</span><span>Flame: ${axie.currentFlame.toFixed(1)}</span></div>`;
        allGrid.appendChild(card);
    });
}

// The GraphQL API doesn't support CORS from browser. Provide curl-friendly alternatives.
function generateCurlCommand(address) {
    const query = `{"query":"query GetAxieBriefList(\\$owner: String, \\$from: Int, \\$size: Int, \\$sort: SortBy) { axies(owner: \\$owner, from: \\$from, size: \\$size, sort: \\$sort) { total results { id name stage class breedCount image title parts { id name class type specialGenes } } } }","variables":{"owner":"${address}","from":0,"size":200,"sort":"IdAsc"}}`;
    return `curl -X POST https://graphql-gateway.axieinfinity.com/graphql -H "Content-Type: application/json" -d '${query}'`;
}

function render() {
    document.getElementById('fetch-btn').addEventListener('click', async () => {
        const addr = document.getElementById('ronin-address').value.trim();
        if (!addr) { alert('Enter your Ronin address'); return; }
        const status = document.getElementById('fetch-status');
        status.textContent = 'Fetching Axies (this may fail due to browser CORS policy)…';

        // Show curl command so user can fetch manually
        document.getElementById('manual-section').style.display = 'block';
        document.getElementById('curl-command').value = generateCurlCommand(addr);

        try {
            // Attempt direct fetch (may fail with CORS)
            const response = await fetch('https://graphql-gateway.axieinfinity.com/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `query GetAxieBriefList($owner: String, $from: Int, $size: Int, $sort: SortBy) {
                        axies(owner: $owner, from: $from, size: $size, sort: $sort) {
                            total results { id name stage class breedCount image title
                            parts { id name class type specialGenes } } }
                    }`,
                    variables: { owner: addr, from: 0, size: 200, sort: 'IdAsc' }
                })
            });
            const result = await response.json();
            if (result.errors) throw new Error(result.errors.map(e => e.message).join(', '));
            const data = result.data?.axies;
            if (!data || !data.results || data.results.length === 0) {
                status.textContent = 'No Axies found.';
                return;
            }
            status.textContent = `Fetched ${data.total} Axies directly!`;
            processAxies(data.results);
        } catch (directErr) {
            console.warn('Direct fetch failed (CORS), providing manual option.', directErr);
            status.textContent = '❌ Browser blocked the API request due to CORS. Use the manual option below.';
        }
    });

    document.getElementById('paste-btn').addEventListener('click', () => {
        const raw = document.getElementById('paste-data').value.trim();
        if (!raw) { alert('Paste the JSON output from the curl command above.'); return; }
        try {
            const parsed = JSON.parse(raw);
            const data = parsed?.data?.axies || parsed;
            if (!data || !data.results) throw new Error('Missing .data.axies.results');
            document.getElementById('fetch-status').textContent = `Loaded ${data.total || data.results.length} Axies via paste!`;
            processAxies(data.results);
        } catch (e) {
            alert('Invalid JSON: ' + e.message);
        }
    });

    // Pre-fill with user's address
    document.getElementById('ronin-address').value = '0xdf8b35668c8fcf82b1d1707875c98cd05b6927c4';
}

document.addEventListener('DOMContentLoaded', render);