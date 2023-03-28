import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Tree,
  TreeChildren,
  TreeParent,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { TonTransaction } from './transaction.entity';

// workchain: number;
//         seqno: number;
//         shard: string;

@Entity()
export class TonBlock {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  workchain: number;

  @Column()
  seqno: number;

  @Column()
  shard: string;

  @Column()
  rootHash: string;

  @Column()
  fileHash: string;

  @Column({ default: false })
  checked: boolean;

  @Column({ default: false })
  inprogress: boolean;

  @Column({ default: false })
  isKeyBlock: boolean;

  @ManyToOne((type) => TonBlock, (tonBlock) => tonBlock.shards, {
    cascade: ['insert', 'update'],
  })
  mcParent: TonBlock;

  @OneToMany((type) => TonBlock, (tonBlock) => tonBlock.mcParent, {
    cascade: ['insert', 'update'],
  })
  shards: TonBlock[];

  @OneToMany(
    (type) => TonTransaction,
    (tonTransaction) => tonTransaction.mcParent,
    { cascade: ['insert', 'update'] },
  )
  transactions: TonTransaction[];
}
