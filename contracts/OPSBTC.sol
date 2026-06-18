// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title  OPSBTC — Optima "Enhanced BTC Long Short Momentum" strategy token
 * @notice Fixed-supply ERC20. The ENTIRE supply (1,000,000,000 tokens, 18 decimals)
 *         is minted exactly once, in the constructor, to `recipient`. There is no
 *         mint function, no owner, no pause, no blacklist, and no fee — the supply
 *         is immutable and no address has any privileged power over the token.
 * @dev    Pure composition of audited OpenZeppelin v5 contracts (ERC20 + ERC20Permit)
 *         plus the single unavoidable constructor _mint; ERC20Permit adds EIP-2612
 *         gasless approvals. decimals() is OZ's default (18).
 */
contract OPSBTC is ERC20, ERC20Permit {
    constructor(address recipient)
        ERC20("Enhanced BTC Long Short Momentum", "OPSBTC")
        ERC20Permit("Enhanced BTC Long Short Momentum")
    {
        _mint(recipient, 1_000_000_000 * 10 ** decimals());
    }
}
