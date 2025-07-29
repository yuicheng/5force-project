const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyData() {
  try {
    console.log('🔍 验证数据库数据...\n');

    // 1. 检查用户
    const users = await prisma.user.findMany();
    console.log('👤 用户数量:', users.length);
    if (users.length > 0) {
      console.log('用户详情:', users[0]);
    }

    // 2. 检查投资组合
    const portfolios = await prisma.portfolio.findMany({
      include: {
        user: true,
      },
    });
    console.log('\n📊 投资组合数量:', portfolios.length);
    if (portfolios.length > 0) {
      console.log('投资组合详情:', portfolios[0]);
    }

    // 3. 检查账户
    const accounts = await prisma.account.findMany({
      include: {
        portfolio: true,
      },
    });
    console.log('\n🏦 账户数量:', accounts.length);
    if (accounts.length > 0) {
      console.log('账户详情:', accounts[0]);
    }

    // 4. 检查资产
    const assets = await prisma.asset.findMany();
    console.log('\n💹 资产数量:', assets.length);
    if (assets.length > 0) {
      console.log('资产列表:');
      assets.forEach(asset => {
        console.log(`  - ${asset.ticker_symbol}: ${asset.name} (${asset.asset_type})`);
      });
    }

    // 5. 检查持仓
    const holdings = await prisma.holding.findMany({
      include: {
        asset: true,
        account: true,
      },
    });
    console.log('\n📈 持仓数量:', holdings.length);
    if (holdings.length > 0) {
      console.log('持仓详情:');
      holdings.forEach(holding => {
        console.log(`  - ${holding.asset.ticker_symbol}: ${holding.quantity} 股, 平均成本: $${holding.average_cost_basis}`);
      });
    }

    // 6. 检查交易记录
    const transactions = await prisma.transaction.findMany({
      include: {
        asset: true,
        account: true,
      },
    });
    console.log('\n💰 交易记录数量:', transactions.length);
    if (transactions.length > 0) {
      console.log('交易记录:');
      transactions.forEach(tx => {
        const assetName = tx.asset ? tx.asset.ticker_symbol : '现金';
        console.log(`  - ${tx.transaction_date.toLocaleDateString()}: ${tx.transaction_type} ${assetName}, 金额: $${tx.total_amount}`);
      });
    }

    // 7. 检查投资组合历史
    const portfolioHistory = await prisma.portfolio_History.findMany({
      include: {
        portfolio: true,
      },
    });
    console.log('\n📅 历史记录数量:', portfolioHistory.length);
    if (portfolioHistory.length > 0) {
      console.log('历史记录:');
      portfolioHistory.forEach(history => {
        console.log(`  - ${history.snapshot_date.toLocaleDateString()}: 净值 $${history.net_worth}, 现金 $${history.cash_value}, 投资 $${history.investment_value}`);
      });
    }

    console.log('\n✅ 数据验证完成！');

  } catch (error) {
    console.error('❌ 数据验证失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行验证脚本
verifyData(); 