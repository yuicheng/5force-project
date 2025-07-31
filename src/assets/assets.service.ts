import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarketDataService, DetailedMarketData } from '../market-data/market-data.service';

export interface CreateAssetDto {
  ticker: string;
  name?: string;
  assetType?: string;
  price?: number;
}

export interface UpdateAssetDto {
  name?: string;
  assetType?: string;
  price?: number;
}

export interface BatchCreateAssetDto {
  assets: CreateAssetDto[];
}

export interface AssetHistoryQueryDto {
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AssetsService {
  
  private readonly logger = new Logger(AssetsService.name);

  constructor(
    private prisma: PrismaService,
    private marketDataService: MarketDataService,
  ) {}

  async refreshPriceByTicker(ticker: string) {
    const searchResult = await this.prisma.asset.findFirst({
      where: {
        ticker_symbol: ticker,
      },
    });
    if (!searchResult) {
      throw new NotFoundException(`Asset with ticker ${ticker} not found`);
    }
    return this.refreshPrice(searchResult.id);
  }

  /**
   * Create a new asset
   */
  async createAsset(createAssetDto: CreateAssetDto) {
    const { ticker, name, assetType, price } = createAssetDto;

    // Validate ticker
    const isValid = await this.marketDataService.validateTicker(ticker);
    if (!isValid) {
      throw new BadRequestException(`Invalid ticker: ${ticker}`);
    }

    // Get market data
    const marketData = await this.marketDataService.getAssetData(ticker);

    // Determine asset type
    // 目前没有用 所有的资产都是股票
    let finalAssetType = assetType || 'stock';
    if (ticker.includes('ETF') || ticker.includes('etf')) {
      finalAssetType = 'etf';
    } else if (ticker.includes('OPT') || ticker.includes('opt')) {
      finalAssetType = 'option';
    }

    const asset = await this.prisma.asset.create({
      data: {
        ticker_symbol: ticker,
        name: name || marketData.name,
        asset_type: finalAssetType as any,
        current_price: price || marketData.currentPrice,
        percent_change_today: marketData.percentChange,
        price_updated_at: new Date(),
        currency: marketData.currency,
      },
    });

    return asset;
  }

  /**
   * 批量创建资产
   */
  async batchCreateAssets(batchDto: BatchCreateAssetDto) {
    const results: Array<{success: boolean; asset?: any; ticker?: string; error?: string}> = [];
    
    for (const assetDto of batchDto.assets) {
      try {
        const asset = await this.createAsset(assetDto);
        results.push({ success: true, asset });
      } catch (error) {
        this.logger.error(`Failed to create asset ${assetDto.ticker}`, error);
        results.push({ 
          success: false, 
          ticker: assetDto.ticker, 
          error: error.message 
        });
      }
    }

    return {
      message: 'Batch asset creation completed',
      results,
    };
  }

  /**
   * 获取所有资产
   */
  async findBatch(page: number = 1, limit: number = 10) {
    page = page < 1 ? 1 : page;
    limit = limit < 1 ? 10 : limit;
    limit = limit > 200 ? 200 : limit;
    return await this.prisma.asset.findMany({
      orderBy: { id: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  /**
   * 根据ID获取资产
   */
  async findOne(id: number) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
    });

    if (!asset) {
      throw new NotFoundException(`Asset with ID ${id} not found`);
    }

    return asset;
  }

  /**
   * 根据ticker获取资产
   */
  async findByTicker(ticker: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { ticker_symbol: ticker },
    });

    if (!asset) {
      throw new NotFoundException(`Asset with ticker ${ticker} not found`);
    }

    return asset;
  }

  /**
   * Update Assest
   */
  async update(id: number, updateAssetDto: UpdateAssetDto) {
    const asset = await this.findOne(id);

    const updatedAsset = await this.prisma.asset.update({
      where: { id },
      data: {
        ...(updateAssetDto.name && { name: updateAssetDto.name }),
        ...(updateAssetDto.assetType && { asset_type: updateAssetDto.assetType as any }),
        ...(updateAssetDto.price && { current_price: updateAssetDto.price }),
        price_updated_at: new Date(),
      },
    });

    return updatedAsset;
  }

  /**
   * Delete Assest
   */
  async remove(id: number) {
    const asset = await this.findOne(id);

    // 检查是否有关联的持仓或交易
    const holdings = await this.prisma.holding.findMany({
      where: { assetId: id },
    });

    const transactions = await this.prisma.transaction.findMany({
      where: { assetId: id },
    });

    if (holdings.length > 0 || transactions.length > 0) {
      throw new BadRequestException(
        `Cannot delete asset with ID ${id} because it has associated holdings or transactions`,
      );
    }

    await this.prisma.asset.delete({
      where: { id },
    });

    return { message: `Asset with ID ${id} has been deleted` };
  }

  /**
   * 批量删除资产
   */
  async batchRemove(ids: number[]) {
    const results: Array<{success: boolean; id?: number; result?: any; error?: string}> = [];
    
    for (const id of ids) {
      try {
        const result = await this.remove(id);
        results.push({ success: true, id, result });
      } catch (error) {
        this.logger.error(`Failed to delete asset ${id}`, error);
        results.push({ 
          success: false, 
          id, 
          error: error.message 
        });
      }
    }

    return {
      message: 'Batch asset deletion completed',
      results,
    };
  }

  /**
   * 刷新资产价格并创建历史记录
   */
  async refreshPrice(id: number) {
    const asset = await this.findOne(id);
    
    if (!asset.ticker_symbol) {
      throw new BadRequestException('Asset does not have a ticker symbol');
    }

    // 使用通用方法更新价格和历史记录
    const result = await this.updateAssetPriceWithHistory(id, asset.ticker_symbol);

    this.logger.log(`Price refreshed for asset ${asset.ticker_symbol}: ${result.priceData.current}`);
    
    return {
      message: `Price refreshed successfully for ${asset.ticker_symbol}`,
      ...result,
    };
  }

