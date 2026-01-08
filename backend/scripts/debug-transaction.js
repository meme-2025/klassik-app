// ============================================
// KASPA TRANSACTION DEBUG TOOL
// Analyze specific transaction
// ============================================

const axios = require('axios');

const TX_ID = 'd7cc71528d452c4cfe6ae39989425d8f948beb5ac0669e7cf0a5fb2ad89ca353';
const SACRIFICE_ADDRESS = 'kaspa:qr25pe5pfa4mhs8slw3dvxud4x55zx73tkz4xnpfyudnf7j8czzlsvf3vksdc';

async function analyzeTx() {
  console.log('\n🔍 Analyzing Kaspa Transaction');
  console.log('=' .repeat(80));
  console.log(`TX ID: ${TX_ID}`);
  console.log(`Sacrifice Address: ${SACRIFICE_ADDRESS}\n`);

  try {
    // Get transaction details
    const response = await axios.get(
      `https://explorer.kaspa.org/api/transactions/${TX_ID}`,
      { timeout: 15000 }
    );

    const tx = response.data;
    
    console.log('📋 Transaction Details:');
    console.log(JSON.stringify(tx, null, 2));
    console.log('\n' + '='.repeat(80));
    
    // Analyze outputs
    if (tx.outputs && Array.isArray(tx.outputs)) {
      console.log(`\n💸 Outputs (${tx.outputs.length}):`);
      
      tx.outputs.forEach((output, i) => {
        console.log(`\n  Output ${i + 1}:`);
        console.log(`    Address: ${output.address || output.scriptPublicKeyAddress || output.script_public_key_address || 'N/A'}`);
        console.log(`    Amount: ${output.amount || output.value || 0} sompi`);
        console.log(`    Amount (KAS): ${(parseFloat(output.amount || output.value || 0) / 100000000).toFixed(8)} KAS`);
        
        const outputAddr = output.address || output.scriptPublicKeyAddress || output.script_public_key_address;
        if (outputAddr === SACRIFICE_ADDRESS) {
          console.log(`    ✅ THIS IS A SACRIFICE!`);
        }
      });
    }

    // Analyze inputs
    if (tx.inputs && Array.isArray(tx.inputs)) {
      console.log(`\n📥 Inputs (${tx.inputs.length}):`);
      
      tx.inputs.forEach((input, i) => {
        console.log(`\n  Input ${i + 1}:`);
        console.log(`    Previous TX: ${input.previous_outpoint_hash || input.previousOutpointHash || 'N/A'}`);
        console.log(`    Address: ${input.address || input.scriptPublicKeyAddress || 'N/A'}`);
      });
    }

    // Check if this is a sacrifice
    const isSacrifice = tx.outputs?.some(output => {
      const addr = output.address || output.scriptPublicKeyAddress || output.script_public_key_address;
      return addr === SACRIFICE_ADDRESS;
    });

    console.log('\n' + '='.repeat(80));
    console.log(`\n🔥 Is Sacrifice? ${isSacrifice ? '✅ YES' : '❌ NO'}`);
    
    if (isSacrifice) {
      const sacrificeOutputs = tx.outputs.filter(output => {
        const addr = output.address || output.scriptPublicKeyAddress || output.script_public_key_address;
        return addr === SACRIFICE_ADDRESS;
      });
      
      const totalSacrificed = sacrificeOutputs.reduce((sum, output) => {
        return sum + parseFloat(output.amount || output.value || 0);
      }, 0);
      
      console.log(`💰 Total Sacrificed: ${(totalSacrificed / 100000000).toFixed(8)} KAS`);
      console.log(`🏆 Points Earned: ${Math.floor(totalSacrificed / 100000000)}`);
    }

    console.log('\n' + '='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

analyzeTx()
  .then(() => {
    console.log('✅ Analysis complete\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Analysis failed:', err);
    process.exit(1);
  });
