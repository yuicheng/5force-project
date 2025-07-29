const { PrismaClient } = require('@prisma/client');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const prisma = new PrismaClient();

// 步骤1: 清理数据库
async function step1_cleanDatabase() {
  try {
    console.log('\n=== 步骤1: 清理数据库 ===');
    console.log('正在清理现有数据...');
    
    // 按依赖关系顺序删除数据 (从最依赖的表到最独立的表)
    console.log('正在删除 Asset_History...');
    await prisma.asset_History.deleteMany({});
    
    console.log('正在删除 Transaction...');
    await prisma.transaction.deleteMany({});
    
    console.log('正在删除 Holding...');
    await prisma.holding.deleteMany({});
    
    console.log('正在删除 Portfolio_History...');
    await prisma.portfolio_History.deleteMany({});
    
    console.log('正在删除 Asset...');
    await prisma.asset.deleteMany({});
    
    console.log('正在删除 Account...');
    await prisma.account.deleteMany({});
    
    console.log('正在删除 Portfolio...');
    await prisma.portfolio.deleteMany({});
    
    console.log('正在删除 User...');
    await prisma.user.deleteMany({});
    
    console.log('✅ 数据清理完成');
  } catch (error) {
    console.log('❌ 数据清理过程中出现错误:', error.message);
    throw error;
  }
}

// 步骤2: 创建用户、投资组合和账户
async function step2_createUserPortfolioAccount() {
  try {
    console.log('\n=== 步骤2: 创建基础数据 ===');
    
    // 创建用户
    console.log('正在创建测试用户...');
    const user = await prisma.user.create({
      data: {
        username: '5force',
        email: 'force@fiveforce.com',
        password_hash: 'DUMMY_HASH',
      },
    });
    console.log('✅ 用户创建成功:', user.username);

    // 创建投资组合
    console.log('正在创建投资组合...');
    const portfolio = await prisma.portfolio.create({
      data: {
        name: '我的投资组合',
        currency: 'USD',
        userId: user.id,
      },
    });
    console.log('✅ 投资组合创建成功:', portfolio.name);

    // 创建账户
    console.log('正在创建投资账户...');
    const account = await prisma.account.create({
      data: {
        institution_name: '测试证券公司',
        account_name: '主要投资账户',
        account_type: 'investment',
        balance_current: 500000.00,
        balance_updated_at: new Date(),
        portfolioId: portfolio.id,
      },
    });
    console.log('✅ 账户创建成功:', account.account_name);

    return { user, portfolio, account };
  } catch (error) {
    console.error('❌ 创建基础数据失败:', error.message);
    throw error;
  }
}

