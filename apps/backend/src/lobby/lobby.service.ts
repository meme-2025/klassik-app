import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lobby } from './entities/lobby.entity';
import { LobbyEntry } from './entities/lobby-entry.entity';
import { ProvablyFairService } from '../game/provably-fair.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LobbyService {
  private readonly logger = new Logger(LobbyService.name);
  private readonly buyInKas: number;
  private readonly maxPlayers: number;
  private readonly houseEdge: number;

  constructor(
    @InjectRepository(Lobby)
    private lobbyRepository: Repository<Lobby>,
    @InjectRepository(LobbyEntry)
    private entryRepository: Repository<LobbyEntry>,
    private provablyFairService: ProvablyFairService,
    private configService: ConfigService,
  ) {
    this.buyInKas = parseFloat(
      this.configService.get('MIN_BUY_IN_KAS') || '0.1',
    );
    this.maxPlayers = parseInt(
      this.configService.get('MAX_PLAYERS_PER_LOBBY') || '10',
    );
    this.houseEdge = parseFloat(
      this.configService.get('HOUSE_EDGE_PERCENT') || '2',
    ) / 100;
  }

  /**
   * Create a new lobby
   */
  async createLobby(): Promise<Lobby> {
    const { serverSeed, serverSeedHash, publicSeed, crashPoint } =
      this.provablyFairService.generateGame();

    const lobby = this.lobbyRepository.create({
      status: 'waiting',
      buyInKas: this.buyInKas,
      maxPlayers: this.maxPlayers,
      currentPlayers: 0,
      potKas: 0,
      crashPoint,
      serverSeed, // Will be revealed after game
      serverSeedHash, // Shown before game for verification
      publicSeed,
      houseEdge: this.houseEdge,
    });

    const saved = await this.lobbyRepository.save(lobby);
    this.logger.log(`✅ New lobby created: ${saved.id} (crash point: ${crashPoint}x)`);
    return saved;
  }

  /**
   * Find or create an available lobby
   */
  async findOrCreateAvailableLobby(): Promise<Lobby> {
    // Find a lobby that's waiting and not full
    let lobby = await this.lobbyRepository.findOne({
      where: { status: 'waiting' },
    });

    if (!lobby || lobby.currentPlayers >= lobby.maxPlayers) {
      lobby = await this.createLobby();
    }

    return lobby;
  }

  /**
   * Join a lobby (after payment confirmed)
   */
  async joinLobby(
    lobbyId: string,
    userId: string,
    socketId: string,
    txId: string,
  ): Promise<LobbyEntry> {
    const lobby = await this.lobbyRepository.findOne({
      where: { id: lobbyId },
    });

    if (!lobby) {
      throw new Error('Lobby not found');
    }

    if (lobby.status !== 'waiting') {
      throw new Error('Lobby is not accepting new players');
    }

    if (lobby.currentPlayers >= lobby.maxPlayers) {
      throw new Error('Lobby is full');
    }

    // Create entry
    const entry = this.entryRepository.create({
      lobbyId,
      userId,
      socketId,
      depositTxId: txId,
      depositConfirmed: true,
      betAmount: this.buyInKas,
      status: 'active',
    });

    await this.entryRepository.save(entry);

    // Update lobby
    lobby.currentPlayers += 1;
    lobby.potKas = parseFloat((lobby.potKas + this.buyInKas).toFixed(8));

    await this.lobbyRepository.save(lobby);

    this.logger.log(
      `✅ Player ${userId} joined lobby ${lobbyId} (${lobby.currentPlayers}/${lobby.maxPlayers})`,
    );

    return entry;
  }

  /**
   * Get lobby with entries
   */
  async getLobbyWithEntries(lobbyId: string) {
    const lobby = await this.lobbyRepository.findOne({
      where: { id: lobbyId },
    });

    const entries = await this.entryRepository.find({
      where: { lobbyId },
    });

    return { lobby, entries };
  }

  /**
   * Get all active lobbies
   */
  async getActiveLobbies() {
    return this.lobbyRepository.find({
      where: [{ status: 'waiting' }, { status: 'playing' }],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Record player cashout
   */
  async cashOut(
    entryId: string,
    multiplier: number,
  ): Promise<{ winAmount: number }> {
    const entry = await this.entryRepository.findOne({
      where: { id: entryId },
    });

    if (!entry || entry.status !== 'active') {
      throw new Error('Invalid entry or already cashed out');
    }

    const winAmount = parseFloat(
      (entry.betAmount * multiplier * (1 - this.houseEdge)).toFixed(8),
    );

    entry.status = 'cashed_out';
    entry.cashoutMultiplier = multiplier;
    entry.cashoutTime = new Date();
    entry.winAmount = winAmount;

    await this.entryRepository.save(entry);

    this.logger.log(
      `💰 Player cashed out at ${multiplier}x, won ${winAmount} KAS`,
    );

    return { winAmount };
  }

  /**
   * Mark players as lost when game crashes
   */
  async crashGame(lobbyId: string) {
    const entries = await this.entryRepository.find({
      where: { lobbyId, status: 'active' },
    });

    for (const entry of entries) {
      entry.status = 'lost';
      entry.winAmount = 0;
      await this.entryRepository.save(entry);
    }

    const lobby = await this.lobbyRepository.findOne({
      where: { id: lobbyId },
    });

    if (lobby) {
      lobby.status = 'finished';
      lobby.finishedAt = new Date();
      await this.lobbyRepository.save(lobby);
    }

    this.logger.log(`💥 Game crashed in lobby ${lobbyId}`);
  }

  /**
   * Start countdown for lobby
   */
  async startCountdown(lobbyId: string) {
    const lobby = await this.lobbyRepository.findOne({
      where: { id: lobbyId },
    });

    if (lobby && lobby.status === 'waiting') {
      lobby.status = 'countdown';
      lobby.countdownStartedAt = new Date();
      await this.lobbyRepository.save(lobby);
      this.logger.log(`⏱️  Countdown started for lobby ${lobbyId}`);
    }
  }

  /**
   * Start game
   */
  async startGame(lobbyId: string) {
    const lobby = await this.lobbyRepository.findOne({
      where: { id: lobbyId },
    });

    if (lobby) {
      lobby.status = 'playing';
      lobby.startedAt = new Date();
      await this.lobbyRepository.save(lobby);
      this.logger.log(`🎮 Game started in lobby ${lobbyId} (crash: ${lobby.crashPoint}x)`);
    }
  }
}
