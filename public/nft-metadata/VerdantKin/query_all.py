import sqlite3
import sys

conn = sqlite3.connect('verdantkin_metadata.db')
c = conn.cursor()

if len(sys.argv) > 1 and sys.argv[1].isdigit():
    # Specific token: Dump ALL columns
    token = int(sys.argv[1])
    c.execute('SELECT * FROM nfts WHERE token_id = ?', (token,))
    row = c.fetchone()
    if row:
        print(f"\nFull Data for #{row[0]} ({row[1]}):")
        print(f"  Name: {row[1]}")
        print(f"  Description: {row[2]}")
        print(f"  Collection: {row[3]}")
        print(f"  Image: {row[4]}")
        print(f"  Fee Recipient: {row[5]}")
        print(f"  Seller Fee BP: {row[6]}")
        print(f"  Attack: {row[7]}")
        print(f"  Defense: {row[8]}")
        print(f"  Vitality: {row[9]}")
        print(f"  Agility: {row[10]}")
        print(f"  Core: {row[11]}")
        print(f"  Background: {row[12]}")
        print(f"  Token URI: {row[13]}")
    else:
        print(f"No data for #{token}")
else:
    # Summary: First 10 NFTs with ALL key attributes
    c.execute('SELECT token_id, name, attack, defense, vitality, agility, core, background FROM nfts ORDER BY token_id LIMIT 10')
    print("\nFirst 10 NFTs (ID | Name | Attack | Def | Vit | Agi | Core | Background):")
    for row in c.fetchall():
        print(f"  {row[0]} | {row[1]} | {row[2]} | {row[3]} | {row[4]} | {row[5]} | {row[6]} | {row[7]}")

# Full stats summary
c.execute('SELECT COUNT(*) as total, AVG(attack), AVG(defense), AVG(vitality), AVG(agility), AVG(core) FROM nfts')
stats = c.fetchone()
print(f"\nOverall Stats: Total NFTs={stats[0]}, Avg Attack={stats[1]:.1f}, Def={stats[2]:.1f}, Vit={stats[3]:.1f}, Agi={stats[4]:.1f}, Core={stats[5]:.1f}")

# Rarity breakdown
c.execute('SELECT background, COUNT(*) FROM nfts GROUP BY background ORDER BY COUNT(*) DESC')
print("\nRarity Breakdown:")
for bg, count in c.fetchall():
    print(f"  {bg}: {count}")

conn.close()