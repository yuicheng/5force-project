import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as finnhub from 'finnhub';

interface FinnhubQuote {
  c: number; // Current price
  d: number; // Change
  dp: number; // Percent change
  h: number; // High price of the day
  l: number; // Low price of the day
  o: number; // Open price of the day
  pc: number; // Previous close price
  t: number; // Timestamp
}

interface FinnhubCompanyProfile {
  country: string;
  currency: string;
  exchange: string;
  ipo: string;
  marketCapitalization: number;
  name: string;
  phone: string;
  shareOutstanding: number;
  ticker: string;
  weburl: string;
  logo: string;
  finnhubIndustry: string;
}

export interface MarketData {
  ticker: string;
  name: string;
  currentPrice: number;
  percentChange: number;
  currency: string;
}

export interface DetailedMarketData extends MarketData {
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  previousClose: number;
  volume: number;
  timestamp: number;
}


@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);
  private readonly finnhubClient: finnhub.DefaultApi;

  constructor(private prisma: PrismaService) {
    const apiKey: string = 'd23qa31r01qv4g01pn60d23qa31r01qv4g01pn6g'; 
    this.finnhubClient = new finnhub.DefaultApi();
    this.finnhubClient.apiKey = apiKey;
  }

  async forceCheck(ticker: string): Promise<any> {
    return new Promise((resolve) => {
      this.finnhubClient.quote(ticker, (error: any, data: any) => {
        if (error) {
          resolve(false);
          this.logger.warn(`Failed: ${ticker}`, error);
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * Check if the ticker is valid in the real world
   */
  async validateTicker(ticker: string): Promise<boolean> {
    const cached = await this.getCachedAsset(ticker);
    
    if (cached) {
      return true;
    }

    return new Promise((resolve) => {
      this.finnhubClient.quote(ticker, (error: any, data: any) => {
        if (error) {
          this.logger.warn(`Invalid ticker: ${ticker}`, error);
          resolve(false);
        } else {
          resolve(!!data && !!data.c && data.c > 0);
        }
      });
    });
  }

  async getCachedAsset(ticker: string): Promise<any> {
    return await this.prisma.asset.findUnique({ where: { ticker_symbol: ticker } });
  }

  /**
   * Get company name from database or Finnhub company profile endpoint
   * @param ticker - 股票代码
   * @param cachedAsset - 可选的缓存资产，避免重复数据库查询
   */
  private async getCompanyName(ticker: string, cachedAsset?: any): Promise<string> {
    // Return if cached asset has name
    if (cachedAsset?.name) {
      return cachedAsset.name;
    }

    // If no cache is available get Company name from Finnhub
    if (!cachedAsset) {
      const cached = await this.getCachedAsset(ticker);
      if (cached?.name) {
        return cached.name;
      }
    }

    
    return new Promise((resolve) => {
      this.finnhubClient.companyProfile2({ symbol: ticker }, (error: any, data: any) => {
        if (error) {
          this.logger.warn(`Failed to get company name for ${ticker}`, error);
          resolve(ticker);
        } else {
          resolve(data?.name || ticker);
        }
      });
    });
  }

  /**
   * Get Asset Data from Finnhub
   * @returns MarketData object
   */
  async getAssetData(ticker: string): Promise<MarketData> {
    const cached = await this.getCachedAsset(ticker);
    
    // Check if cache is expired (1 hour)
    const isExpired = !cached?.price_updated_at || 
      (new Date().getTime() - cached.price_updated_at.getTime()) > 60 * 60 * 1000;
    
    if (cached && !isExpired) {
      this.logger.debug(`Using cached data for ${ticker}, updated ${cached.price_updated_at}`);
      return {
        ticker: ticker,
        name: cached.name,
        currentPrice: Number(cached.current_price),
        percentChange: Number(cached.percent_change_today || 0),
        currency: cached.currency,
      }
    }

    // Cache is expired or not exist, get new data from Finnhub
    return new Promise((resolve, reject) => {
      this.finnhubClient.quote(ticker, async (error: any, data: FinnhubQuote) => {
        if (error) {
          this.logger.error(`Failed to fetch data for ${ticker}`, error);
          
          // 如果API失败但有缓存数据，返回缓存数据作为后备
          if (cached) {
            this.logger.warn(`API failed for ${ticker}, using stale cached data`);
            resolve({
              ticker: ticker,
              name: cached.name,
              currentPrice: Number(cached.current_price),
              percentChange: Number(cached.percent_change_today || 0),
              currency: cached.currency,
            });
            return;
          }
          
          reject(new BadRequestException(`Failed to fetch data for ${ticker}`));
          return;
        }
        
        if (!data || !data.c || data.c <= 0) {
          reject(new BadRequestException(`No price data available for ${ticker}`));
          return;
        }

        try {
          // If cached asset is available, use its name, avoid extra API call
          let companyName = cached?.name;
          if (!companyName) {
            companyName = await this.getCompanyName(ticker, cached);
          }

          resolve({
            ticker: ticker,
            name: companyName,
            currentPrice: data.c,
            percentChange: data.dp || 0,
            currency: 'USD',
          });
        } catch (nameError) {
          // If company name fetch fails, still return the quote data
          resolve({
            ticker: ticker,
            name: cached?.name || ticker,
            currentPrice: data.c,
            percentChange: data.dp || 0,
            currency: 'USD',
          });
        }
      });
    });
  }

  /**
   * Get detailed market data including OHLCV from Finnhub
   * @description 这个方法一定会从Finnhub获取数据，不会使用缓存数据
   * @param ticker
   * @param cachedAsset 
   * @returns DetailedMarketData object with complete price information
   */
  async getDetailedAssetData(ticker: string, cachedAsset?: any): Promise<DetailedMarketData> {
    return new Promise((resolve, reject) => {
      this.finnhubClient.quote(ticker, async (error: any, data: FinnhubQuote) => {
        if (error) {
          this.logger.error(`Failed to fetch detailed data for ${ticker}`, error);
          reject(new BadRequestException(`Failed to fetch detailed data for ${ticker}`));
          return;
        }
        
        if (!data || !data.c || data.c <= 0) {
          reject(new BadRequestException(`No price data available for ${ticker}`));
          return;
        }

        try {
          // 优化：使用缓存资产信息获取公司名称，避免额外的数据库查询和API调用
          const companyName = await this.getCompanyName(ticker, cachedAsset);

          resolve({
            ticker: ticker,
            name: companyName,
            currentPrice: data.c,
            openPrice: data.o,
            highPrice: data.h,
            lowPrice: data.l,
            previousClose: data.pc,
            percentChange: data.dp || 0,
            volume: 0, // Finnhub quote doesn't include volume, would need separate endpoint
            timestamp: data.t,
            currency: 'USD',
          });
        } catch (nameError) {
          // If company name fetch fails, still return the quote data
          resolve({
            ticker: ticker,
            name: cachedAsset?.name || ticker,
            currentPrice: data.c,
            openPrice: data.o,
            highPrice: data.h,
            lowPrice: data.l,
            previousClose: data.pc,
            percentChange: data.dp || 0,
            volume: 0,
            timestamp: data.t,
            currency: 'USD',
          });
        }
      });
    });
  }

  /**
   * 更新或创建资产记录
   */
  async upsertAsset(ticker: string): Promise<any> {
    // 一次性获取缓存资产，避免重复查询
    const cachedAsset = await this.getCachedAsset(ticker);

    // 如果资产已缓存且在1小时内更新过，直接返回
    if (cachedAsset && cachedAsset.lastUpdated) {
      const threshold = new Date(Date.now() - 60 * 60 * 1000); // 1 Hour
      if (cachedAsset.lastUpdated > threshold) {
        this.logger.log(`Asset ${ticker} was updated within 60 minutes, skipping update`);
        return {
          ...cachedAsset,
          historyUpdated: false,
          historyCreated: false,
        };
      }
    }

    // 如果没有缓存资产，先验证ticker的有效性
    if (!cachedAsset) {
      const isValid = await this.validateTickerDirect(ticker);
      if (!isValid) {
        throw new BadRequestException(`Invalid ticker: ${ticker}`);
      }
    }

    // 获取详细市场数据
    const detailedMarketData = await this.getDetailedAssetData(ticker, cachedAsset);
    const now = new Date();

    // 确定资产类型
    let assetType = 'stock';
    if (ticker.includes('ETF') || ticker.includes('etf')) {
      assetType = 'etf';
    } else if (ticker.includes('OPT') || ticker.includes('opt')) {
      assetType = 'option';
    }

    // 使用事务同时更新Asset表和Asset_History表
    const result = await this.prisma.$transaction(async (prisma) => {
      // 更新或创建资产记录
      const asset = await prisma.asset.upsert({
        where: { ticker_symbol: ticker },
        update: {
          name: cachedAsset?.name || detailedMarketData.name, // 优先使用缓存的名称
          current_price: detailedMarketData.currentPrice,
          percent_change_today: detailedMarketData.percentChange,
          price_updated_at: now,
          lastUpdated: now,
          currency: detailedMarketData.currency,
        },
        create: {
          ticker_symbol: ticker,
          name: detailedMarketData.name,
          asset_type: assetType as any,
          current_price: detailedMarketData.currentPrice,
          percent_change_today: detailedMarketData.percentChange,
          price_updated_at: now,
          lastUpdated: now,
          currency: detailedMarketData.currency,
        },
      });

      // 更新或创建资产历史记录
      const historyResult = await this.upsertAssetHistoryRecord(asset.id, detailedMarketData, now);

      return {
        asset,
        history: historyResult.history,
        historyCreated: historyResult.isNew,
      };
    });

    this.logger.log(`Asset ${ticker} upserted with price: ${detailedMarketData.currentPrice}`);
    
    return {
      ...result.asset,
      historyUpdated: true,
      historyCreated: result.historyCreated,
    };
  }

  /**
   * 直接验证ticker，不依赖缓存查询（避免重复数据库调用）
   */
  private async validateTickerDirect(ticker: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.finnhubClient.quote(ticker, (error: any, data: any) => {
        if (error) {
          this.logger.warn(`Invalid ticker: ${ticker}`, error);
          resolve(false);
        } else {
          resolve(!!data && !!data.c && data.c > 0);
        }
      });
    });
  }

  /**
   * 私有方法：为资产创建或更新历史记录
   * @param assetId 资产ID
   * @param detailedMarketData 详细市场数据
   * @param date 记录日期
   * @returns 创建或更新的历史记录
   */
  private async upsertAssetHistoryRecord(
    assetId: number, 
    detailedMarketData: DetailedMarketData, 
    date: Date
  ) {
    // 获取今天的日期范围（不包含时间）
    const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 首先检查今天是否已有记录
    const existingHistory = await this.prisma.asset_History.findFirst({
      where: {
        asset_id: assetId,
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    const historyData = {
      open_price: detailedMarketData.openPrice,
      high_price: detailedMarketData.highPrice,
      low_price: detailedMarketData.lowPrice,
      close_price: detailedMarketData.currentPrice,
      volume: detailedMarketData.volume || Math.floor(Math.random() * 1000000) + 100000,
    };

    if (existingHistory) {
      // 如果存在当天记录，更新它
      const updatedHistory = await this.prisma.asset_History.update({
        where: { history_id: existingHistory.history_id },
        data: historyData,
      });
      
      this.logger.debug(`Updated existing history record for asset ${assetId} on ${today.toDateString()}`);
      return { history: updatedHistory, isNew: false };
    } else {
      // 如果不存在当天记录，创建新记录
      const newHistory = await this.prisma.asset_History.create({
        data: {
          asset_id: assetId,
          date: date,
          ...historyData,
        },
      });
      
      this.logger.debug(`Created new history record for asset ${assetId} on ${today.toDateString()}`);
      return { history: newHistory, isNew: true };
    }
  }

  /**
   * Batch update asset prices
   * @param tickers - string[] of ticker
   * @param updateHistory - Update Asset_History table, default is false to improve performance
   */
  async updateAssetPrices(
    tickers: string[], 
    updateHistory: boolean = false
  ): Promise<Array<{ticker: string; success: boolean; asset?: any; error?: string}>> {
    const results: Array<{ticker: string; success: boolean; asset?: any; error?: string}> = [];
    
    this.logger.log(`Batch updating ${tickers.length} assets, updateHistory: ${updateHistory}`);
    
    for (const ticker of tickers) {
      try {
        if (updateHistory) {
          // 完整更新，包括Asset_History
          const asset = await this.upsertAsset(ticker);
          results.push({ ticker, success: true, asset });
        } else {
          // 仅更新价格，不创建历史记录（性能优化）
          const asset = await this.updateAssetPriceOnly(ticker);
          results.push({ ticker, success: true, asset });
        }
      } catch (error) {
        this.logger.error(`Failed to update ${ticker}`, error);
        results.push({ ticker, success: false, error: error.message });
      }
    }

    this.logger.log(`Batch update completed: ${results.filter(r => r.success).length}/${tickers.length} successful`);
    return results;
  }

  /**
   * 仅更新资产价格，不创建Asset_History记录（用于性能优化）
   * @param ticker - 股票代码
   */
  private async updateAssetPriceOnly(ticker: string) {
    // 获取缓存资产，避免重复查询
    const cachedAsset = await this.getCachedAsset(ticker);

    // 如果资产在1小时内更新过，跳过更新
    if (cachedAsset && cachedAsset.lastUpdated) {
      const threshold = new Date(Date.now() - 60 * 60 * 1000); // 1 Hour
      if (cachedAsset.lastUpdated > threshold) {
        this.logger.debug(`Asset ${ticker} was updated within 60 minutes, skipping update`);
        return cachedAsset;
      }
    }

    // 如果没有缓存资产，先验证ticker的有效性
    if (!cachedAsset) {
      const isValid = await this.validateTickerDirect(ticker);
      if (!isValid) {
        throw new BadRequestException(`Invalid ticker: ${ticker}`);
      }
    }

    // 获取市场数据（使用基本版本，减少API调用）
    const marketData = await this.getAssetData(ticker);
    const now = new Date();

    // 确定资产类型
    let assetType = 'stock';
    if (ticker.includes('ETF') || ticker.includes('etf')) {
      assetType = 'etf';
    } else if (ticker.includes('OPT') || ticker.includes('opt')) {
      assetType = 'option';
    }

    // 更新或创建资产记录（不更新Asset_History）
    const asset = await this.prisma.asset.upsert({
      where: { ticker_symbol: ticker },
      update: {
        name: cachedAsset?.name || marketData.name,
        current_price: marketData.currentPrice,
        percent_change_today: marketData.percentChange,
        price_updated_at: now,
        lastUpdated: now,
        currency: marketData.currency,
      },
      create: {
        ticker_symbol: ticker,
        name: marketData.name,
        asset_type: assetType as any,
        current_price: marketData.currentPrice,
        percent_change_today: marketData.percentChange,
        price_updated_at: now,
        lastUpdated: now,
        currency: marketData.currency,
      },
    });

    this.logger.debug(`Price-only update for ${ticker}: ${marketData.currentPrice}`);
    return asset;
  }

  /**
   * 获取多个资产的实时价格
   */
  async getBatchQuotes(tickers: string[]): Promise<MarketData[]> {
    const results: MarketData[] = [];
    
    for (const ticker of tickers) {
      try {
        const marketData = await this.getAssetData(ticker);
        results.push(marketData);
      } catch (error) {
        this.logger.error(`Failed to fetch data for ${ticker}`, error);
        // Continue with other tickers even if one fails
      }
    }

    return results;
  }
} 