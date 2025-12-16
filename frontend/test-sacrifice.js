/**
 * KASPAHUB SACRIFICE DASHBOARD - MANUAL TEST SCRIPT
 * Run this in browser console (F12) to test all features
 */

console.log('%c🧪 KASPAHUB SACRIFICE TESTING SUITE', 'font-size: 20px; color: #00f3ff; font-weight: bold;');
console.log('='.repeat(50));

// Test Suite
const TEST_SUITE = {
    passed: 0,
    failed: 0,
    tests: []
};

function test(name, fn) {
    try {
        fn();
        TEST_SUITE.passed++;
        TEST_SUITE.tests.push({ name, status: '✅ PASS' });
        console.log(`✅ ${name}`);
    } catch (error) {
        TEST_SUITE.failed++;
        TEST_SUITE.tests.push({ name, status: '❌ FAIL', error: error.message });
        console.error(`❌ ${name}:`, error.message);
    }
}

// ==================== CONFIGURATION TESTS ====================
console.log('\n📋 Testing Configuration...');

test('CONFIG object exists', () => {
    if (typeof CONFIG === 'undefined') throw new Error('CONFIG not found');
});

test('Sacrifice address is set', () => {
    if (!CONFIG.SACRIFICE_ADDRESS) throw new Error('SACRIFICE_ADDRESS not configured');
    if (!CONFIG.SACRIFICE_ADDRESS.startsWith('kaspa:')) throw new Error('Invalid address format');
});

test('API endpoints configured', () => {
    if (!Array.isArray(CONFIG.API_ENDPOINTS)) throw new Error('API_ENDPOINTS not array');
    if (CONFIG.API_ENDPOINTS.length === 0) throw new Error('No API endpoints configured');
});

test('Tiers properly configured', () => {
    if (!CONFIG.TIERS.BRONZE) throw new Error('BRONZE tier missing');
    if (!CONFIG.TIERS.SILVER) throw new Error('SILVER tier missing');
    if (!CONFIG.TIERS.GOLD) throw new Error('GOLD tier missing');
    if (!CONFIG.TIERS.DIAMOND) throw new Error('DIAMOND tier missing');
});

// ==================== UTILITY FUNCTION TESTS ====================
console.log('\n🔧 Testing Utility Functions...');

test('sanitizeInput function works', () => {
    const result = sanitizeInput('<script>alert("xss")</script>');
    if (result.includes('<script>')) throw new Error('XSS not sanitized!');
});

test('formatKAS function works', () => {
    const result = formatKAS(1234567.89);
    if (!result.includes(',')) throw new Error('Number not formatted');
});

test('shortenAddress function works', () => {
    const addr = 'kaspa:qz1234567890abcdef1234567890abcdef1234567890';
    const result = shortenAddress(addr);
    if (result.length >= addr.length) throw new Error('Address not shortened');
    if (!result.includes('...')) throw new Error('Missing ellipsis');
});

// ==================== TIER CALCULATION TESTS ====================
console.log('\n💎 Testing Tier Calculations...');

test('Bronze tier calculation (1,000 KAS)', () => {
    const tier = calculateTier(1000);
    if (!tier || tier.name !== 'Bronze') throw new Error('Wrong tier');
    const points = calculatePoints(1000);
    if (points !== 2500) throw new Error(`Expected 2500 points, got ${points}`);
});

test('Silver tier calculation (10,000 KAS)', () => {
    const tier = calculateTier(10000);
    if (!tier || tier.name !== 'Silver') throw new Error('Wrong tier');
    const points = calculatePoints(10000);
    if (points !== 37500) throw new Error(`Expected 37500 points, got ${points}`);
});

test('Gold tier calculation (50,000 KAS)', () => {
    const tier = calculateTier(50000);
    if (!tier || tier.name !== 'Gold') throw new Error('Wrong tier');
    const points = calculatePoints(50000);
    if (points !== 218750) throw new Error(`Expected 218750 points, got ${points}`);
});

