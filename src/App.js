import React, { useEffect, useState, useCallback } from "react";
import { ethers } from "ethers";

import GameABI from "./abis/GameABI.json";
import ERC20ABI from "./abis/ERC20ABI.json";

import { GAME_ADDRESS } from "./config.js";
import { debugForLocalStorage } from "./debugLocalStorage.js";

const BACKEND_URL = "http://localhost:3001";

export default function App() {
  /* ---------------- WALLET ---------------- */
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);

  useEffect(() => {
    if (!window.ethereum) return;

    const init = async () => {
    const prov = new ethers.BrowserProvider(window.ethereum);
    const signer = await prov.getSigner();
      setProvider(prov);
    const addr = await signer.getAddress();
      setSigner(signer);
      setAccount(addr);
    };

    init();
  }, []);

  /* ---------------- FORM STATE ---------------- */
  const [stakeToken, setStakeToken] = useState("");
  const [stakeAmount, setStakeAmount] = useState("");

  const [nfts, setNfts] = useState([
    { address: "", tokenId: "", metadata: null },
    { address: "", tokenId: "", metadata: null },
    { address: "", tokenId: "", metadata: null }
  ]);

  const [validated, setValidated] = useState(false);
  const [validating, setValidating] = useState(false);

  /* ---------------- GAMES ---------------- */
  const [games, setGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(false);

  /* ---------------- HELPERS ---------------- */
  const updateNFT = (idx, field, value) => {
    const copy = [...nfts];
    copy[idx][field] = value;
    if (field !== "metadata") copy[idx].metadata = null;
    setNfts(copy);
    setValidated(false);
  };

  async function userOwnsNFT(nftAddress, tokenId) {
  if (!provider || !account) return false;

  try {
    const nftContracts = new ethers.Contract(
      nftAddress,
      ["function ownerOf(uint256 tokenId) view returns (address)"],
      provider
    );

    const owner = await nftContracts.ownerOf(tokenId);
    return owner.toLowerCase() === account.toLowerCase();
  } catch (err) {
    console.error("Ownership check failed:", err);
    return false;
  }
}

function downloadRevealBackup(data) {
  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `coreclash-reveal-game-${data.gameId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------------- LOAD GAMES ---------------- */
const loadGames = useCallback(async () => {
  if (!provider) return; // don't filter by account here

  setLoadingGames(true);
  try {
    const gameContract = new ethers.Contract(GAME_ADDRESS, GameABI, provider);
    const loaded = [];

    let i = 0;
    while (true) {
      try {
        const g = await gameContract.games(i);

    if (g.player1 === ethers.ZeroAddress) break;

    loaded.push({
          id: i,
          player1: g.player1 || ethers.ZeroAddress,
          player2: g.player2 || ethers.ZeroAddress,
          stakeAmount: g.stakeAmount,
          player1Revealed: g.player1Revealed,
          player2Revealed: g.player2Revealed,
          settled: g.settled,
          winner: g.winner || ethers.ZeroAddress,
          player1TokenIds: g.player1TokenIds ? [...g.player1TokenIds] : [],
          player2TokenIds: g.player2TokenIds ? [...g.player2TokenIds] : [],
          player1Backgrounds: g.player1Backgrounds ? [...g.player1Backgrounds] : [],
          player2Backgrounds: g.player2Backgrounds ? [...g.player2Backgrounds] : []
        });

        i++;
      } catch {
        break;
      }
    }

    setGames(loaded);
  } catch (e) {
    console.error("loadGames failed", e);
  } finally {
    setLoadingGames(false);
  }
}, [provider]);

  /* ---------------- AUTO-REVEAL + AUTO-SETTLE ---------------- */
const revealAndMaybeSettle = useCallback(
  async (gameId) => {
    if (!signer || !account) return;

    try {
      const gameContract = new ethers.Contract(GAME_ADDRESS, GameABI, signer);
      const g = await gameContract.games(gameId);

      const isP1 = g.player1.toLowerCase() === account.toLowerCase();
      const isP2 = g.player2.toLowerCase() === account.toLowerCase();

      // Already revealed
      if ((isP1 && g.player1Revealed) || (isP2 && g.player2Revealed)) return;

      // Player 1 must wait for Player 2
      if (isP1 && g.player2 === ethers.ZeroAddress) return;

      // ----- LocalStorage keys -----
      const saltKey = isP1 ? "p1_salt" : `p2_salt_${gameId}`;
      const nftContractsKey = isP1 ? "p1_nftContracts" : `p2_nftContracts_${gameId}`;
      const idsKey = isP1 ? "p1_tokenIds" : `p2_tokenIds_${gameId}`;
      const bgKey = isP1 ? "p1_backgrounds" : `p2_backgrounds_${gameId}`;

      // ----- Read raw values -----
      const saltStr = localStorage.getItem(saltKey);
      const nftContractsStr = localStorage.getItem(nftContractsKey);
      const tokenIdsStr = localStorage.getItem(idsKey);
      const backgroundsStr = localStorage.getItem(bgKey);

      // ----- HARD GUARDS (prevents BigInt(null)) -----
      if (!saltStr || !nftContractsStr || !tokenIdsStr || !backgroundsStr) {
        console.warn("Reveal data missing — skipping auto reveal", {
          saltStr,
          nftContractsStr,
          tokenIdsStr,
          backgroundsStr
        });
        return;
      }

if (!localStorage.getItem(saltKey)) {
  console.warn("No salt found for auto-reveal", saltKey);
  return;
}

      // ----- Safe parsing -----
      const salt = BigInt(saltStr);

      const nftContracts = JSON.parse(nftContractsStr);
      const tokenIds = JSON.parse(tokenIdsStr).map(t => BigInt(t));
      const backgrounds = JSON.parse(backgroundsStr);

      if (
        nftContracts.length !== 3 ||
        tokenIds.length !== 3 ||
        backgrounds.length !== 3
      ) {
        console.warn("Reveal data malformed — skipping", {
          nftContracts,
          tokenIds,
          backgrounds
        });
        return;
      }

      // ----- REVEAL -----
      const tx = await gameContract.reveal(
        gameId,
        salt,
        nftContracts,
        tokenIds,
        backgrounds
      );
      await tx.wait();

      console.log(`Reveal completed for game ${gameId}`);

      // ----- AUTO-SETTLE -----
      const updatedGame = await gameContract.games(gameId);
      if (
        updatedGame.player1Revealed &&
        updatedGame.player2Revealed &&
        !updatedGame.settled
      ) {
        const settleTx = await gameContract.settleGame(gameId);
        await settleTx.wait();
        console.log(`Game ${gameId} auto-settled`);
      }

      await loadGames();
    } catch (err) {
      console.error("Reveal / settle failed:", err);
    }
  },
  [signer, account, loadGames]
);

/* ---------------- AUTO-REVEAL LOOP ---------------- */
useEffect(() => {
  if (!account || games.length === 0) return;

  const run = async () => {
    for (const g of games) {
      const isParticipant =
        g.player1.toLowerCase() === account.toLowerCase() ||
        g.player2.toLowerCase() === account.toLowerCase();

      if (!isParticipant) continue;

      // Only attempt reveal if NOT revealed yet
      if (
        (g.player1.toLowerCase() === account.toLowerCase() && !g.player1Revealed) ||
        (g.player2.toLowerCase() === account.toLowerCase() && !g.player2Revealed)
      ) {
        await revealAndMaybeSettle(g.id);
      }
    }
  };

  const interval = setInterval(run, 7000); // slower = fewer tx attempts
  return () => clearInterval(interval);
}, [games, account, revealAndMaybeSettle]);

/* ---------------- USE EFFECT ---------------- */
useEffect(() => {
  if (!provider) return;
  loadGames();
}, [provider, loadGames]);

useEffect(() => {
  if (!provider) return;

  const gameContract = new ethers.Contract(GAME_ADDRESS, GameABI, provider);

  const onGameCreated = () => loadGames();
  const onGameJoined = () => loadGames();
  const onRevealed = () => loadGames();
  const onGameSettled = () => loadGames();

  gameContract.on("GameCreated", onGameCreated);
  gameContract.on("GameJoined", onGameJoined);
  gameContract.on("Revealed", onRevealed);
  gameContract.on("GameSettled", onGameSettled);

  return () => {
    gameContract.off("GameCreated", onGameCreated);
    gameContract.off("GameJoined", onGameJoined);
    gameContract.off("Revealed", onRevealed);
    gameContract.off("GameSettled", onGameSettled);
  };
}, [provider, loadGames]);

/* ---------------- AUTO-REVEAL LOOP ---------------- */
useEffect(() => {
  if (!account || games.length === 0) return;

  const interval = setInterval(() => {
    games.forEach(g => {
      const isParticipant =
        g.player1.toLowerCase() === account.toLowerCase() ||
        g.player2.toLowerCase() === account.toLowerCase();

      if (!isParticipant) return;

      // Only attempt reveal if NOT revealed yet
      if (
        (g.player1.toLowerCase() === account.toLowerCase() && !g.player1Revealed) ||
        (g.player2.toLowerCase() === account.toLowerCase() && !g.player2Revealed)
      ) {
        revealAndMaybeSettle(g.id);
      }
    });
  }, 7000); // slower = fewer tx attempts

  return () => clearInterval(interval);
}, [games, account, revealAndMaybeSettle]);

  /* ---------------- METADATA + VALIDATION ---------------- */
async function validateNFTOwnership() {
  for (const nft of nfts) {
    if (!nft.address || nft.tokenId === "") {
      alert("Missing NFT address or tokenId");
      return false;
    }

    const owns = await userOwnsNFT(nft.address, nft.tokenId);
    if (!owns) {
      alert(`You do NOT own NFT ${nft.tokenId} at ${nft.address}`);
      return false;
    }
  }

  return true;
}

const sanitizedNFTs = nfts.map(n => ({
  ...n,
  tokenId: Number(n.tokenId)
}));

const fetchMetadataAndValidate = async () => {
  try {
    setValidating(true);

    const res = await fetch(`${BACKEND_URL}/games/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player: account, nfts: sanitizedNFTs})
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Validation failed");

    // Build clean arrays for localStorage and reveal backup
    const traits = [];
    const backgrounds = [];
    const tokenURIs = [];

    const plainTeamData = data.metadata.map((m, i) => {
      const nftTraits = m.traits.map(Number);
      if (nftTraits.some(v => Number.isNaN(v)) || nftTraits.length !== 5) {
        throw new Error(`Invalid traits for NFT ${m.tokenId}`);
      }

      traits.push(nftTraits);
      backgrounds.push(m.background || "Unknown");
      tokenURIs.push(m.tokenURI || null);

      return {
        address: nfts[i].address,
        tokenId: Number(nfts[i].tokenId),
        background: m.background || "Unknown",
        traits: nftTraits,
        tokenURI: m.tokenURI || null
      };
    });

    setNfts(prev => prev.map((n, i) => ({ ...n, metadata: plainTeamData[i] })));
    setValidated(true);

    // Local storage for previews
    debugForLocalStorage("p1_traits", traits);
    localStorage.setItem("p1_traits", JSON.stringify(traits));
    debugForLocalStorage("p1_backgrounds", backgrounds);
    localStorage.setItem("p1_backgrounds", JSON.stringify(backgrounds));

    alert("Team valid");
  } catch (err) {
    console.error("Validation failed:", err);
    alert(err.message || "Validation failed");
    setValidated(false);
  } finally {
    setValidating(false);
  }
};

  /* ---------------- APPROVAL ---------------- */
  const approveTokens = async () => {
    if (!signer || !stakeToken || !stakeAmount) return;

    try {
      const erc20 = new ethers.Contract(stakeToken, ERC20ABI, signer);
      const stakeWei = ethers.parseUnits(stakeAmount.trim(), 18);
      const allowance = await erc20.allowance(account, GAME_ADDRESS);
      if (allowance >= stakeWei) { alert("Already approved"); return; }

      const tx = await erc20.approve(GAME_ADDRESS, stakeWei);
      await tx.wait();
      alert("Approval successful");
    } catch (err) {
      console.error("Approval failed:", err);
      alert(err.reason || err.message || "Approval failed");
    }
  };

