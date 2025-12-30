import { ethers } from "ethers";
import fs from "fs";

const revealFile = "./player2_reveal.json"; 
const json = JSON.parse(fs.readFileSync(revealFile, "utf8"));

const salt = BigInt(json.salt);
const nftContracts = json.nftContracts.map(a => a.toLowerCase());
const tokenIds = json.tokenIds.map(t => BigInt(t));

function computeCommit(salt, nftContracts, tokenIds) {
  return ethers.keccak256(
    ethers.solidityPacked(
      ["uint256","address","address","address","uint256","uint256","uint256"],
      [
        salt,
        nftContracts[0],
        nftContracts[1],
        nftContracts[2],
        tokenIds[0],
        tokenIds[1],
        tokenIds[2]
      ]
    )
  );
}

const commit = computeCommit(salt, nftContracts, tokenIds);
console.log("Computed commit:", commit);

const traceCommit = "0x6ed619c6df965b4f4bf267a6159babc36f6082e7827e5d38c8946c7e38d302d0";
console.log("Matches trace?", commit.toLowerCase() === traceCommit.toLowerCase());
