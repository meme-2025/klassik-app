/* initial tables: users, events, bookings, orders, deposits, swaps */
exports.shorthands = undefined;

exports.up = (pgm) => {
  // users table (extend with address + nonce fields)
  pgm.createTable('users', {
    id: 'id',
    email: { type: 'varchar(255)', notNull: false, unique: true },
    password: { type: 'text', notNull: false },
    address: { type: 'varchar(255)', notNull: false, unique: true },
    nonce: { type: 'varchar(255)', notNull: false },
    nonce_expiry: { type: 'timestamp', notNull: false },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  pgm.createTable('events', {
    id: 'id',
    title: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    date: { type: 'timestamp' },
    capacity: { type: 'integer', notNull: true, default: 0 },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  pgm.createTable('bookings', {
    id: 'id',
    user_id: { type: 'integer', notNull: true, references: 'users', onDelete: 'cascade' },
    event_id: { type: 'integer', notNull: true, references: 'events', onDelete: 'cascade' },
    quantity: { type: 'integer', notNull: true, default: 1 },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  // orders table for swap flow
  pgm.createTable('orders', {
    id: 'id',
    user_id: { type: 'integer', notNull: true, references: 'users', onDelete: 'cascade' },
    from_chain: { type: 'varchar(50)', notNull: true },
    to_chain: { type: 'varchar(50)', notNull: true },
    from_amount: { type: 'numeric', notNull: true },
    to_amount: { type: 'numeric', notNull: true },
    from_address: { type: 'varchar(255)' },
    to_address: { type: 'varchar(255)' },
    deposit_address: { type: 'varchar(255)' },
    deposit_reference: { type: 'varchar(255)' },
    status: { type: 'varchar(50)', notNull: true, default: 'created' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  pgm.createTable('deposits', {
    id: 'id',
    order_id: { type: 'integer', notNull: true, references: 'orders', onDelete: 'cascade' },
    tx_hash: { type: 'varchar(255)' },
    confirmations: { type: 'integer', notNull: false, default: 0 },
    status: { type: 'varchar(50)', notNull: true, default: 'pending' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  pgm.createTable('swaps', {
    id: 'id',
    order_id: { type: 'integer', notNull: true, references: 'orders', onDelete: 'cascade' },
    tx_hash: { type: 'varchar(255)' },
    status: { type: 'varchar(50)', notNull: true, default: 'pending' },
    error_message: { type: 'text' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });
};

exports.down = (pgm) => {
  pgm.dropTable('swaps');
  pgm.dropTable('deposits');
  pgm.dropTable('orders');
  pgm.dropTable('bookings');
  pgm.dropTable('events');
  pgm.dropTable('users');
};