// ---------------- VALIDATE REVEAL DATA ----------------
async function validateRevealData(data) {
  if (!data) throw new Error("No reveal data provided");

  if (!data.gameId && data.gameId !== 0) throw new Error("Missing gameId in reveal file");
  const gameId = BigInt(data.gameId);

  if (!account) throw new Error("Wallet not connected");
  if (data.player.toLowerCase() !== account.toLowerCase())
    throw new Error("Reveal file does not belong to this wallet");

  if (!data.salt) throw new Error("Missing salt in reveal file");
  const salt = BigInt(data.salt);

  // NFT contracts
  if (!Array.isArray(data.nftContracts) || data.nftContracts.length !== 3)
    throw new Error("nftContracts must be an array of 3 items");
  const nftContracts = data.nftContracts.map((c, i) => {
    if (!c) throw new Error(`NFT contract at index ${i} is missing`);
    return c.toString();
  });

  // Token IDs
  if (!Array.isArray(data.tokenIds) || data.tokenIds.length !== 3)
    throw new Error("tokenIds must be an array of 3 items");
  const tokenIds = data.tokenIds.map((t, i) => {
    if (!t) throw new Error(`tokenId at index ${i} is missing`);
    return BigInt(t);
  });

  // Backgrounds
  if (!Array.isArray(data.backgrounds) || data.backgrounds.length !== 3)
    throw new Error("backgrounds must be an array of 3 items");
  const backgrounds = data.backgrounds.map((b, i) => {
    if (!b) throw new Error(`background at index ${i} is empty`);
    return b.toString();
  });

  // On-chain checks
  if (!signer) throw new Error("Signer not ready");
  const game = new ethers.Contract(GAME_ADDRESS, GameABI, signer);
  const g = await game.games(gameId);

  const isParticipant =
    g.player1.toLowerCase() === account.toLowerCase() ||
    g.player2.toLowerCase() === account.toLowerCase();
  if (!isParticipant) throw new Error("This wallet is not a participant in this game");

  const alreadyRevealed =
    (g.player1.toLowerCase() === account.toLowerCase() && g.player1Revealed) ||
    (g.player2.toLowerCase() === account.toLowerCase() && g.player2Revealed);
  if (alreadyRevealed) throw new Error("You have already revealed for this game");

  return { gameId, salt, nftContracts, tokenIds, backgrounds };
}

