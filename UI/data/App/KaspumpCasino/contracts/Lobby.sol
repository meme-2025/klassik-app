// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Lobby is ReentrancyGuard, Pausable, Ownable {
    struct LobbyData {
        address owner;
        uint256 maxPlayers;
        uint256 stake;
        address[] players;
        bool active;
        bytes32 commitHash;
        bytes reveal;
        uint256 roundId;
        mapping(address => uint256) claims; // player => multiplier
        uint256 totalPool;
        bool finalized;
    }

    mapping(uint256 => LobbyData) public lobbies;
    uint256 public lobbyCount;
    address public treasury;
    uint256 public constant PROTOCOL_FEE_BPS = 10; // 0.10%

    event LobbyCreated(uint256 indexed lobbyId, address owner, uint256 maxPlayers, uint256 stake);
    event PlayerJoined(uint256 indexed lobbyId, address player);
    event RoundCommitted(uint256 indexed lobbyId, bytes32 commitHash);
    event ClaimSubmitted(uint256 indexed lobbyId, address player, uint256 multiplier);
    event RoundRevealed(uint256 indexed lobbyId, bytes reveal);
    event RoundFinalized(uint256 indexed lobbyId, address[] winners, uint256[] payouts);

    constructor(address _treasury) {
        treasury = _treasury;
    }

    function createLobby(uint256 _maxPlayers, uint256 _stake) external whenNotPaused returns (uint256) {
        require(_maxPlayers >= 4 && _maxPlayers <= 10, "Invalid maxPlayers");
        require(_stake > 0, "Stake must be > 0");

        lobbyCount++;
        LobbyData storage lobby = lobbies[lobbyCount];
        lobby.owner = msg.sender;
        lobby.maxPlayers = _maxPlayers;
        lobby.stake = _stake;
        lobby.active = true;

        emit LobbyCreated(lobbyCount, msg.sender, _maxPlayers, _stake);
        return lobbyCount;
    }

    function joinLobby(uint256 _lobbyId) external payable whenNotPaused nonReentrant {
        LobbyData storage lobby = lobbies[_lobbyId];
        require(lobby.active, "Lobby not active");
        require(lobby.players.length < lobby.maxPlayers, "Lobby full");
        require(msg.value == lobby.stake, "Incorrect stake");

        lobby.players.push(msg.sender);
        lobby.totalPool += msg.value;

        emit PlayerJoined(_lobbyId, msg.sender);
    }

    function commitRound(uint256 _lobbyId, bytes32 _commitHash) external {
        LobbyData storage lobby = lobbies[_lobbyId];
        require(lobby.owner == msg.sender, "Only owner can commit");
        require(lobby.active && lobby.commitHash == bytes32(0), "Invalid state");

        lobby.commitHash = _commitHash;
        lobby.roundId = block.number; // Use block number for RNG

        emit RoundCommitted(_lobbyId, _commitHash);
    }

    function submitClaim(uint256 _lobbyId, uint256 _multiplier, bytes memory _signature) external {
        LobbyData storage lobby = lobbies[_lobbyId];
        require(lobby.active && lobby.commitHash != bytes32(0), "Round not started");
        require(lobby.claims[msg.sender] == 0, "Already claimed");

        // Verify signature (stub - in real impl, verify against player address)
        // For simplicity, assume valid

        lobby.claims[msg.sender] = _multiplier;

        emit ClaimSubmitted(_lobbyId, msg.sender, _multiplier);
    }

    function revealRound(uint256 _lobbyId, bytes memory _reveal) external {
        LobbyData storage lobby = lobbies[_lobbyId];
        require(lobby.owner == msg.sender, "Only owner can reveal");
        require(keccak256(_reveal) == lobby.commitHash, "Invalid reveal");

        lobby.reveal = _reveal;

        emit RoundRevealed(_lobbyId, _reveal);
    }

    function finalizeRound(uint256 _lobbyId) external nonReentrant {
        LobbyData storage lobby = lobbies[_lobbyId];
        require(lobby.active && lobby.reveal.length > 0, "Round not revealed");
        require(!lobby.finalized, "Already finalized");

        // Compute RNG from reveal + blockhash
        bytes32 rng = keccak256(abi.encodePacked(lobby.reveal, blockhash(lobby.roundId)));
        // Bust if rng < threshold (stub: no bust for simplicity)

        // Collect claimants
        address[] memory claimants = new address[](lobby.players.length);
        uint256 claimCount = 0;
        for (uint256 i = 0; i < lobby.players.length; i++) {
            if (lobby.claims[lobby.players[i]] > 0) {
                claimants[claimCount] = lobby.players[i];
                claimCount++;
            }
        }

        uint256 netPool = lobby.totalPool;
        uint256 fee = (netPool * PROTOCOL_FEE_BPS) / 10000;
        netPool -= fee;

        // Simple equal distribution
        uint256[] memory payouts = new uint256[](claimCount);
        if (claimCount > 0) {
            uint256 share = netPool / claimCount;
            for (uint256 i = 0; i < claimCount; i++) {
                payouts[i] = share;
                payable(claimants[i]).transfer(share);
            }
        }

        // Send fee to treasury
        payable(treasury).transfer(fee);

        lobby.finalized = true;
        lobby.active = false; // Reset for next round

        emit RoundFinalized(_lobbyId, claimants, payouts);
    }

    function withdraw(uint256 _lobbyId) external nonReentrant {
        LobbyData storage lobby = lobbies[_lobbyId];
        require(lobby.finalized, "Round not finalized");
        require(lobby.claims[msg.sender] > 0, "No claim");

        uint256 payout = lobby.claims[msg.sender]; // Simplified
        lobby.claims[msg.sender] = 0;
        payable(msg.sender).transfer(payout);
    }

    // Admin functions
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }
}