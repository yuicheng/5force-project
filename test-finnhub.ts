import * as finnhub from 'finnhub';

async function testFinnhub() {
  console.log('🔍 Testing Finnhub API configuration...\n');

  // Use the same API key from the service
  const apiKey: string = 'd23qa31r01qv4g01pn60d23qa31r01qv4g01pn6g';
  
  // Configure the API client for version 2.0.7
  const finnhubClient = new finnhub.DefaultApi();
  finnhubClient.apiKey = apiKey;

  console.log('✅ API Client configured successfully');
  console.log('✅ API Key set:', apiKey.substring(0, 10) + '...');

  // Test tickers
  const testTickers = ['AAPL', 'MSFT', 'GOOGL', 'NVDA'];

  let completedTests = 0;
  const totalTests = testTickers.length;

  for (const ticker of testTickers) {
    console.log(`\n📊 Testing ticker: ${ticker}`);
    
    // Test quote endpoint with callback function
    console.log(`  - Fetching quote data...`);
    
    finnhubClient.quote(ticker, (error: any, data: any) => {
      if (error) {
        console.log(`  ❌ Quote error for ${ticker}:`, error);
      } else {
        if (data && data.c && data.c > 0) {
          console.log(`  ✅ Quote successful:`);
          console.log(`     Current price: $${data.c}`);
          console.log(`     Change: ${data.d} (${data.dp}%)`);
          console.log(`     High: $${data.h}, Low: $${data.l}`);
          console.log(`     Open: $${data.o}, Previous Close: $${data.pc}`);
        } else {
          console.log(`  ❌ Quote returned invalid data:`, data);
        }
      }
      
      // Test company profile endpoint
      console.log(`  - Fetching company profile...`);
      
      finnhubClient.companyProfile2({ symbol: ticker }, (profileError: any, profileData: any) => {
        if (profileError) {
          console.log(`  ❌ Profile error for ${ticker}:`, profileError);
        } else {
          if (profileData && profileData.name) {
            console.log(`  ✅ Profile successful:`);
            console.log(`     Company: ${profileData.name}`);
            console.log(`     Exchange: ${profileData.exchange}`);
            console.log(`     Currency: ${profileData.currency}`);
            console.log(`     Industry: ${profileData.finnhubIndustry}`);
          } else {
            console.log(`  ❌ Profile returned invalid data:`, profileData);
          }
        }
        
        completedTests++;
        if (completedTests === totalTests) {
          console.log('\n🏁 All Finnhub API tests completed!');
          console.log(`✅ Successfully tested ${totalTests} tickers`);
        }
      });
    });
  }
}

// Run the test
testFinnhub().catch(console.error); 