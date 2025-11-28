const db = require('../db');
const { ethers } = require('ethers');
const crypto = require('crypto');

/**
 * POST /api/orders
 * Create new swap order and return deposit instructions
 */
async function createOrder(req, res) {
  const client = await db.getClient();
  
  try {
    const { fromChain, toChain, fromAmount, toAmount, fromAddress, toAddress } = req.body;
    const userId = req.user.userId;

    // Validation
    if (!fromChain || !toChain || !fromAmount || !toAmount || !fromAddress || !toAddress) {
      return res.status(400).json({ error: 'All fields required' });
    }

    if (!['ETH', 'KASPA'].includes(fromChain) || !['ETH', 'KASPA'].includes(toChain)) {
      return res.status(400).json({ error: 'Invalid chain. Supported: ETH, KASPA' });
    }

    if (fromChain === toChain) {
      return res.status(400).json({ error: 'Cannot swap to same chain' });
    }

    const amountNum = parseFloat(fromAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Validate addresses
    if (fromChain === 'ETH' && !ethers.utils.isAddress(fromAddress)) {
      return res.status(400).json({ error: 'Invalid Ethereum from_address' });
    }
    if (toChain === 'ETH' && !ethers.utils.isAddress(toAddress)) {
      return res.status(400).json({ error: 'Invalid Ethereum to_address' });
    }

    await client.query('BEGIN');

    // Generate deposit instructions
    let depositAddress;
    let depositReference;

    if (fromChain === 'ETH') {
      // Use Escrow contract address from env or deployment
      depositAddress = process.env.ESCROW_CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
      depositReference = `0x${Buffer.from(String(userId)).toString('hex').padStart(64, '0')}`;
    } else {
      // Kaspa: generate unique address or use reference
      depositAddress = process.env.KASPA_HOT_WALLET || 'kaspa:qz..hot_wallet_addr';
      depositReference = crypto.randomBytes(16).toString('hex');
    }

    // Insert order
    const orderResult = await client.query(
      `INSERT INTO orders 
       (user_id, from_chain, to_chain, from_amount, to_amount, from_address, to_address, deposit_address, deposit_reference, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'created') 
       RETURNING id`,
      [userId, fromChain, toChain, fromAmount, toAmount, fromAddress, toAddress, depositAddress, depositReference]
    );

    const orderId = orderResult.rows[0].id;

    // Insert deposit record
    await client.query(
      `INSERT INTO deposits (order_id, status) VALUES ($1, 'pending')`,
      [orderId]
    );

    await client.query('COMMIT');

    res.status(201).json({
      orderId,
      depositInstructions: {
        chain: fromChain,
        address: depositAddress,
        amount: fromAmount,
        reference: depositReference,
        ...(fromChain === 'ETH' && { 
          contractAddress: depositAddress,
          depositFunction: 'deposit(bytes32)',
          memo: `Use reference: ${depositReference} when calling deposit()`
        })
      },
      estimatedTime: '5-15 minutes',
      status: 'created'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('createOrder error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  } finally {
    client.release();
  }
}

/**
 * GET /api/orders/:id
 * Get order status
 */
async function getOrder(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await db.query(
      `SELECT o.*, d.tx_hash as deposit_tx, d.confirmations, d.status as deposit_status,
              s.tx_hash as swap_tx, s.status as swap_status, s.error_message
       FROM orders o
       LEFT JOIN deposits d ON o.id = d.order_id
       LEFT JOIN swaps s ON o.id = s.order_id
       WHERE o.id = $1 AND o.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('getOrder error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
}

/**
 * GET /api/orders
 * List user's orders
 */
async function listOrders(req, res) {
  try {
    const userId = req.user.userId;
    const { status, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT o.id, o.from_chain, o.to_chain, o.from_amount, o.to_amount, 
             o.status, o.created_at, d.confirmations
      FROM orders o
      LEFT JOIN deposits d ON o.id = d.order_id
      WHERE o.user_id = $1
    `;
    const params = [userId];

    if (status) {
      query += ` AND o.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    res.json({ orders: result.rows });
  } catch (error) {
    console.error('listOrders error:', error);
    res.status(500).json({ error: 'Failed to list orders' });
  }
}

module.exports = {
  createOrder,
  getOrder,
  listOrders
};
