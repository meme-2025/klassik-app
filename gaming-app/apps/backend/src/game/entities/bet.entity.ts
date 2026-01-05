import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Game } from './game.entity';

@Entity('bets')
export class Bet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  gameId: string;

  @Column()
  userId: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  autoCashout: number | null;

  @Column({ default: false })
  cashedOut: boolean;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  cashoutMultiplier: number | null;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  winAmount: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Game)
  @JoinColumn({ name: 'gameId' })
  game: Game;
}
