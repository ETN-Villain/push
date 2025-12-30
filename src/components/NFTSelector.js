import React, { useState, useEffect } from "react";
import { IPFS_BASE, RARE_BACKGROUNDS } from "../config.js";

/**
 * NFTSelector Component
 * Allows the player to select 3 NFTs for a game.
 * Shows previews after selection.
 */
export default function NFTSelector({ onChange, initialSelection = [] }) {
  const [selectedNFTs, setSelectedNFTs] = useState(initialSelection);
  const [metadata, setMetadata] = useState([]);

  // Fetch metadata for each selected NFT URI
  useEffect(() => {
    const fetchMetadata = async () => {
      const data = await Promise.all(
        selectedNFTs.map(async (uri) => {
          if (!uri) return null;
          try {
            const url = uri.replace("ipfs://", IPFS_BASE);
            const res = await fetch(url);
            const json = await res.json();
            return json;
          } catch (err) {
            console.error("Failed to fetch metadata:", uri, err.message);
            return null;
          }
        })
      );
      setMetadata(data);
    };

    fetchMetadata();
  }, [selectedNFTs]);

  const handleChange = (idx, value) => {
    const newSelection = [...selectedNFTs];
    newSelection[idx] = value;
    setSelectedNFTs(newSelection);
    onChange(newSelection);
  };

  // Check for duplicate rare backgrounds
  const validateRarities = () => {
    const seen = {};
    for (let nft of metadata) {
      if (!nft) continue;
      const bg = nft.background;
      if (RARE_BACKGROUNDS.includes(bg)) {
        if (seen[bg]) return false;
        seen[bg] = true;
      }
    }
    return true;
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <h4>Select 3 NFTs</h4>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ marginBottom: 5 }}>
          <input
            type="text"
            placeholder={`NFT URI ${i + 1}`}
            value={selectedNFTs[i] || ""}
            onChange={(e) => handleChange(i, e.target.value)}
            style={{ width: "80%" }}
          />
          {metadata[i] && (
            <img
              src={metadata[i].image.replace("ipfs://", IPFS_BASE)}
              alt={`NFT ${i + 1}`}
              width={80}
              style={{ marginLeft: 10 }}
            />
          )}
        </div>
      ))}
      {!validateRarities() && (
        <p style={{ color: "red" }}>
          You can only have one of each rare background.
        </p>
      )}
    </div>
  );
}