// ---------------- HANDLE REVEAL FILE ----------------
async function handleRevealFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // Validate and parse the reveal JSON
    const { gameId, salt, nftContracts, tokenIds, backgrounds } = await validateRevealData(data);

    // ---------------- Load CSV Mapping ----------------
    const csvRes = await fetch(`${BACKEND_URL}/mapping.csv`);
    const csvText = await csvRes.text();
    const tokenURIMapping = {};
    csvText.split("\n").slice(1).forEach(line => {
      const [id, uri] = line.trim().split(",");
      if (id && uri) tokenURIMapping[Number(id)] = uri;
    });

    // Ensure arrays are exactly length 3 for Solidity
    const nftContractsArr = [nftContracts[0], nftContracts[1], nftContracts[2]];
    const tokenIdsArr = [tokenIds[0], tokenIds[1], tokenIds[2]];
    const backgroundsArr = [backgrounds[0], backgrounds[1], backgrounds[2]];

    // ---------------- Ownership & tokenURI check ----------------
    for (let i = 0; i < 3; i++) {
      const owns = await userOwnsNFT(nftContractsArr[i], tokenIdsArr[i]);
      if (!owns) throw new Error(`You do not own NFT ${tokenIdsArr[i]} at ${nftContractsArr[i]}`);

      // Add tokenURI from CSV mapping if missing
      if (!data.tokenURIs || !data.tokenURIs[i]) {
        const fallbackURI = tokenURIMapping[Number(tokenIdsArr[i])];
        if (!fallbackURI) throw new Error(`NFT ${tokenIdsArr[i]} is missing a tokenURI`);
        data.tokenURIs = data.tokenURIs || [];
        data.tokenURIs[i] = fallbackURI;
      }
    }

    // ------------------ ON-CHAIN REVEAL ------------------
    const game = new ethers.Contract(GAME_ADDRESS, GameABI, signer);
    const tx = await game.reveal(
      gameId,
      salt,
      nftContractsArr,
      tokenIdsArr,
      backgroundsArr
    );
    await tx.wait();

    // ------------------ POST TO BACKEND ------------------
    const payload = {
      gameId,
      player: account,
      salt: salt.toString(),
      nftContracts: nftContractsArr.map(a => a.toString()),
      tokenIds: tokenIdsArr.map(t => t.toString()),
      backgrounds: backgroundsArr.map(b => b.toString()),
      tokenURIs: data.tokenURIs
    };

    const res = await fetch(`${BACKEND_URL}/games/${gameId}/reveal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const backendData = await res.json();
    if (!res.ok) {
      console.error("Backend reveal failed:", backendData.error || "Unknown error");
      alert(`Backend reveal failed: ${backendData.error || "Unknown error"}`);
      return;
    }

    console.log(`Reveal stored for game ${gameId}, backend ready: ${backendData.revealReady}`);
    alert("Reveal successful");

    // Refresh game list
    await loadGames();

  } catch (err) {
    console.error("Reveal failed:", err);
    alert(`Reveal failed: ${err.message}`);
  }
}

// ---------------- CREATE GAME ----------------
const createGame = async () => {
  const ownsAll = await validateNFTOwnership();
  if (!ownsAll || !signer) return;

  if (!validated || !stakeToken || !stakeAmount) {
    alert("Missing info or validation");
    return;
  }

  try {
    // ---------------- FETCH TOKEN URIS FROM BACKEND ----------------
    const nftsWithURIs = await Promise.all(
      nfts.map(async (n) => {
        const res = await fetch(`${BACKEND_URL}/games/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nfts: [{ address: n.address, tokenId: n.tokenId }] })
        });
        const data = await res.json();
        if (!res.ok || !data.metadata || !data.metadata[0]?.tokenURI) {
          throw new Error(`NFT ${n.tokenId} at ${n.address} is missing a tokenURI`);
        }
        return {
          ...n,
          metadata: { ...n.metadata, tokenURI: data.metadata[0].tokenURI }
        };
      })
    );

    const nftContracts = nftsWithURIs.map(n => n.address);
    const tokenIds = nftsWithURIs.map(n => BigInt(n.tokenId));
    const backgrounds = nftsWithURIs.map(n => n.metadata.background);
    const tokenURIs = nftsWithURIs.map(n => n.metadata.tokenURI);

    // ---------------- ERC20 APPROVAL ----------------
    const erc20 = new ethers.Contract(stakeToken, ERC20ABI, signer);
    const gameContract = new ethers.Contract(GAME_ADDRESS, GameABI, signer);
    const stakeWei = ethers.parseUnits(stakeAmount.trim(), 18);
    const allowance = await erc20.allowance(account, GAME_ADDRESS);

    if (allowance < stakeWei) {
      const approveTx = await erc20.approve(GAME_ADDRESS, stakeWei);
      await approveTx.wait();
    }

    // ---------------- COMMIT ----------------
    const salt = ethers.toBigInt(ethers.randomBytes(32));
    const commit = ethers.solidityPackedKeccak256(
      ["uint256","address","address","address","uint256","uint256","uint256"],
      [salt, nftContracts[0], nftContracts[1], nftContracts[2], tokenIds[0], tokenIds[1], tokenIds[2]]
    );

    // ---------------- ON-CHAIN CREATE ----------------
    const tx = await gameContract.createGame(stakeToken, stakeWei, commit);
    const receipt = await tx.wait();
    const event = receipt.logs
      .map(l => { try { return gameContract.interface.parseLog(l); } catch { return null } })
      .find(e => e?.name === "GameCreated");
    if (!event) throw new Error("GameCreated event not found");

    const gameId = Number(event.args.gameId);

    // ---------------- POST TO BACKEND ----------------
    const payload = {
      creator: account,
      stakeToken,
      stakeAmount: stakeWei.toString(),
      nfts: nftsWithURIs.map(n => ({
        address: n.address,
        tokenId: Number(n.tokenId),
        metadata: n.metadata
      }))
    };

    const backendRes = await fetch(`${BACKEND_URL}/games`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const backendData = await backendRes.json();
    if (!backendRes.ok) throw new Error(backendData.error || "Backend game creation failed");

    // ---------------- FRONTEND STATE ----------------
    setGames(prev => [
      ...prev,
      {
        id: gameId,
        creator: account,
        stakeToken,
        stakeAmount: stakeWei.toString(),
        player1: account,
        player2: null,
        createdAt: new Date().toISOString(),
        settled: false,
        winner: null,
        tie: false,
        revealReady: false,
        _player1: { tokenURIs, teamData: nftsWithURIs, revealed: false },
        _player2: null
      }
    ]);

    // ---------------- DOWNLOAD REVEAL ----------------
    downloadRevealBackup({
      gameId,
      player: account,
      salt: salt.toString(),
      nftContracts,
      tokenIds: tokenIds.map(t => t.toString()),
      backgrounds
    });

    alert(`Game ${gameId} created successfully`);
    await loadGames();

  } catch (err) {
    console.error("Create game failed:", err);
    alert(err.message || "Create game failed");
  }
};

