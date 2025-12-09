#!/bin/bash
# Klassik Migration mit richtiger Konfiguration
# Verwendet die richtige .env Datei aus /etc/klassik/klassik1.env

cd /opt/klassik/backend

# Migration Script mit korrekter ENV
cat > run-migration.js << 'EOFMIGRATION'
// Load environment from /etc/klassik/klassik1.env
const fs = require('fs');
const path = require('path');

// Parse .env file manually
const envPath = '/etc/klassik/klassik1.env';
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    const value = valueParts.join('=').trim();
    process.env[key.trim()] = value.replace(/^["']|["']$/g, '');
  }
});

console.log('📋 Using DATABASE_URL from:', envPath);
console.log('🔌 Port from ENV:', process.env.PORT || '8130');

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting migration...\n');
    
    // 1. Add address column to users
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(42);`);
    console.log('✅ Added address column to users');
    
    // 2. Create index on address
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_address ON users(LOWER(address));`);
    console.log('✅ Created index on address');
    
    // 3. Create nonces table
    await client.query(`
      CREATE TABLE IF NOT EXISTS nonces (
        address VARCHAR(42) PRIMARY KEY,
        nonce VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created nonces table');
    
    // 4. Create index on nonces
    await client.query(`CREATE INDEX IF NOT EXISTS idx_nonces_expires_at ON nonces(expires_at);`);
    console.log('✅ Created index on nonces.expires_at');
    
    // 5. Check if password column exists and make it nullable
    const passwordCheck = await client.query(`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'password'
    `);
    
    if (passwordCheck.rows.length > 0 && passwordCheck.rows[0].is_nullable === 'NO') {
      await client.query(`ALTER TABLE users ALTER COLUMN password DROP NOT NULL;`);
      console.log('✅ Made password column nullable');
    } else if (passwordCheck.rows.length > 0) {
      console.log('ℹ️  Password column already nullable');
    } else {
      console.log('⚠️  No password column found (might be password_hash)');
    }
    
    console.log('\n🎉 Migration completed successfully!\n');
    
    // Verify tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📊 All tables in database:');
    tables.rows.forEach(t => console.log('   -', t.table_name));
    
    // Verify users columns
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Users table structure:');
    columns.rows.forEach(c => {
      console.log(`   - ${c.column_name.padEnd(20)} ${c.data_type.padEnd(25)} ${c.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
    const hasAddress = columns.rows.some(c => c.column_name === 'address');
    console.log('\n✅ Migration verification:');
    console.log('   Address column:', hasAddress ? '✅ Present' : '❌ Missing');
    
    const noncesExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'nonces'
      )
    `);
    console.log('   Nonces table:', noncesExists.rows[0].exists ? '✅ Present' : '❌ Missing');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate()
  .then(() => {
    console.log('\n✅ All done! Backend can now handle wallet authentication.');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
EOFMIGRATION

echo "📝 Migration script created: run-migration.js"
echo ""

# Migration ausführen
sudo -u klassik bash -c "source /etc/klassik/klassik1.env && cd /opt/klassik/backend && node run-migration.js"
