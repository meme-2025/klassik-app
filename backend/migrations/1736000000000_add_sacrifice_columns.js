/*
 Migration: Add Kaspa sacrifice columns + user_points table
 - Add `kaspa_address` (VARCHAR(100)) to `users` if missing
 - Add `sacrifice_points` (BIGINT) to `users` with default 0 if missing
 - Add `last_sacrifice_check` (timestamptz) to `users` if missing
 - Create `user_points` table if it doesn't exist (user_id PK references users.id)
 - Create index on `kaspa_address`
*/

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Add columns to users if they don't exist
  pgm.addColumn('users', {
    kaspa_address: { type: 'VARCHAR(100)' }
  }, { ifNotExists: true });

  pgm.addColumn('users', {
    sacrifice_points: { type: 'BIGINT', default: 0 }
  }, { ifNotExists: true });

  pgm.addColumn('users', {
    last_sacrifice_check: { type: 'TIMESTAMPTZ' }
  }, { ifNotExists: true });

  // Create user_points table if it doesn't exist
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS user_points (
      user_id bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      points_total bigint DEFAULT 0 NOT NULL,
      points_weekly bigint DEFAULT 0 NOT NULL,
      updated_at timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `);

  // Index on kaspa_address for fast lookups
  pgm.createIndex('users', 'kaspa_address', { ifNotExists: true, name: 'idx_users_kaspa_address' });
};

exports.down = (pgm) => {
  // Rollback: remove index and optional table/columns if desired
  pgm.dropIndex('users', 'idx_users_kaspa_address', { ifExists: true });

  // Drop user_points only if it exists
  pgm.sql(`DROP TABLE IF EXISTS user_points`);

  // Drop columns if they exist (be careful in production)
  pgm.dropColumn('users', 'kaspa_address', { ifExists: true });
  pgm.dropColumn('users', 'sacrifice_points', { ifExists: true });
  pgm.dropColumn('users', 'last_sacrifice_check', { ifExists: true });
};
