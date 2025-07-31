import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { PortfolioService } from './portfolio.service';

@ApiTags('portfolio')
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @ApiOperation({ summary: 'Get portfolio by username' })
  @ApiParam({ name: 'username', description: 'Username', example: '5force' })
  @ApiResponse({ status: 200, description: 'portfolio' })
  @Get(':username')
  async getPortfolio(@Param('username') username: string) {
    return await this.portfolioService.getPortfolioByUsername(username);
  }

  @ApiOperation({ summary: 'Get gainers and losers of ' })
  @ApiParam({ name: 'username', description: 'username', example: '5force' })
  @ApiQuery({ name: 'limit', description: 'Max entries', required: false, example: '5' })
  @ApiResponse({ status: 200, description: 'Gainers and Losers list' })
  @Get(':username/performance')
  async getPerformance(
    @Param('username') username: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit) : 5;
    return await this.portfolioService.getTopPerformers(username, limitNum);
  }

  @ApiOperation({ summary: 'Get portfolio history by username' })
  @ApiParam({ name: 'username', description: 'Username', example: '5force' })
  @ApiQuery({ name: 'days', description: 'Days', required: false, example: '30' })
  @ApiResponse({ status: 200, description: 'History data' })
  @Get(':username/history')
  async getHistory(
    @Param('username') username: string,
    @Query('days') days?: string,
  ) {
    const daysNum = days ? parseInt(days) : 30;
    return await this.portfolioService.getPortfolioHistory(username, daysNum);
  }

  @ApiOperation({ summary: 'Refresh all assets in portfolio' })
  @ApiParam({ name: 'username', description: 'Username', example: '5force' })
  @ApiResponse({ status: 200, description: 'Refresh result' })
  @Get(':username/refresh-prices')
  async refreshPrices(@Param('username') username: string) {
    return await this.portfolioService.refreshPortfolioPrices(username);
  }
} 