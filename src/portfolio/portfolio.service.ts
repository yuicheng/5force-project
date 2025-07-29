import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarketDataService } from '../market-data/market-data.service';

export interface PortfolioSummary {
  id: number;
  name: string;
  currency: string;
  totalValue: number;
  cashValue: number;
  investmentValue: number;
  accounts: AccountSummary[];
}

export interface AccountSummary {
  id: number;
  institutionName: string;
  accountName: string;
  accountType: string;
  balanceCurrent: number;
  holdings: HoldingSummary[];
}

export interface HoldingSummary {
  id: number;
  ticker: string;
  name: string;
  assetType: string;
  quantity: number;
  averageCostBasis: number;
  currentPrice: number | null;
  marketValue: number;
  unrealizedGainLoss: number;
  percentChange: number;
}

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  constructor(
    private prisma: PrismaService,
    private marketDataService: MarketDataService,
  ) {}

  /**
   * 根据用户名获取投资组合信息，按类型分组
   */
  async getPortfolioByUsername(username: string): Promise<PortfolioSummary> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        portfolio: {
          include: {
            accounts: {
              include: {
                holdings: {
                  include: {
                    asset: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.portfolio) {
      throw new NotFoundException(`Portfolio not found for user: ${username}`);
    }

    const portfolio = user.portfolio;
    let totalValue = 0;
    let cashValue = 0;
    let investmentValue = 0;

    // 收集所有持仓资产，检查哪些需要价格更新
    const allHoldings = portfolio.accounts.flatMap(account => 
      account.holdings.map(holding => ({
        holding,
        account,
        asset: holding.asset
      }))
    );

    // 检查哪些资产价格过期（超过1小时）
    const now = new Date();
    const priceThreshold = 60 * 60 * 1000; // 1小时
    
    const staleTickers = allHoldings
      .filter(({ asset }) => {
        if (!asset.ticker_symbol) return false;
        if (!asset.price_updated_at) return true;
        
        const ageInMs = now.getTime() - asset.price_updated_at.getTime();
        return ageInMs > priceThreshold;
      })
      .map(({ asset }) => asset.ticker_symbol)
      .filter((ticker): ticker is string => ticker !== null && ticker !== undefined)
      .filter((ticker, index, arr) => arr.indexOf(ticker) === index); // 去重

    // 批量更新过期的资产价格（只更新价格，不创建历史记录）
    if (staleTickers.length > 0) {
      this.logger.log(`Updating prices for ${staleTickers.length} stale assets: ${staleTickers.join(', ')}`);
      
      try {
        await this.updateAssetPricesOnly(staleTickers);
      } catch (error) {
        this.logger.error('Failed to update asset prices in batch', error);
        // 继续执行，使用缓存价格
      }
    }

    // 重新获取更新后的数据
    const updatedUser = await this.prisma.user.findUnique({
      where: { username },
      include: {
        portfolio: {
          include: {
            accounts: {
              include: {
                holdings: {
                  include: {
                    asset: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!updatedUser || !updatedUser.portfolio) {
      throw new NotFoundException(`Portfolio not found for user: ${username} after update`);
    }

    // 处理账户和持仓（现在使用最新的价格数据）
    const accounts: AccountSummary[] = updatedUser.portfolio.accounts.map((account) => {
      const holdings: HoldingSummary[] = account.holdings.map((holding) => {
        // 使用数据库中的最新价格，不再调用API
        const currentPrice = Number(holding.asset.current_price) || 0;
        const percentChange = Number(holding.asset.percent_change_today) || 0;

        const marketValue = Number(holding.quantity) * currentPrice;
        const unrealizedGainLoss =
          marketValue - Number(holding.quantity) * Number(holding.average_cost_basis);

        return {
          id: holding.id,
          ticker: holding.asset.ticker_symbol || 'N/A',
          name: holding.asset.name,
          assetType: holding.asset.asset_type,
          quantity: Number(holding.quantity),
          averageCostBasis: Number(holding.average_cost_basis),
          currentPrice,
          marketValue,
          unrealizedGainLoss,
          percentChange,
        };
      });

      const accountValue = Number(account.balance_current) + 
        holdings.reduce((sum, h) => sum + h.marketValue, 0);

      if (account.account_type === 'depository') {
        cashValue += accountValue;
      } else {
        investmentValue += accountValue;
      }

      totalValue += accountValue;

      return {
        id: account.id,
        institutionName: account.institution_name,
        accountName: account.account_name,
        accountType: account.account_type,
        balanceCurrent: Number(account.balance_current),
        holdings,
      };
    });

    return {
      id: portfolio.id,
      name: portfolio.name,
      currency: portfolio.currency,
      totalValue,
      cashValue,
      investmentValue,
      accounts,
    };
  }

  /**
   * 批量更新资产价格（仅更新价格，不创建历史记录）
   */
  private async updateAssetPricesOnly(tickers: string[]) {
    const promises = tickers.map(async (ticker) => {
      try {
        const marketData = await this.marketDataService.getAssetData(ticker);
        
        // 只更新价格，不触发历史记录创建
        await this.prisma.asset.updateMany({
          where: { ticker_symbol: ticker },
          data: {
            current_price: marketData.currentPrice,
            percent_change_today: marketData.percentChange,
            price_updated_at: new Date(),
          },
        });
        
        return { ticker, success: true };
      } catch (error) {
        this.logger.warn(`Failed to update price for ${ticker}:`, error.message);
        return { ticker, success: false, error: error.message };
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * 获取投资组合的Top 5涨跌幅股票
   */
  async getTopPerformers(username: string, limit: number = 5) {
    const portfolio = await this.getPortfolioByUsername(username);
    
    const allHoldings = portfolio.accounts.flatMap(account => account.holdings);
    
    // 按涨跌幅排序
    const sortedHoldings = allHoldings
      .filter(holding => holding.ticker !== 'N/A')
      .sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));

    const topGainers = sortedHoldings
      .filter(holding => holding.percentChange > 0)
      .slice(0, limit);

    const topLosers = sortedHoldings
      .filter(holding => holding.percentChange < 0)
      .slice(0, limit);

    return {
      topGainers,
      topLosers,
    };
  }

  /**
   * 获取投资组合历史表现
   */
  async getPortfolioHistory(username: string, days: number = 30) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        portfolio: {
          include: {
            history: {
              orderBy: { snapshot_date: 'desc' },
              take: days,
            },
          },
        },
      },
    });

    if (!user?.portfolio) {
      throw new NotFoundException(`Portfolio not found for user: ${username}`);
    }

    return user.portfolio.history.reverse(); // 按时间正序返回
  }

  /**
   * 刷新投资组合中所有资产的价格
   */
  async refreshPortfolioPrices(username: string) {
    const portfolio = await this.getPortfolioByUsername(username);
    
    const tickers = portfolio.accounts
      .flatMap(account => account.holdings)
      .map(holding => holding.ticker)
      .filter(ticker => ticker !== 'N/A');

    if (tickers.length === 0) {
      return { message: 'No assets to update' };
    }

    const results = await this.marketDataService.updateAssetPrices(tickers);
    
    return {
      message: 'Portfolio prices updated',
      results,
    };
  }
} 