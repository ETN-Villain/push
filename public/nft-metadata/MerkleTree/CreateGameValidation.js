import { ethers } from "ethers";
import characterProofs from "./characterProofs.json" assert { type: "json" };
/**
 * Validate game input before calling createGame
 * @param {Array} tokenIds - [token1, token2, token3]
 * @param {Array} characterIds - [char1, char2, char3]
 * @param {Array} traits - uint256[5][3], i.e., 3 chars × 5 stats each
 * @param {Array} backgrounds - string[3]
 */
function validateGameInput(tokenIds, characterIds, traits, backgrounds) {
  if (tokenIds.length !== 3 || characterIds.length !== 3 || traits.length !== 3 || backgrounds.length !== 3) {
    throw new Error("Each array must have exactly 3 elements (one per character).");
  }

  // Check traits: 5 numbers per character, integers 0-100
  for (let i = 0; i < 3; i++) {
    if (!Array.isArray(traits[i]) || traits[i].length !== 5) {
      throw new Error(`traits[${i}] must be an array of 5 numbers.`);
    }
    traits[i] = traits[i].map(n => {
      const num = Number(n);
      if (!Number.isInteger(num) || num < 0 || num > 100) {
        throw new Error(`Invalid trait value: ${n} in traits[${i}]. Must be integer 0-100.`);
      }
      return BigInt(num); // ensure uint256
    });
  }

  // Check tokenIds and characterIds against proofs
  for (let i = 0; i < 3; i++) {
    const tokenId = Number(tokenIds[i]);
    const charId = Number(characterIds[i]);
    if (!characterProofs[tokenId]) {
      throw new Error(`Missing proof for tokenId ${tokenId}`);
    }
    if (!Number.isInteger(charId)) {
      throw new Error(`Invalid characterId ${charId} for token ${tokenId}`);
    }
  }

  // Check for duplicate tokenIds or characterIds
  if (new Set(tokenIds).size !== 3) {
    throw new Error("Duplicate tokenIds detected in team.");
  }
  if (new Set(characterIds).size !== 3) {
    throw new Error("Duplicate characterIds detected in team.");
  }

  // Check backgrounds are strings
  backgrounds.forEach((bg, i) => {
    if (typeof bg !== "string") throw new Error(`backgrounds[${i}] must be a string`);
  });

  console.log("Validation passed ✅");
  return true;
}

// Example usage:
try {
  validateGameInput(
    [59, 359, 468],           // tokenIds
    [5, 0, 3],                 // characterIds
    [ [23,45,67,12,89], [12,34,56,78,90], [1,2,3,4,5] ],  // traits
    ["red","blue","green"]     // backgrounds
  );
} catch (err) {
  console.error(err.message);
}
