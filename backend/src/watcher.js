const { ethers } = require('ethers');
const db = require('./db');

// Blockchain watcher for deposit events
const ETH_RPC_URL = process.env.ETH_RPC_URL || 'http://127.0.0.1:8545';
const ESCROW_CONTRACT_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS;
const REQUIRED_CONFIRMATIONS = parseInt(process.env.REQUIRED_CONFIRMATIONS || '3');

// Escrow ABI (only events and functions we need)
const ESCROW_ABI = [
  'event Deposited(address indexed user, uint256 amount, bytes32 reference)',
  'function balanceOf(address user) external view returns (uint256)'
];

let provider;
let escrowContract;
let isWatching = false;

/**
 * Initialize watcher and start listening for deposits
 */
async function startWatcher() {
  if (isWatching) {
    console.log('⚠️  Watcher already running');
    return;
  }

  if (!ESCROW_CONTRACT_ADDRESS) {
    console.warn('⚠️  ESCROW_CONTRACT_ADDRESS not configured, watcher disabled');
    return;
  }

  try {
    provider = new ethers.providers.JsonRpcProvider(ETH_RPC_URL);
    escrowContract = new ethers.Contract(ESCROW_CONTRACT_ADDRESS, ESCROW_ABI, provider);

    console.log(`🔍 Starting deposit watcher...`);
    console.log(`   RPC: ${ETH_RPC_URL}`);
    console.log(`   Contract: ${ESCROW_CONTRACT_ADDRESS}`);

    // Listen for new Deposited events
    escrowContract.on('Deposited', async (user, amount, reference, event) => {
      try {
        await handleDepositEvent(user, amount, reference, event);
      } catch (error) {
        console.error('Error handling deposit event:', error);
      }
    });

    // Also catch up on historical events from last 1000 blocks
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 1000);
    
    const filter = escrowContract.filters.Deposited();
    const pastEvents = await escrowContract.queryFilter(filter, fromBlock, currentBlock);
    
    console.log(`   Found ${pastEvents.length} past deposit events from block ${fromBlock}`);
    
    for (const event of pastEvents) {
      try {
        await handleDepositEvent(event.args.user, event.args.amount, event.args.reference, event);
      } catch (error) {
        console.error('Error processing past event:', error);
      }
    }

    isWatching = true;
    console.log('✅ Deposit watcher started successfully');

    // Start confirmation checker (runs every 30 seconds)
    setInterval(checkPendingConfirmations, 30000);

  } catch (error) {
    console.error('❌ Failed to start watcher:', error);
    isWatching = false;
  }
}

/**
 * Handle deposit event from contract
 */
async function handleDepositEvent(userAddress, amount, reference, event) {
  try {
    const txHash = event.transactionHash;
    const blockNumber = event.blockNumber;
    
    console.log(`💰 Deposit detected:`);
    console.log(`   User: ${userAddress}`);
    console.log(`   Amount: ${ethers.utils.formatEther(amount)} ETH`);
    console.log(`   Reference: ${reference}`);
    console.log(`   TX: ${txHash}`);

    // Find matching order by reference (stored as deposit_reference in orders table)
    const orderResult = await db.query(
      `SELECT o.id, o.user_id, o.from_amount, o.status, d.id as deposit_id
       FROM orders o
       LEFT JOIN deposits d ON o.id = d.order_id
       WHERE o.deposit_reference = $1 AND o.from_chain = 'ETH' AND o.status != 'completed'
       LIMIT 1`,
      [reference]
    );

    if (orderResult.rows.length === 0) {
      console.warn(`   ⚠️  No matching order found for reference ${reference}`);
      return;
    }

    const order = orderResult.rows[0];
    const expectedAmount = ethers.utils.parseEther(order.from_amount.toString());
    const actualAmount = amount;

    // Check if amount matches
    if (!actualAmount.eq(expectedAmount)) {
      console.warn(`   ⚠️  Amount mismatch: expected ${ethers.utils.formatEther(expectedAmount)}, got ${ethers.utils.formatEther(actualAmount)}`);
    }

    // Update or create deposit record
    if (order.deposit_id) {
      await db.query(
        `UPDATE deposits 
         SET tx_hash = $1, confirmations = 0, status = 'pending'
         WHERE id = $2`,
        [txHash, order.deposit_id]
      );
    } else {
      await db.query(
        `INSERT INTO deposits (order_id, tx_hash, confirmations, status)
         VALUES ($1, $2, 0, 'pending')`,
        [order.id, txHash]
      );
    }

    // Update order status
    await db.query(
      `UPDATE orders SET status = 'deposit_detected' WHERE id = $1`,
      [order.id]
    );

    console.log(`   ✅ Deposit recorded for order ${order.id}`);

  } catch (error) {
    console.error('Error in handleDepositEvent:', error);
  }
}

