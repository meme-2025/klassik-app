import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('games')
export class Game {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  serverSeed: string;

  @Column()
  publicSeed: string;

  @Column('decimal', { precision: 10, scale: 2 })
  crashPoint: number;

  @Column({
    type: 'enum',
    enum: ['idle', 'waiting', 'running', 'crashed'],
    default: 'waiting',
  })
  state: string;

  @Column({ type: 'timestamp', nullable: true })
  startTime: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  endTime: Date | null;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  finalMultiplier: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
