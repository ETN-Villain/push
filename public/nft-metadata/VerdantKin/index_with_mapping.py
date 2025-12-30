import json
import sqlite3
import csv
from pathlib import Path

# Config: Your exact paths
METADATA_DIR = Path(r'C:\Users\Butle_jz8osua\ipfs-metadata-dapp\public\nft-metadata\VerdantKin\VKINjson')  # JSON files
MINT_CSV = Path(r'C:\Users\Butle_jz8osua\ipfs-metadata-dapp\nft-mapper\mapping.csv')  # Your CSV (tokenId,metadataFile)
DB_PATH = Path('verdantkin_metadata.db')  # Output DB (in current folder)

# Connect to DB
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# Create tables (mint_mapping now 2 cols: token_id, filename)
c.execute('''CREATE TABLE IF NOT EXISTS nfts
             (token_id INTEGER PRIMARY KEY, filename TEXT, name TEXT, description TEXT, 
              collection TEXT, image TEXT, fee_recipient TEXT, seller_fee_basis_points INTEGER,
              attack INTEGER, defense INTEGER, vitality INTEGER, 
              agility INTEGER, core INTEGER, background TEXT, 
              token_uri TEXT)''')
c.execute('''CREATE TABLE IF NOT EXISTS mint_mapping
             (token_id INTEGER PRIMARY KEY, filename TEXT)''')  # Simplified: No tx_hash
conn.commit()

# Load mint mapping from your CSV (tokenId, metadataFile)
mapping = {}
if MINT_CSV.exists():
    with open(MINT_CSV, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            token_id = int(row['tokenId'])  # Assumes header 'tokenId'
            filename = row['metadataFile'].strip()  # Assumes header 'metadataFile'
            mapping[token_id] = filename
            c.execute('INSERT OR REPLACE INTO mint_mapping VALUES (?, ?)', (token_id, filename))
    print(f"Loaded {len(mapping)} mappings from {MINT_CSV}")
    print(f"Example: Token #1 maps to {mapping.get(1, 'N/A')}")
else:
    print(f"Error: {MINT_CSV} not found—check path and CSV format (headers: tokenId,metadataFile)")
    exit(1)

def parse_and_insert(token_id, file_path):
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
        
        # Top-level fields
        name = data.get('name', 'Unknown')
        description = data.get('description', '')
        collection = data.get('collection', 'The Verdant Kin')
        image = data.get('image', '')
        fee_recipient = data.get('fee_recipient', '')
        seller_fee_basis_points = int(data.get('seller_fee_basis_points', 1000))
        token_uri = data.get('tokenURI', '') or str(file_path)
        
        # Traits (lowercase keys)
        attrs = {}
        for attr in data.get('attributes', []):
            key = attr['trait_type'].lower()
            value = attr.get('value', 'Unknown')
            if isinstance(value, str) and value.isdigit():
                value = int(value)
            attrs[key] = value
        
        background = str(attrs.get('background', 'Common'))
        c.execute('''INSERT OR REPLACE INTO nfts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                  (token_id, str(file_path.name), name, description, collection, image, fee_recipient, seller_fee_basis_points,
                   int(attrs.get('attack', 0)), int(attrs.get('defense', 0)), int(attrs.get('vitality', 0)),
                   int(attrs.get('agility', 0)), int(attrs.get('core', 0)), background, token_uri))
        conn.commit()
        print(f"Inserted #{token_id} ({file_path.name}): {name} (Background: {background})")
    except Exception as e:
        print(f"Error processing {file_path.name} for #{token_id}: {e}")

# Index: Use mapping to load correct file for each tokenId
print("Indexing mapped files...")
for token_id, filename in mapping.items():
    file_path = METADATA_DIR / filename
    if file_path.exists():
        parse_and_insert(token_id, file_path)
    else:
        print(f"Warning: File {filename} not found for #{token_id} in {METADATA_DIR}")

# Fallback: Index unmatched files (filename as tokenId)
print("Indexing unmatched files...")
unmatched_files = [fp for fp in METADATA_DIR.glob('*.json') if int(fp.stem) not in mapping]
for file_path in unmatched_files:
    token_id = int(file_path.stem)
    parse_and_insert(token_id, file_path)

# Summary
c.execute('SELECT background, COUNT(*) FROM nfts GROUP BY background')
print("\nRarity Summary:")
for bg, count in c.fetchall():
    print(f"  {bg}: {count}")

conn.close()
print(f"Done! Indexed into {DB_PATH}. Total NFTs: {len(mapping) + len(unmatched_files)}")
print("Query with: python query_all.py 1  # For real tokenId 1 (maps to correct JSON)")