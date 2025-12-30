// generateMerkle.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MerkleTree } from 'merkletreejs';
import { keccak256, solidityPacked } from 'ethers';

// Resolve __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load tokenCharacterMap.json (array of objects)
const inputFile = path.join(__dirname, 'tokenCharacterMap.json');
const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

// Create key/value map from array
const tokenCharacterMap = {};
data.forEach(item => {
  const tokenId = Number(item.tokenId);
  const charId = Number(item.characterId);
  if (!Number.isInteger(tokenId) || !Number.isInteger(charId)) {
    throw new Error(`Invalid entry: ${JSON.stringify(item)}`);
  }
  tokenCharacterMap[tokenId] = charId;
});

// Generate Merkle leaves
const leaves = Object.entries(tokenCharacterMap).map(([tokenId, charId]) =>
  keccak256(solidityPacked(["uint256","uint256"], [BigInt(tokenId), BigInt(charId)]))
);

// Build Merkle tree
const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
const MERKLE_ROOT = tree.getHexRoot();

// Write Merkle root to file as UTF-8 string
fs.writeFileSync(
  path.join(__dirname, 'MERKLE_ROOT.txt'),
  MERKLE_ROOT.toString(),
  { encoding: 'utf8' }
);

console.log("MERKLE_ROOT:", MERKLE_ROOT);
console.log("Merkle root saved to MERKLE_ROOT.txt");

// Generate proofs for each token
const proofs = {};
Object.entries(tokenCharacterMap).forEach(([tokenId, charId]) => {
  const leaf = keccak256(solidityPacked(["uint256","uint256"], [BigInt(tokenId), BigInt(charId)]));
  proofs[tokenId] = tree.getHexProof(leaf);
});

// Write proofs to JSON
fs.writeFileSync(
  path.join(__dirname, 'characterProofs.json'),
  JSON.stringify(proofs, null, 2),
  { encoding: 'utf8' }
);

console.log("Character proofs saved to characterProofs.json");
