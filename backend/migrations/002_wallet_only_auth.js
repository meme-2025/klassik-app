/**
 * Migration: Wallet-Only Authentication
 * 
 * Changes:
 * - Remove email/password authentication
 * - Restructure users table for wallet-only auth
 * - Add username field for user identification
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1. Drop old email/password columns (backup data first if needed)
  pgm.dropColumn('users', 'email', { ifExists: true });
  pgm.dropColumn('users', 'password', { ifExists: true });
  
  // 2. Ensure address column exists and is unique
  pgm.alterColumn('users', 'address', {
    type: 'VARCHAR(255)',
    notNull: true,
    unique: true
  });
  
  // 3. Add username column (stored instead of password)
  pgm.addColumn('users', {
    username: {
      type: 'VARCHAR(100)',
      notNull: true,
      unique: true
    }
  }, { ifNotExists: true });
  
  // 4. Ensure created_at exists
  pgm.addColumn('users', {
    created_at: {
      type: 'TIMESTAMP',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP')
    }
  }, { ifNotExists: true });
  
  // 5. Rename address to wallet_address for clarity (optional)
  // Commented out to avoid breaking existing code - can be done later
  // pgm.renameColumn('users', 'address', 'wallet_address');
  
  console.log('✅ Migration complete: Users table now supports wallet-only auth');
};

exports.down = (pgm) => {
  // Rollback: restore old schema
  pgm.addColumn('users', {
    email: {
      type: 'VARCHAR(255)',
      unique: true
    },
    password: {
      type: 'TEXT'
    }
  });
  
  pgm.dropColumn('users', 'username', { ifExists: true });
  
  pgm.alterColumn('users', 'address', {
    type: 'VARCHAR(255)',
    notNull: false,
    unique: true
  });
};
