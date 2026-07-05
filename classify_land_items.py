#!/usr/bin/env python3
"""Classify land items by environment (matching plot types)."""
import json, os, re

BOOST_BY_RARITY = {"Common": 0.05, "Rare": 0.10, "Epic": 0.75, "Mystic": 1.5}

# Environment classification based on item name patterns
ENV_KEYWORDS = {
    "savannah":   r"\b(desert|cactus|succulent|savannah|savanna|sand|thorn|aloe|sunset|palm|sun\d|s\d+[a-z])",
    "forest":     r"\b(forest|wood|leaf|tree|mushroom|flower|tulip|bonzai|grass|herb|vine|petal|potted|moss|log|bark|f\d+[a-z])",
    "arctic":     r"\b(arctic|ice\b|snow|frost|tundra|glacier|blizzard|icy\b|puff snow|frozen|a\d+[a-z])",
    "mystic":     r"\b(mystic|magic|crystal|arcane|spell|enchant|totem|lamp|gem|shard|statue|tribal|ruin|plushie|M\d+)",
    "genesis":    r"\b(genesis|origin|primordial|ancient|primitive|broken|fossil|relic|artifact)",
    "luna":       r"\b(luna|moon|lunacian|lunar|star|celestial|landing)",
}

def classify(name):
    name_lower = name.lower()
    for env, pattern in ENV_KEYWORDS.items():
        if re.search(pattern, name_lower):
            return env
    return "any"

# Load and classify
with open("land_items.json") as f:
    data = json.load(f)

for item in data["items"]:
    item["environment"] = classify(item["name"])
    item["boost"] = BOOST_BY_RARITY.get(item["rarity"], 0)

# Save updated JSON
with open("land_items.json", "w") as f:
    json.dump(data, f, indent=2)

# Rebuild land_data.js
minified = json.dumps(data, separators=(",", ":"))
with open("land_data.js", "w") as f:
    f.write(f"// Auto-generated — {len(data['items'])} land items with environment/boost\n")
    f.write(f"const LAND_ITEMS_DATA = {minified};\n")

# Stats
from collections import Counter
env_counts = Counter(i["environment"] for i in data["items"])
print("Land items by environment:")
env_order = ["savannah", "forest", "arctic", "mystic", "genesis", "luna", "any"]
for env in env_order:
    count = env_counts.get(env, 0)
    total_b = sum(i["boost"] for i in data["items"] if i["environment"] == env)
    print(f"  {env:15s}: {count:3d} items, {total_b:6.2f}% boost")

print(f"\nTotal: {len(data['items'])} items")
print(f"land_data.js: {os.path.getsize('land_data.js')/1024:.0f} KB")