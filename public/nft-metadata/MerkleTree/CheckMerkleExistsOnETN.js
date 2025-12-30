import fs from "fs";
import { ethers } from "ethers";

// 1️⃣ Connect to ETN RPC
const provider = new ethers.JsonRpcProvider("https://rpc.ankr.com/electroneum");

// 2️⃣ Load ABI
const abiPath = "C:/Users/Butle_jz8osua/ipfs-metadata-dapp/public/nft-metadata/MerkleTree/CCTestGame.json";
const abiJson = JSON.parse(fs.readFileSync(abiPath, "utf8"));
const abi = abiJson; // your ABI is already an array

// 3️⃣ Contract address
const contractAddress = "0x146D37404864c233cF9892AaA6802D1e83d8B583";
const gameContract = new ethers.Contract(contractAddress, abi, provider);

// 4️⃣ Read characterMerkleRoot
async function getMerkleRoot() {
  try {
    const root = await gameContract.characterMerkleRoot();
    console.log("On-chain characterMerkleRoot:", root);
  } catch (err) {
    console.error("Error reading Merkle root:", err);
  }
}

getMerkleRoot();
