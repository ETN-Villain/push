const ethers = "ethers";
import { GAME_ADDRESS } from "./config.js";
const ETN_RPC = "https://rpc.ankr.com/electroneum";
const provider = new ethers.JsonRpcProvider(ETN_RPC);

(async () => {
  const filter = {
    address: GAME_ADDRESS,
    fromBlock: 0,
    toBlock: "latest"
  };

  const logs = await provider.getLogs(filter);
  console.log("Total logs found:", logs.length);
  logs.forEach((log, i) => {
    console.log(`Log ${i}:`, log);
  });
})();
