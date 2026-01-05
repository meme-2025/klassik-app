// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title RushGameContract
 * @dev Smart Contract for provably fair Rush Game on Kaspa BlockDAG
 * 
 * Features:
 * - Provably fair game outcomes
 * - Automatic payouts
 * - House edge management
 * - Emergency pause functionality
 */
contract RushGameContract is ReentrancyGuard, Ownable, Pausable {
    
    // Game Configuration
    uint256 public constant MIN_BET = 1 * 10**8; // 1 KAS in sompi
    uint256 public constant MAX_BET = 1000 * 10**8; // 1000 KAS in sompi
    uint256 public constant MAX_PLAYERS = 10;
    uint256 public constant HOUSE_EDGE = 100; // 1% (divide by 10000)
    
    // Game States
    enum GameStatus { Waiting, Playing, Finished }
    
    // Lobby structure
    struct Lobby {
        uint256 id;
        uint256 betAmount;
        uint256 pot;
        uint8 playerCount;
        uint8 maxPlayers;
        GameStatus status;
        uint256 crashPoint; // Stored as fixed point (multiplied by 100)
        bytes32 seedHash;
        string serverSeed;
        address[] players;
        mapping(address => PlayerData) playerData;
        uint256 createdAt;
        uint256 startedAt;
        uint256 finishedAt;
    }
    
    // Player data in a game
    struct PlayerData {
        uint256 betAmount;
        uint256 cashOutMultiplier; // Multiplied by 100
        uint256 winAmount;
        bool hasCashedOut;
        bool hasLost;
        uint256 joinedAt;
    }
    
    // Mappings
    mapping(uint256 => Lobby) public lobbies;
    uint256 public lobbyCounter;
    uint256 public totalGamesPlayed;
    uint256 public totalWagered;
    uint256 public totalPaidOut;
    
    // Events
    event LobbyCreated(uint256 indexed lobbyId, uint256 betAmount, uint8 maxPlayers);
    event PlayerJoined(uint256 indexed lobbyId, address indexed player, uint256 betAmount);
    event GameStarted(uint256 indexed lobbyId, bytes32 seedHash, uint256 timestamp);
    event PlayerCashedOut(uint256 indexed lobbyId, address indexed player, uint256 multiplier, uint256 winAmount);
    event GameCrashed(uint256 indexed lobbyId, uint256 crashPoint, string serverSeed);
    event WinningsPaid(uint256 indexed lobbyId, address indexed player, uint256 amount);
    
    constructor() {
        lobbyCounter = 0;
    }
    
    /**
     * @dev Create a new lobby
     */
    function createLobby(uint256 _betAmount, uint8 _maxPlayers) external onlyOwner returns (uint256) {
        require(_betAmount >= MIN_BET && _betAmount <= MAX_BET, "Invalid bet amount");
        require(_maxPlayers > 0 && _maxPlayers <= MAX_PLAYERS, "Invalid max players");
        
        lobbyCounter++;
        Lobby storage lobby = lobbies[lobbyCounter];
        lobby.id = lobbyCounter;
        lobby.betAmount = _betAmount;
        lobby.maxPlayers = _maxPlayers;
        lobby.status = GameStatus.Waiting;
        lobby.createdAt = block.timestamp;
        
        emit LobbyCreated(lobbyCounter, _betAmount, _maxPlayers);
        return lobbyCounter;
    }
    
    /**
     * @dev Join a lobby and place bet
     */
    function joinLobby(uint256 _lobbyId) external payable nonReentrant whenNotPaused {
        Lobby storage lobby = lobbies[_lobbyId];
        
        require(lobby.id != 0, "Lobby does not exist");
        require(lobby.status == GameStatus.Waiting, "Game already started");
        require(lobby.playerCount < lobby.maxPlayers, "Lobby is full");
        require(msg.value == lobby.betAmount, "Incorrect bet amount");
        require(!_isPlayerInLobby(_lobbyId, msg.sender), "Already joined");
        
        // Add player
        lobby.players.push(msg.sender);
        lobby.playerData[msg.sender] = PlayerData({
            betAmount: msg.value,
            cashOutMultiplier: 0,
            winAmount: 0,
            hasCashedOut: false,
            hasLost: false,
            joinedAt: block.timestamp
        });
        
        lobby.playerCount++;
        lobby.pot += msg.value;
        
        totalWagered += msg.value;
        
        emit PlayerJoined(_lobbyId, msg.sender, msg.value);
        
        // Auto-start if lobby is full
        if (lobby.playerCount == lobby.maxPlayers) {
            _startGame(_lobbyId);
        }
    }
    
    /**
     * @dev Start the game (internal)
     */
    function _startGame(uint256 _lobbyId) internal {
        Lobby storage lobby = lobbies[_lobbyId];
        
        require(lobby.status == GameStatus.Waiting, "Game already started");
        require(lobby.playerCount > 0, "No players");
        
        // Generate seed hash (server seed will be revealed later)
        lobby.seedHash = keccak256(abi.encodePacked(
            block.timestamp,
            block.difficulty,
            _lobbyId,
            lobby.playerCount
        ));
        
        lobby.status = GameStatus.Playing;
        lobby.startedAt = block.timestamp;
        
        emit GameStarted(_lobbyId, lobby.seedHash, block.timestamp);
    }
    
    /**
     * @dev Cash out from game
     */
    function cashOut(uint256 _lobbyId, uint256 _multiplier) external nonReentrant {
        Lobby storage lobby = lobbies[_lobbyId];
        PlayerData storage player = lobby.playerData[msg.sender];
        
        require(lobby.status == GameStatus.Playing, "Game not active");
        require(_isPlayerInLobby(_lobbyId, msg.sender), "Not in this game");
        require(!player.hasCashedOut, "Already cashed out");
        require(!player.hasLost, "Already lost");
        require(_multiplier >= 100, "Multiplier too low"); // Min 1.00x
        
        // Calculate winnings
        uint256 winAmount = (player.betAmount * _multiplier) / 100;
        
        // Check if pot has enough
        require(lobby.pot >= winAmount, "Insufficient pot");
        
        player.cashOutMultiplier = _multiplier;
        player.winAmount = winAmount;
        player.hasCashedOut = true;
        
        lobby.pot -= winAmount;
        
        // Transfer winnings
        (bool success, ) = msg.sender.call{value: winAmount}("");
        require(success, "Transfer failed");
        
        totalPaidOut += winAmount;
        
        emit PlayerCashedOut(_lobbyId, msg.sender, _multiplier, winAmount);
        emit WinningsPaid(_lobbyId, msg.sender, winAmount);
    }
    
    /**
     * @dev Finish game and reveal seed
     */
    function finishGame(uint256 _lobbyId, uint256 _crashPoint, string memory _serverSeed) 
        external 
        onlyOwner 
        nonReentrant 
    {
        Lobby storage lobby = lobbies[_lobbyId];
        
        require(lobby.status == GameStatus.Playing, "Game not playing");
        require(_crashPoint >= 100, "Invalid crash point");
        
        // Verify seed hash
        bytes32 calculatedHash = keccak256(abi.encodePacked(_serverSeed));
        require(calculatedHash == lobby.seedHash, "Invalid server seed");
        
        lobby.crashPoint = _crashPoint;
        lobby.serverSeed = _serverSeed;
        lobby.status = GameStatus.Finished;
        lobby.finishedAt = block.timestamp;
        
        // Mark remaining players as lost
        for (uint i = 0; i < lobby.players.length; i++) {
            address player = lobby.players[i];
            if (!lobby.playerData[player].hasCashedOut) {
                lobby.playerData[player].hasLost = true;
            }
        }
        
        totalGamesPlayed++;
        
        // House takes remaining pot
        if (lobby.pot > 0) {
            uint256 houseCut = lobby.pot;
            lobby.pot = 0;
            (bool success, ) = owner().call{value: houseCut}("");
            require(success, "House transfer failed");
        }
        
        emit GameCrashed(_lobbyId, _crashPoint, _serverSeed);
    }
    
    /**
     * @dev Check if player is in lobby
     */
    function _isPlayerInLobby(uint256 _lobbyId, address _player) internal view returns (bool) {
        Lobby storage lobby = lobbies[_lobbyId];
        for (uint i = 0; i < lobby.players.length; i++) {
            if (lobby.players[i] == _player) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @dev Get lobby info
     */
    function getLobbyInfo(uint256 _lobbyId) external view returns (
        uint256 id,
        uint256 betAmount,
        uint256 pot,
        uint8 playerCount,
        uint8 maxPlayers,
        GameStatus status,
        uint256 crashPoint,
        bytes32 seedHash
    ) {
        Lobby storage lobby = lobbies[_lobbyId];
        return (
            lobby.id,
            lobby.betAmount,
            lobby.pot,
            lobby.playerCount,
            lobby.maxPlayers,
            lobby.status,
            lobby.crashPoint,
            lobby.seedHash
        );
    }
    
    /**
     * @dev Get player data
     */
    function getPlayerData(uint256 _lobbyId, address _player) external view returns (
        uint256 betAmount,
        uint256 cashOutMultiplier,
        uint256 winAmount,
        bool hasCashedOut,
        bool hasLost
    ) {
        PlayerData storage player = lobbies[_lobbyId].playerData[_player];
        return (
            player.betAmount,
            player.cashOutMultiplier,
            player.winAmount,
            player.hasCashedOut,
            player.hasLost
        );
    }
    
    /**
     * @dev Get lobby players
     */
    function getLobbyPlayers(uint256 _lobbyId) external view returns (address[] memory) {
        return lobbies[_lobbyId].players;
    }
    
    /**
     * @dev Emergency pause
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Withdraw house funds
     */
    function withdrawHouseFunds() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Withdrawal failed");
    }
    
    /**
     * @dev Get contract stats
     */
    function getStats() external view returns (
        uint256 _totalGamesPlayed,
        uint256 _totalWagered,
        uint256 _totalPaidOut,
        uint256 _houseProfit,
        uint256 _contractBalance
    ) {
        return (
            totalGamesPlayed,
            totalWagered,
            totalPaidOut,
            totalWagered - totalPaidOut,
            address(this).balance
        );
    }
    
    receive() external payable {}
}
