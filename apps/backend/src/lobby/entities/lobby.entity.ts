import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('lobbies')
export class Lobby {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  status: 'waiting' | 'countdown' | 'playing' | 'finished';

  @Column('decimal', { precision: 18, scale: 8, default: 0.1 })
  buyInKas: number;

  @Column({ default: 10 })
  maxPlayers: number;

  @Column({ default: 0 })
  currentPlayers: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  potKas: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  crashPoint: number;

  @Column({ nullable: true })
  serverSeed: string;

  @Column({ nullable: true })
  serverSeedHash: string;

  @Column({ nullable: true })
  publicSeed: string;

  @Column('decimal', { precision: 5, scale: 4, default: 0.02 })
  houseEdge: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  countdownStartedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  finishedAt: Date;
}
