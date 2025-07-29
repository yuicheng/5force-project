import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MarketDataModule } from './market-data/market-data.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { AssetsModule } from './assets/assets.module';
import { TransactionsModule } from './transactions/transactions.module';
import { HoldingsModule } from './holdings/holdings.module';

@Module({
  imports: [
    PrismaModule,
    MarketDataModule,
    PortfolioModule,
    AssetsModule,
    TransactionsModule,
    HoldingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
