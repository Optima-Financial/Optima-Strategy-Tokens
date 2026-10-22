// Create + initialise the Uniswap v3 <TOKEN>/USDC pool on Arbitrum One at the strategy token's NAV.
//
// No liquidity is added here: the pool is only created and its price set. Liquidity comes later from
// the uni-arb LP subsystem (it deposits only while the pool price is within its tolerance of NAV).
// The configured deployer account only pays gas. Same fee tier as OPSBTC's pool (0.3%).
//
// NAV_USD is the PER-TOKEN price (strategy_nav_snapshots.token_price, e.g. 9.92), NOT the basket NAV
// (strategies.current_nav, e.g. 10158), which would price the pool ~1000x too high. OPSBTC's pool trades
// at its token_price.
//
// Read-only preflight by default. Set DEPLOY=1 to actually broadcast.
//
//   TOKEN_ADDRESS=0x... NAV_USD=9.92180207 npx hardhat run scripts/createUsdcPool.ts --network arbitrumOne
//   DEPLOY=1 TOKEN_ADDRESS=0x... NAV_USD=... npx hardhat run scripts/createUsdcPool.ts --network arbitrumOne  # IRREVERSIBLE
import { ethers } from "hardhat";

const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // Arbitrum-native USDC, 6 decimals
const NFPM = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"; // Uniswap v3 NonfungiblePositionManager
const FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984"; // Uniswap v3 factory
const FEE = 3000; // 0.3 %, as OPSBTC's pool 0xa5024084C40e74a5daB13849154EDc075b37b3DF

const NFPM_ABI = [
  "function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) payable returns (address pool)",
];
const FACTORY_ABI = ["function getPool(address, address, uint24) view returns (address)"];
const POOL_ABI = ["function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)"];
const ERC20_ABI = ["function decimals() view returns (uint8)", "function symbol() view returns (string)"];

function isqrt(n: bigint): bigint {
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

const Q192 = 2n ** 192n;
const NAV_SCALE = 10n ** 8n;

function navScaled(nav: string): bigint {
  const [i, f = ""] = nav.split(".");
  return BigInt(i!) * NAV_SCALE + BigInt((f + "00000000").slice(0, 8));
}

/** USDC per token from a pool's sqrtPriceX96, for the read-back. */
function usdcPerToken(sqrtP: bigint, tokenIsToken0: boolean, tokenDec: number): number {
  const raw = Number(sqrtP * sqrtP) / Number(Q192); // token1 per token0, raw units
  const t1PerT0 = tokenIsToken0 ? raw * 10 ** (tokenDec - 6) : raw * 10 ** (6 - tokenDec);
  return tokenIsToken0 ? t1PerT0 : 1 / t1PerT0;
}

async function main() {
  const tokenAddr = ethers.getAddress(process.env.TOKEN_ADDRESS || "");
  const nav = process.env.NAV_USD || "";
  if (!/^\d+(\.\d+)?$/.test(nav)) throw new Error("NAV_USD must be the per-token price, e.g. 9.92180207");

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("no deployer account — set PRIVATE_KEY in .env");
  const provider = ethers.provider;
  const net = await provider.getNetwork();
  if (net.chainId !== 42161n) throw new Error(`wrong chain: ${net.chainId} (want Arbitrum One 42161)`);

  const token = new ethers.Contract(tokenAddr, ERC20_ABI, provider);
  const [symbol, decRaw] = await Promise.all([token.symbol(), token.decimals()]);
  const dec = Number(decRaw);
  const tokenIsToken0 = BigInt(tokenAddr) < BigInt(USDC);
  const [t0, t1] = tokenIsToken0 ? [tokenAddr, USDC] : [USDC, tokenAddr];

  // price = token1 per token0 in raw units; sqrtPriceX96 = sqrt(price × 2^192), integer.
  const n = navScaled(nav);
  const sqrtPriceX96 = tokenIsToken0
    ? isqrt((n * 10n ** 6n * Q192) / (NAV_SCALE * 10n ** BigInt(dec)))
    : isqrt((NAV_SCALE * 10n ** BigInt(dec) * Q192) / (n * 10n ** 6n));
  const implied = usdcPerToken(sqrtPriceX96, tokenIsToken0, dec);

  const factory = new ethers.Contract(FACTORY, FACTORY_ABI, provider);
  const existing: string = await factory.getPool(t0, t1, FEE);
  const nfpm = new ethers.Contract(NFPM, NFPM_ABI, deployer);
  const gas = await nfpm.createAndInitializePoolIfNecessary.estimateGas(t0, t1, FEE, sqrtPriceX96);
  const fee = await provider.getFeeData();
  const gasPrice = fee.maxFeePerGas ?? fee.gasPrice ?? 0n;
  const bal = await provider.getBalance(deployer.address);

  console.log(`=== ${symbol}/USDC pool preflight (Arbitrum One) ===`);
  console.log("token              :", tokenAddr, `(${symbol}, ${dec} dec)`);
  console.log("token0 / token1    :", t0, "/", t1);
  console.log("fee tier           :", FEE);
  console.log("NAV (USDC/token)   :", nav);
  console.log("sqrtPriceX96       :", sqrtPriceX96.toString());
  console.log("implied price      :", implied.toFixed(6), "USDC per", symbol);
  console.log("existing pool      :", existing);
  console.log("deployer           :", deployer.address);
  console.log("deployer ETH bal   :", ethers.formatEther(bal), "ETH");
  console.log("est. gas           :", gas.toString());
  console.log("est. cost (max fee):", ethers.formatEther(gas * gasPrice), "ETH");
  if (Math.abs(implied / Number(nav) - 1) > 1e-6) throw new Error("implied price does not round-trip to NAV");
  if (existing !== ethers.ZeroAddress) throw new Error(`pool already exists: ${existing} — not re-initialising`);
  if (bal < (gas * gasPrice * 12n) / 10n) throw new Error("insufficient deployer ETH for gas (need ~1.2x est cost)");

  if (process.env.DEPLOY !== "1") {
    console.log("\nPREFLIGHT ONLY — set DEPLOY=1 to broadcast. No transaction sent.");
    return;
  }

  console.log("\nBroadcasting createAndInitializePoolIfNecessary…");
  const tx = await nfpm.createAndInitializePoolIfNecessary(t0, t1, FEE, sqrtPriceX96);
  console.log("tx:", tx.hash);
  await tx.wait(2);

  const poolAddr: string = await factory.getPool(t0, t1, FEE);
  const pool = new ethers.Contract(poolAddr, POOL_ABI, provider);
  const slot0 = await pool.slot0();
  const live = usdcPerToken(BigInt(slot0[0]), tokenIsToken0, dec);
  console.log("\n=== CREATED ===");
  console.log("pool               :", poolAddr);
  console.log("slot0.sqrtPriceX96 :", slot0[0].toString(), "tick", slot0[1].toString());
  console.log("live price         :", live.toFixed(6), "USDC per", symbol);
  console.log("arbiscan           : https://arbiscan.io/address/" + poolAddr);
  if (poolAddr === ethers.ZeroAddress) throw new Error("pool not found after create");
  if (BigInt(slot0[0]) !== sqrtPriceX96) throw new Error("pool initialised at a different price");
  console.log("\nALL ASSERTIONS PASSED — pool exists at the NAV price, no liquidity added.");
}

main().catch((e) => { console.error(e); process.exit(1); });
