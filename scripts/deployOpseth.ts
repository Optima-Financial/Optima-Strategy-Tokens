// Deploy OPSETH (Enhanced ETH Long Short Momentum) to Arbitrum One.
//
// The entire supply mints to RECIPIENT (a Ledger / cold wallet) in the constructor;
// the configured deployer account only pays gas and holds zero tokens. The deployer
// key + RPC come from .env via hardhat.config.ts (network `arbitrumOne`) — never
// hardcoded, never committed.
//
// Read-only preflight by default. Set DEPLOY=1 to actually broadcast.
//
//   npx hardhat run scripts/deployOpseth.ts --network arbitrumOne            # preflight only
//   DEPLOY=1 npx hardhat run scripts/deployOpseth.ts --network arbitrumOne   # deploy (IRREVERSIBLE)
//   RECIPIENT_ADDRESS=0x... DEPLOY=1 npx hardhat run ...                       # override recipient
import { ethers } from "hardhat";

// The production OPSETH supply holder (Optima treasury / Ledger).
const DEFAULT_RECIPIENT = "0x67cEccbd23d3a1F959F1282210E3f32F4AC13d83";
const EXPECTED_SUPPLY = 1_000_000_000n * 10n ** 18n;

async function main() {
  const recipient = ethers.getAddress(process.env.RECIPIENT_ADDRESS || DEFAULT_RECIPIENT);

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("no deployer account — set PRIVATE_KEY in .env");
  const provider = ethers.provider;
  const net = await provider.getNetwork();
  if (net.chainId !== 42161n) throw new Error(`wrong chain: ${net.chainId} (want Arbitrum One 42161)`);

  const Factory = await ethers.getContractFactory("OPSETH");
  const deployTx = await Factory.getDeployTransaction(recipient);
  const gas = await provider.estimateGas({ ...deployTx, from: deployer.address });
  const fee = await provider.getFeeData();
  const gasPrice = fee.maxFeePerGas ?? fee.gasPrice ?? 0n;
  const cost = gas * gasPrice;
  const bal = await provider.getBalance(deployer.address);

  console.log("=== OPSETH deploy preflight (Arbitrum One) ===");
  console.log("recipient (holder) :", recipient);
  console.log("deployer           :", deployer.address);
  console.log("deployer ARB bal   :", ethers.formatEther(bal), "ETH");
  console.log("est. deploy gas    :", gas.toString());
  console.log("est. gas price     :", ethers.formatUnits(gasPrice, "gwei"), "gwei");
  console.log("est. deploy cost   :", ethers.formatEther(cost), "ETH");
  console.log("expected supply    :", EXPECTED_SUPPLY.toString(), "(1e9 * 1e18)");
  if (bal < (cost * 12n) / 10n) throw new Error("insufficient deployer ARB for gas (need ~1.2x est cost)");

  if (process.env.DEPLOY !== "1") {
    console.log("\nPREFLIGHT ONLY — set DEPLOY=1 to broadcast. No transaction sent.");
    return;
  }

  console.log("\nBroadcasting deploy…");
  const c = await Factory.deploy(recipient);
  const tx = c.deploymentTransaction();
  console.log("deploy tx:", tx?.hash);
  await c.waitForDeployment();
  const addr = await c.getAddress();
  // NB: provider.waitForTransaction is NOT implemented by HardhatEthersProvider —
  // it crashed the 2026-07-20 OPSXRP deploy post-broadcast (assertions then run
  // manually via RPC). tx.wait() is the supported path.
  await tx!.wait(2);

  const t = c as any;
  const [name, symbol, decimals, total, rbal, dbal] = await Promise.all([
    t.name(), t.symbol(), t.decimals(), t.totalSupply(),
    t.balanceOf(recipient), t.balanceOf(deployer.address),
  ]);
  console.log("\n=== DEPLOYED ===");
  console.log("contract           :", addr);
  console.log("name               :", name);
  console.log("symbol             :", symbol);
  console.log("decimals           :", decimals.toString());
  console.log("totalSupply        :", total.toString());
  console.log("balanceOf recipient:", rbal.toString());
  console.log("balanceOf deployer :", dbal.toString());
  console.log("arbiscan           : https://arbiscan.io/address/" + addr);

  if (name !== "Enhanced ETH Long Short Momentum") throw new Error("name mismatch");
  if (symbol !== "OPSETH") throw new Error("symbol mismatch");
  if (decimals !== 18n) throw new Error("decimals mismatch");
  if (total !== EXPECTED_SUPPLY) throw new Error("totalSupply mismatch");
  if (rbal !== EXPECTED_SUPPLY) throw new Error("recipient did not receive full supply");
  if (dbal !== 0n) throw new Error("deployer unexpectedly holds tokens");
  console.log("\nALL ASSERTIONS PASSED — full supply with the recipient, deployer holds 0.");
  console.log("VERIFY:  npx hardhat verify --network arbitrumOne " + addr + " " + recipient);
}

main().catch((e) => { console.error(e); process.exit(1); });
