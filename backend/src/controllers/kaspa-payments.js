const db = require('../db');
const axios = require('axios');
const crypto = require('crypto');

/**
 * Native Kaspa Payment Processing
 * Direct integration without third-party processors
 */

const KASPA_APIs = {
  restServer: process.env.KASPA_REST_SERVER || null,
  primary: 'https://api.kaspa.org',
  explorer: 'https://explorer.kaspa.org/api'
};

const KASPA_HOT_WALLET = process.env.KASPA_HOT_WALLET || 'kaspa:qz8wn7k8p2t5h4r3q9x6c7v8b5n2m4k3j6h9g8f5d2s1a3z4x7c9v6b2n8m5k2j6h3g7f4d1s9a6z3x0c7v4b1n8m5';
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

class KaspaPaymentProcessor {
  constructor() {
    this.priceCache = { usd: null, lastUpdate: 0 };
    this.cacheDuration = 30000; // 30 seconds
  }

  /**
   * Get current KAS price in USD
   */
  async getKaspaPrice() {
    const now = Date.now();
    if (this.priceCache.usd && (now - this.priceCache.lastUpdate) < this.cacheDuration) {
      return this.priceCache.usd;
    }

    try {
      const response = await axios.get(`${COINGECKO_API}/simple/price`, {
        params: { ids: 'kaspa', vs_currencies: 'usd' },
        timeout: 5000
      });
      
      const price = response.data?.kaspa?.usd;
      if (price) {
        this.priceCache = { usd: price, lastUpdate: now };
        return price;
      }
    } catch (error) {
      console.error('Failed to fetch KAS price:', error.message);
    }

    // Fallback price if API fails
    return this.priceCache.usd || 0.02; // Default fallback
  }

  /**
   * Generate unique payment address for order
   */
  async generatePaymentAddress(orderId) {
    // For demo: use deterministic address based on order ID
    // In production: generate actual unique addresses from wallet
    const hash = crypto.createHash('sha256').update(`order_${orderId}`).digest('hex');
    const addressSuffix = hash.substring(0, 40);
    return `kaspa:qz${addressSuffix}0a1b2c3d4e5f`;
  }

  /**
   * Check balance for payment address
   */
  async checkAddressBalance(address) {
    try {
      // Try local node first
      if (KASPA_APIs.restServer) {
        const response = await axios.get(`${KASPA_APIs.restServer}/addresses/${address}/balance`, { timeout: 5000 });
        return parseFloat(response.data.balance || 0);
      }

      // Fallback to public API
      const response = await axios.get(`${KASPA_APIs.explorer}/addresses/${address}/balance`, { timeout: 5000 });
      return parseFloat(response.data.balance || 0);
    } catch (error) {
      console.warn('Failed to check balance for', address, error.message);
      return 0;
    }
  }

  /**
   * Calculate order total in KAS
   */
  async calculateOrderTotal(items) {
    const kasPrice = await this.getKaspaPrice();
    let totalUSD = 0;

    for (const item of items) {
      const productResult = await db.query(
        'SELECT price FROM products WHERE id = $1',
        [item.id]
      );
      
      if (productResult.rows.length > 0) {
        const itemPrice = parseFloat(productResult.rows[0].price);
        totalUSD += itemPrice * item.qty;
      }
    }

    const totalKAS = totalUSD / kasPrice;
    return {
      usd: totalUSD,
      kas: parseFloat(totalKAS.toFixed(8)),
      rate: kasPrice
    };
  }

  /**
   * Create Kaspa checkout session
   */
  async createCheckout(userId, items, buyerAddress = null) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      // Calculate totals
      const totals = await this.calculateOrderTotal(items);
      
      // Create order
      const orderResult = await client.query(`
        INSERT INTO orders 
        (user_id, order_type, total_amount, total_kas, payment_method, from_address, to_address, status, created_at)
        VALUES ($1, 'shop', $2, $3, 'kaspa', $4, $5, 'awaiting_payment', CURRENT_TIMESTAMP)
        RETURNING id
      `, [userId, totals.usd, totals.kas, buyerAddress, KASPA_HOT_WALLET]);

      const orderId = orderResult.rows[0].id;

