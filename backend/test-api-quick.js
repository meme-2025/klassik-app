/**
 * 🔍 API QUICK TEST
 * Schnelle Diagnose aller wichtigen Endpoints
 * 
 * Usage: node test-api-quick.js
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const TIMEOUT = 5000;

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

async function testEndpoint(method, path, expectedStatus = 200, data = null) {
  const startTime = Date.now();
  
  try {
    const config = {
      method,
      url: `${BASE_URL}${path}`,
      timeout: TIMEOUT,
      validateStatus: () => true // Accept any status
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    const duration = Date.now() - startTime;
    const success = response.status === expectedStatus;
    
    const statusColor = success ? colors.green : colors.red;
    const icon = success ? '✅' : '❌';
    
    console.log(`${icon} ${method.padEnd(6)} ${path.padEnd(40)} ${statusColor}${response.status}${colors.reset} (${duration}ms)`);
    
    return { success, status: response.status, duration };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ ${method.padEnd(6)} ${path.padEnd(40)} ${colors.red}ERROR${colors.reset} (${duration}ms)`);
    console.log(`   ${colors.yellow}${error.message}${colors.reset}`);
    
    return { success: false, error: error.message, duration };
  }
}

async function runTests() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  🔍 Klassik API Quick Test`);
  console.log(`  Target: ${BASE_URL}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  
  const tests = [
    // Health Checks
    { method: 'GET', path: '/health', status: 200, category: 'Health' },
    { method: 'GET', path: '/api/health', status: 200, category: 'Health' },
    
    // Diagnostic
    { method: 'GET', path: '/api/diagnostic/status', status: 200, category: 'Diagnostic' },
    { method: 'GET', path: '/api/diagnostic/endpoints', status: 200, category: 'Diagnostic' },
    { method: 'GET', path: '/api/diagnostic/database', status: 200, category: 'Diagnostic' },
    { method: 'GET', path: '/api/diagnostic/common-issues', status: 200, category: 'Diagnostic' },
    
    // Public Endpoints
    { method: 'GET', path: '/api/products', status: 200, category: 'Public' },
    { method: 'GET', path: '/api/kaspa/stats', status: 200, category: 'Public' },
    { method: 'GET', path: '/api/auth/check?address=0x0000000000000000000000000000000000000000', status: 200, category: 'Auth' },
    { method: 'GET', path: '/api/auth/nonce?address=0x0000000000000000000000000000000000000001', status: 200, category: 'Auth' },
    
    // Protected Endpoints (should return 401)
    { method: 'GET', path: '/api/users/me', status: 401, category: 'Protected' },
    { method: 'GET', path: '/api/orders', status: 401, category: 'Protected' },
    
    // Admin Endpoints (should return 401/403)
    { method: 'GET', path: '/api/admin/stats', status: [401, 403], category: 'Admin' },
  ];
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: 0,
    totalDuration: 0
  };
  
  let currentCategory = null;
  
  for (const test of tests) {
    if (currentCategory !== test.category) {
      currentCategory = test.category;
      console.log('');
      console.log(`${colors.cyan}${test.category} Endpoints:${colors.reset}`);
    }
    
    const result = await testEndpoint(test.method, test.path, test.status);
    
    results.total++;
    results.totalDuration += result.duration;
    
    if (result.error) {
      results.errors++;
    } else if (result.success) {
      results.passed++;
    } else {
      results.failed++;
    }
  }
  
  // Summary
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  📊 Test Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Total Tests:     ${results.total}`);
  console.log(`  ${colors.green}Passed:${colors.reset}          ${results.passed}`);
  console.log(`  ${colors.red}Failed:${colors.reset}          ${results.failed}`);
  console.log(`  ${colors.yellow}Errors:${colors.reset}          ${results.errors}`);
  console.log(`  Avg Duration:    ${Math.round(results.totalDuration / results.total)}ms`);
  console.log(`  Success Rate:    ${Math.round((results.passed / results.total) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  
  // Recommendations
  if (results.errors > 0) {
    console.log(`${colors.yellow}⚠️  WARNING: ${results.errors} endpoints returned connection errors${colors.reset}`);
    console.log('   Possible causes:');
    console.log('   - Server not running');
    console.log('   - Wrong BASE_URL');
    console.log('   - Firewall blocking connection');
    console.log('');
    console.log('   Try: curl ' + BASE_URL + '/health');
    console.log('');
  }
  
  if (results.failed > 0) {
    console.log(`${colors.yellow}⚠️  ${results.failed} tests failed (unexpected status codes)${colors.reset}`);
    console.log('   Check server logs for details');
    console.log('   Run: GET /api/diagnostic/common-issues for troubleshooting');
    console.log('');
  }
  
  if (results.passed === results.total) {
    console.log(`${colors.green}✅ All tests passed! API is healthy.${colors.reset}`);
    console.log('');
    console.log('   Next steps:');
    console.log('   - Open Live Monitor: ' + BASE_URL + '/monitor.html');
    console.log('   - Check diagnostics: GET /api/diagnostic/status');
    console.log('');
  }
  
  process.exit(results.errors > 0 ? 1 : 0);
}

// Check if server is reachable first
async function checkServer() {
  try {
    await axios.get(`${BASE_URL}/health`, { timeout: 2000 });
    return true;
  } catch (err) {
    console.log('');
    console.log(`${colors.red}❌ Cannot reach server at ${BASE_URL}${colors.reset}`);
    console.log('');
    console.log('   Make sure the backend server is running:');
    console.log(`   ${colors.cyan}cd backend && npm start${colors.reset}`);
    console.log('');
    console.log('   Or set custom URL:');
    console.log(`   ${colors.cyan}API_URL=http://your-server:3000 node test-api-quick.js${colors.reset}`);
    console.log('');
    return false;
  }
}

// Run
(async () => {
  const isReachable = await checkServer();
  if (isReachable) {
    await runTests();
  } else {
    process.exit(1);
  }
})();
