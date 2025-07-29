const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyAssets() {
  try {
    console.log('🔍 验证导入的资产数据...');
    
    // 获取所有资产
    const assets = await prisma.asset.findMany({
      select: {
        id: true,
        ticker_symbol: true,
        name: true,
        asset_type: true,
        current_price: true,
        percent_change_today: true,
        price_updated_at: true,
        lastUpdated: true,
        currency: true,
      },
      orderBy: {
        ticker_symbol: 'asc',
      },
    });

    console.log(`📊 总共找到 ${assets.length} 个资产`);
    
    // 显示前10个资产作为示例
    console.log('\n📋 前10个资产示例:');
    assets.slice(0, 10).forEach((asset, index) => {
      console.log(`${index + 1}. ${asset.ticker_symbol} - ${asset.name} (${asset.asset_type})`);
      console.log(`   价格: ${asset.current_price || 'N/A'}, 今日涨跌: ${asset.percent_change_today || 'N/A'}%`);
      console.log(`   更新时间: ${asset.price_updated_at?.toLocaleString()}`);
      console.log('');
    });

    // 统计资产类型分布
    const assetTypeStats = {};
    assets.forEach(asset => {
      assetTypeStats[asset.asset_type] = (assetTypeStats[asset.asset_type] || 0) + 1;
    });

    console.log('📈 资产类型分布:');
    Object.entries(assetTypeStats).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} 个`);
    });

    // 检查时间戳设置
    const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000));
    const assetsWithCorrectTimestamp = assets.filter(asset => 
      asset.price_updated_at && asset.price_updated_at < oneHourAgo
    );

    console.log(`\n⏰ 时间戳验证: ${assetsWithCorrectTimestamp.length}/${assets.length} 个资产的时间戳设置正确（1小时前）`);

    // 检查percent_change_today设置
    const assetsWithZeroChange = assets.filter(asset => asset.percent_change_today === '0' || asset.percent_change_today === 0);
    console.log(`📊 涨跌幅设置: ${assetsWithZeroChange.length}/${assets.length} 个资产的涨跌幅设置为0`);
    
    // 显示一些有非零涨跌幅的资产
    const assetsWithNonZeroChange = assets.filter(asset => 
      asset.percent_change_today && asset.percent_change_today !== '0' && asset.percent_change_today !== 0
    );
    console.log(`📈 有涨跌幅数据的资产: ${assetsWithNonZeroChange.length} 个`);
    if (assetsWithNonZeroChange.length > 0) {
      console.log('示例:');
      assetsWithNonZeroChange.slice(0, 5).forEach(asset => {
        console.log(`   ${asset.ticker_symbol}: ${asset.percent_change_today}%`);
      });
    }

  } catch (error) {
    console.error('❌ 验证失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyAssets(); 