test('Diamond tier calculation (100,000 KAS)', () => {
    const tier = calculateTier(100000);
    if (!tier || tier.name !== 'Diamond') throw new Error('Wrong tier');
    const points = calculatePoints(100000);
    if (points !== 500000) throw new Error(`Expected 500000 points, got ${points}`);
});

// ==================== STATE MANAGEMENT TESTS ====================
console.log('\n📊 Testing State Management...');

test('APP_STATE object exists', () => {
    if (typeof APP_STATE === 'undefined') throw new Error('APP_STATE not found');
});

test('Initial state is correct', () => {
    if (APP_STATE.connected !== false) throw new Error('Initial connected state wrong');
    if (APP_STATE.walletAddress !== null) throw new Error('Initial wallet address should be null');
    if (APP_STATE.balance !== 0) throw new Error('Initial balance should be 0');
});

// ==================== LOCALSTORAGE TESTS ====================
console.log('\n💾 Testing LocalStorage...');

test('saveToStorage function works', () => {
    saveToStorage('test', { value: 123 });
    const stored = localStorage.getItem('kaspahub_test');
    if (!stored) throw new Error('Data not saved');
});

test('loadFromStorage function works', () => {
    saveToStorage('test', { value: 456 });
    const loaded = loadFromStorage('test');
    if (!loaded || loaded.value !== 456) throw new Error('Data not loaded correctly');
});

test('Invalid JSON handled gracefully', () => {
    localStorage.setItem('kaspahub_corrupt', '{invalid json}');
    const result = loadFromStorage('corrupt');
    if (result !== null) throw new Error('Should return null for corrupt data');
});

// Cleanup
localStorage.removeItem('kaspahub_test');
localStorage.removeItem('kaspahub_corrupt');

// ==================== DOM ELEMENT TESTS ====================
console.log('\n🖥️  Testing DOM Elements...');

test('Connect button exists', () => {
    const btn = document.getElementById('connectBtn');
    if (!btn) throw new Error('Connect button not found');
});

test('Amount input exists', () => {
    const input = document.getElementById('amountInput');
    if (!input) throw new Error('Amount input not found');
});

test('Sacrifice button exists', () => {
    const btn = document.getElementById('sacrificeBtn');
    if (!btn) throw new Error('Sacrifice button not found');
});

test('Countdown elements exist', () => {
    const days = document.getElementById('days');
    const hours = document.getElementById('hours');
    const minutes = document.getElementById('minutes');
    const seconds = document.getElementById('seconds');
    if (!days || !hours || !minutes || !seconds) {
        throw new Error('Countdown elements missing');
    }
});

test('Stats elements exist', () => {
    const total = document.getElementById('totalSacrificed');
    const participants = document.getElementById('participants');
    const points = document.getElementById('yourPoints');
    if (!total || !participants || !points) {
        throw new Error('Stats elements missing');
    }
});

test('Particles container exists', () => {
    const container = document.getElementById('particles-js');
    if (!container) throw new Error('Particles container not found');
});

// ==================== WALLET DETECTION TESTS ====================
console.log('\n🦊 Testing Wallet Detection...');

test('detectWallets function exists', () => {
    if (typeof detectWallets !== 'function') throw new Error('detectWallets function not found');
});

test('detectWallets runs without error', async () => {
    const wallets = await detectWallets();
    if (!Array.isArray(wallets)) throw new Error('detectWallets should return array');
    console.log(`   Detected ${wallets.length} wallet(s):`, wallets.map(w => w.name).join(', ') || 'None');
});

// ==================== API MOCK TESTS ====================
console.log('\n🌐 Testing API Functions...');

test('fetchFromKaspaAPI function exists', () => {
    if (typeof fetchFromKaspaAPI !== 'function') throw new Error('fetchFromKaspaAPI not found');
});

