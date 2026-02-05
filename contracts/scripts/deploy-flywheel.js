/**
 * Metals Flywheel Deployment Script
 * Deploy to Arbitrum One
 *
 * Usage:
 * npx hardhat run scripts/deploy-flywheel.js --network arbitrum
 */

const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying MetalsFlywheel to Arbitrum...\n");

  // Contract addresses on Arbitrum One
  const ARBITRUM_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // Native USDC
  const ZAPPER_X_BRIDGE = "0x978c5786cdb46b1519a9c1c4814e06d5956f6c64"; // ZapperX Bridge on Arbitrum
  const GROWTH_ENGINE_WALLET = "0x1449a7d9973e6215534d785e3e306261156eb610"; // PulseChain destination

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Deploy MetalsFlywheel
  const MetalsFlywheel = await hre.ethers.getContractFactory("MetalsFlywheel");

  const flywheel = await MetalsFlywheel.deploy(
    ARBITRUM_USDC,
    ZAPPER_X_BRIDGE,
    GROWTH_ENGINE_WALLET,
    deployer.address // Initially set deployer as trading bot
  );

  await flywheel.deployed();

  console.log("\n✅ MetalsFlywheel deployed to:", flywheel.address);
  console.log("\n📋 Configuration:");
  console.log("   USDC:", ARBITRUM_USDC);
  console.log("   ZapperX Bridge:", ZAPPER_X_BRIDGE);
  console.log("   Growth Engine Wallet:", GROWTH_ENGINE_WALLET);
  console.log("   Trading Bot:", deployer.address);
  console.log("   Flywheel %:", "5%");

  // Verify on Arbiscan
  console.log("\n🔍 Verifying contract on Arbiscan...");
  try {
    await hre.run("verify:verify", {
      address: flywheel.address,
      constructorArguments: [
        ARBITRUM_USDC,
        ZAPPER_X_BRIDGE,
        GROWTH_ENGINE_WALLET,
        deployer.address
      ],
    });
    console.log("✅ Contract verified!");
  } catch (error) {
    console.log("⚠️ Verification failed:", error.message);
  }

  // Log deployment summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 METALS FLYWHEEL DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log(`Contract Address: ${flywheel.address}`);
  console.log(`Network: Arbitrum One (Chain ID: 42161)`);
  console.log(`Block Number: ${await hre.ethers.provider.getBlockNumber()}`);
  console.log("=".repeat(60));

  return flywheel.address;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
