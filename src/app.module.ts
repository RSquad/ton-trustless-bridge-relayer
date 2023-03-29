import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TonExplorerModule } from './modules/ton-explorer/ton-explorer.module';
import { TonValidatorModule } from './modules/ton-validator/ton-validator.module';
import { EthProviderModule } from './modules/eth-provider/eth-provider.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HealthModule } from './modules/health/health.module';
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      synchronize: true,
      entities: ['**/*.entity{.ts,.js}'],
      url: process.env.DATABASE_URL,
    }),
    // TypeOrmModule.forRoot({
    //   type: 'sqlite',
    //   database: './data/data.db',
    //   entities: [__dirname + '/**/*.entity{.ts,.js}'],
    //   synchronize: true,
    //   // dropSchema: true,
    // }),
    // TypeOrmModule.forRoot(configService.getTypeOrmConfig()),
    TonExplorerModule,
    TonValidatorModule,
    EthProviderModule,
    EventEmitterModule.forRoot(),
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
