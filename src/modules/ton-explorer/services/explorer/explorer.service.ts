import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TonBlock } from '../../entities/block.entity';
import { IsNull, Not, Repository } from 'typeorm';
import { TonTransaction } from '../../entities/transaction.entity';

@Injectable()
export class ExplorerService {
  constructor(
    @InjectRepository(TonBlock)
    private blocksRepository: Repository<TonBlock>,
    @InjectRepository(TonTransaction)
    private transactionsRepository: Repository<TonTransaction>,
  ) {}

  findLast5Transactions() {
    return this.transactionsRepository.find({
      relations: {
        mcParent: {
          mcParent: true,
        },
      },
      where: {
        mcParent: Not(IsNull()),
      },
      order: { id: 'DESC' },
      take: 5,
    });
  }

  findAllBlocks() {
    return this.blocksRepository.find({
      relations: ['shards', 'transactions'],
      where: {
        workchain: -1,
      },
      order: { id: 'DESC' },
      take: 20,
    });
  }

  findAllKeyBlocks() {
    return this.blocksRepository.find({
      relations: ['shards', 'transactions'],
      where: {
        workchain: -1,
        isKeyBlock: true,
      },
      order: { id: 'DESC' },
      take: 20,
    });
  }

  findAllValidatedBlocks() {
    return this.blocksRepository.find({
      relations: ['shards', 'transactions'],
      where: {
        checked: true,
      },
      order: { id: 'DESC' },
      take: 20,
    });
  }

  findTransactionByHash(hash: string) {
    return this.transactionsRepository.find({
      relations: {
        mcParent: {
          mcParent: true,
        },
      },
      where: {
        hash: Buffer.from(hash, 'hex').toString('base64'),
      },
      order: { id: 'DESC' },
      take: 5,
    });
  }
}
