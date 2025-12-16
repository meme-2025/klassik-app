require('dotenv').config();
const db = require('./src/db');

async function migrate() {
  try {
    console.log('🚀 Starting migration...\n');
    
    // 1. Add address column
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(42);`);
    console.log('✅ Added address column');
    
    // 2. Create index
    await db.query(`CREATE INDEX IF NOT EXISTS idx_users_address ON users(LOWER(address));`);
    console.log('✅ Created address index');
    
    // 3. Create nonces table
    await db.query(`
      CREATE TABLE IF NOT EXISTS nonces (
        address VARCHAR(42) PRIMARY KEY,
        nonce VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created nonces table');
    
    // 4. Create nonces index
    await db.query(`CREATE INDEX IF NOT EXISTS idx_nonces_expires_at ON nonces(expires_at);`);
    console.log('✅ Created nonces index');
    
    // 5. Make password nullable
    await db.query(`ALTER TABLE users ALTER COLUMN password DROP NOT NULL;`);
    console.log('✅ Made password nullable');
    
    console.log('\n🎉 Migration completed!\n');
    
    // Verify
    const result = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position`);
    console.log('Users table columns:');
    result.rows.forEach(c => console.log('  -', c.column_name));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
