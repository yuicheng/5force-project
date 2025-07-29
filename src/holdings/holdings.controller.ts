import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiBody, ApiResponse } from '@nestjs/swagger';
import { HoldingsService, CreateHoldingDto, UpdateHoldingDto, BatchCreateHoldingDto, AddToPortfolioDto, SellByTickerDto, SellAllByTickerDto, SellHoldingDto } from './holdings.service';

@ApiTags('holdings')
@Controller('holdings')
export class HoldingsController {
  constructor(private readonly holdingsService: HoldingsService) {}

  @ApiOperation({ summary: 'Create a holding' })
  @ApiBody({ schema: { type: 'object', properties: { accountId: { type: 'number', example: 1 }, assetId: { type: 'number', example: 1 }, quantity: { type: 'number', example: 100 }, averageCostBasis: { type: 'number', example: 140.00 } } } })
  @ApiResponse({ status: 201, description: 'Holding created successfully' })
  @Post()
  create(@Body() createHoldingDto: CreateHoldingDto) {
    return this.holdingsService.create(createHoldingDto);
  }

  @ApiOperation({ summary: 'Batch create holdings' })
  @ApiBody({ schema: { type: 'object', properties: { holdings: { type: 'array', items: { type: 'object', properties: { accountId: { type: 'number' }, assetId: { type: 'number' }, quantity: { type: 'number' }, averageCostBasis: { type: 'number' } } } } } } })
  @ApiResponse({ status: 201, description: 'Batch create result' })
  @Post('batch')
  batchCreate(@Body() batchDto: BatchCreateHoldingDto) {
    return this.holdingsService.batchCreate(batchDto);
  }

  @ApiOperation({ summary: 'Add asset to portfolio' })
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
  @ApiResponse({ status: 201, description: 'Asset added successfully' })
  @Post('add-to-portfolio')
  addToPortfolio(@Body() addToPortfolioDto: AddToPortfolioDto) {
    return this.holdingsService.addToPortfolio(addToPortfolioDto);
  }

  @ApiOperation({ summary: 'Get all holdings' })
  @ApiResponse({ status: 200, description: 'List of holdings' })
  @Get()
  findAll() {
    return this.holdingsService.findAll();
  }

  @ApiOperation({ summary: 'Get all holdings by account id' })
  @ApiParam({ name: 'accountId', description: 'Account ID', example: '1' })
  @ApiResponse({ status: 200, description: 'List of holdings of account id' })
  @Get('account/:accountId')
  findByAccount(@Param('accountId') accountId: string) {
    return this.holdingsService.findByAccount(+accountId);
  }

  @ApiOperation({ summary: 'Get all holdings by username' })
  @ApiParam({ name: 'username', description: 'User name', example: '5force' })
  @ApiResponse({ status: 200, description: 'List of holdings of user name' })
  @Get('user/:username')
  findByUsername(@Param('username') username: string) {
    return this.holdingsService.findByUsername(username);
  }

  @ApiOperation({ summary: 'Get holding by id' })
  @ApiParam({ name: 'holdingId', description: 'Holding ID', example: '1' })
  @ApiResponse({ status: 200, description: 'Holding details' })
  @Get(':id')
  findOne(@Param('holdingId') id: string) {
    return this.holdingsService.findOne(+id);
  }

  @ApiOperation({ summary: 'Update holding' })
  @ApiParam({ name: 'id', description: 'Holding ID', example: '1' })
  @ApiBody({ schema: { type: 'object', properties: { quantity: { type: 'number', example: 150 }, averageCostBasis: { type: 'number', example: 145.00 } } } })
  @ApiResponse({ status: 200, description: 'Update success' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateHoldingDto: UpdateHoldingDto) {
    return this.holdingsService.update(+id, updateHoldingDto);
  }

  @ApiOperation({ summary: 'Delete Holding' })
  @ApiParam({ name: 'id', description: 'Holding ID', example: '1' })
  @ApiResponse({ status: 200, description: 'Delete success' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.holdingsService.remove(+id);
  }

  @ApiOperation({ summary: 'Batch delete holdings' })
  @ApiBody({ schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'number' }, example: [1, 2, 3] } } } })
  @ApiResponse({ status: 200, description: 'Batch delete result' })
  @Delete('batch')
  batchRemove(@Body('ids') ids: number[]) {
    return this.holdingsService.batchRemove(ids);
  }

  @ApiOperation({ summary: 'Sell holding by id and quantity, optional price' })
  @ApiParam({ name: 'id', description: 'Holding ID', example: '1' })
  @ApiBody({ schema: { type: 'object', properties: { quantity: { type: 'number', example: 50 }, price: { type: 'number', example: 155.00 } } } })
  @ApiResponse({ status: 200, description: 'Sell success' })
  @Post(':id/sell')
  sellHolding(
    @Param('id') id: string,
    @Body('quantity') quantity: number,
    @Body('price') price?: number,
  ) {
    return this.holdingsService.sellHolding(+id, quantity, price);
  }


  @ApiOperation({ summary: 'Sell a holding of user and ticker, optional quantity and price'})
  @ApiBody({ 
    schema: { 
      type: 'object', 
      properties: { 
        username: { type: 'string', example: '5force', description: 'username' },
        ticker: { type: 'string', example: 'AAPL', description: 'ticker' }, 
        quantity: { type: 'number', example: 50, description: 'quantity (Optional)' }, 
        price: { type: 'number', example: 155.00, description: 'price (Optional)' }
      },
      required: ['username', 'ticker']
    } 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Sell success',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        ticker: { type: 'string' },
        quantity: { type: 'number' },
        sellPrice: { type: 'number' },
        totalAmount: { type: 'number' },
        isFullSell: { type: 'boolean' },
        remainingHolding: { 
          type: 'object',
          nullable: true,
          description: 'Remaining holding info (null for full sell)'
        }
      }
    }
  })
  @Post('sell')
  sellByTickerUnified(@Body() sellDto: SellHoldingDto) {
    return this.holdingsService.sellByTickerUnified(sellDto);
  }
} 