// ============================================
// KASPA SACRIFICE CHECKER
// Direct blockchain verification
// ============================================

const axios = require('axios');

const SACRIFICE_ADDRESS = 'kaspa:qr25pe5pfa4mhs8slw3dvxud4x55zx73tkz4xnpfyudnf7j8czzlsvf3vksdc';
const KASPA_API = 'https://explorer.kaspa.org/api';

async function checkSacrifice(kaspaAddress) {
  console.log(`\n🔍 Checking Kaspa Address: ${kaspaAddress}`);
  console.log(`🎯 Sacrifice Address: ${SACRIFICE_ADDRESS}\n`);

  try {
    // Get all transactions for this address
    const response = await axios.get(
      `${KASPA_API}/addresses/${kaspaAddress}/transactions`,
      { 
        params: { limit: 100 },
        timeout: 15000 
      }
    );

    const transactions = response.data || [];
    console.log(`✅ Total Transactions: ${transactions.length}`);

    // Filter transactions TO sacrifice address
    let totalSacrificed = 0;
    const sacrificeTxs = [];

    for (const tx of transactions) {
      const outputs = tx.outputs || [];
      
      for (const output of outputs) {
        if (output.address === SACRIFICE_ADDRESS || output.scriptPublicKeyAddress === SACRIFICE_ADDRESS) {
          const amount = parseFloat(output.value || output.amount || 0) / 100000000; // Convert from sompi
          totalSacrificed += amount;
          
          const txTime = new Date(tx.timestamp || tx.block_time || tx.time);
          const hoursAgo = (Date.now() - txTime.getTime()) / (1000 * 60 * 60);
          
          sacrificeTxs.push({
            txHash: tx.hash || tx.id || tx.transaction_id,
            amount: amount,
            timestamp: txTime.toISOString(),
            hoursAgo: hoursAgo.toFixed(1)
          });
        }
      }
    }

    console.log(`\n${sacrificeTxs.length > 0 ? '🔥' : '❌'} Sacrifices Found: ${sacrificeTxs.length}`);
    
    if (sacrificeTxs.length > 0) {
      console.log(`\n💰 TOTAL SACRIFICED: ${totalSacrificed.toFixed(8)} KAS`);
      console.log(`🏆 POINTS EARNED: ${Math.floor(totalSacrificed * 1)}`);
      console.log(`\n📋 Transaction Details:`);
      
      sacrificeTxs.forEach((tx, i) => {
        console.log(`\n  ${i + 1}. TX Hash: ${tx.txHash}`);
        console.log(`     Amount: ${tx.amount.toFixed(8)} KAS`);
        console.log(`     Time: ${tx.timestamp} (${tx.hoursAgo}h ago)`);
        console.log(`     24h Ownership: ${parseFloat(tx.hoursAgo) < 24 ? '✅ Valid' : '❌ Too old'}`);
      });

      const latestTx = sacrificeTxs.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      )[0];

      console.log(`\n🕒 Latest Transaction: ${latestTx.hoursAgo}h ago`);
      console.log(`✅ Registration Eligible: ${parseFloat(latestTx.hoursAgo) < 24 ? 'YES' : 'NO (send fresh sacrifice)'}`);

    } else {
      console.log(`\n❌ NO SACRIFICES FOUND`);
      console.log(`\nTo register:`);
      console.log(`1. Send at least 1 KAS to: ${SACRIFICE_ADDRESS}`);
      console.log(`2. Wait for blockchain confirmation (~1 min)`);
      console.log(`3. Try registration again`);
    }

    return {
      kaspaAddress,
      totalSacrificed,
      points: Math.floor(totalSacrificed * 1),
      transactions: sacrificeTxs,
      eligible: sacrificeTxs.length > 0 && parseFloat(sacrificeTxs[0].hoursAgo) < 24
    };

  } catch (error) {
    console.error(`\n❌ API Error:`, error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, error.response.data);
    }
    throw error;
  }
}

// Check multiple addresses
async function checkMultiple(addresses) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔥 KASPA SACRIFICE CHECKER - Checking ${addresses.length} addresses`);
  console.log(`${'='.repeat(80)}\n`);

  const results = [];

  for (const addr of addresses) {
    try {
      const result = await checkSacrifice(addr);
      results.push(result);
      console.log(`\n${'-'.repeat(80)}\n`);
    } catch (error) {
      console.error(`Failed to check ${addr}`);
      console.log(`\n${'-'.repeat(80)}\n`);
    }
  }

  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 SUMMARY`);
  console.log(`${'='.repeat(80)}\n`);

  results.forEach((r, i) => {
    console.log(`${i + 1}. ${r.kaspaAddress.substring(0, 20)}...${r.kaspaAddress.slice(-10)}`);
    console.log(`   Sacrificed: ${r.totalSacrificed.toFixed(8)} KAS | Points: ${r.points} | Eligible: ${r.eligible ? '✅' : '❌'}`);
  });

  console.log(`\n${'='.repeat(80)}\n`);
}

// Run check
const testAddresses = [
  'kaspa:qzhszuncy0qsh0d3upnd8uxjtwmdqdzslh6vzl20clwcf4gw8mfgyektl04p4' // User's address
];

checkMultiple(testAddresses)
  .then(() => {
    console.log('✅ Check complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Check failed:', err);
    process.exit(1);
  });
