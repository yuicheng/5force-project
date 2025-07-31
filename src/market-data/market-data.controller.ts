import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiBody, ApiResponse } from '@nestjs/swagger';
import { MarketDataService } from './market-data.service';

@ApiTags('market-data')
@Controller('market-data')
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @ApiOperation({ summary: 'Test API for Finnhub' })
  @ApiParam({ name: 'ticker', description: 'Ticker', example: 'AAPL' })
  @Get('test/:ticker')
  async test(@Param('ticker') ticker: string) {
    return await this.marketDataService.forceCheck(ticker);
  }

  @ApiOperation({ summary: '验证ticker是否存在于真实世界中' })
  @ApiParam({ name: 'ticker', description: 'Ticker', example: 'AAPL' })
  @ApiResponse({ status: 200, description: 'Result', schema: { type: 'object', properties: { ticker: { type: 'string' }, isValid: { type: 'boolean' } } } })
  @Get('validate/:ticker')
  async validateTicker(@Param('ticker') ticker: string) {
    const isValid = await this.marketDataService.validateTicker(ticker);
    return { ticker, isValid };
  }

  @ApiOperation({ summary: 'Get market data of an asset by ticker' })
  @ApiParam({ name: 'ticker', description: 'Ticker', example: 'AAPL' })
  @ApiResponse({ status: 200, description: 'Market data object' })
  @Get('quote/:ticker')
  async getQuote(@Param('ticker') ticker: string) {
    return await this.marketDataService.getAssetData(ticker);
  }

  @ApiOperation({ summary: 'Upsert an asset' })
  @ApiBody({ schema: { type: 'object', properties: { ticker: { type: 'string', example: 'AAPL' } } } })
  @ApiResponse({ status: 201, description: 'Upsert success' })
  @Post('upsert-asset')
  async upsertAsset(@Body('ticker') ticker: string) {
    return await this.marketDataService.upsertAsset(ticker);
  }

  @ApiOperation({ summary: 'Batch update asset prices' })
  @ApiBody({ schema: { type: 'object', properties: { tickers: { type: 'array', items: { type: 'string' }, example: ['AAPL', 'GOOGL', 'MSFT'] } } } })
  @ApiResponse({ status: 200, description: 'Batch update result' })
  @Post('update-prices')
  async updatePrices(@Body('tickers') tickers: string[]) {
    return await this.marketDataService.updateAssetPrices(tickers);
  }

  @ApiOperation({ summary: 'Batch get asset quotes' })
  @ApiQuery({ name: 'tickers', description: 'Tickers list seperated by comma', example: 'AAPL,GOOGL,MSFT' })
  @ApiResponse({ status: 200, description: '' })
  @Get('batch-quotes')
  async getBatchQuotes(@Query('tickers') tickers: string) {
    const tickerArray = tickers.split(',');
    return await this.marketDataService.getBatchQuotes(tickerArray);
  }
} 