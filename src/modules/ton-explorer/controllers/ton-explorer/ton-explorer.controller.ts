import { Controller, Get, Param, Query } from '@nestjs/common';
import { ExplorerService } from '../../services/explorer/explorer.service';

@Controller('ton-explorer')
export class TonExplorerController {
  constructor(private readonly explorer: ExplorerService) {}

  @Get('count')
  allblockscount() {
    return this.explorer.countAllBlocks();
  }

  @Get()
  findAll(@Query('skip') skip: string) {
    return this.explorer.findAllBlocks(+(skip || '0'));
  }

  @Get('keyblocks')
  findAllKeyBlocks() {
    return this.explorer.findAllKeyBlocks();
  }

  @Get('checkedcount')
  allcheckedblockscount() {
    return this.explorer.countValidatedBlocks();
  }

  @Get('checked')
  findAllCheckedBlocks(@Query('skip') skip: string) {
    return this.explorer.findAllValidatedBlocks(+(skip || '0'));
  }

  @Get('demotx')
  findDemoTx() {
    return this.explorer.findLast5Transactions();
  }

  @Get('findtx/:hash')
  findTx(
    @Param('hash') hash: string,
    @Query('workchain') workchain: string,
    @Query('lt') lt: string,
  ) {
    return this.explorer.findTransactionByHash(hash, +workchain, +lt);
  }
}
