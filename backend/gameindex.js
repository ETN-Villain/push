// gameindex.js
const express = "express";
const cors = "cors";
const fs = "fs";
const path = "path";
const axios = "axios";
import { IPFS_BASE } from "../src/config";
import { IPFS_BASE } from "./config";

const app = express();
const PORT = 3001;

// =======================
// Enable CORS and JSON parsing
// =======================
app.use(cors());
app.use(express.json());

// =======================
// Config
// =======================
const DB_FILE = path.join(__dirname, "games.json");
const IPFS_BASE = IPFS_BASE;

const RARE_BACKGROUNDS = ["Gold", "Silver", "Verdant Green", "Rose Gold"];

// =======================
// Load or init DB
// =======================
let games = [];
if (fs.existsSync(DB_FILE)) {
  games = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
} else {
  fs.writeFileSync(DB_FILE, JSON.stringify([]));
}

const saveGames = () => {
  fs.writeFileSync(DB_FILE, JSON.stringify(games, null, 2));
};

// =======================
// Helper: Fetch NFT metadata from IPFS
// =======================
const fetchNFT = async (tokenURI) => {
  try {
    const url = tokenURI.replace("ipfs://", "https://ipfs.io/ipfs/");
    const res = await axios.get(url);
    return res.data;
  } catch (err) {
    console.error("Failed to fetch NFT metadata:", tokenURI, err.message);
    return null;
  }
};

// =======================
// Helper: Validate team of 3 NFTs
// =======================
const validateTeam = (nfts) => {
  if (!Array.isArray(nfts) || nfts.length !== 3) {
    throw new Error("Team must have exactly 3 NFTs");
  }

  const seenNames = new Set();
  let rareCount = 0;

  for (const nft of nfts) {
    if (seenNames.has(nft.name)) throw new Error(`Duplicate character: ${nft.name}`);
    seenNames.add(nft.name);

    if (RARE_BACKGROUNDS.includes(nft.background)) rareCount++;
  }

  if (rareCount > 1) throw new Error("Team can have at most 1 rare background");
  return true;
};

// =======================
// Game logic
// =======================
const getRoundResult = (traits1, traits2) => {
  const atk1 = traits1.attack + traits1.agility;
  const def1 = traits1.defense + traits1.vitality;
  const core1 = traits1.core;

  const atk2 = traits2.attack + traits2.agility;
  const def2 = traits2.defense + traits2.vitality;
  const core2 = traits2.core;

  const damage1 = atk2 > def1 ? atk2 - def1 : 0;
  const mod1 = core1 > damage1 ? core1 - damage1 : 0;

  const damage2 = atk1 > def2 ? atk1 - def2 : 0;
  const mod2 = core2 > damage2 ? core2 - damage2 : 0;

  let p1_wins = 0, p2_wins = 0;
  if (mod1 > mod2) p1_wins = 1;
  else if (mod2 > mod1) p2_wins = 1;

  const round_diff = mod1 - mod2;
  return { p1_wins, p2_wins, round_diff };
};

const computeWinner = (traits1Arr, traits2Arr) => {
  let player1Points = 0, player2Points = 0, totalDiff = 0;

  for (let i = 0; i < 3; i++) {
    const res = getRoundResult(traits1Arr[i], traits2Arr[i]);
    player1Points += res.p1_wins;
    player2Points += res.p2_wins;
    totalDiff += res.round_diff;
  }

  if (player1Points > player2Points) return "player1";
  if (player2Points > player1Points) return "player2";
  if (totalDiff > 0) return "player1";
  if (totalDiff < 0) return "player2";
  return "tie";
};

// =======================
// API Endpoints
// =======================

// Get all games
app.get("/games", (req, res) => {
  res.json(games);
});

// Create a new game
app.post("/games", async (req, res) => {
  try {
    const { creator, stakeToken, stakeAmount, tokenURIs } = req.body;
    if (!creator || !stakeToken || !stakeAmount || !tokenURIs || tokenURIs.length !== 3) {
      return res.status(400).json({ error: "Missing required fields or invalid NFT array" });
    }

    const nfts = await Promise.all(tokenURIs.map(fetchNFT));
    validateTeam(nfts);

    const nextGameId = games.length > 0 ? Math.max(...games.map(g => g.id)) + 1 : 0;

    const newGame = {
      id: nextGameId,
      creator,
      player1NFTs: tokenURIs,
      player2: null,
      player2NFTs: [],
      stakeToken,
      stakeAmount,
      createdAt: new Date().toISOString(),
      settledAt: null,
      winner: null,
      tie: false
    };

    games.push(newGame);
    saveGames();

    res.status(201).json(newGame);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Join game (player 2)
app.post("/games/:id/join", async (req, res) => {
  try {
    const gameId = Number(req.params.id);
    const { player2, tokenURIs } = req.body;

    const game = games.find(g => g.id === gameId);
    if (!game) return res.status(404).json({ error: "Game not found" });
    if (game.player2) return res.status(400).json({ error: "Game already has player 2" });
    if (!tokenURIs || tokenURIs.length !== 3) return res.status(400).json({ error: "Must submit 3 NFTs" });

    const nfts = await Promise.all(tokenURIs.map(fetchNFT));
    validateTeam(nfts);

    game.player2 = player2;
    game.player2NFTs = tokenURIs;

    // Compute winner immediately after join
    const p1Traits = await Promise.all(game.player1NFTs.map(fetchNFT));
    const p2Traits = await Promise.all(game.player2NFTs.map(fetchNFT));

    const traits1Arr = p1Traits.map(nft => ({
      attack: nft.attack,
      defense: nft.defense,
      vitality: nft.vitality,
      agility: nft.agility,
      core: nft.core
    }));

    const traits2Arr = p2Traits.map(nft => ({
      attack: nft.attack,
      defense: nft.defense,
      vitality: nft.vitality,
      agility: nft.agility,
      core: nft.core
    }));

    const winnerKey = computeWinner(traits1Arr, traits2Arr);
    game.winner = winnerKey === "player1" ? game.creator : winnerKey === "player2" ? player2 : null;
    game.tie = winnerKey === "tie";
    game.settledAt = new Date().toISOString();

    saveGames();
    res.json(game);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Settle game manually (if needed)
app.post("/games/:id/settle", (req, res) => {
  const gameId = Number(req.params.id);
  const game = games.find(g => g.id === gameId);
  if (!game) return res.status(404).json({ error: "Game not found" });
  if (game.settledAt) return res.status(400).json({ error: "Game already settled" });

  game.settledAt = new Date().toISOString();
  saveGames();

  res.json({ message: "Game settled manually", game });
});

// =======================
// Start server
// =======================
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
