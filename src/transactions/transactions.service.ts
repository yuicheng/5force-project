import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateTransactionDto {
  accountId: number;
  transactionType: string;
  transactionDate: Date;
  quantity?: number;
  pricePerUnit?: number;
  totalAmount: number;
  description?: string;
  assetId?: number;
}

export interface UpdateTransactionDto {
  transactionType?: string;
  transactionDate?: Date;
  quantity?: number;
  pricePerUnit?: number;
  totalAmount?: number;
  description?: string;
  assetId?: number;
}

export interface CashflowSummary {
  period: string;
  income: number;
  spending: number;
  netCashflow: number;
  transactions: any[];
}

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 创建交易记录
   */
  async create(createTransactionDto: CreateTransactionDto) {
    const transaction = await this.prisma.transaction.create({
      data: {
        accountId: createTransactionDto.accountId,
        transaction_type: createTransactionDto.transactionType as any,
        transaction_date: createTransactionDto.transactionDate,
        quantity: createTransactionDto.quantity,
        price_per_unit: createTransactionDto.pricePerUnit,
        total_amount: createTransactionDto.totalAmount,
        description: createTransactionDto.description,
        assetId: createTransactionDto.assetId,
      },
      include: {
        account: true,
        asset: true,
      },
    });

    return transaction;
  }

  /**
   * 获取所有交易记录
   */
  async findAll() {
    return await this.prisma.transaction.findMany({
      include: {
        account: true,
        asset: true,
      },
      orderBy: { transaction_date: 'desc' },
    });
  }

  /**
   * 根据ID获取交易记录
   */
  async findOne(id: number) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        account: true,
        asset: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    return transaction;
  }

  /**
   * 根据账户ID获取交易记录
   */
  async findByAccount(accountId: number) {
    return await this.prisma.transaction.findMany({
      where: { accountId: accountId },
      include: {
        account: true,
        asset: true,
      },
      orderBy: { transaction_date: 'desc' },
    });
  }

  /**
   * 根据用户名获取交易记录
   */
  async findByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        portfolio: {
          include: {
            accounts: {
              include: {
                transactions: {
                  include: {
                    asset: true,
                  },
                  orderBy: { transaction_date: 'desc' },
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

    const allTransactions = user.portfolio.accounts.flatMap(account => account.transactions);
    return allTransactions.sort((a, b) => b.transaction_date.getTime() - a.transaction_date.getTime());
  }

  /**
   * 更新交易记录
   */
  async update(id: number, updateTransactionDto: UpdateTransactionDto) {
    await this.findOne(id);

    const updatedTransaction = await this.prisma.transaction.update({
      where: { id },
      data: {
        ...(updateTransactionDto.transactionType && { transaction_type: updateTransactionDto.transactionType as any }),
        ...(updateTransactionDto.transactionDate && { transaction_date: updateTransactionDto.transactionDate }),
        ...(updateTransactionDto.quantity !== undefined && { quantity: updateTransactionDto.quantity }),
        ...(updateTransactionDto.pricePerUnit !== undefined && { price_per_unit: updateTransactionDto.pricePerUnit }),
        ...(updateTransactionDto.totalAmount !== undefined && { total_amount: updateTransactionDto.totalAmount }),
        ...(updateTransactionDto.description && { description: updateTransactionDto.description }),
        ...(updateTransactionDto.assetId !== undefined && { asset_id: updateTransactionDto.assetId }),
      },
      include: {
        account: true,
        asset: true,
      },
    });

    return updatedTransaction;
  }

  /**
   * 删除交易记录
   */
  async remove(id: number) {
    await this.findOne(id);

    await this.prisma.transaction.delete({
      where: { id },
    });

    return { message: `Transaction with ID ${id} has been deleted` };
  }

  /**
   * 获取30天现金流分析
   */
  async getCashflowAnalysis(username: string, days: number = 30): Promise<CashflowSummary> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - days);

    const transactions = await this.findByUsername(username);
    
    const recentTransactions = transactions.filter(
      transaction => transaction.transaction_date >= thirtyDaysAgo
    );

    let income = 0;
    let spending = 0;

    recentTransactions.forEach(transaction => {
      const amount = Number(transaction.total_amount);
      
      // 收入类型：deposit, dividend, interest
      if (['deposit', 'dividend', 'interest'].includes(transaction.transaction_type)) {
        income += amount;
      } else {
        // 支出类型：withdrawal, fee, buy, sell (卖出可能是收入，但这里简化处理)
        spending += amount;
      }
    });

    return {
      period: `Last ${days} days`,
      income,
      spending,
      netCashflow: income - spending,
      transactions: recentTransactions,
    };
  }

  /**
   * 按投资类型分组的现金流分析
   */
  async getCashflowByAssetType(username: string, days: number = 30) {
    const cashflowSummary = await this.getCashflowAnalysis(username, days);
    
    const groupedTransactions = {};
    
    cashflowSummary.transactions.forEach(transaction => {
      const assetType = transaction.asset?.asset_type || 'cash';
      
      if (!groupedTransactions[assetType]) {
        groupedTransactions[assetType] = {
          income: 0,
          spending: 0,
          transactions: [],
        };
      }

      const amount = Number(transaction.total_amount);
      
      if (['deposit', 'dividend', 'interest'].includes(transaction.transaction_type)) {
        groupedTransactions[assetType].income += amount;
      } else {
        groupedTransactions[assetType].spending += amount;
      }
      
      groupedTransactions[assetType].transactions.push(transaction);
    });

    // 计算每个类型的净现金流
    Object.keys(groupedTransactions).forEach(assetType => {
      groupedTransactions[assetType].netCashflow = 
        groupedTransactions[assetType].income - groupedTransactions[assetType].spending;
    });

    return {
      period: `Last ${days} days`,
      summary: cashflowSummary,
      byAssetType: groupedTransactions,
    };
  }

  /**
   * 获取交易统计
   */
  async getTransactionStats(username: string, days: number = 30) {
    const transactions = await this.findByUsername(username);
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - days);
    
    const recentTransactions = transactions.filter(
      transaction => transaction.transaction_date >= thirtyDaysAgo
    );

    const stats = {
      totalTransactions: recentTransactions.length,
      totalVolume: recentTransactions.reduce((sum, t) => sum + Number(t.total_amount), 0),
      byType: {},
      byAsset: {},
    };

    // 按类型统计
    recentTransactions.forEach(transaction => {
      const type = transaction.transaction_type;
      if (!stats.byType[type]) {
        stats.byType[type] = { count: 0, volume: 0 };
      }
      stats.byType[type].count++;
      stats.byType[type].volume += Number(transaction.total_amount);
    });

    // 按资产统计
    recentTransactions.forEach(transaction => {
      const assetName = transaction.asset?.name || 'Cash';
      if (!stats.byAsset[assetName]) {
        stats.byAsset[assetName] = { count: 0, volume: 0 };
      }
      stats.byAsset[assetName].count++;
      stats.byAsset[assetName].volume += Number(transaction.total_amount);
    });

    return stats;
  }
} 