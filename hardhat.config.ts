import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

// Secrets come from .env (gitignored) — NEVER commit real keys. See .env.example.
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const ARBITRUM_MAINNET_RPC_URL = process.env.ARBITRUM_MAINNET_RPC_URL || "https://arb1.arbitrum.io/rpc";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: { optimizer: { enabled: true, runs: 1000 } },
  },
  networks: {
    arbitrumOne: {
      url: ARBITRUM_MAINNET_RPC_URL,
      chainId: 42161,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  // Etherscan V2 key works across chains (incl. Arbitrum).
  etherscan: { apiKey: ETHERSCAN_API_KEY },
  // Keyless fallback verifier; Blockscout imports Sourcify matches automatically.
  sourcify: { enabled: true },
};

export default config;
