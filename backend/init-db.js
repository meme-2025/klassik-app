#!/usr/bin/env node
/**
 * Database Initialization Script
 * Runs all necessary SQL to create tables and indexes
 */

require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'klassik'}`;

const pool = new Pool({ connectionString });

const initSQL = `
-- ============================================
-- Users Table
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  address VARCHAR(42),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_email_or_address CHECK (email IS NOT NULL OR address IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_address ON users(LOWER(address));

-- ============================================
-- Nonces Table (for wallet authentication)
-- ============================================
CREATE TABLE IF NOT EXISTS nonces (
  address VARCHAR(42) PRIMARY KEY,
  nonce VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nonces_expires_at ON nonces(expires_at);

-- ============================================
-- Events Table
-- ============================================
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  date TIMESTAMP NOT NULL,
  location VARCHAR(255),
  price DECIMAL(10, 2),
  currency VARCHAR(10) DEFAULT 'EUR',
  image_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Bookings Table
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  tickets INTEGER NOT NULL DEFAULT 1,
  total_price DECIMAL(10, 2),
  payment_status VARCHAR(50) DEFAULT 'pending',
  payment_tx_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_event_id ON bookings(event_id);

-- ============================================
-- Products Table
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'EUR',
  category VARCHAR(100),
  image_url TEXT,
  stock INTEGER DEFAULT 0,
  country VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_country ON products(country);

-- ============================================
-- Orders Table
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  total_price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'EUR',
  payment_status VARCHAR(50) DEFAULT 'pending',
  payment_method VARCHAR(50),
  payment_tx_hash VARCHAR(255),
  shipping_address TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

-- ============================================
-- Payments Table
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'KAS',
  payment_address VARCHAR(255),
  tx_hash VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  confirmations INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT payment_reference CHECK (order_id IS NOT NULL OR booking_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- ============================================
-- Swap Transactions Table (Kaspa DEX)
-- ============================================
CREATE TABLE IF NOT EXISTS swap_transactions (
  id SERIAL PRIMARY KEY,
  user_address VARCHAR(255) NOT NULL,
  from_currency VARCHAR(10) NOT NULL,
  to_currency VARCHAR(10) NOT NULL,
  from_amount DECIMAL(20, 8) NOT NULL,
  to_amount DECIMAL(20, 8) NOT NULL,
  exchange_rate DECIMAL(20, 8),
  status VARCHAR(50) DEFAULT 'pending',
  tx_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_swap_user_address ON swap_transactions(user_address);
CREATE INDEX IF NOT EXISTS idx_swap_status ON swap_transactions(status);
`;

async function initDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Initializing database...');
    console.log('📍 Connection:', connectionString.replace(/:[^:@]*@/, ':***@'));
    
    await client.query(initSQL);
    
    console.log('✅ Database initialized successfully!');
    console.log('');
    console.log('📊 Created tables:');
    console.log('   - users (with email & wallet support)');
    console.log('   - nonces (for wallet authentication)');
    console.log('   - events');
    console.log('   - bookings');
    console.log('   - products');
    console.log('   - orders');
    console.log('   - payments');
    console.log('   - swap_transactions');
    console.log('');
    
    // Verify tables
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📋 Existing tables in database:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

initDatabase();