      // Generate payment address
      const paymentAddress = await this.generatePaymentAddress(orderId);

      // Update order with payment address
      await client.query(
        'UPDATE orders SET deposit_address = $1 WHERE id = $2',
        [paymentAddress, orderId]
      );

      // Insert order items
      for (const item of items) {
        const productResult = await client.query(
          'SELECT id, title, price, currency FROM products WHERE id = $1',
          [item.id]
        );
        
        if (productResult.rows.length > 0) {
          const product = productResult.rows[0];
          await client.query(`
            INSERT INTO order_items (order_id, product_id, product_title, quantity, price, currency)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [orderId, product.id, product.title, item.qty, product.price, product.currency]);
        }
      }

      // Create payment record
      await client.query(`
        INSERT INTO kaspa_payments 
        (order_id, payment_address, expected_amount, status, created_at)
        VALUES ($1, $2, $3, 'pending', CURRENT_TIMESTAMP)
      `, [orderId, paymentAddress, totals.kas]);

      await client.query('COMMIT');

      return {
        orderId,
        paymentAddress,
        amountKAS: totals.kas,
        amountUSD: totals.usd,
        exchangeRate: totals.rate,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
        status: 'awaiting_payment'
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(orderId) {
    const result = await db.query(`
      SELECT o.*, kp.payment_address, kp.expected_amount, kp.received_amount, kp.tx_hash
      FROM orders o
      LEFT JOIN kaspa_payments kp ON o.id = kp.order_id
      WHERE o.id = $1
    `, [orderId]);

    if (result.rows.length === 0) {
      throw new Error('Order not found');
    }

    const order = result.rows[0];
    
    if (order.status === 'awaiting_payment' && order.payment_address) {
      // Check current balance
      const balance = await this.checkAddressBalance(order.payment_address);
      
      if (balance >= order.expected_amount) {
        // Payment received! Update order
        await this.processPaymentReceived(orderId, balance);
        order.status = 'paid';
        order.received_amount = balance;
      }
    }

    return order;
  }

  /**
   * Process confirmed payment
   */
  async processPaymentReceived(orderId, amount) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      // Update order status
      await client.query(`
        UPDATE orders 
        SET status = 'paid', paid_at = CURRENT_TIMESTAMP 
        WHERE id = $1
      `, [orderId]);

      // Update payment record
      await client.query(`
        UPDATE kaspa_payments 
        SET received_amount = $1, status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP
        WHERE order_id = $2
      `, [amount, orderId]);

      await client.query('COMMIT');
      
      console.log(`✅ Payment confirmed for order ${orderId}: ${amount} KAS`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Failed to process payment:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

/**
 * POST /api/payments/kaspa/checkout
 * Create Kaspa payment checkout
 */
async function createKaspaCheckout(req, res) {
  try {
    const { items, buyerAddress } = req.body;
    const userId = req.user.userId || req.user.id;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array required' });
    }

    const processor = new KaspaPaymentProcessor();
    const checkout = await processor.createCheckout(userId, items, buyerAddress);

    res.status(201).json(checkout);

  } catch (error) {
    console.error('createKaspaCheckout error:', error);
    res.status(500).json({ error: 'Failed to create Kaspa checkout' });
  }
}

/**
 * GET /api/payments/kaspa/:orderId/status
 * Check Kaspa payment status
 */
async function checkKaspaPaymentStatus(req, res) {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId || req.user.id;

    const processor = new KaspaPaymentProcessor();
    const status = await processor.checkPaymentStatus(orderId);

    // Verify user owns this order
    if (status.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(status);

  } catch (error) {
    console.error('checkKaspaPaymentStatus error:', error);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
}

/**
 * GET /api/payments/kaspa/price
 * Get current KAS price
 */
async function getKaspaPrice(req, res) {
  try {
    const processor = new KaspaPaymentProcessor();
    const price = await processor.getKaspaPrice();
    
    res.json({ 
      kas_usd: price,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('getKaspaPrice error:', error);
    res.status(500).json({ error: 'Failed to get KAS price' });
  }
}

module.exports = {
  KaspaPaymentProcessor,
  createKaspaCheckout,
  checkKaspaPaymentStatus,
  getKaspaPrice
};