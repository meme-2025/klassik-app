import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('kaspa_transactions')
export class KaspaTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  txId: string;

  @Column()
  type: 'deposit' | 'payout';

  @Column({ nullable: true })
  fromAddress: string;

  @Column({ nullable: true })
  toAddress: string;

  @Column('decimal', { precision: 18, scale: 8 })
  amountKas: number;

  @Column('bigint')
  amountSompi: number;

  @Column({ default: 0 })
  confirmations: number;

  @Column()
  status: 'pending' | 'confirmed' | 'failed';

  @Column({ nullable: true })
  lobbyId: string;

  @Column({ nullable: true })
  userId: string;

  @Column({ nullable: true })
  blockHash: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date;

  @Column('jsonb', { nullable: true })
  metadata: any;
}
