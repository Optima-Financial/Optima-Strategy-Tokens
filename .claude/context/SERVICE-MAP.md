# Service Map (compressed)

One line per component. For detail, open that service's `CLAUDE.md`. For message contracts, see the shared-models `CLAUDE.md`. Verify against code before acting; flag drift to knowledge-keeper.

> **Nature of this repo:** a Hardhat + Solidity **smart-contract artifact + deploy-tooling** repo — NOT a runtime service. It produces immutable on-chain ERC20 tokens (fixed-supply, zero-admin) for Optima trading strategies. There is no server, no DB, no queue, no long-running process. "Components" below are build/deploy artifacts, not services.

## Services
| Service | Lang | Role | In → Out |
|---|---|---|---|
| No runtime services | — | This repo deploys immutable on-chain ERC20 tokens; nothing runs persistently. | (build/deploy artifacts only — see rows below) |
| `contracts/OPSBTC.sol` | Solidity 0.8.27 | ERC20 + ERC20Permit token "Enhanced BTC Long Short Momentum"; entire 1e9 (18-dec) supply minted once in constructor to `recipient`, no owner/mint/pause/fee | `constructor(address recipient)` → on-chain token state (balances, totalSupply, EIP-2612 permit) `OPSBTC.sol:18-23` |
| `contracts/OPSXRP.sol` | Solidity 0.8.27 | ERC20 + ERC20Permit token "Enhanced XRP Perp Momentum"; same fixed-supply zero-admin pattern as OPSBTC. Deployed 2026-07-20 to `0x1ff1c0189df884d25d8221b93d77d910d894abcf` (Arbitrum One, tx `0x462661d0…316a38`), full supply to treasury `0x67cE…3d83` | `constructor(address recipient)` → on-chain token state `OPSXRP.sol:18-23` |
| `scripts/deployOpsxrp.ts` | TypeScript (Hardhat/ethers v6) | Mirror of deployOpsbtc.ts for OPSXRP (preflight default, `DEPLOY=1` broadcasts, post-deploy assertions) | `.env` (PRIVATE_KEY, RPC) + `RECIPIENT_ADDRESS` → deployed contract addr + assertions |
| `test/OPSXRP.test.ts` | TypeScript (Hardhat/chai) | Same invariant suite as OPSBTC.test.ts for OPSXRP | Hardhat in-memory chain → pass/fail |
| `contracts/OPSSOL.sol` | Solidity 0.8.27 | ERC20 + ERC20Permit token "Enhanced SOL Long Short Momentum"; same fixed-supply zero-admin pattern as OPSBTC/OPSXRP. Deployed 2026-08-19 to `0xb02E5F75d2cF987e70b3c553876cFaFE2A881003` (Arbitrum One, tx `0xa7f380e6…f05973`), full supply to treasury `0x67cE…3d83` | `constructor(address recipient)` → on-chain token state `OPSSOL.sol:18-23` |
| `scripts/deployOpssol.ts` | TypeScript (Hardhat/ethers v6) | Mirror of deployOpsxrp.ts for OPSSOL (preflight default, `DEPLOY=1` broadcasts, post-deploy assertions) | `.env` (PRIVATE_KEY, RPC) + `RECIPIENT_ADDRESS` → deployed contract addr + assertions |
| `test/OPSSOL.test.ts` | TypeScript (Hardhat/chai) | Same invariant suite as OPSBTC.test.ts for OPSSOL | Hardhat in-memory chain → pass/fail |
| `scripts/deployOpsbtc.ts` | TypeScript (Hardhat/ethers v6) | Read-only preflight by default (`DEPLOY=1` to broadcast); validates chain id 42161 + gas headroom, deploys, then asserts name/symbol/decimals/totalSupply and that recipient holds 100% / deployer holds 0 | `.env` (PRIVATE_KEY, RPC) + `RECIPIENT_ADDRESS` → deployed contract addr + post-deploy assertions `deployOpsbtc.ts:19-82` |
| `test/OPSBTC.test.ts` | TypeScript (Hardhat/chai) | Invariant tests: full supply to recipient/none to deployer; zero admin surface (no mint/owner/pause/blacklist fn); EIP-2612 permit present; transfers work | Hardhat in-memory chain → pass/fail `OPSBTC.test.ts:16-45` |
| `hardhat.config.ts` | TypeScript | Toolchain config: solc 0.8.27 (optimizer runs=1000), single `arbitrumOne` network (chainId 42161), Etherscan V2 verify key — all secrets from gitignored `.env` | `.env` → compile/deploy/verify config `hardhat.config.ts:12-26` |

## Cross-service contracts that silently break if drifted
- **Deployed OPSBTC address** `0xC6900e6CdeE6E46380289c0C854551F9896cbF5C` on Arbitrum One (`README.md:16`): any off-repo consumer (Optima basket/strategy services, UI) referencing this token must match this address + the immutable `name`/`symbol`/`decimals`/`totalSupply`. The contract is immutable — drift can only occur in consumers, never here.
- **Deployed OPSXRP address** `0x1ff1c0189df884d25d8221b93d77d910d894abcf` on Arbitrum One: same consumer-drift rule as OPSBTC. Prod OPS hot wallet (deposits/withdrawals) is `0x3bb7FdF829F978147770d226f5b79C63353Bf6Fe` (`token_distribution_wallets` "Arbitrum Mainnet Hot Wallet").
- **Deployed OPSSOL address** `0xb02E5F75d2cF987e70b3c553876cFaFE2A881003` on Arbitrum One (2026-08-19): same consumer-drift rule. Prod-registered in `portfolio_token_contracts` (row `cc4bbff2-…`, stored lowercase) bound to active retail pair `092a3644`; shares the same hot wallet. 10k float sent to hot wallet, remainder at treasury.
- **Default supply recipient** `0x67cEccbd23d3a1F959F1282210E3f32F4AC13d83` (Optima strategy treasury / Ledger) hardcoded as `DEFAULT_RECIPIENT` (`deployOpsbtc.ts:16`); the post-deploy assertion (`deployOpsbtc.ts:78`) requires this address holds the full supply. Changing it must be a deliberate `RECIPIENT_ADDRESS` override, not an edit.
- **Fixed supply constant** `1_000_000_000 * 10**18` is asserted identically in three places — contract `OPSBTC.sol:22`, deploy script `EXPECTED_SUPPLY` `deployOpsbtc.ts:17`, test `SUPPLY` `OPSBTC.test.ts:6`. All three must agree or the deploy/test guards fail.

## Infra & cross-cutting (fill in for this repo)
- **Transport**: none — no IPC/queue/sidecar. The only "transport" is an Arbitrum One JSON-RPC deploy transaction broadcast by the Hardhat script (`hardhat.config.ts:18-22`).
- **Stores**: source-of-truth is the **Arbitrum One blockchain** (chain id 42161) holding deployed token state; no off-chain DB or object store. Local `artifacts/` + `cache/` + `typechain-types/` are generated compiler outputs (gitignored, reproducible).
- **DB access rule**: N/A — no database. The equivalent invariant: **never add an owner/mint/pause/fee path** to the contract; supply immutability + zero admin surface is enforced by `test/OPSBTC.test.ts:26-33` and is the core security property (`README.md:44-47`).

---
_Add components above this line. Cite a `file:line` or ruling for every claim; verify against code before acting._
