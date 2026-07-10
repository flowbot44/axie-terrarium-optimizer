import json
import os
import subprocess
import time
def load_dotenv():
    with open('.env') as f:
        for line in f:
            if line.startswith('SKYMAVIS_API_KEY='):
                os.environ['SKYMAVIS_API_KEY'] = line.strip().split('=')[1]

load_dotenv()

API_KEY = os.getenv("SKYMAVIS_API_KEY")
if not API_KEY:
    print("Error: SKYMAVIS_API_KEY not found in .env")
    exit(1)

RONIN = "0xdf8b35668c8fcf82b1d1707875c98cd05b6927c4"
URL = "https://graphql-gateway.axieinfinity.com/graphql"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
PAGE_SIZE = 50

def fetch_page(query, variables):
    payload = json.dumps({"query": query, "variables": variables})
    cmd = [
        "curl", "-s",
        "-H", "Content-Type: application/json",
        "-H", f"User-Agent: {UA}",
        "-H", f"X-API-Key: {API_KEY}",
        "-d", payload,
        URL
    ]
    for attempt in range(3):
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode == 0:
                return json.loads(result.stdout)
            print(f"curl error (attempt {attempt+1}): {result.stderr[:200]}")
        except Exception as e:
            print(f"Error (attempt {attempt+1}): {e}")
        time.sleep(2)
    return None

def fetch_all(query, data_key, fields_callback=None, page_size=PAGE_SIZE, extra_vars=None):
    all_results = []
    total = None
    offset = 0
    while total is None or offset < total:
        print(f"  Fetching {data_key} offset={offset}...", end=" ", flush=True)
        vars = {"owner": RONIN, "from": offset, "size": page_size}
        if extra_vars:
            vars.update(extra_vars)
        result = fetch_page(query, vars)
        if result is None or "errors" in result:
            print(f"FAILED: {result.get('errors', 'Unknown error')}")
            break
        data = result.get("data", {}).get(data_key, {})
        if total is None:
            total = data.get("total", 0)
            print(f"Total: {total}", end=" ", flush=True)
        page = data.get("results", [])
        if fields_callback:
            page = fields_callback(page)
        all_results.extend(page)
        print(f"got {len(page)}", flush=True)
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        time.sleep(0.5)
    return all_results

AXIE_QUERY = """query GetAxies($owner: String, $from: Int, $size: Int, $sort: SortBy) {
  axies(owner: $owner, from: $from, size: $size, sort: $sort) {
    total
    results {
      id name stage class breedCount image title
      parts { id name class type specialGenes }
    }
  }
}"""

ITEMS_QUERY = """query GetItems($owner: String, $from: Int, $size: Int) {
  items(owner: $owner, from: $from, size: $size) {
    total
    results { name rarity itemId itemAlias }
  }
}"""

EQUIPMENTS_QUERY = """query GetEquipments($owner: String, $from: Int, $size: Int) {
  equipments(owner: $owner, from: $from, size: $size) {
    total
    results { name alias rarity }
  }
}"""

def classify_item(item):
    # Parse itemAlias to environment
    alias = item.get("itemAlias", "")
    env = "any"
    if alias.startswith("s"): env = "savannah"
    elif alias.startswith("f"): env = "forest"
    elif alias.startswith("a"): env = "arctic"
    elif alias.startswith("M") or alias.startswith("m"): env = "mystic"
    elif alias.startswith("g"): env = "genesis"
    elif alias.startswith("l"): env = "luna"
    
    # Calculate boost from rarity
    boost = 0
    rarity = item.get("rarity", "")
    if rarity == "Common": boost = 0.05
    elif rarity == "Rare": boost = 0.10
    elif rarity == "Epic": boost = 0.75
    elif rarity == "Mystic": boost = 1.5
    
    item["environment"] = env
    item["boost"] = boost
    return item

def process_items(page):
    return [classify_item(item) for item in page]

def count_evolved_parts(axie):
    count = sum(1 for p in axie.get("parts", []) if p.get("id", "").endswith("-2"))
    axie["evolvedParts"] = count
    return axie

def process_axies(page):
    return [count_evolved_parts(a) for a in page]

print("=== Fetching User Data ===")
print("Fetching Axies...")
axies = fetch_all(AXIE_QUERY, "axies", process_axies, extra_vars={"sort": "IdAsc"})

print("\nFetching Land Items...")
items = fetch_all(ITEMS_QUERY, "items", process_items)

print("\nFetching Accessories (Equipments)...")
accessories = fetch_all(EQUIPMENTS_QUERY, "equipments", page_size=32)

user_data = {
    "owner": RONIN,
    "axies": axies,
    "items": items,
    "accessories": accessories,
    "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
}

# Save as JS file for the frontend to consume
js_content = f"const USER_DATA = {json.dumps(user_data, separators=(',', ':'))};\n"
with open("user_data.js", "w") as f:
    f.write(js_content)

print(f"\nSaved {len(axies)} Axies, {len(items)} Items, {len(accessories)} Accessories to user_data.js")
