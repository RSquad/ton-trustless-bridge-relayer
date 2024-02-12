import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { IBeacon, IExecution } from 'src/modules/eth-beacon/beacon/normalize-beacon/index.js';

@Injectable()
export class EthBeaconService {
  constructor(
    private prisma: PrismaService
  ) {}

  async createBeacon<T extends IBeacon, E extends IExecution>(
    beacon: T,
    execution: IExecution,
    executionBranch: string[],
    isFinality: boolean = false
  ) {
    const exists = await this.prisma.beacon.findFirst({
      where: {
        selfHash: beacon.selfHash
      }
    });

    if (exists) {
      if (isFinality) {
        const createdBeacon = await this.prisma.beacon.update({
          where: {
            id: exists.id
          },
          data: {
            isFinality: true
          }
        });

        console.log('Finality flag updated');

        return createdBeacon;
      }
      return beacon;
    }


    const parent = await this.prisma.beacon.findFirst({
      where: {
        selfHash: beacon.parentRoot
      }
    })

    const parentId: number = parent ? parent.id : undefined;

    console.log('Parent:', parentId);
    const connect = !!parentId
      ? {
          Parent: {
            connect: {
              id: parentId,
            },
          },
        }
      : undefined;

    const createdBeacon = this.prisma.beacon.create({
      data: {
        ...beacon,
        ...connect
      }
    });

    const createdExecution = await this.prisma.execution.create({
      data: {
        ...execution,
        executionBranch1: executionBranch[0],
        executionBranch2: executionBranch[1],
        executionBranch3: executionBranch[2],
        executionBranch4: executionBranch[3],
        beacon: {
          connect: {
            id: (await createdBeacon).id
          }
        }
      }
    })
    return {beacon: createdBeacon, execution: createdExecution};
  }

  async findBySelfHash(hash: string) {
    console.log('HASH:', hash);
    const beacon = await this.prisma.beacon.findFirst({
      where: {
        // id: 198
        selfHash: hash
      }
    });

    return beacon;
  }

  async findNext(hash: string) {
    const beacon = await this.prisma.beacon.findFirst({
      where: {
        parentRoot: hash
      }
    });

    return beacon;
  }

  async findPrev(hash: string) {
    const beacon = await this.prisma.beacon.findFirst({
      where: {
        Child: {
          selfHash: hash
        }
      }
    });

    return beacon;
  }

  async findExecution(beaconId: number) {
    const execution = await this.prisma.execution.findFirst({
      where: {
        beaconId
      }
    });

    return execution;
  }
}
