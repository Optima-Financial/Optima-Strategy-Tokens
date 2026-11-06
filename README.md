# Optima Strategy Tokens

ERC20 tokens representing Optima trading-strategy positions on-chain. Each is a
**fixed-supply, zero-admin** token: the entire supply is minted once in the
constructor and there is **no owner, no mint function, no pause, no blacklist, and
no fee** — pure composition of [OpenZeppelin Contracts 5.1.0](https://github.com/OpenZeppelin/openzeppelin-contracts/tree/v5.1.0)
(`ERC20` + `ERC20Permit`, the version pinned in [`package.json`](package.json)) so the only custom code is the
constructor. OpenZeppelin publishes its own audits of the library, including its October 2023 audit of v5.0,
in [`audits/` at the v5.1.0 tag](https://github.com/OpenZeppelin/openzeppelin-contracts/tree/v5.1.0/audits).
This repository does not include a separate audit of the token contracts.

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

### OPSXRP — "Enhanced XRP Long Short Momentum"

The strategy's name, as the Optima API gives it. The deployed contract's ERC-20 `name()` is the earlier
"Enhanced XRP Perp Momentum": it is set in the constructor of a verified, immutable contract and cannot change.

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
