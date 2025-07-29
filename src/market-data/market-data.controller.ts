import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiBody, ApiResponse } from '@nestjs/swagger';
import { MarketDataService } from './market-data.service';

@ApiTags('market-data')
@Controller('market-data')
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @ApiOperation({ summary: '验证ticker是否存在于真实世界中' })
  @ApiParam({ name: 'ticker', description: '股票代码', example: 'AAPL' })
  @ApiResponse({ status: 200, description: '验证结果', schema: { type: 'object', properties: { ticker: { type: 'string' }, isValid: { type: 'boolean' } } } })
  @Get('validate/:ticker')
  async validateTicker(@Param('ticker') ticker: string) {
    const isValid = await this.marketDataService.validateTicker(ticker);
    return { ticker, isValid };
  }

  @ApiOperation({ summary: '获取单个资产的实时市场数据' })
  @ApiParam({ name: 'ticker', description: '股票代码', example: 'AAPL' })
  @ApiResponse({ status: 200, description: '资产市场数据' })
  @Get('quote/:ticker')
  async getQuote(@Param('ticker') ticker: string) {
    return await this.marketDataService.getAssetData(ticker);
  }

  @ApiOperation({ summary: '更新或创建资产记录' })
  @ApiBody({ schema: { type: 'object', properties: { ticker: { type: 'string', example: 'AAPL' } } } })
  @ApiResponse({ status: 201, description: '资产创建/更新成功' })
  @Post('upsert-asset')
  async upsertAsset(@Body('ticker') ticker: string) {
    return await this.marketDataService.upsertAsset(ticker);
  }

  @ApiOperation({ summary: '批量更新资产价格' })
  @ApiBody({ schema: { type: 'object', properties: { tickers: { type: 'array', items: { type: 'string' }, example: ['AAPL', 'GOOGL', 'MSFT'] } } } })
  @ApiResponse({ status: 200, description: '批量更新结果' })
  @Post('update-prices')
  async updatePrices(@Body('tickers') tickers: string[]) {
    return await this.marketDataService.updateAssetPrices(tickers);
  }

  @ApiOperation({ summary: 'Batch get asset quotes' })
  @ApiQuery({ name: 'tickers', description: 'Tickers list seperated by comma', example: 'AAPL,GOOGL,MSFT' })
  @ApiResponse({ status: 200, description: '批量报价数据' })
  @Get('batch-quotes')
  async getBatchQuotes(@Query('tickers') tickers: string) {
    const tickerArray = tickers.split(',');
    return await this.marketDataService.getBatchQuotes(tickerArray);
  }
} 