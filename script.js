/* Axie Terrarium Optimizer - script.js */

// Base flame values from official in-game infographic
const COLLECTION_FLAME = {
    normal: 5,
    summer: 20,
    nightmare: 40,
    japanese: 60,
    shiny: 200,
    xmas: 200,
    meo: 200,
    origin: 400,
    mystic: 1000,
    agamo: 2000
};

// Evolved parts multiplier table
const EVOLVED_MULT = [1.0, 1.1, 1.2, 1.3, 1.45, 1.68];

// Accessories flame boost matrix:
// [axieRarityIndex][accessoryRarityIndex]
// rarity order: normal(0), rare(1), epic(2), mystic(3)
const ACCESSORY_MATRIX = [
    [0.1, 0.3, 1.0, 3.0],
    [0.2, 0.5, 1.5, 4.0],
    [0.5, 1.0, 2.5, 5.5],
    [1.0, 2.0, 4.5, 9.0]
];

// Rarity mapping for axie collections
const COLLECTION_RARITY = {
    normal: 0,
    summer: 1,
    nightmare: 1,
    japanese: 1,
    shiny: 2,
    xmas: 2,
    meo: 2,
    origin: 2,
    mystic: 3,
    agamo: 3
};

// Map specialGenes string to collection key
const SPECIES_MAP = {
    'mystic': 'mystic',
    'summer': 'summer',
    'nightmare': 'nightmare',
    'japanese': 'japanese',
    'shiny': 'shiny',
    'xmas': 'xmas',
    'meo': 'meo',
    'origin': 'origin',
    'agamo': 'agamo'
};

const RARITY_LABELS = ['Normal', 'Rare', 'Epic', 'Mystic'];
const ACCESSORY_RARITY_LABELS = ['Common', 'Rare', 'Epic', 'Mystic'];

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
    // Return most common specialGene
    let maxCount = 0;
    let best = 'normal';
    for (const [key, count] of Object.entries(counts)) {
        if (count > maxCount) {
            maxCount = count;
            best = key;
        }
    }
    return best;
}

function getBaseFlame(collection) {
    return COLLECTION_FLAME[collection] || 5;
}

function getEvolvedBoost(evolvedParts) {
    if (evolvedParts < 1) return 1.0;
    const idx = Math.min(evolvedParts - 1, 5);
    return EVOLVED_MULT[idx];
}

function getAccessoryBoost(axieRarityIdx, accessories) {
    // accessories: array of {rarity: 0-3} up to 5
    if (!accessories || accessories.length === 0) return 0;
    let total = 0;
    for (const acc of accessories) {
        const accRarity = Math.min(Math.max(acc.rarity, 0), 3);
        total += ACCESSORY_MATRIX[axieRarityIdx][accRarity];
    }
    return total;
}

function calcIndividualFlame(axie) {
    const base = axie.baseFlame;
    const evoMult = getEvolvedBoost(axie.evolvedParts);
    const accBoost = getAccessoryBoost(axie.rarityIdx, axie.accessories);
    return base * evoMult + accBoost;
}

function calcPlotFlame(axies, landItemBoost, fortuneSlipActive) {
    const totalIndividual = axies.reduce((sum, a) => sum + calcIndividualFlame(a), 0);
    const itemMult = 1 + (landItemBoost / 100);
    const fortuneMult = fortuneSlipActive ? 1.10 : 1.0;
    return Math.floor(totalIndividual * itemMult * fortuneMult);
}

// GraphQL query
const QUERY = `
query GetAxieBriefList($owner: String, $from: Int, $size: Int, $sort: SortBy) {
  axies(owner: $owner, from: $from, size: $size, sort: $sort) {
    total
    results {
      id
      name
      stage
      class
      breedCount
      image
      title
      parts {
        id
        name
        class
        type
        specialGenes
      }
    }
  }
}
`;

async function fetchAxies(address) {
    const variables = {
        owner: address,
        from: 0,
        size: 200,
        sort: 'IdAsc'
    };

    const response = await fetch('https://graphql-gateway.axieinfinity.com/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: QUERY, variables })
    });

    const result = await response.json();
    if (result.errors) {
        throw new Error(result.errors.map(e => e.message).join(', '));
    }
    return result.data?.axies;
}

