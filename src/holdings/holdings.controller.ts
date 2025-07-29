import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiBody, ApiResponse } from '@nestjs/swagger';
import { HoldingsService, CreateHoldingDto, UpdateHoldingDto, BatchCreateHoldingDto, AddToPortfolioDto, SellByTickerDto, SellAllByTickerDto } from './holdings.service';

@ApiTags('holdings')
@Controller('holdings')
export class HoldingsController {
  constructor(private readonly holdingsService: HoldingsService) {}

  @ApiOperation({ summary: '创建持仓' })
  @ApiBody({ schema: { type: 'object', properties: { accountId: { type: 'number', example: 1 }, assetId: { type: 'number', example: 1 }, quantity: { type: 'number', example: 100 }, averageCostBasis: { type: 'number', example: 140.00 } } } })
  @ApiResponse({ status: 201, description: '持仓创建成功' })
  @Post()
  create(@Body() createHoldingDto: CreateHoldingDto) {
    return this.holdingsService.create(createHoldingDto);
  }

  @ApiOperation({ summary: '批量创建持仓' })
  @ApiBody({ schema: { type: 'object', properties: { holdings: { type: 'array', items: { type: 'object', properties: { accountId: { type: 'number' }, assetId: { type: 'number' }, quantity: { type: 'number' }, averageCostBasis: { type: 'number' } } } } } } })
  @ApiResponse({ status: 201, description: '批量创建结果' })
  @Post('batch')
  batchCreate(@Body() batchDto: BatchCreateHoldingDto) {
    return this.holdingsService.batchCreate(batchDto);
  }

  @ApiOperation({ summary: '添加资产到投资组合（On Demand Populate）' })
  @ApiBody({ 
    schema: { 
      type: 'object', 
      properties: { 
        username: { type: 'string', example: '5force' }, 
        ticker: { type: 'string', example: 'AAPL' }, 
        accountId: { type: 'number', example: 1 }, 
        quantity: { type: 'number', example: 100 }, 
        price: { type: 'number', example: 150.25, description: '(Optional) Price' },
        transactionDate: { type: 'string', example: '2024-01-15', description: 'Transaction date (YYYY-MM-DD)' },
        updateMarketPrice: { type: 'boolean', example: false, description: 'Update Market Price (Optinal)' },
        description: { type: 'string', example: 'Initial purchase', description: 'Tx description (Optional)' }
      },
      required: ['username', 'ticker', 'accountId', 'quantity']
    } 
  })
  @ApiResponse({ status: 201, description: '资产添加成功' })
  @Post('add-to-portfolio')
  addToPortfolio(@Body() addToPortfolioDto: AddToPortfolioDto) {
    return this.holdingsService.addToPortfolio(addToPortfolioDto);
  }

  @ApiOperation({ summary: '获取所有持仓' })
  @ApiResponse({ status: 200, description: '持仓列表' })
  @Get()
  findAll() {
    return this.holdingsService.findAll();
  }

  @ApiOperation({ summary: '根据账户ID获取持仓' })
  @ApiParam({ name: 'accountId', description: '账户ID', example: '1' })
  @ApiResponse({ status: 200, description: '账户持仓列表' })
  @Get('account/:accountId')
  findByAccount(@Param('accountId') accountId: string) {
    return this.holdingsService.findByAccount(+accountId);
  }

  @ApiOperation({ summary: '根据用户名获取持仓' })
  @ApiParam({ name: 'username', description: '用户名', example: '5force' })
  @ApiResponse({ status: 200, description: '用户持仓列表' })
  @Get('user/:username')
  findByUsername(@Param('username') username: string) {
    return this.holdingsService.findByUsername(username);
  }

  @ApiOperation({ summary: '根据ID获取持仓' })
  @ApiParam({ name: 'id', description: '持仓ID', example: '1' })
  @ApiResponse({ status: 200, description: '持仓详情' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.holdingsService.findOne(+id);
  }

  @ApiOperation({ summary: '更新持仓' })
  @ApiParam({ name: 'id', description: '持仓ID', example: '1' })
  @ApiBody({ schema: { type: 'object', properties: { quantity: { type: 'number', example: 150 }, averageCostBasis: { type: 'number', example: 145.00 } } } })
  @ApiResponse({ status: 200, description: '更新成功' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateHoldingDto: UpdateHoldingDto) {
    return this.holdingsService.update(+id, updateHoldingDto);
  }

  @ApiOperation({ summary: '删除持仓' })
  @ApiParam({ name: 'id', description: '持仓ID', example: '1' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.holdingsService.remove(+id);
  }

  @ApiOperation({ summary: '批量删除持仓' })
  @ApiBody({ schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'number' }, example: [1, 2, 3] } } } })
  @ApiResponse({ status: 200, description: '批量删除结果' })
  @Delete('batch')
  batchRemove(@Body('ids') ids: number[]) {
    return this.holdingsService.batchRemove(ids);
  }

  @ApiOperation({ summary: '卖出持仓' })
  @ApiParam({ name: 'id', description: '持仓ID', example: '1' })
  @ApiBody({ schema: { type: 'object', properties: { quantity: { type: 'number', example: 50 }, price: { type: 'number', example: 155.00 } } } })
  @ApiResponse({ status: 200, description: '卖出成功' })
  @Post(':id/sell')
  sellHolding(
    @Param('id') id: string,
    @Body('quantity') quantity: number,
    @Body('price') price?: number,
  ) {
    return this.holdingsService.sellHolding(+id, quantity, price);
  }

  @ApiOperation({ summary: '卖出全部持仓（最简单方式，推荐前端使用）' })
  @ApiBody({ 
    schema: { 
      type: 'object', 
      properties: { 
        username: { type: 'string', example: '5force', description: '用户名' },
        ticker: { type: 'string', example: 'AAPL', description: '股票代码' }
      },
      required: ['username', 'ticker']
    } 
  })
  @ApiResponse({ status: 200, description: '全部卖出成功' })
  @Post('sell-all-by-ticker')
  sellAllByTicker(@Body() sellAllDto: SellAllByTickerDto) {
    return this.holdingsService.sellAllByTicker(sellAllDto);
  }

  @ApiOperation({ summary: '通过股票代码卖出指定数量持仓（高级用法）' })
  @ApiBody({ 
    schema: { 
      type: 'object', 
      properties: { 
        username: { type: 'string', example: '5force', description: '用户名' },
        ticker: { type: 'string', example: 'SOME', description: '股票代码' }, 
        quantity: { type: 'number', example: 50, description: '卖出数量' }, 
        price: { type: 'number', example: 155.00, description: '卖出价格（可选，不提供则使用市场价格）' },
        accountId: { type: 'number', example: 1, description: '账户ID（可选，不提供则使用用户的默认账户）' }
      },
      required: ['username', 'ticker', 'quantity']
    } 
  })
  @ApiResponse({ status: 200, description: '卖出成功' })
  @Post('sell-by-ticker')
  sellByTicker(@Body() sellByTickerDto: SellByTickerDto) {
    return this.holdingsService.sellByTicker(sellByTickerDto);
  }
} 