import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiBody, ApiResponse } from '@nestjs/swagger';
import { AssetsService, CreateAssetDto, UpdateAssetDto, BatchCreateAssetDto, AssetHistoryQueryDto } from './assets.service';
import { match } from 'assert';
import { isEmail, isEmpty } from 'class-validator';

@ApiTags('assets')
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @ApiOperation({ summary: '创建单个资产' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', example: 'AAPL', description: '资产的股票代码' },
        name: { type: 'string', example: 'Apple Inc.', description: '资产名称' },
        assetType: { type: 'string', example: 'stock', description: '资产类型，如stock、etf等' },
        price: { type: 'number', example: 150.25, description: '初始价格' },
      },
      required: ['ticker'],
    },
  })
  @ApiResponse({ status: 201, description: '资产创建成功' })
  @Post()
  create(@Body() createAssetDto: CreateAssetDto) {
    return this.assetsService.createAsset(createAssetDto);
  }

  @ApiOperation({ summary: '批量创建资产' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        assets: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ticker: { type: 'string' },
              name: { type: 'string' },
              assetType: { type: 'string' },
              price: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: '批量创建结果' })
  @Post('batch')
  batchCreate(@Body() batchDto: BatchCreateAssetDto) {
    return this.assetsService.batchCreateAssets(batchDto);
  }

  @ApiOperation({ summary: 'Batch get assets' })
  @ApiResponse({ status: 200, description: '资产列表' })
  @ApiQuery({ name: 'page', description: 'page number', example: 1, required: false })
  @ApiQuery({ name: 'limit', description: 'max entries per page ', example: 10, required: false })
  @Get()
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    // JavaScript doesn't have unwarp_or_else()
    const pageNum = page ?? 1;
    const limitNum = limit ?? 10;
    return this.assetsService.findBatch(+pageNum, +limitNum);
  }

  @ApiOperation({ summary: 'Search assets' })
  @ApiQuery({ name: 'q', description: 'Keyword', example: 'Apple' })
  @ApiResponse({ status: 200, description: 'Result list' })
  @Get('search')
  search(@Query('q') query: string) {
    return this.assetsService.search(query);
  }

  @ApiOperation({ summary: 'Get asset by id' })
  @ApiParam({ name: 'id', description: 'assetId', example: '1' })
  @ApiResponse({ status: 200, description: 'asset info' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.assetsService.findOne(+id);
  }

  @ApiOperation({ summary: '根据Ticker获取资产' })
  @ApiParam({ name: 'ticker', description: '股票代码', example: 'AAPL' })
  @ApiResponse({ status: 200, description: '资产信息' })
  @Get('ticker/:ticker')
  findByTicker(@Param('ticker') ticker: string) {
    return this.assetsService.findByTicker(ticker);
  }

  @ApiOperation({ summary: '更新资产' })
  @ApiParam({ name: 'id', description: '资产ID', example: '1' })
  @ApiBody({ schema: { type: 'object', properties: { name: { type: 'string', example: 'Updated Name' }, assetType: { type: 'string', example: 'stock' }, price: { type: 'number', example: 155.00 } } } })
  @ApiResponse({ status: 200, description: '更新成功' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAssetDto: UpdateAssetDto) {
    return this.assetsService.update(+id, updateAssetDto);
  }

  @ApiOperation({ summary: '删除资产' })
  @ApiParam({ name: 'id', description: '资产ID', example: '1' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.assetsService.remove(+id);
  }

  @ApiOperation({ summary: '批量删除资产' })
  @ApiBody({ schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'number' }, example: [1, 2, 3] } } } })
  @ApiResponse({ status: 200, description: '批量删除结果' })
  @Delete('batch')
  batchRemove(@Body('ids') ids: number[]) {
    return this.assetsService.batchRemove(ids);
  }

  @ApiOperation({ summary: 'Refresh asset price by assetId' })
  @ApiParam({ name: 'id', description: 'assetId', example: '1' })
  @ApiResponse({ status: 200, description: '200 SUCCESS' })
  @Get(':id/refresh-price')
  refreshPrice(@Param('id') id: string) {
    return this.assetsService.refreshPrice(+id);
  }

  @ApiOperation({ summary: 'Refresh asset price by ticker' })
  @ApiParam({ name: 'ticker', description: 'ticker', example: 'AAPL' })
  @ApiResponse({ status: 200, description: '200 SUCCESS' })
  @Get('ticker/:ticker/refresh-price')
  refreshPriceByTicker(@Param('ticker') ticker: string) {
    return this.assetsService.refreshPriceByTicker(ticker);
  }

  @ApiOperation({ summary: 'Get history of an asset by ID' })
  @ApiParam({ name: 'id', description: 'AssetID', example: '1' })
  @ApiQuery({ name: 'startDate', description: 'Start date', example: '2025-06-30', required: false })
  @ApiQuery({ name: 'endDate', description: 'End date', example: '2024-07-31', required: false })
  @ApiQuery({ name: 'page', description: 'page number', example: 1, required: false })
  @ApiQuery({ name: 'limit', description: 'page size', example: 30, required: false })
  @ApiResponse({ status: 200, description: 'History list of an asset' })
  @Get(':id/history')
  getAssetHistory(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const queryDto: AssetHistoryQueryDto = {
      startDate,
      endDate,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    };
    return this.assetsService.getAssetHistory(+id, queryDto);
  }

  @ApiOperation({ summary: 'Get history of an asset by Ticker' })
  @ApiParam({ name: 'ticker', description: '股票代码', example: 'AAPL' })
  @ApiQuery({ name: 'startDate', description: '开始日期', example: '2025-06-030', required: false })
  @ApiQuery({ name: 'endDate', description: '结束日期', example: '2025-07-31', required: false })
  @ApiQuery({ name: 'page', description: '页码', example: 1, required: false })
  @ApiQuery({ name: 'limit', description: '每页数量', example: 30, required: false })
  @ApiResponse({ status: 200, description: '历史记录列表' })
  @Get('ticker/:ticker/history')
  getAssetHistoryByTicker(
    @Param('ticker') ticker: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const queryDto: AssetHistoryQueryDto = {
      startDate,
      endDate,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    };
    return this.assetsService.getAssetHistoryByTicker(ticker, queryDto);
  }

  @ApiOperation({ summary: '获取资产最新历史记录' })
  @ApiParam({ name: 'id', description: '资产ID', example: '1' })
  @ApiResponse({ status: 200, description: '最新历史记录' })
  @Get(':id/history/latest')
  getLatestAssetHistory(@Param('id') id: string) {
    return this.assetsService.getLatestAssetHistory(+id);
  }

  @ApiOperation({ summary: '根据Ticker获取资产最新历史记录' })
  @ApiParam({ name: 'ticker', description: '股票代码', example: 'AAPL' })
  @ApiResponse({ status: 200, description: '最新历史记录' })
  @Get('ticker/:ticker/history/latest')
  getLatestAssetHistoryByTicker(@Param('ticker') ticker: string) {
    return this.assetsService.getLatestAssetHistoryByTicker(ticker);
  }

  @ApiOperation({ summary: '获取资产历史记录统计信息' })
  @ApiParam({ name: 'id', description: '资产ID', example: '1' })
  @ApiQuery({ name: 'days', description: '统计天数', example: 30, required: false })
  @ApiResponse({ status: 200, description: '历史记录统计信息' })
  @Get(':id/history/stats')
  getAssetHistoryStats(
    @Param('id') id: string,
    @Query('days') days?: string,
  ) {
    return this.assetsService.getAssetHistoryStats(+id, days ? +days : undefined);
  }
} 