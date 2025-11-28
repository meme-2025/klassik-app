#!/usr/bin/env node
require('dotenv').config();
const db = require('../src/db');

/**
 * Seed script for sample products
 * Run with: node scripts/seed-products.js
 */

const SAMPLE_PRODUCTS = [
  // Gaming Gift Cards
  {
    title: 'PlayStation Store Gift Card $10',
    description: 'Add funds to your PlayStation Network wallet instantly',
    category: 'Giftcards',
    subcategory: 'Gaming',
    provider: 'internal',
    country: 'US',
    price: 0.004,
    currency: 'ETH',
    stock: 50,
    image_url: 'https://via.placeholder.com/300x200?text=PSN+$10',
    active: true
  },
  {
    title: 'PlayStation Store Gift Card $25',
    description: 'Add $25 to your PlayStation Network wallet',
    category: 'Giftcards',
    subcategory: 'Gaming',
    provider: 'internal',
    country: 'US',
    price: 0.01,
    currency: 'ETH',
    stock: 30,
    image_url: 'https://via.placeholder.com/300x200?text=PSN+$25',
    active: true
  },
  {
    title: 'Xbox Gift Card $15',
    description: 'Buy games, apps, and more on Xbox',
    category: 'Giftcards',
    subcategory: 'Gaming',
    provider: 'internal',
    country: 'US',
    price: 0.006,
    currency: 'ETH',
    stock: 40,
    image_url: 'https://via.placeholder.com/300x200?text=Xbox+$15',
    active: true
  },
  {
    title: 'Steam Gift Card $20',
    description: 'Add funds to your Steam wallet for games and content',
    category: 'Giftcards',
    subcategory: 'Gaming',
    provider: 'internal',
    country: 'US',
    price: 0.008,
    currency: 'ETH',
    stock: 100,
    image_url: 'https://via.placeholder.com/300x200?text=Steam+$20',
    active: true
  },
  {
    title: 'Nintendo eShop Card $35',
    description: 'Download games and content for Nintendo Switch',
    category: 'Giftcards',
    subcategory: 'Gaming',
    provider: 'internal',
    country: 'US',
    price: 0.014,
    currency: 'ETH',
    stock: 25,
    image_url: 'https://via.placeholder.com/300x200?text=Nintendo+$35',
    active: true
  },

  // Mobile Top-Up
  {
    title: 'T-Mobile USA $10 Top-Up',
    description: 'Instant mobile credit for T-Mobile US',
    category: 'Mobile',
    subcategory: 'Prepaid',
    provider: 'dingconnect',
    country: 'US',
    price: 0.004,
    currency: 'ETH',
    stock: 1000,
    active: true
  },
  {
    title: 'Vodafone DE €15 Guthaben',
    description: 'Prepaid credit for Vodafone Germany',
    category: 'Mobile',
    subcategory: 'Prepaid',
    provider: 'dingconnect',
    country: 'DE',
    price: 0.006,
    currency: 'ETH',
    stock: 500,
    active: true
  },

  // Retail Gift Cards
  {
    title: 'Amazon Gift Card $50',
    description: 'Shop millions of items on Amazon.com',
    category: 'Giftcards',
    subcategory: 'Retail',
    provider: 'internal',
    country: 'US',
    price: 0.02,
    currency: 'ETH',
    stock: 75,
    image_url: 'https://via.placeholder.com/300x200?text=Amazon+$50',
    active: true
  },
  {
    title: 'Spotify Premium 3 Months',
    description: 'Listen to music ad-free for 3 months',
    category: 'Giftcards',
    subcategory: 'Entertainment',
    provider: 'internal',
    country: 'US',
    price: 0.012,
    currency: 'ETH',
    stock: 60,
    image_url: 'https://via.placeholder.com/300x200?text=Spotify+3mo',
    active: true
  },
  {
    title: 'Netflix Gift Card $30',
    description: 'Stream movies and TV shows',
    category: 'Giftcards',
    subcategory: 'Entertainment',
    provider: 'internal',
    country: 'US',
    price: 0.012,
    currency: 'ETH',
    stock: 45,
    image_url: 'https://via.placeholder.com/300x200?text=Netflix+$30',
    active: true
  },

  // Game Bundles
  {
    title: 'Fortnite V-Bucks 1000',
    description: '1000 V-Bucks for Fortnite Battle Royale',
    category: 'Games',
    subcategory: 'In-Game Currency',
    provider: 'internal',
    country: 'US',
    price: 0.003,
    currency: 'ETH',
    stock: 200,
    image_url: 'https://via.placeholder.com/300x200?text=V-Bucks',
    active: true
  },
  {
    title: 'Roblox Gift Card $25',
    description: 'Robux and exclusive virtual items',
    category: 'Games',
    subcategory: 'In-Game Currency',
    provider: 'internal',
    country: 'US',
    price: 0.01,
    currency: 'ETH',
    stock: 150,
    image_url: 'https://via.placeholder.com/300x200?text=Roblox',
    active: true
  },

  // Klassik Merch
  {
    title: 'Klassik Vinyl - Beethoven Symphony No. 9',
    description: 'Limited edition vinyl record - Numbered edition',
    category: 'Bundles',
    subcategory: 'Merch',
    provider: 'internal',
    country: 'DE',
    price: 0.02,
    currency: 'ETH',
    stock: 10,
    image_url: 'https://via.placeholder.com/300x200?text=Klassik+Vinyl',
    active: true
  },
  {
    title: 'Klassik Poster A2',
    description: 'High-quality A2 poster - Signed by artist',
    category: 'Bundles',
    subcategory: 'Merch',
    provider: 'internal',
    country: 'DE',
    price: 0.005,
    currency: 'ETH',
    stock: 25,
    image_url: 'https://via.placeholder.com/300x200?text=Poster',
    active: true
  },
  {
    title: 'Klassik Hoodie - Black',
    description: 'Comfort fit hoodie with embroidered logo',
    category: 'Bundles',
    subcategory: 'Merch',
    provider: 'internal',
    country: 'DE',
    price: 0.03,
    currency: 'ETH',
    stock: 15,
    image_url: 'https://via.placeholder.com/300x200?text=Hoodie',
    active: true
  }
];

async function seedProducts() {
  console.log('🌱 Starting product seed...\n');

  try {
    // Check if products already exist
    const existing = await db.query('SELECT COUNT(*) FROM products');
    const count = parseInt(existing.rows[0].count);

    if (count > 0) {
      console.log(`⚠️  Database already has ${count} products.`);
      console.log('   Delete all products? (y/N)');
      
      // In a real script, you'd use readline here
      // For now, we'll just proceed
      console.log('   Skipping seed (uncomment TRUNCATE line to force reset)\n');
      // await db.query('TRUNCATE products RESTART IDENTITY CASCADE');
      process.exit(0);
    }

    let inserted = 0;
    for (const product of SAMPLE_PRODUCTS) {
      await db.query(
        `INSERT INTO products 
         (title, description, category, subcategory, provider, country, price, currency, stock, image_url, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          product.title,
          product.description,
          product.category,
          product.subcategory,
          product.provider,
          product.country,
          product.price,
          product.currency,
          product.stock,
          product.image_url,
          product.active
        ]
      );
      inserted++;
      console.log(`   ✓ ${product.title}`);
    }

    console.log(`\n✅ Successfully seeded ${inserted} products!`);
    process.exit(0);

  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

// Run seed
seedProducts();
