// Deployment script for Rush Game Smart Contract
const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying Rush Game Contract...");

  // Get the contract factory
  const RushGame = await hre.ethers.getContractFactory("RushGameContract");
  
  // Deploy the contract
  console.log("📦 Deploying contract...");
  const rushGame = await RushGame.deploy();

  await rushGame.deployed();

  console.log("✅ Rush Game Contract deployed to:", rushGame.address);

  // Create initial lobbies
  console.log("\n🏗️ Creating initial lobbies...");
  
  const betAmounts = [
    hre.ethers.utils.parseEther("10"),  // 10 KAS
    hre.ethers.utils.parseEther("50"),  // 50 KAS
    hre.ethers.utils.parseEther("100")  // 100 KAS
  ];

  for (let i = 0; i < betAmounts.length; i++) {
    const tx = await rushGame.createLobby(betAmounts[i], 10);
    await tx.wait();
    console.log(`✅ Lobby ${i + 1} created with ${hre.ethers.utils.formatEther(betAmounts[i])} KAS bet`);
  }

  // Display contract stats
  console.log("\n📊 Contract Information:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Contract Address: ${rushGame.address}`);
  console.log(`Min Bet: ${hre.ethers.utils.formatUnits(await rushGame.MIN_BET(), 8)} KAS`);
  console.log(`Max Bet: ${hre.ethers.utils.formatUnits(await rushGame.MAX_BET(), 8)} KAS`);
  console.log(`Max Players: ${await rushGame.MAX_PLAYERS()}`);
  console.log(`House Edge: ${await rushGame.HOUSE_EDGE() / 100}%`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Save deployment info
  const fs = require('fs');
  const deploymentInfo = {
    contractAddress: rushGame.address,
    network: hre.network.name,
    deployedAt: new Date().toISOString(),
    deployer: (await hre.ethers.getSigners())[0].address,
    minBet: hre.ethers.utils.formatUnits(await rushGame.MIN_BET(), 8),
    maxBet: hre.ethers.utils.formatUnits(await rushGame.MAX_BET(), 8),
    maxPlayers: (await rushGame.MAX_PLAYERS()).toString(),
    houseEdge: (await rushGame.HOUSE_EDGE() / 100).toString()
  };

  fs.writeFileSync(
    'rush-game-deployment.json',
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n💾 Deployment info saved to rush-game-deployment.json");
  
  // Verification instructions
  console.log("\n📝 To verify the contract, run:");
  console.log(`npx hardhat verify --network ${hre.network.name} ${rushGame.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
