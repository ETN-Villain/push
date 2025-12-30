import sqlite3
import json

# ===== CONFIG =====
DB_PATH = r"C:\Users\Butle_jz8osua\ipfs-metadata-dapp\public\nft-metadata\VerdantKin\verdantkin_metadata.db"
OUTPUT_FILE = "tokenCharacterMap.json"

# Character mapping: must match contract IDs
CHARACTER_IDS = {
    "Aurelia": 0,
    "Kaelth": 1,
    "Lumora": 2,
    "Sylor": 3,
    "Verdant Core": 4,
    "Veyra": 5,
}

# ==================

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Read token_id and name from the nfts table
    cursor.execute("SELECT token_id, name FROM nfts")
    rows = cursor.fetchall()

    mapping = []

    for token_id, name in rows:
        # Extract character name from the 'name' field
        # e.g., "Kaelth #312" -> "Kaelth"
        character_name = name.split(" #")[0].strip()

        if character_name not in CHARACTER_IDS:
            raise ValueError(f"Unknown character '{character_name}' in token {token_id}")

        character_id = CHARACTER_IDS[character_name]

        mapping.append({
            "tokenId": token_id,
            "characterId": character_id
        })

    # Sort mapping by tokenId (optional but clean)
    mapping.sort(key=lambda x: x["tokenId"])

    # Write JSON
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(mapping, f, indent=2)

    print(f"✅ Generated {OUTPUT_FILE} with {len(mapping)} entries")

    # Optional: print character distribution
    counts = {}
    for m in mapping:
        cid = m["characterId"]
        counts[cid] = counts.get(cid, 0) + 1

    print("Character distribution:")
    for name, cid in CHARACTER_IDS.items():
        print(f"  {name}: {counts.get(cid,0)}")

    conn.close()

if __name__ == "__main__":
    main()
