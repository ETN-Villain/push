import React, { useState } from "react";
import { ethers } from "ethers";
import axios from "axios";
import GameABI from "../src/abis/GameABI.json";
import ERC20ABI from "../src/abis/ERC20ABI.json";
import { GAME_ADDRESS, IPFS_BASE } from "../config.js";

const BACKEND_URL = "http://localhost:3001";

export default function JoinGame({ game, provider, signer, account, onJoined }) {
  const [stakeApproved, setStakeApproved] = useState(false);
  const [nfts, setNfts] = useState([
    { address: "", tokenId: "" },
    { address: "", tokenId: "" },
    { address: "", tokenId: "" }
  ]);
  const [loading, setLoading] = useState(false);
  const [validated, setValidated] = useState(false);
  const [teamPreview, setTeamPreview] = useState([]);

  /* ---------------- HELPERS ---------------- */

  const updateNFT = (idx, field, value) => {
    const copy = [...nfts];
    copy[idx][field] = value;
    setNfts(copy);
    setValidated(false);
  };

  const makeCommit = (salt, ids) => {
    return ethers.keccak256(
      ethers.solidityPacked(
        ["uint256", "uint256", "uint256", "uint256"],
        [salt, ids[0], ids[1], ids[2]]
      )
    );
  };

  /* ---------------- VALIDATE TEAM ---------------- */

  const validateTeam = async () => {
    try {
      setLoading(true);

      const tokenURIs = nfts.map(
        (n) => `${IPFS_BASE}${n.tokenId}.json`
      );

      const res = await axios.post(`${BACKEND_URL}/validate-team`, {
        tokenURIs
      });

      setTeamPreview(res.data.preview);
      setValidated(true);
    } catch (err) {
      alert(err.response?.data?.error || "Validation failed");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- ERC20 APPROVAL ---------------- */

  const approveStake = async () => {
    try {
      setLoading(true);

      const erc20 = new ethers.Contract(
        game.stakeToken,
        ERC20ABI,
        signer
      );

      const tx = await erc20.approve(
        GAME_ADDRESS,
        game.stakeAmount
      );
      await tx.wait();

      setStakeApproved(true);
    } catch (err) {
      alert("Approval failed");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- JOIN + SETTLE ---------------- */

  const joinAndSettle = async () => {
    if (!validated) {
      alert("Validate your team first");
      return;
    }

    try {
      setLoading(true);

      const nftIds = nfts.map((n) => Number(n.tokenId));
      const salt = BigInt(ethers.randomBytes(32));
      const commit = makeCommit(salt, nftIds);

      const gameContract = new ethers.Contract(
        GAME_ADDRESS,
        GameABI,
        signer
      );

      // JOIN GAME
      const joinTx = await gameContract.joinGame(
        game.id,
        commit
      );
      await joinTx.wait();

      // SAVE SALT LOCALLY (for proof/debug)
      localStorage.setItem(
        `p2_salt_${game.id}`,
        salt.toString()
      );

      // SETTLE GAME (player 2 triggers)
      const settleTx = await gameContract.settleGame(game.id);
      await settleTx.wait();

      onJoined();
    } catch (err) {
      console.error(err);
      alert("Join or settle failed");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- UI ---------------- */

  return (
    <div style={{ marginTop: 10 }}>
      <h4>Join Game</h4>

      {nfts.map((n, i) => (
        <div key={i} style={{ marginBottom: 5 }}>
          <input
            placeholder="NFT Address"
            value={n.address}
            onChange={(e) =>
              updateNFT(i, "address", e.target.value)
            }
            style={{ width: "45%", marginRight: 5 }}
          />
          <input
            placeholder="Token ID"
            value={n.tokenId}
            onChange={(e) =>
              updateNFT(i, "tokenId", e.target.value)
            }
            style={{ width: "45%" }}
          />
        </div>
      ))}

      {!validated && (
        <button onClick={validateTeam} disabled={loading}>
          Validate Team
        </button>
      )}

      {validated && teamPreview.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          {teamPreview.map((img, i) => (
            <img key={i} src={img} width={100} alt="NFT" />
          ))}
        </div>
      )}

      {!stakeApproved && (
        <button onClick={approveStake} disabled={loading}>
          Approve Stake
        </button>
      )}

      {stakeApproved && (
        <button onClick={joinAndSettle} disabled={loading}>
          Join & Settle
        </button>
      )}
    </div>
  );
}
