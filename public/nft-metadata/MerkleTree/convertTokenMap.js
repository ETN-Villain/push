import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Convert import.meta.url to __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputFile = path.join(__dirname, 'tokenCharacterMap.json'); // your current JSON
const outputFile = path.join(__dirname, 'tokenCharacterMap_map.json'); // new file

// Read the array of objects
const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

// Convert to key/value map
const map = {};
data.forEach(item => {
  if (!Number.isInteger(item.tokenId) || !Number.isInteger(item.characterId)) {
    throw new Error(`Invalid entry: ${JSON.stringify(item)}`);
  }
  map[item.tokenId] = item.characterId;
});

// Save the new JSON
fs.writeFileSync(outputFile, JSON.stringify(map, null, 2));

console.log(`Converted ${inputFile} → ${outputFile}`);
