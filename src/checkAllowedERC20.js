import { ethers } from "ethers";
import { GAME_ADDRESS, RPC_URL, CORE_TOKEN } from "./config.js";

const USER = "0x3Fd2e5B4AC0efF6DFDF2446abddAB3f66B425099";

// Minimal ABIs
const GAME_ABI = [
  "function allowedERC20(address) view returns (bool)"
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  // Game contract
  const game = new ethers.Contract(GAME_ADDRESS, GAME_ABI, provider);
  const allowed = await game.allowedERC20(CORE_TOKEN);
  console.log("allowedERC20:", allowed);

  // ERC20 contract
  const erc20 = new ethers.Contract(CORE_TOKEN, ERC20_ABI, provider);
  const decimals = await erc20.decimals();
  const balance = await erc20.balanceOf(USER);
  const allowance = await erc20.allowance(USER, GAME_ADDRESS);

  console.log("decimals:", decimals);
  console.log("balance:", balance.toString());
  console.log("allowance:", allowance.toString());

  // Check a stake amount
  const stakeAmount = "1"; // Change this to the intended stake
  const stakeWei = ethers.parseUnits(stakeAmount, decimals);
  console.log("stakeWei:", stakeWei.toString());

  if (balance < stakeWei) {
    console.log("❌ Insufficient balance for stake");
  } else {
    console.log("✅ Balance sufficient");
  }

  if (allowance < stakeWei) {
    console.log("❌ Allowance too low for stake");
  } else {
    console.log("✅ Allowance sufficient");
  }
}

main().catch(console.error);
