import sqlite3
import json

# Connect to the database
conn = sqlite3.connect('verdantkin_metadata.db')
cursor = conn.cursor()

# Table name is 'nfts' based on the DB generation code
table_name = 'nfts'

# Query to get unique combinations of character (name) and background, with attributes
# We use ROW_NUMBER() to pick one token per unique name+background (e.g., the first/lowest token_id)
query = """
SELECT name, background, attack, defense, vitality, agility, core
FROM (
    SELECT name, background, attack, defense, vitality, agility, core, token_id,
           ROW_NUMBER() OVER (PARTITION BY name, background ORDER BY token_id ASC) as rn
    FROM {}
) ranked
WHERE rn = 1
ORDER BY name, background
""".format(table_name)

cursor.execute(query)
rows = cursor.fetchall()

# Structure the data
unique_cards = []
for row in rows:
    unique_cards.append({
        "character": row[0],  # 'name' as character
        "background": row[1],
        "attack": row[2],
        "defense": row[3],
        "vitality": row[4],
        "agility": row[5],
        "core": row[6]
    })

# Output as JSON for easy use
output_json = json.dumps(unique_cards, indent=2)
print(output_json)

# Also save to file for convenience
with open('unique_cards.json', 'w') as f:
    f.write(output_json)

# Summary stats
print(f"\nExtracted {len(unique_cards)} unique character+background combos.")
cursor.execute("SELECT COUNT(DISTINCT name) FROM nfts")
total_characters = cursor.fetchone()[0]
print(f"Total unique characters (names): {total_characters}")

conn.close()