import { mine, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { HardhatEthersSigner as Signer } from "@nomicfoundation/hardhat-ethers/signers";
import { expect, } from "chai";
import { ethers, network } from "hardhat";
import { Vault, IERC20, IERC20__factory } from "../typechain-types";

const whaleAddress = "0xc499FEA2c04101Aa2d99455a016b4eb6189F1fA9";
const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";

describe("Vault", function () {

  let owner: Signer, user1: Signer, user2: Signer, user3: Signer, user4: Signer, whale: Signer;
  let vault: Vault;
  let daiContract: IERC20, usdcContract: IERC20, usdtContract: IERC20;

  before(async () => {

    // Contracts are deployed using the first signer/account by default
    [owner, user1, user2, user3, user4] = await ethers.getSigners();

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [whaleAddress],
    });
    whale = await ethers.getSigner(whaleAddress);

    const Vault = await ethers.getContractFactory("Vault");
    vault = await Vault.deploy();

    daiContract = IERC20__factory.connect(DAI);
    usdcContract = IERC20__factory.connect(USDC);
    usdtContract = IERC20__factory.connect(USDT);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await vault.owner()).to.equal(owner.address);
    });

    it("Should live when first deployed", async function () {
      expect(await vault.isPaused()).to.equal(false);
    });
  });

  describe("Admin functionality", function () {

    it("Add/remove whitelisted assets", async function () {
      // Add USDC, USDT, DAI
      await vault.connect(owner)
        .addWhitelist(USDC);
      await vault.connect(owner)
        .addWhitelist(USDT);
      await vault.connect(owner)
        .addWhitelist(DAI);

      // Remove USDC from whitelist
      await vault.connect(owner)
        .removeWhitelist(USDC);
    });

    it("Try to deposit non-whitelist token", async function () {
      await expect(vault.connect(user1)
        .deposit(USDC, 1000))
        .to.be.revertedWith('Not whitelisted token');
    });

    it("Transfer ownership to other user", async function () {
      // Transfer ownership to user1
      await vault.connect(owner)
        .transferOwnership(user1.address);

      // Try to call unpause with old admin
      await expect(vault.connect(owner)
        .unpause())
        .to.be.revertedWith('Ownable: caller is not the owner');

      // Revert ownership to owner and make live for further test
      await vault.connect(user1)
        .transferOwnership(owner.address);

      await vault.connect(owner)
        .unpause();
    });

  })

  describe("Deposit token", function () {

    it("Deposit correct amount", async function () {
      const vaultAddress = await vault.getAddress();

      const depositAmount = ethers.parseUnits('100', 6); // 100$

      // Get some USDT from whale
      await usdtContract.connect(whale)
        .transfer(user1.address, depositAmount);

      // Approve amount before deposit
      await usdtContract.connect(user1)
        .approve(vaultAddress, depositAmount);

      // Deposit USDT
      await vault.connect(user1)
        .deposit(USDT, depositAmount);

      // Check vault balance
      const usdtBalance = await usdtContract.connect(owner)
        .balanceOf(vaultAddress);
      expect(usdtBalance).equals(depositAmount, "Vault balance not matched");
    });

    it("Try to deposit incorrect amount", async function () {
      // Try to deposit without approve token
      await expect(vault.connect(user2)
        .deposit(USDT, 1000))
        .to.be.revertedWith("SafeERC20: low-level call failed");
    });

    it("Try to deposit when paused", async function () {
      // Call paused
      await vault.connect(owner)
        .pause();

      // Should be failed
      await expect(vault.connect(user1)
        .deposit(USDT, 1000))
        .to.be.revertedWith('Deposit not allowed');

      await vault.connect(owner)
        .unpause();
    });

    it("Deposit by multi users", async function () {
      const vaultAddress = await vault.getAddress();

      const depositAmount = ethers.parseUnits('30', 18); // 30$
      for (const user of [user1, user2, user3]) {

        // Get some DAI from whale
        await daiContract.connect(whale)
          .transfer(user.address, depositAmount);

        // Approve amount before deposit
        await daiContract.connect(user)
          .approve(vaultAddress, depositAmount);

        // Deposit DAI
        await vault.connect(user)
          .deposit(DAI, depositAmount);
      }

      // Check vault balance
      const daiBalance = await daiContract.connect(owner)
        .balanceOf(vaultAddress);
      expect(daiBalance).equals(depositAmount * 3n, "Vault balance not matched");
    });
  })

  describe("Withdraw token", function () {

    it("Withdraw correct amount", async function () {
      const vaultAddress = await vault.getAddress();

      const withdrawAmount = ethers.parseUnits('100', 6); // 100$

      // Check balance before
      const vaultBalanceBefore = await usdtContract.connect(owner)
        .balanceOf(vaultAddress);
      const userBalanceBefore = await usdtContract.connect(user1)
        .balanceOf(user1.address);

      // Withdraw USDT
      await vault.connect(user1)
        .withdraw(USDT, withdrawAmount);

      // Check vault balance
      const vaultBalanceAfter = await usdtContract.connect(owner)
        .balanceOf(vaultAddress);
      const userBalanceAfter = await usdtContract.connect(user1)
        .balanceOf(user1.address);

      // User balance should be increased with correct amount
      expect(userBalanceAfter - userBalanceBefore).equals(withdrawAmount, "User balance not matched");
      // Vault balance should be decreased with correct amount
      expect(vaultBalanceBefore - vaultBalanceAfter).equals(withdrawAmount, "Vault balance not matched");
    });

    it("Try to withdraw with incorrect amount", async function () {
      const vaultAddress = await vault.getAddress();

      // Get user's current deposited amount
      const depositedAmount = await vault.connect(user1)
        .userInfos(user1.address, DAI);

      // Try to withdraw more than deposited amount
      await expect(vault.connect(user1)
        .withdraw(DAI, depositedAmount + 1n))
        .to.be.revertedWith('Insufficient token amount');
    });

    it("Try to withdraw when paused", async function () {
      // Call paused
      await vault.connect(owner)
        .pause();

      // Should be failed
      await expect(vault.connect(user1)
        .withdraw(USDC, 1000))
        .to.be.revertedWith('Withdraw not allowed');

      await vault.connect(owner)
        .unpause();
    });

    it("Withdraw by multi users", async function () {
      const vaultAddress = await vault.getAddress();

      for (const user of [user1, user2, user3]) {

        // Get deposited amount of each user
        const depositedAmount = await vault.connect(user)
          .userInfos(user.address, DAI);

        // Withdraw all DAI
        await vault.connect(user)
          .withdraw(DAI, depositedAmount);
      }

      // Check vault balance
      const daiBalance = await daiContract.connect(owner)
        .balanceOf(vaultAddress);
      expect(daiBalance).equals(0, "Vault balance not matched");
    });
  })

});
