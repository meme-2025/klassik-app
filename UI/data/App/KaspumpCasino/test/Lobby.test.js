const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Lobby", function () {
  let Lobby, lobby, owner, addr1, addr2, treasury;

  beforeEach(async function () {
    [owner, addr1, addr2, treasury] = await ethers.getSigners();
    const LobbyFactory = await ethers.getContractFactory("Lobby");
    lobby = await LobbyFactory.deploy(treasury.address);
    await lobby.deployed();
  });

  it("Should create a lobby", async function () {
    await expect(lobby.createLobby(4, ethers.utils.parseEther("1")))
      .to.emit(lobby, "LobbyCreated")
      .withArgs(1, owner.address, 4, ethers.utils.parseEther("1"));
  });

  it("Should allow players to join", async function () {
    await lobby.createLobby(4, ethers.utils.parseEther("1"));
    await expect(lobby.connect(addr1).joinLobby(1, { value: ethers.utils.parseEther("1") }))
      .to.emit(lobby, "PlayerJoined")
      .withArgs(1, addr1.address);
  });

  it("Should commit round", async function () {
    await lobby.createLobby(4, ethers.utils.parseEther("1"));
    const commitHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("secret"));
    await expect(lobby.commitRound(1, commitHash))
      .to.emit(lobby, "RoundCommitted")
      .withArgs(1, commitHash);
  });

  it("Should submit claim", async function () {
    await lobby.createLobby(4, ethers.utils.parseEther("1"));
    await lobby.connect(addr1).joinLobby(1, { value: ethers.utils.parseEther("1") });
    const commitHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("secret"));
    await lobby.commitRound(1, commitHash);

    await expect(lobby.connect(addr1).submitClaim(1, 200, "0x"))
      .to.emit(lobby, "ClaimSubmitted")
      .withArgs(1, addr1.address, 200);
  });

  it("Should reveal and finalize round", async function () {
    await lobby.createLobby(4, ethers.utils.parseEther("1"));
    await lobby.connect(addr1).joinLobby(1, { value: ethers.utils.parseEther("1") });
    const secret = "secret";
    const commitHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(secret));
    await lobby.commitRound(1, commitHash);

    await lobby.connect(addr1).submitClaim(1, 200, "0x");

    await expect(lobby.revealRound(1, ethers.utils.toUtf8Bytes(secret)))
      .to.emit(lobby, "RoundRevealed");

    await expect(lobby.finalizeRound(1))
      .to.emit(lobby, "RoundFinalized");
  });

  it("Should enforce protocol fee", async function () {
    await lobby.createLobby(4, ethers.utils.parseEther("100"));
    await lobby.connect(addr1).joinLobby(1, { value: ethers.utils.parseEther("100") });
    const secret = "secret";
    const commitHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(secret));
    await lobby.commitRound(1, commitHash);
    await lobby.connect(addr1).submitClaim(1, 200, "0x");
    await lobby.revealRound(1, ethers.utils.toUtf8Bytes(secret));

    const treasuryBalanceBefore = await ethers.provider.getBalance(treasury.address);
    await lobby.finalizeRound(1);
    const treasuryBalanceAfter = await ethers.provider.getBalance(treasury.address);

    // Fee: 100 * 0.001 = 0.1 ETH
    expect(treasuryBalanceAfter.sub(treasuryBalanceBefore)).to.equal(ethers.utils.parseEther("0.1"));
  });
});