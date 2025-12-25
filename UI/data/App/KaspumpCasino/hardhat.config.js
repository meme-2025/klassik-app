require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-waffle");

module.exports = {
  solidity: "0.8.0",
  networks: {
    hardhat: {
      chainId: 1337
    },
    // Für Live: Kaspa Testnet hinzufügen, aber Hardhat ist Ethereum-basiert
    // kaspaTestnet: { ... }
  },
  paths: {
    scripts: "scripts"
  }
};