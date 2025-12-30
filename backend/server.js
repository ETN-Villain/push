import express from "express";
import cors from "cors"; // ✅ import cors
import { generateMapping } from "./utils/generateMapping.js";
import gamesRouter from "./routes/games.js";

const app = express();

// ---------------- MIDDLEWARE ----------------
app.use(cors({ origin: "http://localhost:3000" })); // allow requests from your React app
app.use(express.json());

// ---------------- ROUTES ----------------
app.use("/games", gamesRouter);

// ---------------- INIT ----------------
await generateMapping();
app.listen(3001, () => console.log("Backend running"));