// 步骤3: 从SQLite填充资产数据和历史记录
async function step3_populateAssetsFromSQLite() {
  return new Promise((resolve, reject) => {
    console.log('\n=== 步骤3: 从SQLite填充资产数据和历史记录 ===');
    
    const dbPath = path.join(__dirname, '..', 'finance_portfolio_priority.db');
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ 无法连接到SQLite数据库:', err.message);
        reject(err);
        return;
      }
      console.log('✅ 已连接到SQLite数据库');
    });

    // 首先填充资产数据
    db.all("SELECT asset_id, ticker_symbol, name, asset_type, currency FROM Assets", [], async (err, assetRows) => {
      if (err) {
        console.error('❌ 查询SQLite Assets表失败:', err.message);
        db.close();
        reject(err);
        return;
      }

      try {
        console.log(`📊 从SQLite Assets表读取到 ${assetRows.length} 个资产`);
        
        // 设置时间戳为当前时间1小时+1分钟前
        const timestamp = new Date(Date.now() - (61 * 60 * 1000));
        
        const assets = [];
        const assetIdMapping = {}; // SQLite asset_id -> Prisma Asset id 映射
        
        for (const row of assetRows) {
          // 映射asset_type到Prisma schema的枚举值
          let assetType = 'stock'; // 默认值
          if (row.asset_type) {
            const type = row.asset_type.toLowerCase();
            if (['stock', 'etf', 'option', 'mutual_fund', 'crypto'].includes(type)) {
              assetType = type;
            }
          }

          // 使用Asset_History最近一条的close_price作为当前价格，涨跌幅设为0
          // 查询Asset_History表获取最近一条close_price
          let latestPrice = null;
          try {
            const priceRow = await new Promise((resolve, reject) => {
              db.get(
                `SELECT close_price, date FROM PriceHistory WHERE asset_id = ? ORDER BY date DESC LIMIT 1`,
                [row.asset_id],
                (err, result) => {
                  if (err) reject(err);
                  else resolve(result);
                }
              );
            });
            if (priceRow && priceRow.close_price != null) {
              latestPrice = priceRow.close_price;
            }
          } catch (e) {
            console.warn(`⚠️ 查询资产${row.ticker_symbol}的最新价格失败:`, e.message);
          }

          const assetData = {
            ticker_symbol: row.ticker_symbol,
            name: row.name,
            asset_type: assetType,
            current_price: latestPrice !== null ? latestPrice : 0,
            percent_change_today: 0,
            price_updated_at: timestamp,
            lastUpdated: timestamp,
            currency: row.currency || 'USD',
          };

          assets.push({ sqliteId: row.asset_id, data: assetData });
        }

        // 逐个创建资产，跳过重复的ticker_symbol
        let createdAssetCount = 0;
        console.log('正在创建资产记录...');
        
        for (const assetItem of assets) {
          try {
            const createdAsset = await prisma.asset.create({
              data: assetItem.data,
            });
            assetIdMapping[assetItem.sqliteId] = createdAsset.id;
            createdAssetCount++;
          } catch (error) {
            // 如果是唯一约束冲突，跳过这个资产
            if (error.code === 'P2002') {
              console.log(`⚠️ 跳过重复的资产: ${assetItem.data.ticker_symbol}`);
            } else {
              console.error(`❌ 创建资产 ${assetItem.data.ticker_symbol} 失败:`, error.message);
            }
          }
        }

        console.log(`✅ 成功创建 ${createdAssetCount} 个资产`);

        // 现在填充价格历史数据
        console.log('正在从SQLite PriceHistory表读取历史数据...');
        
        db.all(`SELECT asset_id, date, open_price, high_price, low_price, close_price, volume 
                FROM PriceHistory 
                ORDER BY asset_id, date`, [], async (err, historyRows) => {
          if (err) {
            console.error('❌ 查询SQLite PriceHistory表失败:', err.message);
            db.close();
            reject(err);
            return;
          }

          try {
            console.log(`📈 从SQLite PriceHistory表读取到 ${historyRows.length} 条历史记录`);
            
            let createdHistoryCount = 0;
            let skippedHistoryCount = 0;
            
            console.log('正在创建资产历史记录...');
            
            for (const historyRow of historyRows) {
              // 检查是否有对应的Prisma资产ID
              const prismaAssetId = assetIdMapping[historyRow.asset_id];
              
              if (!prismaAssetId) {
                skippedHistoryCount++;
                continue; // 跳过没有对应资产的历史记录
              }

              try {
                await prisma.asset_History.create({
                  data: {
                    asset_id: prismaAssetId,
                    date: new Date(historyRow.date),
                    open_price: parseFloat(historyRow.open_price).toFixed(2),
                    high_price: parseFloat(historyRow.high_price).toFixed(2),
                    low_price: parseFloat(historyRow.low_price).toFixed(2),
                    close_price: parseFloat(historyRow.close_price).toFixed(2),
                    volume: parseInt(historyRow.volume),
                  },
                });
                createdHistoryCount++;
              } catch (error) {
                // 如果是唯一约束冲突（相同资产相同日期），跳过
                if (error.code === 'P2002') {
                  skippedHistoryCount++;
                } else {
                  console.error(`❌ 创建历史记录失败:`, error.message);
                }
              }
            }

            console.log(`✅ 成功创建 ${createdHistoryCount} 条资产历史记录`);
            if (skippedHistoryCount > 0) {
              console.log(`⚠️ 跳过 ${skippedHistoryCount} 条历史记录（重复或无对应资产）`);
            }

            db.close();
            resolve({
              assetsCreated: createdAssetCount,
              historyCreated: createdHistoryCount
            });

          } catch (error) {
            console.error('❌ 创建资产历史记录失败:', error.message);
            db.close();
            reject(error);
          }
        });

      } catch (error) {
        console.error('❌ 创建资产失败:', error.message);
        db.close();
        reject(error);
      }
    });
  });
}