function getRarityLabel(collection) {
    const rarityIdx = COLLECTION_RARITY[collection] || 0;
    return { label: RARITY_LABELS[rarityIdx], idx: rarityIdx };
}

function formatNumber(n) {
    return n.toLocaleString();
}

function render() {
    document.getElementById('fetch-btn').addEventListener('click', async () => {
        const addr = document.getElementById('ronin-address').value.trim();
        if (!addr) { alert('Enter your Ronin address'); return; }

        const status = document.getElementById('fetch-status');
        status.textContent = 'Fetching Axies…';
        
        try {
            const data = await fetchAxies(addr);
            if (!data || !data.results || data.results.length === 0) {
                status.textContent = 'No Axies found for this address.';
                return;
            }

            status.textContent = `Found ${data.total} Axies. Analyzing…`;

            // Process each axie
            const axies = data.results.map(axie => {
                const collection = detectCollection(axie.parts);
                const rarityIdx = COLLECTION_RARITY[collection] || 0;
                return {
                    id: axie.id,
                    name: axie.name,
                    image: axie.image,
                    class: axie.class,
                    collection: collection,
                    rarityIdx: rarityIdx,
                    baseFlame: getBaseFlame(collection),
                    evolvedParts: 0, // user can adjust
                    accessories: [],  // user can add
                };
            });

            // Sort by flame descending, then by name
            axies.forEach(a => { a.currentFlame = calcIndividualFlame(a); });
            axies.sort((a, b) => b.currentFlame - a.currentFlame || a.name.localeCompare(b.name));

            // Group into plots of 30
            const PLOT_SIZE = 30;
            const plots = [];
            for (let i = 0; i < axies.length; i += PLOT_SIZE) {
                const chunk = axies.slice(i, i + PLOT_SIZE);
                const totalFlame = chunk.reduce((s, a) => s + a.currentFlame, 0);
                plots.push({ axies: chunk, totalFlame });
            }

            document.getElementById('total-axies').textContent = axies.length;
            document.getElementById('total-plots').textContent = plots.length;
            document.getElementById('total-flame').textContent = formatNumber(plots.reduce((s, p) => s + p.totalFlame, 0));
            document.getElementById('optimizer-results').style.display = 'block';
            status.textContent = '';

            // Render plots
            const plotContainer = document.getElementById('plot-container');
            plotContainer.innerHTML = '';
            plots.forEach((plot, idx) => {
                const div = document.createElement('div');
                div.className = 'plot-card';
                div.innerHTML = `
                    <h3>Plot ${idx + 1} <span class="plot-flame">${formatNumber(plot.totalFlame)} Flame</span></h3>
                    <div class="plot-axies"></div>
                `;
                const grid = div.querySelector('.plot-axies');
                grid.className = 'axies-grid';
                plot.axies.forEach(axie => {
                    const card = document.createElement('div');
                    card.className = 'axie-card';
                    card.innerHTML = `
                        <img src="${axie.image}" alt="${axie.name}" onerror="this.src='https://axieinfinity.com/static/media/default-axie.png'">
                        <div class="axie-name">${axie.name}</div>
                        <div class="axie-stats">
                            <span>${axie.collection}</span>
                            <span>Flame: ${axie.currentFlame.toFixed(1)}</span>
                        </div>
                    `;
                    grid.appendChild(card);
                });
                plotContainer.appendChild(div);
            });

            // Render all axies
            const allGrid = document.getElementById('all-axies-grid');
            allGrid.innerHTML = '';
            axies.forEach(axie => {
                const card = document.createElement('div');
                card.className = 'axie-card';
                card.innerHTML = `
                    <img src="${axie.image}" alt="${axie.name}" onerror="this.src='https://axieinfinity.com/static/media/default-axie.png'">
                    <div class="axie-name">${axie.name}</div>
                    <div class="axie-stats">
                        <span>${axie.collection}</span>
                        <span>Flame: ${axie.currentFlame.toFixed(1)}</span>
                    </div>
                `;
                allGrid.appendChild(card);
            });

        } catch (err) {
            status.textContent = 'Error: ' + err.message;
            console.error(err);
        }
    });
}

document.addEventListener('DOMContentLoaded', render);