/**
 * Check confirmations for pending deposits
 */
async function checkPendingConfirmations() {
  try {
    const result = await db.query(
      `SELECT d.id, d.order_id, d.tx_hash, d.confirmations
       FROM deposits d
       JOIN orders o ON d.order_id = o.id
       WHERE d.status = 'pending' AND o.status != 'completed'`
    );

    if (result.rows.length === 0) return;

    const currentBlock = await provider.getBlockNumber();

    for (const deposit of result.rows) {
      try {
        const tx = await provider.getTransaction(deposit.tx_hash);
        if (!tx || !tx.blockNumber) continue;

        const confirmations = currentBlock - tx.blockNumber + 1;

        // Update confirmations
        await db.query(
          'UPDATE deposits SET confirmations = $1 WHERE id = $2',
          [confirmations, deposit.id]
        );

        // If enough confirmations, process the swap
        if (confirmations >= REQUIRED_CONFIRMATIONS) {
          await db.query(
            'UPDATE deposits SET status = $1 WHERE id = $2',
            ['confirmed', deposit.id]
          );

          await db.query(
            'UPDATE orders SET status = $1 WHERE id = $2',
            ['deposit_confirmed', deposit.order_id]
          );

          console.log(`✅ Deposit confirmed for order ${deposit.order_id} (${confirmations} confirmations)`);

          // Trigger swap execution
          await executeSwap(deposit.order_id);
        }

      } catch (error) {
        console.error(`Error checking confirmations for deposit ${deposit.id}:`, error);
      }
    }

  } catch (error) {
    console.error('Error in checkPendingConfirmations:', error);
  }
}

/**
 * Execute cross-chain swap (simplified version)
 */
async function executeSwap(orderId) {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // Get order details
    const orderResult = await client.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      throw new Error('Order not found');
    }

    const order = orderResult.rows[0];

    console.log(`🔄 Executing swap for order ${orderId}`);
    console.log(`   From: ${order.from_amount} ${order.from_chain}`);
    console.log(`   To: ${order.to_amount} ${order.to_chain}`);
    console.log(`   Destination: ${order.to_address}`);

    // TODO: Actual swap logic here
    // For ETH -> KASPA: would send Kaspa from hot wallet to order.to_address
    // For KASPA -> ETH: would send ETH from hot wallet to order.to_address

    // For now, simulate success
    const mockTxHash = '0x' + require('crypto').randomBytes(32).toString('hex');

    // Create swap record
    await client.query(
      `INSERT INTO swaps (order_id, tx_hash, status)
       VALUES ($1, $2, 'completed')`,
      [orderId, mockTxHash]
    );

    // Update order status
    await client.query(
      'UPDATE orders SET status = $1 WHERE id = $2',
      ['completed', orderId]
    );

    await client.query('COMMIT');

    console.log(`✅ Swap completed for order ${orderId}`);
    console.log(`   TX: ${mockTxHash}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Swap failed for order ${orderId}:`, error);

    // Record failure
    await db.query(
      `INSERT INTO swaps (order_id, status, error_message)
       VALUES ($1, 'failed', $2)`,
      [orderId, error.message]
    );

    await db.query(
      'UPDATE orders SET status = $1 WHERE id = $2',
      ['failed', orderId]
    );

  } finally {
    client.release();
  }
}

/**
 * Stop the watcher
 */
function stopWatcher() {
  if (escrowContract) {
    escrowContract.removeAllListeners('Deposited');
    console.log('🛑 Deposit watcher stopped');
  }
  isWatching = false;
}

module.exports = { 
  startWatcher,
  stopWatcher
};
