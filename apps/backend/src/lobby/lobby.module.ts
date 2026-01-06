import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LobbyController } from './lobby.controller';
import { LobbyService } from './lobby.service';
import { LobbyGateway } from './lobby.gateway';
import { Lobby } from './entities/lobby.entity';
import { LobbyEntry } from './entities/lobby-entry.entity';
import { ProvablyFairService } from '../game/provably-fair.service';
import { KaspaModule } from '../kaspa/kaspa.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Lobby, LobbyEntry]),
    KaspaModule,
    UserModule,
  ],
  controllers: [LobbyController],
  providers: [LobbyService, LobbyGateway, ProvablyFairService],
  exports: [LobbyService],
})
export class LobbyModule {}
