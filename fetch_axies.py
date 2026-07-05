#!/usr/bin/env python3
"""Fetch all Axies for a Ronin address using curl (terminal, no CORS issues)."""
import json
import os
import subprocess
import sys
import time

RONIN = "0xdf8b35668c8fcf82b1d1707875c98cd05b6927c4"
PAGE_SIZE = 50
OUTPUT = "axies_data.json"

QUERY = """query GetAxieBriefList($owner: String, $from: Int, $size: Int) {
  axies(owner: $owner, from: $from, size: $size) {
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
}"""

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

def fetch_page(owner, from_idx, size):
    variables = {"owner": owner, "from": from_idx, "size": size}
    payload = json.dumps({"query": QUERY, "variables": variables})

    cmd = [
        "curl", "-s",
        "-H", "Content-Type: application/json",
        "-H", f"User-Agent: {UA}",
        "-d", payload,
        "https://graphql-gateway.axieinfinity.com/graphql"
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            print(f"  curl error: {result.stderr[:200]}")
            return None
        return json.loads(result.stdout)
    except subprocess.TimeoutExpired:
        print("  timeout")
        return None
    except json.JSONDecodeError as e:
        print(f"  JSON parse error: {e}")
        return None

def main():
    print(f"Fetching Axies for {RONIN}...", flush=True)
    all_results = []
    total = None
    offset = 0

    while total is None or offset < total:
        print(f"  offset={offset}...", end=" ", flush=True)
        result = fetch_page(RONIN, offset, PAGE_SIZE)
        if result is None:
            print("FAILED, retry in 3s...", flush=True)
            time.sleep(3)
            result = fetch_page(RONIN, offset, PAGE_SIZE)
            if result is None:
                print("FAILED again, stopping", flush=True)
                break

        if "errors" in result:
            print(f"GraphQL errors: {result['errors']}", flush=True)
            break

        data = result.get("data", {}).get("axies", {})
        if total is None:
            total = data.get("total", 0)
            print(f"Total: {total}", flush=True)

        page = data.get("results", [])
        all_results.extend(page)
        print(f"got {len(page)} (total: {len(all_results)})", flush=True)

        if len(page) < PAGE_SIZE:
            break

        offset += PAGE_SIZE
        time.sleep(0.5)

    print(f"\nFetched {len(all_results)} / {total} Axies", flush=True)

    output = {
        "owner": RONIN,
        "total": total,
        "fetched": len(all_results),
        "axies": all_results,
        "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    with open(OUTPUT, "w") as f:
        json.dump(output, f, indent=2)
    size_kb = os.path.getsize(OUTPUT) / 1024
    print(f"Saved to {OUTPUT} ({size_kb:.0f} KB)", flush=True)
    return len(all_results) == total if total else False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)