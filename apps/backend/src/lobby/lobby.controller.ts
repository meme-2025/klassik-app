import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { LobbyService } from './lobby.service';

@Controller('lobby')
export class LobbyController {
  constructor(private readonly lobbyService: LobbyService) {}

  @Get()
  async getActiveLobbies() {
    return this.lobbyService.getActiveLobbies();
  }

  @Get('available')
  async getAvailableLobby() {
    return this.lobbyService.findOrCreateAvailableLobby();
  }

  @Get(':id')
  async getLobby(@Param('id') id: string) {
    return this.lobbyService.getLobbyWithEntries(id);
  }

  @Post(':id/join')
  async joinLobby(
    @Param('id') id: string,
    @Body() body: { userId: string; socketId: string; txId: string },
  ) {
    return this.lobbyService.joinLobby(
      id,
      body.userId,
      body.socketId,
      body.txId,
    );
  }
}