// 步骤4: 创建持仓和交易记录
async function step4_createHoldingsAndTransactions(account) {
  try {
    console.log('\n=== 步骤4: 创建持仓和交易记录 ===');
    
    // 获取前几个资产用于创建持仓
    console.log('正在获取资产列表...');
    const assets = await prisma.asset.findMany({
      take: 6, // 取前6个资产
      orderBy: { ticker_symbol: 'asc' }
    });
    
    if (assets.length === 0) {
      throw new Error('没有找到任何资产，无法创建持仓');
    }
    
    console.log(`✅ 找到 ${assets.length} 个资产，将为前6个创建持仓`);

    // 创建持仓
    console.log('正在创建持仓记录...');
    const holdings = [];
    const transactions = [];
    
    for (let i = 0; i < Math.min(assets.length, 6); i++) {
      const asset = assets[i];
      const quantity = Math.floor(Math.random() * 100) + 10; // 10-109股
      const averageCost = parseFloat(asset.current_price) * (0.8 + Math.random() * 0.4); // 当前价格的80%-120%
      
      // 创建持仓
      const holding = await prisma.holding.create({
        data: {
          quantity: quantity,
          average_cost_basis: averageCost,
          accountId: account.id,
          assetId: asset.id,
        },
      });
      holdings.push(holding);
      
      // 创建对应的买入交易记录
      const transactionDate = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000); // 过去90天内的随机日期
      const transaction = await prisma.transaction.create({
        data: {
          transaction_type: 'buy',
          transaction_date: transactionDate,
          quantity: quantity,
          price_per_unit: averageCost,
          total_amount: quantity * averageCost,
          description: `购买 ${asset.name}`,
          accountId: account.id,
          assetId: asset.id,
        },
      });
      transactions.push(transaction);
    }
    
    // 添加初始资金存入记录
    console.log('正在创建初始资金存入记录...');
    const depositTransaction = await prisma.transaction.create({
      data: {
        transaction_type: 'deposit',
        transaction_date: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100天前
        quantity: null,
        price_per_unit: null,
        total_amount: 500000.00,
        description: '初始资金存入',
        accountId: account.id,
        assetId: null,
      },
    });
    transactions.push(depositTransaction);

    console.log(`✅ 持仓创建成功: ${holdings.length} 个持仓`);
    console.log(`✅ 交易记录创建成功: ${transactions.length} 条记录`);
    
    return { holdings, transactions };
  } catch (error) {
    console.error('❌ 创建持仓和交易记录失败:', error.message);
    throw error;
  }
}

