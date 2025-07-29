import { Module } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { PortfolioController } from './portfolio.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketDataModule } from '../market-data/market-data.module';

@Module({
  imports: [PrismaModule, MarketDataModule],
  controllers: [PortfolioController],
  providers: [PortfolioService],
  exports: [PortfolioService],
})
export class PortfolioModule {} 