import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { PortfolioService } from '../src/portfolio/portfolio.service';
import { HoldingsService } from '../src/holdings/holdings.service';
import { TransactionsService } from '../src/transactions/transactions.service';
import { MarketDataService } from '../src/market-data/market-data.service';
import { AppModule } from '../src/app.module';
import * as fs from 'fs';
import * as path from 'path';

describe('Portfolio Trading Test', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let portfolioService: PortfolioService;
  let holdingsService: HoldingsService;
  let transactionsService: TransactionsService;
  let marketDataService: MarketDataService;

  const TEST_USERNAME = '5force';
  const TEST_TICKER = 'AAPL'; // 使用苹果股票作为测试
  const BACKUP_PATH = path.join(__dirname, '../test-backup.db');
  const ORIGINAL_DB_PATH = path.join(__dirname, '../prisma/dev.db');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    portfolioService = moduleFixture.get<PortfolioService>(PortfolioService);
    holdingsService = moduleFixture.get<HoldingsService>(HoldingsService);
    transactionsService = moduleFixture.get<TransactionsService>(TransactionsService);
    marketDataService = moduleFixture.get<MarketDataService>(MarketDataService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Portfolio Trading Operations', () => {
    let originalPortfolioValue: number;
    let testAccountId: number;
    let testAssetId: number;
    let originalHoldings: any[];
    let soldTicker: string; // 记录2.1中卖出的股票代码

    it('0. 测试前备份数据库', async () => {
      // 备份原始数据库
      if (fs.existsSync(ORIGINAL_DB_PATH)) {
        fs.copyFileSync(ORIGINAL_DB_PATH, BACKUP_PATH);
        console.log(`✅ 数据库已备份到: ${BACKUP_PATH}`);
      } else {
        console.log('⚠️  原始数据库文件不存在，跳过备份');
      }
    });

    it('1. 找到用户5force的portfolio并显示现在的净值', async () => {
      // 获取用户投资组合
      const portfolio = await portfolioService.getPortfolioByUsername(TEST_USERNAME);
      
      expect(portfolio).toBeDefined();
      expect(portfolio.name).toBeDefined();
      
      originalPortfolioValue = portfolio.totalValue;
      testAccountId = portfolio.accounts[0]?.id;
      
      console.log(`📊 用户 ${TEST_USERNAME} 的投资组合信息:`);
      console.log(`   投资组合名称: ${portfolio.name}`);
      console.log(`   总净值: $${originalPortfolioValue.toFixed(2)}`);
      console.log(`   现金价值: $${portfolio.cashValue.toFixed(2)}`);
      console.log(`   投资价值: $${portfolio.investmentValue.toFixed(2)}`);
      console.log(`   账户数量: ${portfolio.accounts.length}`);
      
      // 显示持仓信息
      portfolio.accounts.forEach((account, index) => {
        console.log(`   账户 ${index + 1}: ${account.institutionName} - ${account.accountName}`);
        console.log(`     账户余额: $${account.balanceCurrent.toFixed(2)}`);
        console.log(`     持仓数量: ${account.holdings.length}`);
        
        account.holdings.forEach((holding, hIndex) => {
          console.log(`     持仓 ${hIndex + 1}: ${holding.ticker} - ${holding.name}`);
          console.log(`       数量: ${holding.quantity}`);
          console.log(`       当前价格: $${holding.currentPrice}`);
          console.log(`       市值: $${holding.marketValue.toFixed(2)}`);
          console.log(`       未实现盈亏: $${holding.unrealizedGainLoss.toFixed(2)}`);
        });
      });

      // 保存原始持仓信息用于后续验证
      originalHoldings = portfolio.accounts.flatMap(account => account.holdings);
      
      expect(portfolio.accounts.length).toBeGreaterThan(0);
      expect(testAccountId).toBeDefined();
    });

    it('2.1 全仓卖出持有的某个股票', async () => {
      // 找到第一个有持仓的股票进行全仓卖出
      const holdings = await holdingsService.findByUsername(TEST_USERNAME);
      
      if (holdings.length === 0) {
        console.log('⚠️  用户没有持仓，跳过卖出测试');
        return;
      }

      const targetHolding = holdings[0];
      const ticker = targetHolding.asset.ticker_symbol;
      
      if (!ticker) {
        console.log('⚠️  持仓没有股票代码，跳过卖出测试');
        return;
      }

      // 记录卖出的股票代码，供2.3步骤使用
      soldTicker = ticker;

      console.log(`🔄 开始全仓卖出 ${ticker}`);
      console.log(`   原始持仓数量: ${targetHolding.quantity}`);

      // 使用新的统一卖出接口 - 不提供 quantity 参数表示全仓卖出
      const sellResult = await holdingsService.sellByTickerUnified({
        username: TEST_USERNAME,
        ticker: ticker
      });

      expect(sellResult.success).toBe(true);
      expect(sellResult.quantity).toBeGreaterThan(0);
      expect(sellResult.totalAmount).toBeGreaterThan(0);
      expect(sellResult.isFullSell).toBe(true);
      expect(sellResult.remainingHolding).toBeNull();

      console.log(`✅ 全仓卖出成功:`);
      console.log(`   卖出数量: ${sellResult.quantity}`);
      console.log(`   卖出价格: $${sellResult.sellPrice}`);
      console.log(`   总金额: $${sellResult.totalAmount.toFixed(2)}`);

      // 验证持仓已被删除
      const updatedHoldings = await holdingsService.findByUsername(TEST_USERNAME);
      const remainingHolding = updatedHoldings.find(h => 
        h.asset.ticker_symbol?.toLowerCase() === ticker.toLowerCase()
      );
      expect(remainingHolding).toBeUndefined();
    });

    it('2.2 部分卖出持有的某个股票', async () => {
      // 找到另一个有持仓的股票进行部分卖出
      const holdings = await holdingsService.findByUsername(TEST_USERNAME);
      
      if (holdings.length === 0) {
        console.log('⚠️  用户没有更多持仓，跳过部分卖出测试');
        return;
      }

      const targetHolding = holdings[0];
      const ticker = targetHolding.asset.ticker_symbol;
      const originalQuantity = Number(targetHolding.quantity);
      
      if (!ticker) {
        console.log('⚠️  持仓没有股票代码，跳过部分卖出测试');
        return;
      }

      // 计算部分卖出的数量（卖出50%）
      const sellQuantity = Math.floor(originalQuantity * 0.5);
      
      if (sellQuantity <= 0) {
        console.log('⚠️  持仓数量不足，跳过部分卖出测试');
        return;
      }

      console.log(`🔄 开始部分卖出 ${ticker}`);
      console.log(`   原始持仓数量: ${originalQuantity}`);
      console.log(`   计划卖出数量: ${sellQuantity}`);

      // 使用新的统一卖出接口 - 提供 quantity 参数表示部分卖出
      const sellResult = await holdingsService.sellByTickerUnified({
        username: TEST_USERNAME,
        ticker: ticker,
        quantity: sellQuantity
      });

      expect(sellResult.remainingHolding).toBeDefined();
      expect(sellResult.totalAmount).toBeGreaterThan(0);
      expect(sellResult.isFullSell).toBe(false);
      expect(sellResult.quantity).toBe(sellQuantity);

      console.log(`✅ 部分卖出成功:`);
      console.log(`   卖出数量: ${sellQuantity}`);
      console.log(`   卖出价格: $${sellResult.sellPrice}`);
      console.log(`   总金额: $${sellResult.totalAmount.toFixed(2)}`);
      
      // 验证剩余持仓数量正确
      expect(sellResult.remainingHolding).not.toBeNull();
      expect(sellResult.remainingHolding).toBeDefined();
      
      const remainingHolding = sellResult.remainingHolding as any;
      console.log(`   剩余数量: ${remainingHolding?.quantity}`);
      expect(Number(remainingHolding.quantity)).toBe(originalQuantity - sellQuantity);
    });

    it('2.3 重新建仓2.1中的股票', async () => {
      // 重新买入之前在2.1中全仓卖出的股票
      if (!soldTicker) {
        console.log('⚠️  没有记录到2.1中卖出的股票，跳过重新建仓测试');
        return;
      }

      // 重新买入2.1中卖出的股票
      const buyQuantity = 10; // 买入10股

      console.log(`🔄 开始重新建仓2.1中卖出的股票: ${soldTicker}`);
      console.log(`   计划买入数量: ${buyQuantity}`);

      // 执行重新建仓
      const buyResult = await holdingsService.addToPortfolio({
        username: TEST_USERNAME,
        ticker: soldTicker,
        accountId: testAccountId,
        quantity: buyQuantity,
        description: `重新建仓2.1中卖出的 ${soldTicker}`
      });

      expect(buyResult.holding).toBeDefined();
      expect(buyResult.priceUsed).toBeGreaterThan(0);

      console.log(`✅ 重新建仓成功:`);
      console.log(`   重新建仓股票: ${soldTicker}`);
      console.log(`   买入数量: ${buyQuantity}`);
      console.log(`   买入价格: $${buyResult.priceUsed}`);
      console.log(`   总金额: $${(buyQuantity * buyResult.priceUsed).toFixed(2)}`);

      // 验证新的持仓已创建
      const updatedHoldings = await holdingsService.findByUsername(TEST_USERNAME);
      const newHolding = updatedHoldings.find(h => 
        h.asset.ticker_symbol?.toLowerCase() === soldTicker.toLowerCase()
      );
      expect(newHolding).toBeDefined();
      expect(newHolding).not.toBeUndefined();
      if (newHolding) {
        expect(Number(newHolding.quantity)).toBe(buyQuantity);
        console.log(`   验证通过: 新持仓数量为 ${newHolding.quantity}`);
      }
    });

    it('3. 确认transactions中存在这3笔交易', async () => {
      // 获取用户的所有交易记录
      const transactions = await transactionsService.findByUsername(TEST_USERNAME);
      
      console.log(`📋 用户 ${TEST_USERNAME} 的交易记录:`);
      console.log(`   总交易数量: ${transactions.length}`);

      // 获取最近的3笔交易（应该是我们刚才创建的）
      const recentTransactions = transactions.slice(0, 3);
      
      recentTransactions.forEach((transaction, index) => {
        console.log(`   交易 ${index + 1}:`);
        console.log(`     类型: ${transaction.transaction_type}`);
        console.log(`     日期: ${transaction.transaction_date}`);
        console.log(`     数量: ${transaction.quantity}`);
        console.log(`     单价: $${transaction.price_per_unit}`);
        console.log(`     总金额: $${transaction.total_amount}`);
        console.log(`     描述: ${transaction.description}`);
        if (transaction.asset) {
          console.log(`     资产: ${transaction.asset.ticker_symbol} - ${transaction.asset.name}`);
        }
      });

      // 验证至少有3笔交易
      expect(transactions.length).toBeGreaterThanOrEqual(3);

      // 验证交易类型
      const transactionTypes = recentTransactions.map(t => t.transaction_type);
      expect(transactionTypes).toContain('sell'); // 应该包含卖出交易
      expect(transactionTypes).toContain('buy');   // 应该包含买入交易（2.3步骤的重新建仓）
      
      // 统计交易类型
      const buyTransactions = transactionTypes.filter(t => t === 'buy');
      const sellTransactions = transactionTypes.filter(t => t === 'sell');
      console.log(`   买入交易数量: ${buyTransactions.length}`);
      console.log(`   卖出交易数量: ${sellTransactions.length}`);
    });

    it('4. 再次找到5force的portfolio并且确认平账', async () => {
      // 获取更新后的投资组合
      const updatedPortfolio = await portfolioService.getPortfolioByUsername(TEST_USERNAME);
      
      console.log(`📊 更新后的投资组合信息:`);
      console.log(`   总净值: $${updatedPortfolio.totalValue.toFixed(2)}`);
      console.log(`   现金价值: $${updatedPortfolio.cashValue.toFixed(2)}`);
      console.log(`   投资价值: $${updatedPortfolio.investmentValue.toFixed(2)}`);

      // 显示所有持仓
      updatedPortfolio.accounts.forEach((account, index) => {
        console.log(`   账户 ${index + 1}: ${account.institutionName} - ${account.accountName}`);
        console.log(`     账户余额: $${account.balanceCurrent.toFixed(2)}`);
        console.log(`     持仓数量: ${account.holdings.length}`);
        
        account.holdings.forEach((holding, hIndex) => {
          console.log(`     持仓 ${hIndex + 1}: ${holding.ticker} - ${holding.name}`);
          console.log(`       数量: ${holding.quantity}`);
          console.log(`       当前价格: $${holding.currentPrice}`);
          console.log(`       市值: $${holding.marketValue.toFixed(2)}`);
          console.log(`       未实现盈亏: $${holding.unrealizedGainLoss.toFixed(2)}`);
        });
      });

      // 验证投资组合结构完整
      expect(updatedPortfolio.totalValue).toBeGreaterThanOrEqual(0);
      expect(updatedPortfolio.cashValue).toBeGreaterThanOrEqual(0);
      expect(updatedPortfolio.investmentValue).toBeGreaterThanOrEqual(0);
      
      // 验证总净值计算正确
      const calculatedTotal = updatedPortfolio.cashValue + updatedPortfolio.investmentValue;
      expect(Math.abs(updatedPortfolio.totalValue - calculatedTotal)).toBeLessThan(0.01);

      console.log(`✅ 投资组合平账验证通过`);
    });

    it('5. 恢复数据库', async () => {
      // 关闭Prisma连接
      await prismaService.$disconnect();
      
      // 恢复原始数据库
      if (fs.existsSync(BACKUP_PATH)) {
        fs.copyFileSync(BACKUP_PATH, ORIGINAL_DB_PATH);
        console.log(`✅ 数据库已从备份恢复: ${ORIGINAL_DB_PATH}`);
        
        // 删除备份文件
        fs.unlinkSync(BACKUP_PATH);
        console.log(`🗑️  备份文件已删除`);
      } else {
        console.log('⚠️  备份文件不存在，跳过恢复');
      }
    });
  });
}); 