// ---------------- JOIN GAME ----------------
const joinGame = async (gameId) => {
  const ownsAll = await validateNFTOwnership();
  if (!ownsAll || !signer) return;

  if (!validated) {
    alert("Validate your team before joining");
    return;
  }

  try {
    // ---------------- FETCH TOKEN URIS FROM BACKEND ----------------
const sanitizedNFTs = nfts.map(n => ({
  ...n,
  tokenId: Number(n.tokenId)
}));

const nftsWithURIs = await Promise.all(
      nfts.map(async (n) => {
        const res = await fetch(`${BACKEND_URL}/games/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nfts: [{ address: n.address, tokenId: sanitizedNFTs }] })
        });
        const data = await res.json();
        if (!res.ok || !data.metadata || !data.metadata[0]?.tokenURI) {
          throw new Error(`NFT ${n.tokenId} at ${n.address} is missing a tokenURI`);
        }
        return {
          ...n,
          metadata: { ...n.metadata, tokenURI: data.metadata[0].tokenURI }
        };
      })
    );

    const nftContracts = nftsWithURIs.map(n => n.address);
    const tokenIds = nftsWithURIs.map(n => BigInt(n.tokenId));
    const backgrounds = nftsWithURIs.map(n => n.metadata.background);
    const tokenURIs = nftsWithURIs.map(n => n.metadata.tokenURI);

    // ---------------- COMMIT ----------------
    const game = new ethers.Contract(GAME_ADDRESS, GameABI, signer);
    const salt = ethers.toBigInt(ethers.randomBytes(32));
    const commit = ethers.solidityPackedKeccak256(
      ["uint256","address","address","address","uint256","uint256","uint256"],
      [salt, nftContracts[0], nftContracts[1], nftContracts[2], tokenIds[0], tokenIds[1], tokenIds[2]]
    );

    const tx = await game.joinGame(gameId, commit);
    await tx.wait();

    // ---------------- POST TO BACKEND ----------------
    const payload = {
      player2: account,
      nfts: nftsWithURIs.map(n => ({
        address: n.address,
        tokenId: Number(n.tokenId),
        metadata: n.metadata
      }))
    };

    const backendRes = await fetch(`${BACKEND_URL}/games/${gameId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const backendData = await backendRes.json();
    if (!backendRes.ok) throw new Error(backendData.error || "Backend join failed");

    // ---------------- FRONTEND STATE ----------------
    const _player2 = {
      tokenURIs,
      teamData: nftsWithURIs.map((n, i) => ({
        address: n.address,
        tokenId: Number(n.tokenId),
        background: backgrounds[i],
        traits: [...n.metadata.traits],
        tokenURI: tokenURIs[i]
      })),
      revealed: false
    };

    setGames(prev =>
      prev.map(g => g.id === gameId
        ? { ...g, player2: account, player2JoinedAt: new Date().toISOString(), _player2 }
        : g
      )
    );

    downloadRevealBackup({ gameId, player: account, salt: salt.toString(), nftContracts, tokenIds: tokenIds.map(t => t.toString()), backgrounds });

    alert("Joined game successfully");
    await loadGames();

  } catch (err) {
    console.error("Join game failed:", err);
    alert(err.message || "Join failed");
  }
};

/* ---------------- UI ---------------- */
return (
  <div style={{ padding: 20, maxWidth: 900 }}>
    <h1>Core Clash</h1>
    <p>Connected: {account || "Not connected"}</p>

    {/* ================= CREATE GAME ================= */}
    <h2>Create Game</h2>

    <label>Stake Token</label>
    <input
      value={stakeToken}
      onChange={e => setStakeToken(e.target.value)}
      style={{ width: "100%", marginBottom: 6 }}
    />

    <label>Stake Amount</label>
    <input
      value={stakeAmount}
      onChange={e => setStakeAmount(e.target.value)}
      style={{ width: "100%", marginBottom: 12 }}
    />

    <h3>NFT Team (3)</h3>
    {nfts.map((n, i) => (
      <div key={i} style={{ marginBottom: 10 }}>
        <input
          placeholder="NFT Address"
          value={n.address}
          onChange={e => updateNFT(i, "address", e.target.value)}
          style={{ width: "60%" }}
        />
        <input
          placeholder="Token ID"
          value={n.tokenId}
          onChange={e => updateNFT(i, "tokenId", e.target.value)}
          style={{ width: "35%", marginLeft: 5 }}
        />

        {n.metadata && (
          <div style={{ marginTop: 5, fontSize: 14 }}>
            <b>{n.metadata.name}</b>
            <div>Background: {n.metadata.background}</div>
          </div>
        )}
      </div>
    ))}

    <button disabled={validating} onClick={fetchMetadataAndValidate}>
      {validating ? "Validating..." : "Validate Team"}
    </button>

    <div style={{ marginTop: 12 }}>
      <button
        onClick={approveTokens}
        disabled={!stakeToken || !stakeAmount || !signer}
      >
        Approve Tokens
      </button>

      <button
        onClick={createGame}
        disabled={!validated || !stakeToken || !stakeAmount || !signer}
        style={{ marginLeft: 8 }}
      >
        Create Game
      </button>
    </div>

    {/* ================= GAMES ================= */}
    <h2 style={{ marginTop: 40 }}>Games</h2>

    {loadingGames && <p>Loading games…</p>}
    {!loadingGames && games.length === 0 && <p>No games yet</p>}

{[...games]
  .sort((a, b) => b.id - a.id)
  .map((g) => (
  <div key={g.id} style={{ border: "1px solid #444", padding: 14, marginBottom: 14 }}>
    <h3>Game #{g.id}</h3>

    <div>🟥 Player 1: {g.player1}</div>
    <div>🟦 Player 2: {g.player2 !== ethers.ZeroAddress ? g.player2 : "Waiting for opponent"}</div>
    <div style={{ marginTop: 6 }}>Stake: {ethers.formatUnits(g.stakeAmount, 18)}</div>

    {/* ---- ACTIONS ---- */}
    <div style={{ marginTop: 10 }}>
      {g.player2 === ethers.ZeroAddress && g.player1.toLowerCase() !== account?.toLowerCase() && (
        <button onClick={() => joinGame(g.id)}>Join Game</button>
      )}

      {((g.player1.toLowerCase() === account?.toLowerCase() && g.player2 !== ethers.ZeroAddress && !g.player1Revealed) ||
        (g.player2.toLowerCase() === account?.toLowerCase() && !g.player2Revealed)) && (
        <button onClick={() => revealAndMaybeSettle(g.id)} style={{ marginLeft: 8 }}>
          Reveal
        </button>
      )}

      {g.player1Revealed && g.player2Revealed && !g.settled && 
        (g.player1.toLowerCase() === account?.toLowerCase() || g.player2.toLowerCase() === account?.toLowerCase()) && (
        <button
          onClick={async () => {
            try {
              const gameContract = new ethers.Contract(GAME_ADDRESS, GameABI, signer);
              const tx = await gameContract.settleGame(g.id);
              await tx.wait();
              await loadGames();
            } catch (err) {
              alert(err.reason || err.message || "Settle failed");
            }
          }}
          style={{ marginLeft: 8 }}
        >
          Settle Game
        </button>
      )}

      <input type="file" accept="application/json" onChange={handleRevealFile} />
    </div>

    {/* ---- PLAYER TEAMS ---- */}
    {g.player1Revealed && (
      <div style={{ marginTop: 14 }}>
        <h4>🟥 Player 1 Team</h4>
        {g.player1TokenIds.map((id, i) => (
          <div key={i} style={{ marginLeft: 10 }}>
            NFT #{id.toString()} — {g.player1Backgrounds[i] || "Unknown"}
          </div>
        ))}
      </div>
    )}

    {g.player2Revealed && (
      <div style={{ marginTop: 14 }}>
        <h4>🟦 Player 2 Team</h4>
        {g.player2TokenIds.map((id, i) => (
          <div key={i} style={{ marginLeft: 10 }}>
            NFT #{id.toString()} — {g.player2Backgrounds[i] || "Unknown"}
          </div>
        ))}
      </div>
    )}

{/* ---- RESULT ---- */}
{g.settled && (
  <div style={{ marginTop: 14, padding: 12, background: "#111", border: "1px solid #333" }}>
    <h3>
      🏆 Result:{" "}
      {g.winner === ethers.ZeroAddress
        ? "Draw"
        : g.winner.toLowerCase() === g.player1.toLowerCase()
        ? "Player 1 wins"
        : "Player 2 wins"}
    </h3>
    <div style={{ fontSize: 14, marginTop: 6 }}>
      Winner address: {g.winner === ethers.ZeroAddress ? "—" : g.winner}
    </div>

    {/* ---- ROUND-BY-ROUND DETAILS ---- */}
    {g.roundResults && g.roundResults.length > 0 && (
      <div style={{ marginTop: 12 }}>
        <h4>Round-by-Round Results</h4>
        {g.roundResults.map((r, idx) => (
          <div key={idx} style={{ marginLeft: 10, marginTop: 4 }}>
            <strong>Round {idx + 1}:</strong>{" "}
            {r.winner === "tie"
              ? "Tie"
              : r.winner === "player1"
              ? "Player 1 wins"
              : "Player 2 wins"}{" "}
            (diff: {r.roundDiff})
            <div style={{ fontSize: 12, marginLeft: 12 }}>
              🟥 P1 Traits: {r.p1.join(", ")}<br />
              🟦 P2 Traits: {r.p2.join(", ")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )}
  </div>
))}
</div>
)}