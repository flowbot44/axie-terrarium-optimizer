#!/usr/bin/env python3
"""Classify land items by environment type and add boost values."""
import json, os, re

BOOST_BY_RARITY = {"Common": 0.05, "Rare": 0.10, "Epic": 0.75, "Mystic": 1.5}

# Known plot environment types from the game
ENVIRONMENTS = {
    "arctic":    r"\b(arctic|ice\b|snow|frost|tundra|glacier|blizzard|icy\b|puff snow)",
    "forest":    r"\b(forest|wood|leaf|tree|mushroom|flower|tulip|bonzai|grass|herb|vine|petal|potted)",
    "savannah":  r"\b(desert|cactus|succulent|savannah|sand|thorn|aloe|sunset)",
    "mystic":    r"\b(mystic|magic|crystal|arcane|spell|enchant|totem|lamp|gem|shard|statue of|tribal)",
    "genesis":   r"\b(genesis|origin|primordial|ancient|primitive|ruin|broken|fossil)",
    "luna":      r"\b(luna|moon|lunacian|lunar|star|celestial)",
}

def classify(name):
    name_lower = name.lower()
    for env, pattern in ENVIRONMENTS.items():
        if re.search(pattern, name_lower):
            return env
    # Secondary: check for common non-specific items
    if any(kw in name_lower for kw in ["propeller", "vase", "yarn", "pouch", "doll",
                                         "spear", "jug", "barrel", "stone", "pillar",
                                         "lavender", "lamp", "plushie", "paper",
                                         "bullseye", "arrow", "box", "chest",
                                         "jack", "candle", "banner", "shield"]):
        return "decor"
    return "any"

# Load and classify
with open("land_items.json") as f:
    data = json.load(f)

types = {}
for item in data["items"]:
    item["type"] = classify(item["name"])
    item["boost"] = BOOST_BY_RARITY.get(item["rarity"], 0)
    t = item["type"]
    if t not in types: types[t] = {"count": 0, "total_boost": 0}
    types[t]["count"] += 1
    types[t]["total_boost"] += item["boost"]

# Save
with open("land_items.json", "w") as f:
    json.dump(data, f, indent=2)

# Rebuild land_data.js
minified = json.dumps(data, separators=(",", ":"))
with open("land_data.js", "w") as f:
    f.write(f"// Auto-generated — {len(data['items'])} land items with types/boosts\n")
    f.write(f"const LAND_ITEMS_DATA = {minified};\n")

from collections import Counter
type_counts = Counter(i["type"] for i in data["items"])
print("Land item type distribution:")
for t, c in type_counts.most_common():
    total_b = sum(i["boost"] for i in data["items"] if i["type"] == t)
    print(f"  {t:15s}: {c:3d} items, {total_b:6.2f}% total boost")

print(f"\nTotal: {len(data['items'])} items")
print(f"land_data.js: {os.path.getsize('land_data.js')/1024:.0f} KB")