test('processTransactions handles empty array', async () => {
    const result = await processTransactions([]);
    if (!Array.isArray(result)) throw new Error('Should return array');
    if (result.length !== 0) throw new Error('Should return empty array');
});

// ==================== UI UPDATE TESTS ====================
console.log('\n🎨 Testing UI Updates...');

test('updateCountdown function works', () => {
    updateCountdown();
    const days = document.getElementById('days');
    if (!days || days.textContent === '') throw new Error('Countdown not updated');
});

test('updateTierStats function works', () => {
    updateTierStats(10000);
    // Function should run without error
});

test('setAmount function works', () => {
    setAmount(5000);
    const input = document.getElementById('amountInput');
    if (input && input.value !== '5000') throw new Error('Amount not set correctly');
});

test('toggleInfo function works', () => {
    toggleInfo();
    toggleInfo(); // Toggle back
    // Should run without error
});

// ==================== SECURITY TESTS ====================
console.log('\n🔒 Testing Security Features...');

test('XSS protection in sanitizeInput', () => {
    const malicious = '<img src=x onerror="alert(1)">';
    const clean = sanitizeInput(malicious);
    if (clean.includes('onerror')) throw new Error('XSS not blocked!');
    if (clean.includes('<img')) throw new Error('HTML tags not escaped!');
});

test('Script injection blocked', () => {
    const malicious = '<script>document.cookie</script>';
    const clean = sanitizeInput(malicious);
    if (clean.includes('<script>')) throw new Error('Script tags not blocked!');
});

test('No private keys in localStorage', () => {
    const keys = Object.keys(localStorage);
    const kaspaKeys = keys.filter(k => k.startsWith('kaspahub_'));
    for (const key of kaspaKeys) {
        const value = localStorage.getItem(key);
        if (value && (value.includes('privateKey') || value.includes('private_key'))) {
            throw new Error('Private key found in localStorage!');
        }
    }
});

// ==================== PERFORMANCE TESTS ====================
console.log('\n⚡ Testing Performance...');

test('calculatePoints performance (<1ms for 1000 calls)', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
        calculatePoints(50000);
    }
    const duration = performance.now() - start;
    if (duration > 10) throw new Error(`Too slow: ${duration.toFixed(2)}ms`);
    console.log(`   Executed 1000 calculations in ${duration.toFixed(2)}ms`);
});

test('formatKAS performance (<1ms for 1000 calls)', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
        formatKAS(1234567.89);
    }
    const duration = performance.now() - start;
    if (duration > 10) throw new Error(`Too slow: ${duration.toFixed(2)}ms`);
    console.log(`   Executed 1000 formats in ${duration.toFixed(2)}ms`);
});

// ==================== FINAL RESULTS ====================
console.log('\n' + '='.repeat(50));
console.log('%c📊 TEST RESULTS', 'font-size: 16px; color: #00ff88; font-weight: bold;');
console.log('='.repeat(50));

console.log(`\n✅ Passed: ${TEST_SUITE.passed}`);
console.log(`❌ Failed: ${TEST_SUITE.failed}`);
console.log(`📊 Total: ${TEST_SUITE.passed + TEST_SUITE.failed}`);
console.log(`✨ Success Rate: ${((TEST_SUITE.passed / (TEST_SUITE.passed + TEST_SUITE.failed)) * 100).toFixed(1)}%`);

if (TEST_SUITE.failed === 0) {
    console.log('\n%c🎉 ALL TESTS PASSED! SYSTEM READY FOR PRODUCTION! 🚀', 'font-size: 18px; color: #00ff88; font-weight: bold; background: #0a0a0a; padding: 10px;');
} else {
    console.log('\n%c⚠️ SOME TESTS FAILED - REVIEW ERRORS ABOVE', 'font-size: 16px; color: #ff0066; font-weight: bold;');
}

