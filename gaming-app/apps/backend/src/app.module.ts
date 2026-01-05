import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { GameModule } from './game/game.module';
import { UserModule } from './user/user.module';
import { KaspaModule } from './kaspa/kaspa.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        autoLoadEntities: true,
        synchronize: process.env.NODE_ENV !== 'production',
        logging: process.env.NODE_ENV === 'development',
        // Make connection optional for development without Docker
        retryAttempts: 3,
        retryDelay: 1000,
      }),
    }),
    ScheduleModule.forRoot(),
    GameModule,
    UserModule,
    KaspaModule,
  ],
})
export class AppModule {}
