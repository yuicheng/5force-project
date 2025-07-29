import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarketDataService } from '../market-data/market-data.service';

export interface CreateHoldingDto {
  accountId: number;
  assetId: number;
  quantity: number;
  averageCostBasis: number;
}

export interface UpdateHoldingDto {
  quantity?: number;
  averageCostBasis?: number;
}

export interface BatchCreateHoldingDto {
  holdings: CreateHoldingDto[];
}

export interface AddToPortfolioDto {
  username: string;
  ticker: string;
  accountId: number;
  quantity: number;
  price?: number; // 如果提供，使用指定价格；否则获取当前市场价格
  transactionDate?: string; // 交易日期，默认为当前时间
  updateMarketPrice?: boolean; // 是否更新市场价格，默认为false
  description?: string; // 交易描述
}

export interface SellByTickerDto {
  username: string;
  ticker: string;
  quantity: number;
  price?: number;
  accountId?: number; // 可选，不提供则使用用户的默认账户
}

export interface SellAllByTickerDto {
  username: string;
  ticker: string;
}

export interface SellHoldingDto {
  username: string;
  ticker: string;
  quantity?: number; // 可选，不提供则全仓卖出
  price?: number;    // 可选，不提供则使用市场价格
}

@Injectable()
export class HoldingsService {
  private readonly logger = new Logger(HoldingsService.name);

  constructor(
    private prisma: PrismaService,
    private marketDataService: MarketDataService,
  ) {}

  /**
   * 创建持仓
   */
  async create(createHoldingDto: CreateHoldingDto) {
    // 检查是否已存在相同的账户和资产组合
    const existingHolding = await this.prisma.holding.findUnique({
      where: {
        accountId_assetId: {
          accountId: createHoldingDto.accountId,
          assetId: createHoldingDto.assetId,
        },
      },
    });

    if (existingHolding) {
      throw new BadRequestException(
        'Holding already exists for this account and asset combination',
      );
    }

    const holding = await this.prisma.holding.create({
      data: {
        accountId: createHoldingDto.accountId,
        assetId: createHoldingDto.assetId,
        quantity: createHoldingDto.quantity,
        average_cost_basis: createHoldingDto.averageCostBasis,
      },
      include: {
        account: true,
        asset: true,
      },
    });

    return holding;
  }

  /**
   * 批量创建持仓
   */
  async batchCreate(batchDto: BatchCreateHoldingDto) {
    const results: Array<{success: boolean; holding?: any; error?: string}> = [];
    
    for (const holdingDto of batchDto.holdings) {
      try {
        const holding = await this.create(holdingDto);
        results.push({ success: true, holding });
      } catch (error) {
        this.logger.error(`Failed to create holding`, error);
        results.push({ 
          success: false, 
          error: error.message 
        });
      }
    }

    return {
      message: 'Batch holding creation completed',
      results,
    };
  }

