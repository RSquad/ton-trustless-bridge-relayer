import { Module } from '@nestjs/common';
import { BlockSubscriptionService } from './services/block-subscription/block-subscription.service';
import { TonExplorerController } from './controllers/ton-explorer/ton-explorer.controller';
import { ExplorerService } from './services/explorer/explorer.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [BlockSubscriptionService, ExplorerService],
  controllers: [TonExplorerController],
})
export class TonExplorerModule {}
