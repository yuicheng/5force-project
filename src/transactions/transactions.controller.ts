import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiBody, ApiResponse } from '@nestjs/swagger';
import { TransactionsService, CreateTransactionDto, UpdateTransactionDto } from './transactions.service';

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @ApiOperation({ summary: '创建交易记录' })
  @ApiBody({ schema: { type: 'object', properties: { accountId: { type: 'number', example: 1 }, transactionType: { type: 'string', example: 'buy' }, transactionDate: { type: 'string', format: 'date-time', example: '2024-01-15T10:00:00Z' }, quantity: { type: 'number', example: 100 }, pricePerUnit: { type: 'number', example: 150.25 }, totalAmount: { type: 'number', example: 15025 }, description: { type: 'string', example: 'Bought Apple stock' }, assetId: { type: 'number', example: 1 } } } })
  @ApiResponse({ status: 201, description: '交易记录创建成功' })
  @Post()
  create(@Body() createTransactionDto: CreateTransactionDto) {
    return this.transactionsService.create(createTransactionDto);
  }

  @ApiOperation({ summary: '获取所有交易记录' })
  @ApiResponse({ status: 200, description: '交易记录列表' })
  @Get()
  findAll() {
    return this.transactionsService.findAll();
  }

  @ApiOperation({ summary: '根据账户ID获取交易记录' })
  @ApiParam({ name: 'accountId', description: '账户ID', example: '1' })
  @ApiResponse({ status: 200, description: '账户交易记录' })
  @Get('account/:accountId')
  findByAccount(@Param('accountId') accountId: string) {
    return this.transactionsService.findByAccount(+accountId);
  }

  @ApiOperation({ summary: '根据用户名获取交易记录' })
  @ApiParam({ name: 'username', description: '用户名', example: '5force' })
  @ApiResponse({ status: 200, description: '用户交易记录' })
  @Get('user/:username')
  findByUsername(@Param('username') username: string) {
    return this.transactionsService.findByUsername(username);
  }

  @ApiOperation({ summary: '根据ID获取交易记录' })
  @ApiParam({ name: 'id', description: '交易记录ID', example: '1' })
  @ApiResponse({ status: 200, description: '交易记录详情' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.transactionsService.findOne(+id);
  }

  @ApiOperation({ summary: '更新交易记录' })
  @ApiParam({ name: 'id', description: '交易记录ID', example: '1' })
  @ApiBody({ schema: { type: 'object', properties: { transactionType: { type: 'string' }, transactionDate: { type: 'string', format: 'date-time' }, quantity: { type: 'number' }, pricePerUnit: { type: 'number' }, totalAmount: { type: 'number' }, description: { type: 'string' }, assetId: { type: 'number' } } } })
  @ApiResponse({ status: 200, description: '更新成功' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTransactionDto: UpdateTransactionDto) {
    return this.transactionsService.update(+id, updateTransactionDto);
  }

  @ApiOperation({ summary: '删除交易记录' })
  @ApiParam({ name: 'id', description: '交易记录ID', example: '1' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.transactionsService.remove(+id);
  }

  @ApiOperation({ summary: '获取30天现金流分析' })
  @ApiParam({ name: 'username', description: '用户名', example: '5force' })
  @ApiQuery({ name: 'days', description: '分析天数', required: false, example: '30' })
  @ApiResponse({ status: 200, description: '现金流分析结果' })
  @Get('cashflow/:username')
  getCashflowAnalysis(
    @Param('username') username: string,
    @Query('days') days?: string,
  ) {
    const daysNum = days ? parseInt(days) : 30;
    return this.transactionsService.getCashflowAnalysis(username, daysNum);
  }

  @ApiOperation({ summary: '按资产类型分组的现金流分析' })
  @ApiParam({ name: 'username', description: '用户名', example: '5force' })
  @ApiQuery({ name: 'days', description: '分析天数', required: false, example: '30' })
  @ApiResponse({ status: 200, description: '分组现金流分析结果' })
  @Get('cashflow/:username/by-asset-type')
  getCashflowByAssetType(
    @Param('username') username: string,
    @Query('days') days?: string,
  ) {
    const daysNum = days ? parseInt(days) : 30;
    return this.transactionsService.getCashflowByAssetType(username, daysNum);
  }

  @ApiOperation({ summary: '获取交易统计' })
  @ApiParam({ name: 'username', description: '用户名', example: '5force' })
  @ApiQuery({ name: 'days', description: '统计天数', required: false, example: '30' })
  @ApiResponse({ status: 200, description: '交易统计数据' })
  @Get('stats/:username')
  getTransactionStats(
    @Param('username') username: string,
    @Query('days') days?: string,
  ) {
    const daysNum = days ? parseInt(days) : 30;
    return this.transactionsService.getTransactionStats(username, daysNum);
  }
} 