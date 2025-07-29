import { Module } from '@nestjs/common';
import { HoldingsService } from './holdings.service';
import { HoldingsController } from './holdings.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketDataModule } from '../market-data/market-data.module';

@Module({
  imports: [PrismaModule, MarketDataModule],
  controllers: [HoldingsController],
  providers: [HoldingsService],
  exports: [HoldingsService],
})
export class HoldingsModule {} 