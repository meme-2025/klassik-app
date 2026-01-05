// Kaspa Explorer Validation Script
// Führe dieses Script in der Browser-Konsole aus, wenn kaspa-explorer-local.html geöffnet ist

console.log('🧪 Starting Kaspa Explorer Validation...\n');

// Test 1: Check if all required functions exist
const requiredFunctions = [
    'formatNumber',
    'formatCompact', 
    'formatHashrate',
    'safeGet',
    'fetchWithRetry',
    'updateStatus',
    'fetchAllData',
    'updateUI'
];

console.log('1️⃣ Checking required functions:');
requiredFunctions.forEach(fn => {
    const exists = typeof window[fn] === 'function';
    console.log(`  ${exists ? '✅' : '❌'} ${fn}`);
});

// Test 2: Check if all stat elements exist
const requiredElements = [
    'price-stat',
    'price-change',
    'mcap-stat',
    'txs-24h-stat',
    'hashrate-stat',
    'difficulty-stat',
    'block-reward-stat',
    'latest-block-stat',
    'total-supply-stat',
    'mineable-remaining-stat',
    'avg-block-time-stat',
    'miner-rewards-stat',
    'regular-txs-stat',
    'total-blocks-stat',
    'daily-blocks-stat',
    'status-indicator',
    'update-status',
    'refresh-btn',
    'error-banner'
];

console.log('\n2️⃣ Checking DOM elements:');
let missingElements = [];
requiredElements.forEach(id => {
    const exists = document.getElementById(id) !== null;
    if (!exists) missingElements.push(id);
    console.log(`  ${exists ? '✅' : '❌'} #${id}`);
});

// Test 3: Check configuration
console.log('\n3️⃣ Checking configuration:');
console.log(`  ✅ API_BASE: ${window.API_BASE || 'Not defined'}`);
console.log(`  ✅ RETRY_CONFIG: ${JSON.stringify(window.RETRY_CONFIG || {})}`);
console.log(`  ✅ CACHE_DURATION: ${window.CACHE_DURATION || 'Not defined'}ms`);

// Test 4: Test utility functions
console.log('\n4️⃣ Testing utility functions:');
try {
    const tests = {
        'formatNumber(1234567)': formatNumber(1234567) === '1,234,567',
        'formatCompact(1500000000)': formatCompact(1500000000) === '1.50B',
        'formatHashrate(1.5e15)': formatHashrate(1.5e15) === '1.50 PH/s',
        'safeGet({a:{b:1}}, "a.b")': safeGet({a:{b:1}}, 'a.b') === 1
    };
    
    for (const [test, result] of Object.entries(tests)) {
        console.log(`  ${result ? '✅' : '❌'} ${test}`);
    }
} catch (error) {
    console.log(`  ❌ Error testing utilities: ${error.message}`);
}

// Test 5: Check if data is being fetched
console.log('\n5️⃣ Checking data fetch status:');
setTimeout(() => {
    const priceEl = document.getElementById('price-stat');
    const hasData = priceEl && priceEl.textContent !== 'Loading...' && priceEl.textContent !== 'N/A';
    console.log(`  ${hasData ? '✅' : '⏳'} Data loaded: ${priceEl?.textContent || 'None'}`);
    
    const statusEl = document.getElementById('update-status');
    console.log(`  📊 Status: ${statusEl?.textContent || 'Unknown'}`);
}, 3000);

// Test 6: Test manual refresh
console.log('\n6️⃣ Testing manual refresh:');
const refreshBtn = document.getElementById('refresh-btn');
if (refreshBtn) {
    console.log('  ✅ Refresh button found');
    console.log('  ℹ️  You can test it by clicking the 🔄 button or running: refreshBtn.click()');
} else {
    console.log('  ❌ Refresh button not found');
}

// Test 7: Check responsive design
console.log('\n7️⃣ Checking responsive design:');
const statsGrid = document.querySelector('.stats-grid');
if (statsGrid) {
    const styles = window.getComputedStyle(statsGrid);
    console.log(`  ✅ Grid columns: ${styles.gridTemplateColumns}`);
    console.log(`  ✅ Gap: ${styles.gap}`);
} else {
    console.log('  ❌ Stats grid not found');
}

// Summary
console.log('\n📋 Validation Summary:');
console.log(`  Total elements: ${requiredElements.length}`);
console.log(`  Missing elements: ${missingElements.length}`);
if (missingElements.length > 0) {
    console.log(`  Missing: ${missingElements.join(', ')}`);
}
console.log(`  Functions: ${requiredFunctions.length} defined`);

console.log('\n✅ Validation complete! Check results above.');
console.log('💡 Tip: Run this script again after 5 seconds to verify data loading.');
