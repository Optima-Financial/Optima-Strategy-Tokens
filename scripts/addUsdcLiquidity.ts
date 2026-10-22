// Add a FULL-RANGE seed position to an existing Uniswap v3 <TOKEN>/USDC pool (fee 0.3 %) on Arbitrum One.
//
// The position is minted to the configured account (the deployer), which must already hold the token and the USDC.
// Full range: a small seed with no manager must stay in range whatever the price does; the uni-arb LP subsystem adds
// its own concentrated liquidity later.
//
// Guard: an EMPTY pool's price can be moved for free, so the script refuses unless the pool's live price is within
// PRICE_TOLERANCE (default 1 %) of EXPECT_PRICE_USD, and both amounts carry a 2 % minimum: a moved price reverts the mint.
//
// Read-only preflight by default. Set DEPLOY=1 to approve and mint.
//
//   TOKEN_ADDRESS=0x... TOKEN_AMOUNT=0.5 EXPECT_PRICE_USD=9.92180207 npx hardhat run scripts/addUsdcLiquidity.ts --network arbitrumOne
//   DEPLOY=1 ... (same) ...  # IRREVERSIBLE
import { ethers } from "hardhat";

const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const NFPM = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
const FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
const FEE = 3000;
const TICK_SPACING = 60;
const MIN_TICK = -887272;
const MAX_TICK = 887272;
const TICK_LOWER = Math.ceil(MIN_TICK / TICK_SPACING) * TICK_SPACING; // -887220
const TICK_UPPER = Math.floor(MAX_TICK / TICK_SPACING) * TICK_SPACING; // 887220

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address, address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
];
const FACTORY_ABI = ["function getPool(address, address, uint24) view returns (address)"];
const POOL_ABI = [
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)",
  "function liquidity() view returns (uint128)",
];
const NFPM_ABI = [
  "function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
  "function positions(uint256) view returns (uint96, address, address, address, uint24, int24, int24, uint128, uint256, uint256, uint128, uint128)",
  "event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
];

const Q192 = 2n ** 192n;

function toUnits(decimal: string, dec: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(decimal)) throw new Error(`not a positive decimal: ${decimal}`);
  return ethers.parseUnits(decimal, dec);
}

