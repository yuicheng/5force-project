const finnhub = require('finnhub');

class FinnhubTester {
  constructor() {
    this.apiKey = 'd23qa31r01qv4g01pn60d23qa31r01qv4g01pn6g';
    this.client = new finnhub.DefaultApi();
    this.client.apiKey = this.apiKey;
  }

  /**
   * 测试获取股票报价
   */
  async testQuote(ticker = 'AAPL') {
    console.log(`\n=== 测试股票报价: ${ticker} ===`);
    
    return new Promise((resolve) => {
      this.client.quote(ticker, (error, data) => {
        if (error) {
          console.error('❌ 获取报价失败:', error);
          resolve({ success: false, error });
        } else {
          console.log('✅ 报价数据:');
          console.log(`  当前价格: $${data.c}`);
          console.log(`  今日变化: $${data.d} (${data.dp}%)`);
          console.log(`  开盘价: $${data.o}`);
          console.log(`  最高价: $${data.h}`);
          console.log(`  最低价: $${data.l}`);
          console.log(`  昨收价: $${data.pc}`);
          console.log(`  时间戳: ${new Date(data.t * 1000).toISOString()}`);
          resolve({ success: true, data });
        }
      });
    });
  }

  /**
   * 测试获取公司信息
   */
  async testCompanyProfile(ticker = 'AAPL') {
    console.log(`\n=== 测试公司信息: ${ticker} ===`);
    
    return new Promise((resolve) => {
      this.client.companyProfile2({ symbol: ticker }, (error, data) => {
        if (error) {
          console.error('❌ 获取公司信息失败:', error);
          resolve({ success: false, error });
        } else {
          console.log('✅ 公司信息:');
          console.log(`  公司名称: ${data.name}`);
          console.log(`  国家: ${data.country}`);
          console.log(`  货币: ${data.currency}`);
          console.log(`  交易所: ${data.exchange}`);
          console.log(`  行业: ${data.finnhubIndustry}`);
          console.log(`  市值: $${data.marketCapitalization?.toLocaleString()}`);
          console.log(`  网址: ${data.weburl}`);
          resolve({ success: true, data });
        }
      });
    });
  }

  /**
   * 测试API连接状态
   */
  async testConnection() {
    console.log('\n=== 测试API连接 ===');
    
    try {
      const result = await this.testQuote('AAPL');
      if (result.success) {
        console.log('✅ Finnhub API连接正常');
        return true;
      } else {
        console.log('❌ Finnhub API连接失败');
        return false;
      }
    } catch (error) {
      console.error('❌ API连接测试异常:', error);
      return false;
    }
  }

  /**
   * 验证股票代码是否有效
   */
  async validateTicker(ticker) {
    console.log(`\n=== 验证股票代码: ${ticker} ===`);
    
    return new Promise((resolve) => {
      this.client.quote(ticker, (error, data) => {
        if (error) {
          console.log(`❌ 股票代码 ${ticker} 无效:`, error.message);
          resolve(false);
        } else {
          const isValid = data && data.c && data.c > 0;
          if (isValid) {
            console.log(`✅ 股票代码 ${ticker} 有效，当前价格: $${data.c}`);
          } else {
            console.log(`❌ 股票代码 ${ticker} 无价格数据`);
          }
          resolve(isValid);
        }
      });
    });
  }

  /**
   * 批量测试多个股票代码
   */
  async testMultipleTickers(tickers = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'INVALID_TICKER']) {
    console.log('\n=== 批量测试股票代码 ===');
    
    const results = [];
    
    for (const ticker of tickers) {
      try {
        const result = await this.testQuote(ticker);
        results.push({
          ticker,
          success: result.success,
          price: result.data?.c || null,
          error: result.error?.message || null
        });
        
        // 避免API限制，间隔请求
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        results.push({
          ticker,
          success: false,
          price: null,
          error: error.message
        });
      }
    }
    
    console.log('\n📊 批量测试结果:');
    console.table(results);
    
    return results;
  }

  /**
   * 完整测试套件
   */
  async runFullTest() {
    console.log('🚀 开始Finnhub API完整测试\n');
    console.log(`使用API密钥: ${this.apiKey.substring(0, 10)}...`);
    
    try {
      // 1. 测试连接
      const connected = await this.testConnection();
      if (!connected) {
        console.log('❌ API连接失败，停止测试');
        return;
      }
      
      // 2. 测试单个股票报价
      await this.testQuote('AAPL');
      
      // 3. 测试公司信息
      await this.testCompanyProfile('AAPL');
      
      // 4. 测试股票代码验证
      await this.validateTicker('AAPL');
      await this.validateTicker('INVALID_TICKER');
      
      // 5. 批量测试
      await this.testMultipleTickers();
      
      console.log('\n✅ 所有测试完成');
      
    } catch (error) {
      console.error('❌ 测试过程中发生错误:', error);
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const tester = new FinnhubTester();
  
  // 从命令行参数获取要测试的功能
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // 没有参数时运行完整测试
    tester.runFullTest();
  } else {
    const command = args[0];
    const ticker = args[1] || 'AAPL';
    
    switch (command) {
      case 'quote':
        tester.testQuote(ticker);
        break;
      case 'profile':
        tester.testCompanyProfile(ticker);
        break;
      case 'validate':
        tester.validateTicker(ticker);
        break;
      case 'connection':
        tester.testConnection();
        break;
      case 'batch':
        tester.testMultipleTickers();
        break;
      default:
        console.log('可用命令:');
        console.log('  node test-finnhub-standalone.js                    # 运行完整测试');
        console.log('  node test-finnhub-standalone.js quote AAPL         # 测试报价');
        console.log('  node test-finnhub-standalone.js profile AAPL       # 测试公司信息');
        console.log('  node test-finnhub-standalone.js validate AAPL      # 验证股票代码');
        console.log('  node test-finnhub-standalone.js connection         # 测试连接');
        console.log('  node test-finnhub-standalone.js batch              # 批量测试');
    }
  }
}

module.exports = FinnhubTester; 