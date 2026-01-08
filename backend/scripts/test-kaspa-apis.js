// ============================================
// KASPA API TESTER
// Test all available APIs to find working one
// ============================================

const axios = require('axios');

const TEST_ADDRESS = 'kaspa:qzhszuncy0qsh0d3upnd8uxjtwmdqdzslh6vzl20clwcf4gw8mfgyektl04p4';

const APIs = {
  local: {
    name: 'Local REST Server',
    url: 'http://localhost:8080',
    endpoint: (addr) => `/addresses/${addr}/transactions?limit=10`
  },
  kaspaLive: {
    name: 'KaspaLive API',
    url: 'https://api.kaspa.live/v1',
    endpoint: (addr) => `/addresses/${addr}/transactions?limit=10`
  },
  explorer: {
    name: 'Kaspa Explorer',
    url: 'https://explorer.kaspa.org/api',
    endpoint: (addr) => `/addresses/${addr}/transactions?limit=10`
  },
  kaspaScan: {
    name: 'KaspaScan',
    url: 'https://api.kaspascan.io/api/v1',
    endpoint: (addr) => `/address/${addr}/transactions?limit=10`
  }
};

async function testAPI(key, api, address) {
  const fullUrl = api.url + api.endpoint(address);
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 Testing: ${api.name}`);
  console.log(`📡 URL: ${fullUrl}`);
  console.log(`${'='.repeat(80)}`);

  try {
    const startTime = Date.now();
    
    const response = await axios.get(fullUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Klassik-Backend/1.0',
        'Accept': 'application/json'
      },
      validateStatus: () => true // Don't throw on any status
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    if (response.status === 200) {
      const data = response.data;
      const txCount = Array.isArray(data) ? data.length : (data.transactions?.length || 0);

      console.log(`✅ SUCCESS`);
      console.log(`⏱️  Response Time: ${duration}ms`);
      console.log(`📊 Status: ${response.status}`);
      console.log(`📋 Transactions Found: ${txCount}`);
      
      if (txCount > 0) {
        const firstTx = Array.isArray(data) ? data[0] : data.transactions[0];
        console.log(`\n📝 First Transaction Structure:`);
        console.log(JSON.stringify(firstTx, null, 2).substring(0, 500) + '...');
        
        // Check for sacrifice address
        const SACRIFICE_ADDRESS = 'kaspa:qr25pe5pfa4mhs8slw3dvxud4x55zx73tkz4xnpfyudnf7j8czzlsvf3vksdc';
        const outputs = firstTx.outputs || [];
        
        console.log(`\n🔍 Checking ${outputs.length} outputs for sacrifice address...`);
        outputs.forEach((output, i) => {
          const addr = output.address || output.scriptPublicKeyAddress || output.script_public_key_address;
          console.log(`  Output ${i + 1}: ${addr?.substring(0, 30)}...`);
          if (addr === SACRIFICE_ADDRESS) {
            console.log(`    🔥 THIS IS A SACRIFICE!`);
          }
        });
      }

      return {
        success: true,
        duration,
        transactions: txCount,
        api: api.name
      };

    } else {
      console.log(`❌ FAILED`);
      console.log(`⏱️  Response Time: ${duration}ms`);
      console.log(`📊 Status: ${response.status}`);
      console.log(`❗ Error: ${response.statusText || 'Unknown error'}`);
      
      if (response.data) {
        console.log(`📄 Response:`, JSON.stringify(response.data).substring(0, 200));
      }

      return {
        success: false,
        error: `HTTP ${response.status}`,
        api: api.name
      };
    }

  } catch (error) {
    console.log(`❌ ERROR`);
    console.log(`❗ ${error.message}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.log(`💡 Tip: Server not running or not accessible`);
    } else if (error.code === 'ETIMEDOUT') {
      console.log(`💡 Tip: Request timed out (slow network or server down)`);
    }

    return {
      success: false,
      error: error.message,
      api: api.name
    };
  }
}

async function testAllAPIs() {
  console.log(`\n${'█'.repeat(80)}`);
  console.log(`🚀 KASPA API AVAILABILITY TEST`);
  console.log(`${'█'.repeat(80)}`);
  console.log(`\n📍 Test Address: ${TEST_ADDRESS.substring(0, 40)}...`);
  console.log(`⏰ Started: ${new Date().toISOString()}\n`);

  const results = [];

  for (const [key, api] of Object.entries(APIs)) {
    const result = await testAPI(key, api, TEST_ADDRESS);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay between tests
  }

  // Summary
  console.log(`\n${'█'.repeat(80)}`);
  console.log(`📊 SUMMARY`);
  console.log(`${'█'.repeat(80)}\n`);

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Successful APIs: ${successful.length}/${results.length}`);
  console.log(`❌ Failed APIs: ${failed.length}/${results.length}\n`);

  if (successful.length > 0) {
    console.log(`🏆 Working APIs (sorted by speed):`);
    successful
      .sort((a, b) => a.duration - b.duration)
      .forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.api} - ${r.duration}ms (${r.transactions} transactions)`);
      });

    console.log(`\n💡 Recommendation: Use "${successful[0].api}" (fastest)`);
  }

  if (failed.length > 0) {
    console.log(`\n⚠️  Failed APIs:`);
    failed.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.api} - ${r.error}`);
    });
  }

  console.log(`\n${'█'.repeat(80)}\n`);

  // Return best API
  return successful.length > 0 ? successful[0] : null;
}

// Run tests
testAllAPIs()
  .then((best) => {
    if (best) {
      console.log(`✅ Testing complete. Best API: ${best.api}`);
      process.exit(0);
    } else {
      console.log(`❌ All APIs failed. Check network or try local node.`);
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
