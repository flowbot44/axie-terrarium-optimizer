#!/usr/bin/env python3
"""Fetch land items for a Ronin address and re-detect evolved parts."""
import json
import os
import subprocess
import sys
import time

RONIN = "0xdf8b35668c8fcf82b1d1707875c98cd05b6927c4"
PAGE_SIZE = 100
OUTPUT = "land_items.json"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

def fetch_page(query, variables, max_retries=2):
    payload = json.dumps({"query": query, "variables": variables})
    for attempt in range(max_retries + 1):
        try:
            result = subprocess.run(
                ["curl", "-s", "-H", "Content-Type: application/json",
                 "-H", f"User-Agent: {UA}", "-d", payload,
                 "https://graphql-gateway.axieinfinity.com/graphql"],
                capture_output=True, text=True, timeout=30
            )
            if result.returncode != 0:
                print(f"  curl error (attempt {attempt+1}): {result.stderr[:100]}")
                time.sleep(2)
                continue
            return json.loads(result.stdout)
        except Exception as e:
            print(f"  Error (attempt {attempt+1}): {e}")
            time.sleep(2)
    return None

def fetch_land_items():
    QUERY = """query GetItems($owner: String, $from: Int, $size: Int) {
      items(owner: $owner, from: $from, size: $size) {
        total results { name rarity tokenId itemId }
      }
    }"""
    all_results = []
    total = None
    offset = 0
    while total is None or offset < total:
        print(f"  Land items offset={offset}...", end=" ", flush=True)
        result = fetch_page(QUERY, {"owner": RONIN, "from": offset, "size": PAGE_SIZE})
        if result is None or "errors" in (result or {}):
            print(f"FAILED: {result.get('errors', 'no response')[:100] if result else 'no response'}")
            break
        data = result.get("data", {}).get("items", {})
        if total is None:
            total = data.get("total", 0)
            print(f"Total: {total}", end=" ", flush=True)
        page = data.get("results", [])
        all_results.extend(page)
        print(f"got {len(page)}", flush=True)
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        time.sleep(0.3)
    print(f"\n  Fetched {len(all_results)} / {total} land items")
    return {"owner": RONIN, "total": total, "items": all_results,
            "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}

def re_detect_evolved_axies(axie_data):
    """Detect evolved parts from -2 suffix in part IDs."""
    evo_stats = {0:0,1:0,2:0,3:0,4:0,5:0,6:0}
    for axie in axie_data["axies"]:
        evo_count = sum(1 for p in axie["parts"] if p["id"].endswith("-2"))
        evo_stats[evo_count] = evo_stats.get(evo_count, 0) + 1
    print(f"  Evolved parts distribution: {dict(sorted(evo_stats.items()))}")
    return axie_data

def main():
    # Fetch land items
    print("=== Fetching Land Items ===")
    land_data = fetch_land_items()
    with open(OUTPUT, "w") as f:
        json.dump(land_data, f, indent=2)
    size_kb = os.path.getsize(OUTPUT) / 1024
    print(f"  Saved to {OUTPUT} ({size_kb:.0f} KB)")

    # Re-process axies for evolved parts
    print("\n=== Checking Axies Evolved Parts ===")
    with open("axies_data.json") as f:
        axie_data = json.load(f)
    re_detect_evolved_axies(axie_data)

    # Summary
    print(f"\n=== Summary ===")
    print(f"  Land Items: {land_data['total']}")
    print(f"  Axies: {axie_data['total']}")
    print("  Done!")

if __name__ == "__main__":
    main()