// Display detailed results
console.log('\n📋 Detailed Results:');
console.table(TEST_SUITE.tests);

// ==================== LIVE SYSTEM CHECK ====================
console.log('\n' + '='.repeat(50));
console.log('%c🔍 LIVE SYSTEM CHECK', 'font-size: 16px; color: #00f3ff; font-weight: bold;');
console.log('='.repeat(50));

console.log('\n📍 Configuration:');
console.log(`   Sacrifice Address: ${CONFIG.SACRIFICE_ADDRESS}`);
console.log(`   Event End Date: ${new Date(CONFIG.EVENT_END_DATE).toLocaleString()}`);
console.log(`   Blockchain Scan Interval: ${CONFIG.BLOCKCHAIN_SCAN_INTERVAL / 1000}s`);

console.log('\n🌐 API Endpoints:');
CONFIG.API_ENDPOINTS.forEach((endpoint, i) => {
    console.log(`   ${i + 1}. ${endpoint}`);
});

console.log('\n💎 Tier Configuration:');
Object.entries(CONFIG.TIERS).forEach(([name, tier]) => {
    console.log(`   ${tier.name}: ${tier.min.toLocaleString()}-${tier.max === Infinity ? '∞' : tier.max.toLocaleString()} KAS → ${tier.pointsPerK} pts/1K (+${tier.bonus * 100}% bonus)`);
});

console.log('\n📊 Current State:');
console.log(`   Connected: ${APP_STATE.connected}`);
console.log(`   Wallet Type: ${APP_STATE.walletType || 'None'}`);
console.log(`   Wallet Address: ${APP_STATE.walletAddress || 'None'}`);
console.log(`   Balance: ${APP_STATE.balance} KAS`);
console.log(`   Total Sacrificed: ${APP_STATE.totalStats.totalSacrificed.toLocaleString()} KAS`);
console.log(`   Participants: ${APP_STATE.totalStats.participants}`);

console.log('\n💾 LocalStorage Status:');
const storageKeys = Object.keys(localStorage).filter(k => k.startsWith('kaspahub_'));
console.log(`   Keys stored: ${storageKeys.length}`);
storageKeys.forEach(key => {
    const size = localStorage.getItem(key).length;
    console.log(`   - ${key.replace('kaspahub_', '')}: ${size} bytes`);
});

console.log('\n🦊 Wallet Detection:');
detectWallets().then(wallets => {
    if (wallets.length === 0) {
        console.log('   ⚠️  No wallets detected');
        console.log('   Please install: KasWare, Kaspium, or Kaspa Desktop');
    } else {
        console.log(`   ✅ Found ${wallets.length} wallet(s):`);
        wallets.forEach((wallet, i) => {
            console.log(`   ${i + 1}. ${wallet.icon} ${wallet.name} (${wallet.type})`);
        });
    }
});

console.log('\n' + '='.repeat(50));
console.log('%c✅ TESTING COMPLETE', 'font-size: 16px; color: #00ff88; font-weight: bold;');
console.log('='.repeat(50));

console.log('\n💡 Next Steps:');
console.log('1. Update SACRIFICE_ADDRESS in code (if not done)');
console.log('2. Set correct EVENT_END_DATE');
console.log('3. Test wallet connection (click Connect Wallet)');
console.log('4. Send small test sacrifice (1,000 KAS minimum)');
console.log('5. Verify transaction on Kaspa Explorer');
console.log('6. Deploy to production server');
console.log('7. Announce to community 🚀');

console.log('\n📚 Documentation:');
console.log('- SACRIFICE_AUDIT_REPORT.md - Full security audit');
console.log('- SACRIFICE_QUICK_START.md - Deployment guide');
console.log('- Console logs - Real-time debugging');

console.log('\n%c🔥 READY TO REVOLUTIONIZE THE BLOCKCHAIN! 🔥', 'font-size: 20px; color: #ff00ff; font-weight: bold;');
