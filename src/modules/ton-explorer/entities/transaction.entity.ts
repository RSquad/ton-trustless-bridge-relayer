import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Tree,
  TreeChildren,
  TreeParent,
  ManyToOne,
} from 'typeorm';
import { TonBlock } from './block.entity';

@Entity()
export class TonTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  account: string;

  @Column()
  hash: string;

  @Column()
  lt: string;

  @Column({ default: false })
  checked: boolean;

  @Column({ default: false })
  inprogress: boolean;

  @ManyToOne((type) => TonBlock, (tonBlock) => tonBlock.transactions, {
    cascade: ['insert', 'update'],
  })
  mcParent: TonBlock;
}