// 步骤5: 创建30天投资组合历史记录
async function step5_createPortfolioHistory(portfolio) {
  try {
    console.log('\n=== 步骤5: 创建投资组合历史记录 ===');
    
    const historyRecords = [];
    const today = new Date();

    // 先获取当前投资组合的总净值、现金、投资值，作为第30天（今天）的记录
    // 这里假设投资组合的当前净值、现金、投资值为最新一笔
    // 如果没有portfolio.current_net_worth等字段，则用默认值
    let currentNetWorth = typeof portfolio.current_net_worth === 'number' ? portfolio.current_net_worth : 500000.00;
    let currentCash = typeof portfolio.current_cash === 'number' ? portfolio.current_cash : 100000.00;
    let currentInvestment = typeof portfolio.current_investment === 'number' ? portfolio.current_investment : (currentNetWorth - currentCash);

    // 记录每天的净值、现金、投资值
    // 先倒序生成数组（第30天到第1天），再正序写入
    const days = 30;
    const netWorthArr = [];
    const cashArr = [];
    const investmentArr = [];
    const dateArr = [];

    // 第30天（今天）的数据
    netWorthArr[days - 1] = currentNetWorth;
    cashArr[days - 1] = currentCash;
    investmentArr[days - 1] = currentInvestment;
    dateArr[days - 1] = new Date(today.getTime());

    // 倒推前29天
    for (let i = days - 2; i >= 0; i--) {
      // 现金不变
      cashArr[i] = currentCash;

      // 投资部分浮动，-3%~+5%
      const changePercent = (Math.random() * 8 - 3) / 100; // -3%~+5%
      // 上一天的投资部分
      const nextInvestment = investmentArr[i + 1];
      // 上一天的净值
      const nextNetWorth = netWorthArr[i + 1];

      // 前一天的投资部分 = 后一天的投资部分 / (1 + changePercent)
      // 但我们要倒推：前一天的投资部分 = nextInvestment / (1 + changePercent)
      // 现金不变
      const prevInvestment = nextInvestment / (1 + changePercent);

      // 前一天的净值 = 现金 + 前一天的投资部分
      const prevNetWorth = cashArr[i] + prevInvestment;

      investmentArr[i] = prevInvestment;
      netWorthArr[i] = prevNetWorth;

      // 日期
      dateArr[i] = new Date(today.getTime() - (days - 1 - i) * 24 * 60 * 60 * 1000);
    }

    // 现在正序写入数据库（第1天到第30天）
    for (let i = 0; i < days; i++) {
      const record = await prisma.portfolio_History.create({
        data: {
          snapshot_date: dateArr[i],
          net_worth: Math.round(netWorthArr[i] * 100) / 100,
          cash_value: Math.round(cashArr[i] * 100) / 100,
          investment_value: Math.round(investmentArr[i] * 100) / 100,
          portfolioId: portfolio.id,
        },
      });
      historyRecords.push(record);
    }

    console.log(`✅ 投资组合历史记录创建成功: ${historyRecords.length} 条记录`);
    console.log(`📈 净值变化: $${netWorthArr[0].toFixed(2)} → $${netWorthArr[days - 1].toFixed(2)}`);

    return historyRecords;
  } catch (error) {
    console.error('❌ 创建投资组合历史记录失败:', error.message);
    throw error;
  }
}

// 主函数
async function main() {
  try {
    console.log('🚀 开始数据库填充流程...\n');
    
    const args = process.argv;
    
    // 步骤1: 清理数据库
    await step1_cleanDatabase();
    
    // 如果只是清理数据库，则退出
    if (args.length == 3 && args[2] === 'clean') {
      console.log('\n✅ 数据库已清理，程序结束');
      return;
    }
    
    // 步骤2: 创建基础数据（用户、投资组合、账户）
    const { user, portfolio, account } = await step2_createUserPortfolioAccount();
    
    // 步骤3: 从SQLite填充资产数据和历史记录
    let assetResults;
    try {
      assetResults = await step3_populateAssetsFromSQLite();
    } catch (error) {
      console.log('⚠️ 从SQLite填充资产失败，程序终止:', error.message);
      throw error;
    }
    
    // 步骤4: 创建持仓和交易记录
    const { holdings, transactions } = await step4_createHoldingsAndTransactions(account);
    
    // 步骤5: 创建投资组合历史记录
    const historyRecords = await step5_createPortfolioHistory(portfolio);
    
    // 显示汇总信息
    console.log('\n🎉 数据库填充完成！');
    console.log('\n📊 数据汇总:');
    console.log(`- 用户: 1个 (${user.username})`);
    console.log(`- 投资组合: 1个 (${portfolio.name})`);
    console.log(`- 账户: 1个 (${account.account_name})`);
    console.log(`- 资产: ${assetResults.assetsCreated}个`);
    console.log(`- 资产历史记录: ${assetResults.historyCreated}条`);
    console.log(`- 持仓: ${holdings.length}个`);
    console.log(`- 交易记录: ${transactions.length}条`);
    console.log(`- 投资组合历史记录: ${historyRecords.length}条`);
    
    console.log('\n👤 测试用户信息:');
    console.log('- 用户名: 5force');
    console.log('- 密码哈希: $DUMMY_HASH);

  } catch (error) {
    console.error('\n❌ 数据库填充失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行主函数
main(); 