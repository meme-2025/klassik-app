import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Lobby } from './lobby.entity';

@Entity('lobby_entries')
export class LobbyEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  lobbyId: string;

  @ManyToOne(() => Lobby)
  @JoinColumn({ name: 'lobbyId' })
  lobby: Lobby;

  @Column()
  userId: string;

  @Column({ nullable: true })
  socketId: string;

  @Column({ nullable: true, unique: true })
  depositTxId: string;

  @Column({ default: false })
  depositConfirmed: boolean;

  @Column('decimal', { precision: 18, scale: 8 })
  betAmount: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  cashoutMultiplier: number;

  @Column({ type: 'timestamp', nullable: true })
  cashoutTime: Date;

  @Column('decimal', { precision: 18, scale: 8, nullable: true })
  winAmount: number;

  @Column({ nullable: true })
  payoutTxId: string;

  @Column({ default: false })
  payoutConfirmed: boolean;

  @Column()
  status: 'pending' | 'active' | 'cashed_out' | 'lost' | 'completed';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
