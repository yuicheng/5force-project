import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiBody, ApiResponse } from '@nestjs/swagger';
import { TransactionsService, CreateTransactionDto, UpdateTransactionDto } from './transactions.service';

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @ApiOperation({ summary: 'Create a transaction record' })
  @ApiBody({ schema: { type: 'object', properties: { accountId: { type: 'number', example: 1 }, transactionType: { type: 'string', example: 'buy' }, transactionDate: { type: 'string', format: 'date-time', example: '2024-01-15T10:00:00Z' }, quantity: { type: 'number', example: 100 }, pricePerUnit: { type: 'number', example: 150.25 }, totalAmount: { type: 'number', example: 15025 }, description: { type: 'string', example: 'Bought Apple stock' }, assetId: { type: 'number', example: 1 } } } })
  @ApiResponse({ status: 201, description: 'Created' })
  @Post()
  create(@Body() createTransactionDto: CreateTransactionDto) {
    return this.transactionsService.create(createTransactionDto);
  }

  @ApiOperation({ summary: 'Get all transaction records' })
  @ApiResponse({ status: 200, description: 'Transaction records list' })
  @Get()
  findAll() {
    return this.transactionsService.findAll();
  }

  @ApiOperation({ summary: 'Get transaction records by accountId' })
  @ApiParam({ name: 'accountId', description: 'Account ID', example: '1' })
  @ApiResponse({ status: 200, description: 'Transaction records list' })
  @Get('account/:accountId')
  findByAccount(@Param('accountId') accountId: string) {
    return this.transactionsService.findByAccount(+accountId);
  }

  @ApiOperation({ summary: 'Get transaction records by username' })
  @ApiParam({ name: 'username', description: 'Username', example: '5force' })
  @ApiResponse({ status: 200, description: 'Transaction records list' })
  @Get('user/:username')
  findByUsername(@Param('username') username: string) {
    return this.transactionsService.findByUsername(username);
  }

  @ApiOperation({ summary: 'Get transaction record by id' })
  @ApiParam({ name: 'id', description: 'Transaction ID', example: '1' })
  @ApiResponse({ status: 200, description: 'Transaction record' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.transactionsService.findOne(+id);
  }

  @ApiOperation({ summary: 'Update a transaction record' })
  @ApiParam({ name: 'id', description: 'Transaction ID', example: '1' })
  @ApiBody({ schema: { type: 'object', properties: { transactionType: { type: 'string' }, transactionDate: { type: 'string', format: 'date-time' }, quantity: { type: 'number' }, pricePerUnit: { type: 'number' }, totalAmount: { type: 'number' }, description: { type: 'string' }, assetId: { type: 'number' } } } })
  @ApiResponse({ status: 200, description: 'Updated' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTransactionDto: UpdateTransactionDto) {
    return this.transactionsService.update(+id, updateTransactionDto);
  }

  @ApiOperation({ summary: 'Delete a transaction record' })
  @ApiParam({ name: 'id', description: 'Transaction ID', example: '1' })
  @ApiResponse({ status: 200, description: 'Deleted' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.transactionsService.remove(+id);
  }

  @ApiOperation({ summary: 'Get cashflow analysis by username' })
  @ApiParam({ name: 'username', description: 'Username', example: '5force' })
  @ApiQuery({ name: 'days', description: 'Max days', required: false, example: '30' })
  @ApiResponse({ status: 200, description: 'Cashflow analysis result' })
  @Get('cashflow/:username')
  getCashflowAnalysis(
    @Param('username') username: string,
    @Query('days') days?: string,
  ) {
    const daysNum = days ? parseInt(days) : 30;
    return this.transactionsService.getCashflowAnalysis(username, daysNum);
  }

  @ApiOperation({ summary: 'Get cashflow analysis by asset type' })
  @ApiParam({ name: 'username', description: 'Username', example: '5force' })
  @ApiQuery({ name: 'days', description: 'Max days', required: false, example: '30' })
  @ApiResponse({ status: 200, description: 'Cashflow analysis result' })
  @Get('cashflow/:username/by-asset-type')
  getCashflowByAssetType(
    @Param('username') username: string,
    @Query('days') days?: string,
  ) {
    const daysNum = days ? parseInt(days) : 30;
    return this.transactionsService.getCashflowByAssetType(username, daysNum);
  }

  @ApiOperation({ summary: 'Get transaction stats' })
  @ApiParam({ name: 'username', description: 'Username', example: '5force' })
  @ApiQuery({ name: 'days', description: 'Max days', required: false, example: '30' })
  @ApiResponse({ status: 200, description: 'Transaction stats data' })
  @Get('stats/:username')
  getTransactionStats(
    @Param('username') username: string,
    @Query('days') days?: string,
  ) {
    const daysNum = days ? parseInt(days) : 30;
    return this.transactionsService.getTransactionStats(username, daysNum);
  }
} 