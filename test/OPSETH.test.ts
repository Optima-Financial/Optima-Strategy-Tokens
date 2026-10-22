import { expect } from "chai";
import { ethers } from "hardhat";

// Invariants of the fixed-supply, zero-admin OPSETH token.
describe("OPSETH", () => {
  const SUPPLY = 1_000_000_000n * 10n ** 18n;

  async function deploy() {
    const [deployer, recipient, other] = await ethers.getSigners();
    const OPSETH = await ethers.getContractFactory("OPSETH");
    const t: any = await OPSETH.deploy(recipient.address); // any: methods resolved at runtime (no typechain dep)
    await t.waitForDeployment();
    return { t, deployer, recipient, other };
  }

  it("mints the full fixed supply to the recipient, none to the deployer", async () => {
    const { t, deployer, recipient } = await deploy();
    expect(await t.name()).to.equal("Enhanced ETH Long Short Momentum");
    expect(await t.symbol()).to.equal("OPSETH");
    expect(await t.decimals()).to.equal(18);
    expect(await t.totalSupply()).to.equal(SUPPLY);
    expect(await t.balanceOf(recipient.address)).to.equal(SUPPLY);
    expect(await t.balanceOf(deployer.address)).to.equal(0n);
  });

  it("has no mint function and no owner (zero admin surface)", async () => {
    const { t } = await deploy();
    const iface = t.interface as any;
    for (const banned of ["mint", "owner", "pause", "blacklist"]) {
      const has = iface.fragments.some((f: any) => f.type === "function" && f.name === banned);
      expect(has, `unexpected ${banned}() — supply must be immutable + admin-free`).to.equal(false);
    }
  });

  it("supports EIP-2612 permit (has DOMAIN_SEPARATOR + nonces)", async () => {
    const { t, recipient } = await deploy();
    expect(await t.DOMAIN_SEPARATOR()).to.be.a("string");
    expect(await t.nonces(recipient.address)).to.equal(0n);
  });

  it("transfers normally", async () => {
    const { t, recipient, other } = await deploy();
    await t.connect(recipient).transfer(other.address, 1000n);
    expect(await t.balanceOf(other.address)).to.equal(1000n);
  });
});
