# Data Flow — the data-transform view of THIS repo

Companion to `SERVICE-MAP.md`. The service map says *where things live and how
they connect* (structure). This says *what the data is, who owns its truth, and
how it is transformed* (semantics). Model the system as **data nodes** flowing
through **transforms**; tag each transform `pure` (reads only, safe to re-run) or
`effect` (writes state — needs idempotency + a compensation path). Read this
before designing a feature, changing a contract, or moving where truth lives.

> **Repo nature:** smart-contract artifact + deploy tooling. The only persistent
> "data" is on-chain ERC20 token state on Arbitrum One. There is no DB/queue/API.
> The dominant effect (deploy) is **irreversible and one-time** — there is no
> compensation, which is exactly why the script gates it behind preflight + assertions.

## Data nodes (what the data is + who owns its truth)
| Node | Shape / schema | Origin | Authority (system-of-record) | Class / governance |
|---|---|---|---|---|
| OPSBTC on-chain token state | ERC20 (`name`,`symbol`,`decimals=18`,`totalSupply=1e9*1e18`, `balanceOf`, allowances) + EIP-2612 permit (`DOMAIN_SEPARATOR`,`nonces`) | Minted once by `OPSBTC` constructor `OPSBTC.sol:22` | **Arbitrum One blockchain** (chain id 42161), contract `0xC6900e6CdeE6E46380289c0C854551F9896cbF5C` `README.md:16` | public (on-chain, immutable) |
| Supply recipient address | EVM address (`0x67cEccbd23d3a1F959F1282210E3f32F4AC13d83` default, or `RECIPIENT_ADDRESS` override) | `DEFAULT_RECIPIENT` constant `deployOpsbtc.ts:16`; env override `deployOpsbtc.ts:20` | The repo (constant) until overridden at deploy by env | internal (treasury/Ledger address; public once on-chain) |
| Deployer secrets | `PRIVATE_KEY`, `ARBITRUM_MAINNET_RPC_URL`, `ETHERSCAN_API_KEY` | Gitignored `.env` (template `.env.example:5-11`); read in `hardhat.config.ts:8-10` | Operator's local `.env` — **never** committed (`.gitignore`, `README.md:44-47`) | secret (gas-only deployer key) |
| Build artifacts | Solidity ABI/bytecode + typechain types | `hardhat compile` output → `artifacts/`, `cache/`, `typechain-types/` | Regenerated from `contracts/` — not a source of truth | internal (reproducible, gitignored) |

## Transform graph (data node → transform → data node)
Each step is `pure` or `effect`. Effects state idempotency + compensation.
```
contracts/OPSBTC.sol
   │  hardhat compile (pure: deterministic for fixed solc 0.8.27 + optimizer runs=1000)  ──►  ABI + bytecode (artifacts/)

.env secrets + recipient
   │  deploy preflight: chainId==42161 check, gas estimate vs balance≥1.2x (pure: read-only RPC, no tx)  ──►  preflight report  deployOpsbtc.ts:24-49
   │  Factory.deploy(recipient) (effect: IRREVERSIBLE one-time on-chain mint; NOT idempotent —
   │     re-running mints a NEW contract at a new address; NO compensation/undo. Guarded by
   │     DEPLOY=1 gate + post-deploy assertions, not by rollback)  ──►  OPSBTC on-chain token state  deployOpsbtc.ts:46-63
   │  post-deploy assert name/symbol/decimals/totalSupply, recipient==full supply, deployer==0
   │     (pure: read-back verification; throws on mismatch)  ──►  verified deployment  deployOpsbtc.ts:74-80

recipient holder (post-deploy)
   │  transfer / permit-approve (effect: standard ERC20, idempotent only in the trivial sense;
   │     no privileged reversal — no owner/pause/clawback exists)  ──►  updated balances  OPSBTC.sol:17 (ERC20/ERC20Permit)
```

## Validation rules (where data is checked, and what happens on violation)
| Rule | Locus | Action on violation | Enforced at |
|---|---|---|---|
| Deploy network MUST be Arbitrum One (chainId 42161) | `LOCAL` | reject — `throw "wrong chain"` before any tx | `deployOpsbtc.ts:26` |
| Deployer account MUST exist (PRIVATE_KEY set) | `LOCAL` | reject — `throw "no deployer account"` | `deployOpsbtc.ts:23` |
| Deployer ARB balance ≥ ~1.2× estimated gas cost | `LOCAL` | reject — `throw "insufficient deployer ARB for gas"` | `deployOpsbtc.ts:44` |
| Recipient address well-formed (checksummed) | `LOCAL` | reject — `ethers.getAddress(...)` throws on invalid | `deployOpsbtc.ts:20` |
| Broadcast gated behind explicit opt-in | `LOCAL` | default = preflight only, no tx unless `DEPLOY=1` | `deployOpsbtc.ts:46-49` |
| Post-deploy: name/symbol/decimals/totalSupply == expected | `GLOBAL` | reconcile against on-chain read-back; `throw` on any mismatch | `deployOpsbtc.ts:74-77` |
| Post-deploy: recipient holds 100% AND deployer holds 0 | `GLOBAL` | reconcile against on-chain read-back; `throw` on mismatch | `deployOpsbtc.ts:78-79` |
| Invariant: NO mint/owner/pause/blacklist function exists | `LOCAL` | test fails (CI gate) — supply must be immutable + admin-free | `OPSBTC.test.ts:26-33` |
| Invariant: full fixed supply to recipient, none to deployer | `LOCAL` | test fails | `OPSBTC.test.ts:16-24` |
| Invariant: EIP-2612 permit present (DOMAIN_SEPARATOR + nonces) | `LOCAL` | test fails | `OPSBTC.test.ts:35-39` |

> `LOCAL reject` = a transform refuses bad input at its own seam. `GLOBAL reconcile`
> = a discrepancy across nodes is resolved against the authority node, never by the
> first writer to win. Authority rulings live in `DECISIONS.md` — a transform that
> would move authority off a node of record **blocks and escalates**, never "fixes" it.
> Here the authority node is the Arbitrum One chain; the deploy script's GLOBAL checks
> read truth back from chain and throw rather than "repair" a bad deploy (there is no repair — it is irreversible).

---
_Add nodes/transforms/rules above this line. Cite a `file:line` or ruling for every
claim; mark unknowns explicitly — never guess origin, authority, or data class._
