// backend/utils/autoSettleGame.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { computeWinner } from "../gameLogic.js";

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to games.json
const GAMES_FILE = path.join(__dirname, "../games.json");

// Helpers
const loadGames = () =>
  fs.existsSync(GAMES_FILE) ? JSON.parse(fs.readFileSync(GAMES_FILE, "utf8")) : [];

const saveGames = (games) =>
  fs.writeFileSync(GAMES_FILE, JSON.stringify(games, null, 2));

/**
 * Validate that traits exist and are correctly formatted.
 */
function assertTraitsFinalized(game) {
  const p1 = game._player1?.traits;
  const p2 = game._player2?.traits;

  if (!p1 || !p2) {
    throw new Error("Cannot settle: traits missing for one or both players");
  }

  if (p1.length !== 3 || p2.length !== 3) {
    throw new Error("Each player must have exactly 3 NFTs");
  }

  for (const t of [...p1, ...p2]) {
    if (!Array.isArray(t) || t.length !== 5 || t.some(v => typeof v !== "number")) {
      throw new Error("Invalid trait structure detected");
    }
  }
}

/**
 * Auto-settle a single game using slot-aligned traits.
 */
export async function autoSettleGame(game) {
  if (!game._player1 || !game._player2) return;

  try {
    // 🔒 Ensure traits exist and are valid
    assertTraitsFinalized(game);

    const player1Teams = game._player1.traits; // slot-aligned
    const player2Teams = game._player2.traits; // slot-aligned

    const winnerKey = computeWinner(player1Teams, player2Teams);

    game.winner =
      winnerKey === "player1"
        ? game.player1
        : winnerKey === "player2"
        ? game.player2
        : null;

    game.tie = winnerKey === "tie";
    game.settledAt = new Date().toISOString();

    const games = loadGames().map(g => (g.id === game.id ? game : g));
    saveGames(games);

    console.log(
      `✅ Game ${game.id} resolved. Outcome: ${game.tie ? "Tie" : game.winner}`
    );
  } catch (err) {
    console.error(
      `❌ Refused to auto-settle game ${game.id}:`,
      err.message
    );
  }
}
