/*
 Migration: Create game_sessions table for server-side game engine
 - Creates game_sessions table for persistent game state
 - Adds game_status and current_game_id columns to users table
*/

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create game_sessions table
  pgm.createTable('game_sessions', {
    id: { type: 'SERIAL', primaryKey: true },
    user_id: { type: 'INTEGER', references: 'users(id)', onDelete: 'CASCADE', notNull: true },
    game_type: { type: 'VARCHAR(50)', notNull: true },
    buy_in_amount: { type: 'DECIMAL(20,8)', notNull: true },
    current_balance: { type: 'DECIMAL(20,8)', notNull: true },
    total_bets: { type: 'INTEGER', default: 0, notNull: true },
    total_wagered: { type: 'DECIMAL(20,8)', default: 0, notNull: true },
    total_won: { type: 'DECIMAL(20,8)', default: 0, notNull: true },
    status: { type: 'VARCHAR(20)', default: 'active', notNull: true },
    session_data: { type: 'JSONB', default: '{}', notNull: true },
    started_at: { type: 'TIMESTAMPTZ', default: pgm.func('CURRENT_TIMESTAMP'), notNull: true },
    ended_at: { type: 'TIMESTAMPTZ' },
    last_action: { type: 'TIMESTAMPTZ', default: pgm.func('CURRENT_TIMESTAMP'), notNull: true }
  });

  // Add indexes
  pgm.createIndex('game_sessions', 'user_id', { name: 'idx_game_sessions_user_id' });
  pgm.createIndex('game_sessions', 'status', { name: 'idx_game_sessions_status' });
  pgm.createIndex('game_sessions', 'last_action', { name: 'idx_game_sessions_last_action' });

  // Add game-related columns to users table
  pgm.addColumn('users', {
    game_status: { type: 'VARCHAR(20)', default: 'idle' }
  }, { ifNotExists: true });

  pgm.addColumn('users', {
    current_game_id: { type: 'INTEGER', references: 'game_sessions(id)', onDelete: 'SET NULL' }
  }, { ifNotExists: true });
};

exports.down = (pgm) => {
  // Drop columns from users
  pgm.dropColumn('users', 'current_game_id', { ifExists: true });
  pgm.dropColumn('users', 'game_status', { ifExists: true });

  // Drop table
  pgm.dropTable('game_sessions', { ifExists: true });
};