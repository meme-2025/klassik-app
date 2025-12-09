/**
 * Migration: Wallet-Only Authentication (FINAL)
 * 
 * Changes:
 * - Add username column for display names
 * - Make email and password NULLABLE (wallet-only users don't need them)
 * - Ensure address column is properly indexed
 * - Migrate existing data from email→address, password→username
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  console.log('🔧 Starting Wallet-Only Migration...');
  
  // 1. Add username column if not exists
  pgm.addColumn('users', {
    username: {
      type: 'VARCHAR(100)',
      unique: true
    }
  }, { ifNotExists: true });
  
  // 2. Make email and password nullable (for wallet-only users)
  pgm.alterColumn('users', 'email', {
    type: 'VARCHAR(255)',
    notNull: false,
    unique: true
  });
  
  pgm.alterColumn('users', 'password', {
    type: 'TEXT',
    notNull: false
  });
  
  // 3. Ensure address column exists and is indexed
  pgm.addColumn('users', {
    address: {
      type: 'VARCHAR(255)',
      unique: true
    }
  }, { ifNotExists: true });
  
  // 4. Migrate existing wallet users (email starts with 0x → is wallet address)
  pgm.sql(`
    UPDATE users 
    SET 
      username = COALESCE(password, CONCAT('user_', id)),
      address = LOWER(email),
      email = NULL,
      password = NULL
    WHERE email LIKE '0x%' OR email LIKE '0X%'
  `);
  
  // 5. Create index for faster lookups
  pgm.createIndex('users', 'address', { 
    ifNotExists: true,
    name: 'idx_users_address'
  });
  
  pgm.createIndex('users', 'username', { 
    ifNotExists: true,
    name: 'idx_users_username'
  });
  
  console.log('✅ Wallet-Only Migration complete!');
};

exports.down = (pgm) => {
  console.log('⏪ Rolling back Wallet-Only Migration...');
  
  // Restore old structure (if needed)
  pgm.sql(`
    UPDATE users
    SET 
      email = address,
      password = username
    WHERE address IS NOT NULL AND email IS NULL
  `);
  
  pgm.dropIndex('users', 'address', { 
    ifExists: true,
    name: 'idx_users_address'
  });
  
  pgm.dropIndex('users', 'username', { 
    ifExists: true,
    name: 'idx_users_username'
  });
  
  // Don't drop username column to preserve data
  
  console.log('✅ Rollback complete');
};
