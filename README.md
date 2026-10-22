# Optima Strategy Tokens

ERC20 tokens representing Optima trading-strategy positions on-chain. Each is a
**fixed-supply, zero-admin** token: the entire supply is minted once in the
constructor and there is **no owner, no mint function, no pause, no blacklist, and
no fee** — pure composition of audited [OpenZeppelin v5](https://github.com/OpenZeppelin/openzeppelin-contracts)
contracts (`ERC20` + `ERC20Permit`) so the only custom code is the constructor.

## Tokens

### OPSBTC — "Enhanced BTC Long Short Momentum"

| | |
|---|---|
| Network | **Arbitrum One** (chain id 42161) |
| Contract | [`0xC6900e6CdeE6E46380289c0C854551F9896cbF5C`](https://arbiscan.io/address/0xC6900e6CdeE6E46380289c0C854551F9896cbF5C) |
| Symbol / decimals | `OPSBTC` / 18 |
| Total supply | 1,000,000,000 (fixed, minted at deploy) |
| Standard | ERC20 + ERC20Permit (EIP-2612) |
| Admin surface | none (no owner / mint / pause / fee) |

Source: [`contracts/OPSBTC.sol`](contracts/OPSBTC.sol).

### OPSXRP — "Enhanced XRP Perp Momentum"

| | |
|---|---|
| Network | **Arbitrum One** (chain id 42161) |
| Contract | [`0x1ff1c0189df884d25d8221b93d77d910d894abcf`](https://arbiscan.io/address/0x1ff1c0189df884d25d8221b93d77d910d894abcf) |
| Symbol / decimals | `OPSXRP` / 18 |
| Total supply | 1,000,000,000 (fixed, minted at deploy) |
| Standard | ERC20 + ERC20Permit (EIP-2612) |
| Admin surface | none (no owner / mint / pause / fee) |

Source: [`contracts/OPSXRP.sol`](contracts/OPSXRP.sol). Verified on
[Blockscout](https://arbitrum.blockscout.com/address/0x1ff1c0189df884d25d8221b93d77d910d894abcf);
Arbiscan verification pending a valid `ETHERSCAN_API_KEY`.

### OPLAI — "Optima AI Stocks Bull"

| | |
|---|---|
| Network | **Arbitrum One** (chain id 42161) |
| Contract | [`0x9d461962282731Ba81F66E27a2FDd54a4de4cC44`](https://arbiscan.io/address/0x9d461962282731Ba81F66E27a2FDd54a4de4cC44) |
| Deploy tx | [`0xc49323fd…5703`](https://arbiscan.io/tx/0xc49323fd98138c1dd894a82a1991f11b23ce87856545f3cfd252faafcd575703) (2026-10-22) |
| Symbol / decimals | `OPLAI` / 18 |
| Total supply | 1,000,000,000 (fixed, minted at deploy to `0x67cEccbd23d3a1F959F1282210E3f32F4AC13d83`) |
| Standard | ERC20 + ERC20Permit (EIP-2612) |
| Admin surface | none (no owner / mint / pause / fee) |

Source: [`contracts/OPLAI.sol`](contracts/OPLAI.sol). Verified on
[Sourcify](https://repo.sourcify.dev/42161/0x9d461962282731Ba81F66E27a2FDd54a4de4cC44) (exact match).

### OPSAI — "Optima AI Stocks Bear"

| | |
|---|---|
| Network | **Arbitrum One** (chain id 42161) |
| Contract | [`0xD81b95E18fe1670342821dD87a3721cc9Bbe8aF6`](https://arbiscan.io/address/0xD81b95E18fe1670342821dD87a3721cc9Bbe8aF6) |
| Deploy tx | [`0x287178ba…a99d`](https://arbiscan.io/tx/0x287178bad861f327df1227173d80b516bb0dd1c3a8eab8e765304965ee33a99d) (2026-10-22) |
| Symbol / decimals | `OPSAI` / 18 |
| Total supply | 1,000,000,000 (fixed, minted at deploy to `0x67cEccbd23d3a1F959F1282210E3f32F4AC13d83`) |
| Standard | ERC20 + ERC20Permit (EIP-2612) |
| Admin surface | none (no owner / mint / pause / fee) |

Source: [`contracts/OPSAI.sol`](contracts/OPSAI.sol). Verified on
[Sourcify](https://repo.sourcify.dev/42161/0xD81b95E18fe1670342821dD87a3721cc9Bbe8aF6) (exact match).

## Uniswap v3 pools

`scripts/createUsdcPool.ts` creates and initialises a `<TOKEN>/USDC` pool (0.3 %, as OPSBTC's) at the
token's NAV, with no liquidity; the uni-arb LP subsystem adds liquidity later. Preflight by default,
`DEPLOY=1` to broadcast:

```bash
TOKEN_ADDRESS=0x... NAV_USD=10158.52 npx hardhat run scripts/createUsdcPool.ts --network arbitrumOne
```

## Develop

```bash
npm install
npx hardhat compile
npx hardhat test
```

## Deploy (Arbitrum One)

1. `cp .env.example .env` and set `PRIVATE_KEY` (a gas-only deployer; the full supply
   mints to the recipient, not the deployer), `ARBITRUM_MAINNET_RPC_URL`, and
   `ETHERSCAN_API_KEY`. **Never commit `.env`.**
2. Preflight (no transaction): `npx hardhat run scripts/deployOpsbtc.ts --network arbitrumOne`
3. Deploy (irreversible): `DEPLOY=1 npx hardhat run scripts/deployOpsbtc.ts --network arbitrumOne`
4. Verify: `npx hardhat verify --network arbitrumOne <address> <recipient>`

The deploy script validates the chain id + gas headroom, then asserts the deployed
`name/symbol/decimals/totalSupply` and that the recipient holds 100% (deployer holds 0).

## Security

No secrets live in this repository. Deployer keys and RPC URLs are read from a
gitignored `.env` (template: `.env.example`). The tokens are immutable once deployed.
