import { Controller, Get, Param } from '@nestjs/common';
import { ExplorerService } from '../../services/explorer/explorer.service';

@Controller('ton-explorer')
export class TonExplorerController {
  constructor(private readonly explorer: ExplorerService) {}

  @Get()
  findAll() {
    return this.explorer.findAllBlocks();
  }

  @Get('keyblocks')
  findAllKeyBlocks() {
    return this.explorer.findAllKeyBlocks();
  }

  @Get('checked')
  findAllCheckedBlocks() {
    return this.explorer.findAllValidatedBlocks();
  }

  @Get('demotx')
  findDemoTx() {
    return this.explorer.findLast5Transactions();
  }

  @Get('findtx/:hash')
  findTx(@Param('hash') hash: string) {
    return this.explorer.findTransactionByHash(hash);
  }
}
