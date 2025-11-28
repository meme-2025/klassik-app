const db = require('../db');
const crypto = require('crypto');

/**
 * NOWPayments API Integration
 * Docs: https://documenter.getpostman.com/view/7907941/S1a32n38
 */

const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY;
const NOWPAYMENTS_API_URL = process.env.NOWPAYMENTS_API_URL || 'https://api.nowpayments.io/v1';
const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET;

/**
 * POST /api/payments/invoice
 * Create NOWPayments invoice for shop order
 */
async function createInvoice(req, res) {
  const client = await db.getClient();

  try {
    const { items, buyerAddress } = req.body;
    const userId = req.user.userId || req.user.id;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array required' });
    }

    if (!NOWPAYMENTS_API_KEY) {
      return res.status(500).json({ error: 'Payment gateway not configured' });
    }

    await client.query('BEGIN');

    // Calculate total
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      if (!item.id || !item.qty || item.qty <= 0) {
        throw new Error('Invalid item format');
      }

      // Get product details
      const productResult = await client.query(
        'SELECT id, title, price, currency, stock FROM products WHERE id = $1 AND active = true',
        [item.id]
      );

      if (productResult.rows.length === 0) {
        throw new Error(`Product ${item.id} not found or inactive`);
      }

      const product = productResult.rows[0];

      // Check stock
      if (product.stock < item.qty) {
        throw new Error(`Insufficient stock for ${product.title}`);
      }

      const itemTotal = parseFloat(product.price) * item.qty;
      totalAmount += itemTotal;

      orderItems.push({
        product_id: product.id,
        product_title: product.title,
        quantity: item.qty,
        price: product.price,
        currency: product.currency
      });
    }

    // Create order
    const orderResult = await client.query(
      `INSERT INTO orders 
       (user_id, order_type, status, total_amount, from_address, to_address, from_chain, to_chain, from_amount, to_amount)
       VALUES ($1, 'shop', 'created', $2, $3, $3, 'ETH', 'ETH', $2, $2)
       RETURNING id`,
      [userId, totalAmount, buyerAddress || 'N/A']
    );

    const orderId = orderResult.rows[0].id;

    // Insert order items
    for (const item of orderItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_title, quantity, price, currency)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, item.product_id, item.product_title, item.quantity, item.price, item.currency]
      );

      // Reduce stock
      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }

    // Create NOWPayments invoice
    const invoiceData = {
      price_amount: totalAmount,
      price_currency: 'usd', // Convert ETH to USD or use dynamic rate
      pay_currency: 'eth',
      ipn_callback_url: `${process.env.BASE_URL || 'http://localhost:3000'}/api/payments/webhook`,
      order_id: orderId.toString(),
      order_description: `Klassik Shop Order #${orderId}`,
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/order-success?orderId=${orderId}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/order-cancelled`
    };

    const nowResponse = await fetch(`${NOWPAYMENTS_API_URL}/invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': NOWPAYMENTS_API_KEY
      },
      body: JSON.stringify(invoiceData)
    });

    if (!nowResponse.ok) {
      const errorText = await nowResponse.text();
      console.error('NOWPayments API error:', errorText);
      throw new Error('Failed to create payment invoice');
    }

    const invoiceResponse = await nowResponse.json();

    // Store payment record
    await client.query(
      `INSERT INTO payments 
       (order_id, payment_id, invoice_id, invoice_url, pay_address, pay_amount, pay_currency, price_amount, price_currency, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'waiting')`,
      [
        orderId,
        invoiceResponse.id,
        invoiceResponse.id,
        invoiceResponse.invoice_url,
        invoiceResponse.pay_address,
        invoiceResponse.pay_amount,
        invoiceResponse.pay_currency,
        invoiceResponse.price_amount,
        invoiceResponse.price_currency
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({
      orderId,
      payment_id: invoiceResponse.id,
      invoice_url: invoiceResponse.invoice_url,
      pay_address: invoiceResponse.pay_address,
      pay_amount: invoiceResponse.pay_amount,
      pay_currency: invoiceResponse.pay_currency,
      status: 'waiting'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('createInvoice error:', error);
    res.status(500).json({ error: error.message || 'Failed to create invoice' });
  } finally {
    client.release();
  }
}

/**
 * POST /api/payments/webhook
 * NOWPayments IPN callback
 */
async function handleWebhook(req, res) {
  try {
    const payload = req.body;
    const signature = req.headers['x-nowpayments-sig'];

    // Verify signature
    if (NOWPAYMENTS_IPN_SECRET && signature) {
      const expectedSignature = crypto
        .createHmac('sha512', NOWPAYMENTS_IPN_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (signature !== expectedSignature) {
        console.error('Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const { payment_id, payment_status, order_id, actually_paid, outcome_amount, outcome_currency } = payload;

    if (!payment_id) {
      return res.status(400).json({ error: 'payment_id required' });
    }

    // Update payment record
    const updateResult = await db.query(
      `UPDATE payments 
       SET payment_status = $1, actually_paid = $2, outcome_amount = $3, outcome_currency = $4, updated_at = CURRENT_TIMESTAMP
       WHERE payment_id = $5
       RETURNING order_id`,
      [payment_status, actually_paid, outcome_amount, outcome_currency, payment_id]
    );

    if (updateResult.rows.length === 0) {
      console.warn('Payment not found:', payment_id);
      return res.status(404).json({ error: 'Payment not found' });
    }

    const orderId = updateResult.rows[0].order_id;

    // Update order status based on payment status
    let orderStatus = 'created';
    if (['finished', 'partially_paid'].includes(payment_status)) {
      orderStatus = 'paid';
    } else if (payment_status === 'failed') {
      orderStatus = 'failed';
    } else if (payment_status === 'expired') {
      orderStatus = 'expired';
    } else if (payment_status === 'refunded') {
      orderStatus = 'refunded';
    }

    await db.query(
      'UPDATE orders SET status = $1 WHERE id = $2',
      [orderStatus, orderId]
    );

    console.log(`✅ Webhook processed: Order ${orderId}, Payment ${payment_id}, Status: ${payment_status}`);

    res.json({ success: true });

  } catch (error) {
    console.error('handleWebhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

/**
 * GET /api/payments/:orderId
 * Get payment status for order
 */
async function getPaymentStatus(req, res) {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId || req.user.id;

    const result = await db.query(
      `SELECT p.*, o.status as order_status, o.total_amount
       FROM payments p
       JOIN orders o ON p.order_id = o.id
       WHERE p.order_id = $1 AND o.user_id = $2`,
      [orderId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('getPaymentStatus error:', error);
    res.status(500).json({ error: 'Failed to get payment status' });
  }
}

/**
 * GET /api/payments/status/:paymentId
 * Check payment status from NOWPayments API
 */
async function checkPaymentStatus(req, res) {
  try {
    const { paymentId } = req.params;

    if (!NOWPAYMENTS_API_KEY) {
      return res.status(500).json({ error: 'Payment gateway not configured' });
    }

    const response = await fetch(`${NOWPAYMENTS_API_URL}/payment/${paymentId}`, {
      headers: {
        'x-api-key': NOWPAYMENTS_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error('Failed to check payment status');
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('checkPaymentStatus error:', error);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
}

module.exports = {
  createInvoice,
  handleWebhook,
  getPaymentStatus,
  checkPaymentStatus
};