  /**
   * 添加资产到投资组合（On Demand Populate）
   */
  async addToPortfolio(addToPortfolioDto: AddToPortfolioDto) {
    const { 
      username, 
      ticker, 
      accountId, 
      quantity, 
      price,
      transactionDate,
      updateMarketPrice = false,
      description
    } = addToPortfolioDto;

    // 验证用户和账户
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        portfolio: {
          include: {
            accounts: true,
          },
        },
      },
    });

    if (!user?.portfolio) {
      throw new NotFoundException(`Portfolio not found for user: ${username}`);
    }

    const account = user.portfolio.accounts.find(acc => acc.id === accountId);
    if (!account) {
      throw new NotFoundException(`Account with ID ${accountId} not found`);
    }

    // 解析交易日期
    const tradeDate = transactionDate ? new Date(transactionDate) : new Date();

    // 验证ticker
    const isValid = await this.marketDataService.validateTicker(ticker);
    if (!isValid) {
      throw new BadRequestException(`Invalid ticker: ${ticker}`);
    }

    // 智能获取或创建资产，避免不必要的价格更新
    let asset;
    let purchasePrice = price;

    if (updateMarketPrice) {
      // 如果明确要求更新市场价格，使用upsertAsset
      asset = await this.marketDataService.upsertAsset(ticker);
      if (!purchasePrice) {
        purchasePrice = asset.current_price;
      }
    } else {
      // 否则只查找或创建资产，不更新价格
      asset = await this.marketDataService.getCachedAsset(ticker);
      
      if (!asset) {
        // 资产不存在，需要创建，但不更新价格到最新
        const basicMarketData = await this.marketDataService.getAssetData(ticker);
        
        // 创建资产，但使用历史时间戳
        asset = await this.prisma.asset.create({
          data: {
            ticker_symbol: ticker,
            name: basicMarketData.name,
            asset_type: this.determineAssetType(ticker),
            current_price: basicMarketData.currentPrice,
            percent_change_today: basicMarketData.percentChange,
            price_updated_at: tradeDate, // 使用交易日期而不是当前时间
            lastUpdated: tradeDate,
            currency: basicMarketData.currency,
          },
        });
      }

      // 如果没有提供价格，获取资产的当前价格（不触发更新）
      if (!purchasePrice) {
        if (asset.current_price) {
          purchasePrice = Number(asset.current_price);
        } else {
          // 如果资产没有价格信息，才获取市场数据
          const marketData = await this.marketDataService.getAssetData(ticker);
          purchasePrice = marketData.currentPrice;
        }
      }
    }

    if (!purchasePrice) {
      throw new BadRequestException('Unable to determine purchase price');
    }

    // 检查是否已存在持仓
    const existingHolding = await this.prisma.holding.findUnique({
      where: {
        accountId_assetId: {
          accountId,
          assetId: asset.id,
        },
      },
    });

    let holding;
    if (existingHolding) {
      // 更新现有持仓（平均成本法）
      const totalQuantity = Number(existingHolding.quantity) + quantity;
      const totalCost = Number(existingHolding.quantity) * Number(existingHolding.average_cost_basis) + 
                       quantity * purchasePrice;
      const newAverageCost = totalCost / totalQuantity;

      holding = await this.prisma.holding.update({
        where: { id: existingHolding.id },
        data: {
          quantity: totalQuantity,
          average_cost_basis: newAverageCost,
        },
        include: {
          account: true,
          asset: true,
        },
      });
    } else {
      // 创建新持仓
      holding = await this.create({
        accountId,
        assetId: asset.id,
        quantity,
        averageCostBasis: purchasePrice,
      });
    }

    // 创建交易记录
    await this.prisma.transaction.create({
      data: {
        accountId: accountId,
        transaction_type: 'buy',
        transaction_date: tradeDate, // 使用指定的交易日期
        quantity,
        price_per_unit: purchasePrice,
        total_amount: quantity * purchasePrice,
        description: description || `Bought ${quantity} shares of ${ticker}`,
        assetId: asset.id,
      },
    });

    return {
      message: `Successfully added ${quantity} shares of ${ticker} to portfolio`,
      holding,
      asset,
      transactionDate: tradeDate,
      priceUsed: purchasePrice,
      marketPriceUpdated: updateMarketPrice,
    };
  }

  /**
   * 获取所有持仓
   */
  async findAll() {
    return await this.prisma.holding.findMany({
      include: {
        account: true,
        asset: true,
      },
    });
  }

  /**
   * 根据ID获取持仓
   */
  async findOne(id: number) {
    const holding = await this.prisma.holding.findUnique({
      where: { id },
      include: {
        account: true,
        asset: true,
      },
    });

    if (!holding) {
      throw new NotFoundException(`Holding with ID ${id} not found`);
    }

    return holding;
  }

  /**
   * 根据账户ID获取持仓
   */
  async findByAccount(accountId: number) {
    return await this.prisma.holding.findMany({
      where: { accountId: accountId },
      include: {
        account: true,
        asset: true,
      },
    });
  }

  /**
   * 根据用户名获取持仓
   */
  async findByUsername(username: string) {
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

    if (!user?.portfolio) {
      throw new NotFoundException(`Portfolio not found for user: ${username}`);
    }

    const allHoldings = user.portfolio.accounts.flatMap(account => account.holdings);
    return allHoldings;
  }

  /**
   * 更新持仓
   */
  async update(id: number, updateHoldingDto: UpdateHoldingDto) {
    await this.findOne(id);

    const updatedHolding = await this.prisma.holding.update({
      where: { id },
      data: {
        ...(updateHoldingDto.quantity !== undefined && { quantity: updateHoldingDto.quantity }),
        ...(updateHoldingDto.averageCostBasis !== undefined && { average_cost_basis: updateHoldingDto.averageCostBasis }),
      },
      include: {
        account: true,
        asset: true,
      },
    });

    return updatedHolding;
  }

  /**
   * 删除持仓
   */
  async remove(id: number) {
    await this.findOne(id);

    await this.prisma.holding.delete({
      where: { id },
    });

    return { message: `Holding with ID ${id} has been deleted` };
  }

  /**
   * 批量删除持仓
   */
  async batchRemove(ids: number[]) {
    const results: Array<{success: boolean; id?: number; error?: string}> = [];
    
    for (const id of ids) {
      try {
        const result = await this.remove(id);
        results.push({ success: true, id, error: result.message });
      } catch (error) {
        this.logger.error(`Failed to delete holding ${id}`, error);
        results.push({ 
          success: false, 
          id, 
          error: error.message 
        });
      }
    }

    return {
      message: 'Batch holding deletion completed',
      results,
    };
  }

  /**
   * 统一的卖出接口 - 根据是否提供quantity自动判断全仓还是部分卖出
   * 推荐使用这个方法替代 sellAllByTicker 和 sellByTicker
   */
  async sellByTickerUnified(sellDto: SellHoldingDto) {
    const { username, ticker, quantity, price } = sellDto;

    // 验证用户和获取账户信息
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

    if (!user?.portfolio) {
      throw new NotFoundException(`Portfolio not found for user: ${username}`);
    }

    // 使用默认账户（第一个账户）- 符合单用户单portfolio单account的场景
    const account = user.portfolio.accounts[0];
    if (!account) {
      throw new BadRequestException('No account found for user');
    }

    // 查找该股票的持仓
    const holding = account.holdings.find(h => 
      h.asset.ticker_symbol?.toLowerCase() === ticker.toLowerCase()
    );

    if (!holding) {
      throw new NotFoundException(`No holding found for ticker: ${ticker}`);
    }

    const currentQuantity = Number(holding.quantity);
    if (currentQuantity <= 0) {
      throw new BadRequestException(`No shares to sell for ticker: ${ticker}`);
    }

    // 确定卖出数量
    let sellQuantity: number;
    if (quantity === undefined || quantity === null) {
      // 全仓卖出
      sellQuantity = currentQuantity;
    } else {
      // 部分卖出
      if (quantity <= 0) {
        throw new BadRequestException('Sell quantity must be greater than 0');
      }
      if (quantity > currentQuantity) {
        throw new BadRequestException(`Insufficient quantity. Available: ${currentQuantity}, Requested: ${quantity}`);
      }
      sellQuantity = quantity;
    }

    // 确定卖出价格
    let sellPrice = price;
    if (!sellPrice) {
      try {
        const marketData = await this.marketDataService.getAssetData(ticker);
        sellPrice = marketData.currentPrice;
      } catch (error) {
        // 如果无法获取市场价格，使用资产的当前价格
        if (holding.asset.current_price) {
          sellPrice = Number(holding.asset.current_price);
          this.logger.warn(`Using cached price for ${ticker}: ${sellPrice}`);
        } else {
          throw new BadRequestException(`Unable to determine sell price for ${ticker}`);
        }
      }
    }

    const totalAmount = sellQuantity * sellPrice;
    const remainingQuantity = currentQuantity - sellQuantity;
    const isFullSell = remainingQuantity === 0;

    // 使用事务处理
    const result = await this.prisma.$transaction(async (prisma) => {
      let updatedHolding: any = null;

      if (isFullSell) {
        // 全仓卖出，删除持仓记录
        await prisma.holding.delete({
          where: { id: holding.id },
        });
      } else {
        // 部分卖出，更新持仓数量
        updatedHolding = await prisma.holding.update({
          where: { id: holding.id },
          data: { quantity: remainingQuantity },
          include: {
            account: true,
            asset: true,
          },
        });
      }

      // 创建卖出交易记录
      const transaction = await prisma.transaction.create({
        data: {
          accountId: account.id,
          transaction_type: 'sell',
          transaction_date: new Date(),
          quantity: sellQuantity,
          price_per_unit: sellPrice,
          total_amount: totalAmount,
          description: isFullSell 
            ? `Sold all ${sellQuantity} shares of ${ticker}`
            : `Sold ${sellQuantity} shares of ${ticker}`,
          assetId: holding.asset.id,
        },
      });

      return { transaction, updatedHolding };
    });

    this.logger.log(
      `User ${username} sold ${sellQuantity} shares of ${ticker} at $${sellPrice} ` +
      `(${isFullSell ? 'full sell' : 'partial sell'})`
    );

    return {
      success: true,
      message: isFullSell 
        ? `Successfully sold all ${sellQuantity} shares of ${ticker}`
        : `Successfully sold ${sellQuantity} shares of ${ticker}, ${remainingQuantity} shares remaining`,
      ticker,
      quantity: sellQuantity,
      sellPrice,
      totalAmount,
      remainingHolding: result.updatedHolding,
      isFullSell,
      transaction: result.transaction,
    };
  }

  /**
   * 卖出持仓 (按ID)
   */
  async sellHolding(id: number, quantity: number, price?: number) {
    const holding = await this.findOne(id);
    
    if (Number(holding.quantity) < quantity) {
      throw new BadRequestException('Insufficient quantity to sell');
    }

    // 确定卖出价格 - 优化版本
    let sellPrice = price;
    if (!sellPrice && holding.asset.ticker_symbol) {
      // 优先使用缓存的价格数据
      const optimalPrice = await this.getOptimalSellPrice(holding.asset);
      
      if (optimalPrice === null) {
        throw new BadRequestException('Unable to determine sell price');
      }
      
      sellPrice = optimalPrice;
    }

    if (!sellPrice) {
      throw new BadRequestException('Sell price is required');
    }

    // 更新持仓数量
    const remainingQuantity = Number(holding.quantity) - quantity;
    let updatedHolding;

    if (remainingQuantity === 0) {
      // 完全卖出，删除持仓
      await this.prisma.holding.delete({ where: { id } });
      updatedHolding = null;
    } else {
      // 部分卖出，更新持仓
      updatedHolding = await this.prisma.holding.update({
        where: { id },
        data: { quantity: remainingQuantity },
        include: {
          account: true,
          asset: true,
        },
      });
    }

    // 创建卖出交易记录
    await this.prisma.transaction.create({
      data: {
        accountId: holding.accountId,
        transaction_type: 'sell',
        transaction_date: new Date(),
        quantity,
        price_per_unit: sellPrice,
        total_amount: quantity * sellPrice,
        description: `Sold ${quantity} shares of ${holding.asset.ticker_symbol || holding.asset.name}`,
        assetId: holding.assetId,
      },
    });

    return {
      message: `Successfully sold ${quantity} shares`,
      remainingHolding: updatedHolding,
      sellPrice,
      totalAmount: quantity * sellPrice,
    };
  }

  /**
   * 卖出用户在某个股票上的全部持仓 (简化版本，只需要用户名和股票代码)
   */
  async sellAllByTicker(sellAllDto: SellAllByTickerDto) {
    const { username, ticker } = sellAllDto;

    // 查找用户和投资组合
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

    if (!user?.portfolio) {
      throw new NotFoundException(`Portfolio not found for user: ${username}`);
    }

    // 使用默认账户（第一个账户）
    const account = user.portfolio.accounts[0];
    if (!account) {
      throw new BadRequestException('No account found for user');
    }

    // 查找该股票的持仓
    const holding = account.holdings.find(h => 
      h.asset.ticker_symbol?.toLowerCase() === ticker.toLowerCase()
    );

    if (!holding) {
      throw new NotFoundException(`No holding found for ticker: ${ticker}`);
    }

    if (Number(holding.quantity) <= 0) {
      throw new BadRequestException(`No shares to sell for ticker: ${ticker}`);
    }

    // 获取市场价格
    let sellPrice: number;
    try {
      const marketData = await this.marketDataService.getAssetData(ticker);
      sellPrice = marketData.currentPrice;
    } catch (error) {
      // 如果无法获取市场价格，使用资产的当前价格
      if (holding.asset.current_price) {
        sellPrice = Number(holding.asset.current_price);
        this.logger.warn(`Using cached price for ${ticker}: ${sellPrice}`);
      } else {
        throw new BadRequestException(`Unable to determine sell price for ${ticker}`);
      }
    }

    // 卖出全部持仓
    const quantity = Number(holding.quantity);
    const totalAmount = quantity * sellPrice;

    // 使用事务处理
    const result = await this.prisma.$transaction(async (prisma) => {
      // 删除持仓记录（全部卖出）
      await prisma.holding.delete({
        where: { id: holding.id },
      });

      // 创建卖出交易记录
      const transaction = await prisma.transaction.create({
        data: {
          accountId: account.id,
          transaction_type: 'sell',
          transaction_date: new Date(),
          quantity,
          price_per_unit: sellPrice,
          total_amount: totalAmount,
          description: `Sold all ${quantity} shares of ${ticker}`,
          assetId: holding.asset.id,
        },
      });

      return { transaction, quantity, sellPrice, totalAmount };
    });

    this.logger.log(`User ${username} sold all ${quantity} shares of ${ticker} at $${sellPrice}`);

    return {
      success: true,
      message: `Successfully sold all ${quantity} shares of ${ticker}`,
      ticker,
      quantity,
      sellPrice,
      totalAmount,
      transaction: result.transaction,
    };
  }

  /**
   * 批量卖出持仓 (原有方法，保持兼容性)
   */
  async sellByTicker(sellByTickerDto: SellByTickerDto) {
    const { username, ticker, quantity, price, accountId } = sellByTickerDto;

    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        portfolio: {
          include: {
            accounts: true,
          },
        },
      },
    });

    if (!user?.portfolio) {
      throw new NotFoundException(`Portfolio not found for user: ${username}`);
    }

    // 确定账户
    let account;
    if (accountId) {
      account = user.portfolio.accounts.find(acc => acc.id === accountId);
      if (!account) {
        throw new NotFoundException(`Account with ID ${accountId} not found`);
      }
    } else {
      // 如果没有提供账户ID，使用用户的默认账户
      // 没有 is_default 字段，默认取第一个账户
      account = user.portfolio.accounts[0];
      if (!account) {
        throw new BadRequestException('No default account found for user. Please provide an accountId.');
      }
    }

    // 验证ticker
    const isValid = await this.marketDataService.validateTicker(ticker);
    if (!isValid) {
      throw new BadRequestException(`Invalid ticker: ${ticker}`);
    }

    // 智能获取或创建资产，避免不必要的价格更新
    let asset;
    let sellPrice = price;

    if (sellPrice) {
      // 如果提供了价格，直接使用
      asset = await this.marketDataService.upsertAsset(ticker);
    } else {
      // 否则只查找或创建资产，不更新价格
      asset = await this.marketDataService.getCachedAsset(ticker);
      
      if (!asset) {
        // 资产不存在，需要创建，但不更新价格到最新
        const basicMarketData = await this.marketDataService.getAssetData(ticker);
        
        // 创建资产，但使用历史时间戳
        asset = await this.prisma.asset.create({
          data: {
            ticker_symbol: ticker,
            name: basicMarketData.name,
            asset_type: this.determineAssetType(ticker),
            current_price: basicMarketData.currentPrice,
            percent_change_today: basicMarketData.percentChange,
            price_updated_at: new Date(), // 使用当前时间
            lastUpdated: new Date(),
            currency: basicMarketData.currency,
          },
        });
      }

      // 如果没有提供价格，获取资产的当前价格（不触发更新）
      if (!sellPrice) {
        if (asset.current_price) {
          sellPrice = Number(asset.current_price);
        } else {
          // 如果资产没有价格信息，才获取市场数据
          const marketData = await this.marketDataService.getAssetData(ticker);
          sellPrice = marketData.currentPrice;
        }
      }
    }

    if (!sellPrice) {
      throw new BadRequestException('Unable to determine sell price');
    }

    // 检查是否存在持仓
    const existingHolding = await this.prisma.holding.findUnique({
      where: {
        accountId_assetId: {
          accountId: account.id,
          assetId: asset.id,
        },
      },
    });

    if (!existingHolding) {
      throw new NotFoundException(`No holding found for account ${account.id} and asset ${asset.id}`);
    }

    // 更新持仓数量
    const remainingQuantity = Number(existingHolding.quantity) - quantity;
    let updatedHolding;

    if (remainingQuantity === 0) {
      // 完全卖出，删除持仓
      await this.prisma.holding.delete({ where: { id: existingHolding.id } });
      updatedHolding = null;
    } else {
      // 部分卖出，更新持仓
      updatedHolding = await this.prisma.holding.update({
        where: { id: existingHolding.id },
        data: { quantity: remainingQuantity },
        include: {
          account: true,
          asset: true,
        },
      });
    }

    // 创建卖出交易记录
    await this.prisma.transaction.create({
      data: {
        accountId: account.id,
        transaction_type: 'sell',
        transaction_date: new Date(),
        quantity,
        price_per_unit: sellPrice,
        total_amount: quantity * sellPrice,
        description: `Sold ${quantity} shares of ${ticker}`,
        assetId: asset.id,
      },
    });

    return {
      message: `Successfully sold ${quantity} shares of ${ticker}`,
      remainingHolding: updatedHolding,
      sellPrice,
      totalAmount: quantity * sellPrice,
    };
  }

  /**
   * 获取最优卖出价格 - 智能缓存策略
   * @param asset - 资产对象
   * @returns 卖出价格
   */
  private async getOptimalSellPrice(asset: any): Promise<number | null> {
    // 1. 检查缓存价格是否足够新（30分钟内认为可用于交易）
    if (asset.current_price && asset.price_updated_at) {
      const now = new Date();
      const priceAge = now.getTime() - asset.price_updated_at.getTime();
      const thirtyMinutes = 30 * 60 * 1000;
      
      if (priceAge < thirtyMinutes) {
        this.logger.log(`Using cached price for ${asset.ticker_symbol}: ${asset.current_price} (${Math.floor(priceAge / 60000)} minutes old)`);
        return Number(asset.current_price);
      }
    }

    // 2. 价格过期，需要获取最新价格
    if (!asset.ticker_symbol) {
      this.logger.warn(`Asset ${asset.id} has no ticker symbol, cannot get live price`);
      return asset.current_price ? Number(asset.current_price) : null;
    }

    try {
      this.logger.log(`Getting live price for ${asset.ticker_symbol} (cached price is stale)`);
      const marketData = await this.marketDataService.getAssetData(asset.ticker_symbol);
      
      // 同时更新数据库中的价格（避免其他请求重复获取）
      await this.prisma.asset.update({
        where: { id: asset.id },
        data: {
          current_price: marketData.currentPrice,
          percent_change_today: marketData.percentChange,
          price_updated_at: new Date(),
        },
      });
      
      return marketData.currentPrice;
    } catch (error) {
      this.logger.error(`Failed to get live price for ${asset.ticker_symbol}:`, error.message);
      
      // API失败时，如果有缓存价格，使用缓存价格作为后备
      if (asset.current_price) {
        this.logger.warn(`Using stale cached price for ${asset.ticker_symbol}: ${asset.current_price}`);
        return Number(asset.current_price);
      }
      
      return null;
    }
  }

  /**
   * 私有方法：确定资产类型
   */
  private determineAssetType(ticker: string) {
    if (ticker.includes('ETF') || ticker.includes('etf')) {
      return 'etf' as any;
    } else if (ticker.includes('OPT') || ticker.includes('opt')) {
      return 'option' as any;
    }
    return 'stock' as any;
  }
} 