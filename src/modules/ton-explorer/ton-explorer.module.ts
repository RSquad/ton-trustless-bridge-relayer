import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TonBlock } from './entities/block.entity';
import { TonTransaction } from './entities/transaction.entity';
import { BlockSubscriptionService } from './services/block-subscription/block-subscription.service';
import { TonExplorerController } from './controllers/ton-explorer/ton-explorer.controller';
import { ExplorerService } from './services/explorer/explorer.service';

@Module({
  imports: [TypeOrmModule.forFeature([TonBlock, TonTransaction])],
  providers: [BlockSubscriptionService, ExplorerService],
  controllers: [TonExplorerController],
})
export class TonExplorerModule {}
