// Build Merkle tree
const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
const MERKLE_ROOT = tree.getHexRoot();

// Ensure it’s a string and write
fs.writeFileSync(
  path.join(__dirname, 'MERKLE_ROOT.txt'),
  MERKLE_ROOT.toString(),   // <-- force string
  { encoding: 'utf8' }      // <-- ensure utf8
);

console.log("MERKLE_ROOT:", MERKLE_ROOT);
console.log("Merkle root saved to MERKLE_ROOT.txt");