async function main() {
  const tokenAddr = ethers.getAddress(process.env.TOKEN_ADDRESS || "");
  const tokenAmountStr = process.env.TOKEN_AMOUNT || "";
  const expect = Number(process.env.EXPECT_PRICE_USD || "");
  const tol = Number(process.env.PRICE_TOLERANCE || "0.01");
  if (!(expect > 0)) throw new Error("EXPECT_PRICE_USD must be the per-token price the pool was initialised at");

  const [me] = await ethers.getSigners();
  if (!me) throw new Error("no deployer account — set PRIVATE_KEY");
  const provider = ethers.provider;
  if ((await provider.getNetwork()).chainId !== 42161n) throw new Error("wrong chain (want Arbitrum One 42161)");

  const token = new ethers.Contract(tokenAddr, ERC20_ABI, me);
  const usdc = new ethers.Contract(USDC, ERC20_ABI, me);
  const [symbol, decRaw] = await Promise.all([token.symbol(), token.decimals()]);
  const dec = Number(decRaw);
  const tokenIsToken0 = BigInt(tokenAddr) < BigInt(USDC);
  const [t0, t1] = tokenIsToken0 ? [tokenAddr, USDC] : [USDC, tokenAddr];

  const poolAddr: string = await new ethers.Contract(FACTORY, FACTORY_ABI, provider).getPool(t0, t1, FEE);
  if (poolAddr === ethers.ZeroAddress) throw new Error("no pool for this pair at fee 3000");
  const pool = new ethers.Contract(poolAddr, POOL_ABI, provider);
  const [slot0, liqBefore] = await Promise.all([pool.slot0(), pool.liquidity()]);
  const sqrtP = BigInt(slot0[0]);

  // Raw price = token1 per token0 in raw units = sqrtP² / 2^192. USDC per token, human:
  const rawP = Number(sqrtP * sqrtP) / Number(Q192);
  const usdcPerToken = tokenIsToken0 ? rawP * 10 ** (dec - 6) : 1 / (rawP * 10 ** (6 - dec));
  const drift = Math.abs(usdcPerToken / expect - 1);

  const tokenAmt = toUnits(tokenAmountStr, dec);
  // Full range: amount1 / amount0 = raw price (the range ends are ~0 and ~∞). USDC needed for tokenAmt, exact bigint:
  const usdcNeeded = tokenIsToken0 ? (tokenAmt * sqrtP * sqrtP) / Q192 : (tokenAmt * Q192) / (sqrtP * sqrtP);
  const usdcDesired = (usdcNeeded * 101n) / 100n; // a hair over: the token side is the one that binds
  const [amount0Desired, amount1Desired] = tokenIsToken0 ? [tokenAmt, usdcDesired] : [usdcDesired, tokenAmt];
  const [amount0Min, amount1Min] = tokenIsToken0
    ? [(tokenAmt * 98n) / 100n, (usdcNeeded * 98n) / 100n]
    : [(usdcNeeded * 98n) / 100n, (tokenAmt * 98n) / 100n];

  const [ethBal, tokBal, usdcBal] = await Promise.all([provider.getBalance(me.address), token.balanceOf(me.address), usdc.balanceOf(me.address)]);

  console.log(`=== ${symbol}/USDC full-range seed preflight (Arbitrum One) ===`);
  console.log("pool               :", poolAddr, "liquidity now", liqBefore.toString());
  console.log("live price         :", usdcPerToken.toFixed(6), "USDC per", symbol, `(expected ${expect}, drift ${(drift * 100).toFixed(4)} %)`);
  console.log("ticks              :", TICK_LOWER, "→", TICK_UPPER);
  console.log("token in           :", ethers.formatUnits(tokenAmt, dec), symbol, "(balance", ethers.formatUnits(tokBal, dec) + ")");
  console.log("USDC needed / cap  :", ethers.formatUnits(usdcNeeded, 6), "/", ethers.formatUnits(usdcDesired, 6), "(balance", ethers.formatUnits(usdcBal, 6) + ")");
  console.log("ETH                :", ethers.formatEther(ethBal));
  console.log("recipient          :", me.address);

  if (drift > tol) throw new Error(`pool price drifted ${(drift * 100).toFixed(4)} % from the expected price — not minting`);
  if (tokBal < tokenAmt) throw new Error(`not enough ${symbol} on the account`);
  if (usdcBal < usdcDesired) throw new Error("not enough USDC on the account");

  if (process.env.DEPLOY !== "1") {
    console.log("\nPREFLIGHT ONLY — set DEPLOY=1 to approve and mint. No transaction sent.");
    return;
  }

  for (const [c, need, name] of [[token, tokenAmt, symbol], [usdc, usdcDesired, "USDC"]] as const) {
    const allowance: bigint = await c.allowance(me.address, NFPM);
    if (allowance < need) {
      const tx = await c.approve(NFPM, need);
      console.log(`approve ${name}:`, tx.hash);
      await tx.wait(1);
    }
  }

  const nfpm = new ethers.Contract(NFPM, NFPM_ABI, me);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  const tx = await nfpm.mint({
    token0: t0, token1: t1, fee: FEE, tickLower: TICK_LOWER, tickUpper: TICK_UPPER,
    amount0Desired, amount1Desired, amount0Min, amount1Min, recipient: me.address, deadline,
  });
  console.log("mint tx            :", tx.hash);
  const rc = await tx.wait(2);

  let tokenId: bigint | null = null;
  for (const log of rc!.logs) {
    try {
      const parsed = nfpm.interface.parseLog(log);
      if (parsed?.name === "IncreaseLiquidity") {
        tokenId = BigInt(parsed.args.tokenId);
        console.log("IncreaseLiquidity  : tokenId", tokenId.toString(), "liquidity", parsed.args.liquidity.toString(),
          "amount0", parsed.args.amount0.toString(), "amount1", parsed.args.amount1.toString());
      }
    } catch { /* not an NFPM event */ }
  }
  if (tokenId === null) throw new Error("no IncreaseLiquidity event in the receipt");
  const pos = await nfpm.positions(tokenId);
  const [liqAfter, slotAfter] = await Promise.all([pool.liquidity(), pool.slot0()]);
  console.log("\n=== MINTED ===");
  console.log("position NFT       :", tokenId.toString(), "ticks", pos[5].toString(), pos[6].toString(), "liquidity", pos[7].toString());
  console.log("pool liquidity     :", liqAfter.toString(), "(was", liqBefore.toString() + ")");
  console.log("pool sqrtPriceX96  :", slotAfter[0].toString(), slotAfter[0] === slot0[0] ? "(unchanged)" : "(MOVED)");
  console.log("uniswap            : https://app.uniswap.org/positions/v3/arbitrum/" + tokenId.toString());
  if (BigInt(liqAfter) <= BigInt(liqBefore)) throw new Error("pool liquidity did not rise");
}

main().catch((e) => { console.error(e); process.exit(1); });