  /**
   * 搜索资产
   */
  async search(query: string) {
    return await this.prisma.asset.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { ticker_symbol: { contains: query } },
        ],
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * 通用方法：为资产创建或更新历史记录
   * @param assetId 资产ID
   * @param detailedMarketData 详细市场数据
   * @param date 记录日期，默认为当前时间
   * @param prisma prisma client, default is this.prisma, when in transaction, pass the prisma instance of the transaction
   * @returns 创建或更新的历史记录
   */
  private async upsertAssetHistory(
    assetId: number, 
    detailedMarketData: DetailedMarketData, 
    date: Date = new Date(),
    prisma: any = this.prisma
  ) {
    // 获取今天的日期范围（不包含时间）
    const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 首先检查今天是否已有记录
    const existingHistory = await prisma.asset_History.findFirst({
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
      const updatedHistory = await prisma.asset_History.update({
        where: { history_id: existingHistory.history_id },
        data: historyData,
      });
      
      this.logger.debug(`Updated existing history record for asset ${assetId} on ${today.toDateString()}`);
      return { history: updatedHistory, isNew: false };
    } else {
      // 如果不存在当天记录，创建新记录
      const newHistory = await prisma.asset_History.create({
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
   * 通用方法：为资产更新价格并创建历史记录
   * @param assetId 资产ID
   * @param ticker 股票代码
   * @returns 更新结果
   */
  async updateAssetPriceWithHistory(assetId: number, ticker: string) {
    // 获取实时的详细市场数据
    const detailedMarketData = await this.marketDataService.getDetailedAssetData(ticker);
    const now = new Date();

    const result = await this.prisma.$transaction(async (prisma) => {
      // 更新资产表
      const updatedAsset = await prisma.asset.update({
        where: { id: assetId },
        data: {
          current_price: detailedMarketData.currentPrice,
          percent_change_today: detailedMarketData.percentChange,
          price_updated_at: now,
          lastUpdated: now,
        },
      });

      // 更新或创建历史记录
      const historyResult = await this.upsertAssetHistory(assetId, detailedMarketData, now, prisma);

      return {
        asset: updatedAsset,
        history: historyResult.history,
        historyIsNew: historyResult.isNew,
      };
    });

    return {
      asset: result.asset,
      history: result.history,
      historyCreated: result.historyIsNew,
      priceData: {
        current: detailedMarketData.currentPrice,
        open: detailedMarketData.openPrice,
        high: detailedMarketData.highPrice,
        low: detailedMarketData.lowPrice,
        change: detailedMarketData.percentChange,
        volume: detailedMarketData.volume,
      },
      timestamp: now,
    };
  }

  /**
   * 根据资产ID获取历史记录
   */
  async getAssetHistory(id: number, queryDto: AssetHistoryQueryDto = {}) {
    const { startDate, endDate, page = 1, limit = 30 } = queryDto;
    
    // 验证资产是否存在
    await this.findOne(id);

    // 构建查询条件
    const where: any = { asset_id: id };
    
    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        where.date.lte = new Date(endDate);
      }
    }

    // 计算分页参数
    const skip = (page - 1) * limit;

    // 查询历史记录
    const [history, totalCount] = await Promise.all([
      this.prisma.asset_History.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.asset_History.count({ where }),
    ]);

    return {
      data: history,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  /**
   * 根据ticker获取历史记录
   */
  async getAssetHistoryByTicker(ticker: string, queryDto: AssetHistoryQueryDto = {}) {
    const asset = await this.findByTicker(ticker);
    return this.getAssetHistory(asset.id, queryDto);
  }

  /**
   * 获取资产的最新历史记录
   */
  async getLatestAssetHistory(id: number) {
    // 验证资产是否存在
    await this.findOne(id);

    const latestHistory = await this.prisma.asset_History.findFirst({
      where: { asset_id: id },
      orderBy: { date: 'desc' },
    });

    if (!latestHistory) {
      throw new NotFoundException(`No history found for asset with ID ${id}`);
    }

    return latestHistory;
  }

  /**
   * 根据ticker获取最新历史记录
   */
  async getLatestAssetHistoryByTicker(ticker: string) {
    const asset = await this.findByTicker(ticker);
    return this.getLatestAssetHistory(asset.id);
  }

  /**
   * 获取资产的历史记录统计信息
   */
  async getAssetHistoryStats(id: number, days: number = 30) {
    // 验证资产是否存在
    await this.findOne(id);

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const history = await this.prisma.asset_History.findMany({
      where: {
        asset_id: id,
        date: { gte: fromDate },
      },
      orderBy: { date: 'desc' },
    });

    if (history.length === 0) {
      throw new NotFoundException(`No history found for asset with ID ${id} in the last ${days} days`);
    }

    // 计算统计信息
    const prices = history.map(h => parseFloat(h.close_price.toString()));
    const volumes = history.map(h => h.volume);

    const stats = {
      period: `${days} days`,
      recordCount: history.length,
      latestPrice: prices[0],
      highestPrice: Math.max(...prices),
      lowestPrice: Math.min(...prices),
      averagePrice: prices.reduce((sum, price) => sum + price, 0) / prices.length,
      totalVolume: volumes.reduce((sum, vol) => sum + vol, 0),
      averageVolume: volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length,
      priceChange: prices[0] - prices[prices.length - 1],
      priceChangePercent: ((prices[0] - prices[prices.length - 1]) / prices[prices.length - 1]) * 100,
    };

    return {
      assetId: id,
      stats,
      firstDate: history[history.length - 1].date,
      lastDate: history[0].date,
    };
  }
} 