import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { PortfolioService } from './portfolio.service';

@ApiTags('portfolio')
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @ApiOperation({ summary: '获取用户的完整投资组合信息，按类型分组' })
  @ApiParam({ name: 'username', description: '用户名', example: 'john_doe' })
  @ApiResponse({ status: 200, description: '投资组合信息' })
  @Get(':username')
  async getPortfolio(@Param('username') username: string) {
    return await this.portfolioService.getPortfolioByUsername(username);
  }

  @ApiOperation({ summary: '获取投资组合的Top涨跌幅股票' })
  @ApiParam({ name: 'username', description: '用户名', example: 'john_doe' })
  @ApiQuery({ name: 'limit', description: '返回数量限制', required: false, example: '5' })
  @ApiResponse({ status: 200, description: '性能数据' })
  @Get(':username/performance')
  async getPerformance(
    @Param('username') username: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit) : 5;
    return await this.portfolioService.getTopPerformers(username, limitNum);
  }

  @ApiOperation({ summary: '获取投资组合历史表现' })
  @ApiParam({ name: 'username', description: '用户名', example: 'john_doe' })
  @ApiQuery({ name: 'days', description: '历史天数', required: false, example: '30' })
  @ApiResponse({ status: 200, description: '历史表现数据' })
  @Get(':username/history')
  async getHistory(
    @Param('username') username: string,
    @Query('days') days?: string,
  ) {
    const daysNum = days ? parseInt(days) : 30;
    return await this.portfolioService.getPortfolioHistory(username, daysNum);
  }

  @ApiOperation({ summary: '刷新投资组合中所有资产的价格' })
  @ApiParam({ name: 'username', description: '用户名', example: 'john_doe' })
  @ApiResponse({ status: 200, description: '价格刷新结果' })
  @Get(':username/refresh-prices')
  async refreshPrices(@Param('username') username: string) {
    return await this.portfolioService.refreshPortfolioPrices(username);
  }
} 