const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  const Lobby = await ethers.getContractFactory("Lobby");
  const treasury = deployer.address; // Für Demo
  const lobby = await Lobby.deploy(treasury);

  await lobby.deployed();

  console.log("Lobby deployed to:", lobby.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });