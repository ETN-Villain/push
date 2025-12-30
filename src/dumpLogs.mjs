import { ethers } from "ethers";

import { GAME_ADDRESS } from "./config.js";
const RPC = "https://rpc.ankr.com/electroneum";
const DEPLOY_BLOCK = 11176496;
const provider = new ethers.JsonRpcProvider(RPC);

(async () => {
  try {
    console.log("Fetching logs for contract:", GAME_ADDRESS);

const logs = await provider.getLogs({
  address: GAME_ADDRESS,
  fromBlock: DEPLOY_BLOCK,
  toBlock: "latest",
  topics: ["0xaa461c27"] // CreateGame
});

    console.log("TOTAL LOGS FOUND:", logs.length);

    logs.forEach((log, i) => {
      console.log(`\n=== LOG ${i} ===`);
      console.log("blockNumber:", log.blockNumber);
      console.log("topics:", log.topics);
      console.log("data:", log.data);
      console.log("txHash:", log.transactionHash);
    });

  } catch (err) {
    console.error("LOG FETCH FAILED:", err);
  }
})();
