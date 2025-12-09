require('dotenv').config();
const db = require('./src/db');

async function checkSchema() {
  try {
    const result = await db.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📊 Current USERS table structure:');
    console.log('=====================================');
    result.rows.forEach(col => {
      console.log(`  ${col.column_name.padEnd(20)} ${col.data_type.padEnd(30)} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    console.log('');
    
    // Check if nonces table exists
    const nonceCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'nonces'
      );
    `);
    
    console.log('📋 Nonces table exists:', nonceCheck.rows[0].exists ? '✅ YES' : '❌ NO');
    
    if (nonceCheck.rows[0].exists) {
      const nonceSchema = await db.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'nonces' 
        ORDER BY ordinal_position
      `);
      console.log('\n📊 NONCES table structure:');
      console.log('=====================================');
      nonceSchema.rows.forEach(col => {
        console.log(`  ${col.column_name.padEnd(20)} ${col.data_type.padEnd(30)} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkSchema();
