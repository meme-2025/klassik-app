/* Products, Payments, Order Items tables */
exports.shorthands = undefined;

exports.up = (pgm) => {
  // Products table
  pgm.createTable('products', {
    id: 'id',
    title: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    category: { type: 'varchar(100)' },
    subcategory: { type: 'varchar(100)' },
    provider: { type: 'varchar(50)', default: 'internal' }, // 'internal', 'dingconnect', 'reloadly'
    country: { type: 'varchar(2)' }, // ISO country code
    price: { type: 'numeric(10,6)', notNull: true },
    currency: { type: 'varchar(10)', notNull: true, default: 'ETH' },
    stock: { type: 'integer', default: 0 },
    image_url: { type: 'text' },
    external_id: { type: 'varchar(255)' }, // ID from external provider
    metadata: { type: 'jsonb' }, // flexible field for provider-specific data
    active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  pgm.createIndex('products', 'category');
  pgm.createIndex('products', 'provider');
  pgm.createIndex('products', 'active');

  // Order items table (for shop orders)
  pgm.createTable('order_items', {
    id: 'id',
    order_id: { type: 'integer', notNull: true, references: 'orders', onDelete: 'cascade' },
    product_id: { type: 'integer', references: 'products', onDelete: 'set null' },
    product_title: { type: 'varchar(255)', notNull: true }, // store title in case product is deleted
    quantity: { type: 'integer', notNull: true, default: 1 },
    price: { type: 'numeric(10,6)', notNull: true },
    currency: { type: 'varchar(10)', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  pgm.createIndex('order_items', 'order_id');

  // Payments table for NOWPayments integration
  pgm.createTable('payments', {
    id: 'id',
    order_id: { type: 'integer', notNull: true, references: 'orders', onDelete: 'cascade' },
    payment_id: { type: 'varchar(255)', unique: true }, // NOWPayments payment_id
    invoice_id: { type: 'varchar(255)' }, // NOWPayments invoice_id
    invoice_url: { type: 'text' },
    pay_address: { type: 'varchar(255)' },
    pay_amount: { type: 'numeric(20,8)' },
    pay_currency: { type: 'varchar(10)' },
    price_amount: { type: 'numeric(10,2)' },
    price_currency: { type: 'varchar(10)' },
    payment_status: { type: 'varchar(50)', notNull: true, default: 'waiting' }, // waiting, confirming, confirmed, sending, partially_paid, finished, failed, refunded, expired
    actually_paid: { type: 'numeric(20,8)' },
    outcome_amount: { type: 'numeric(20,8)' },
    outcome_currency: { type: 'varchar(10)' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  pgm.createIndex('payments', 'order_id');
  pgm.createIndex('payments', 'payment_id');
  pgm.createIndex('payments', 'payment_status');

  // Update orders table: add total_amount and shop_order flag
  pgm.addColumns('orders', {
    total_amount: { type: 'numeric(10,6)' },
    order_type: { type: 'varchar(20)', notNull: true, default: 'swap' } // 'swap' or 'shop'
  });

  // Add updated_at trigger function
  pgm.createFunction(
    'update_updated_at_column',
    [],
    {
      returns: 'trigger',
      language: 'plpgsql',
      replace: true
    },
    `
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    `
  );

  // Add triggers for updated_at
  pgm.createTrigger('products', 'update_products_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'update_updated_at_column',
    level: 'ROW'
  });

  pgm.createTrigger('payments', 'update_payments_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'update_updated_at_column',
    level: 'ROW'
  });
};

exports.down = (pgm) => {
  pgm.dropTrigger('payments', 'update_payments_updated_at');
  pgm.dropTrigger('products', 'update_products_updated_at');
  pgm.dropFunction('update_updated_at_column');
  pgm.dropColumns('orders', ['total_amount', 'order_type']);
  pgm.dropTable('payments');
  pgm.dropTable('order_items');
  pgm.dropTable('products');
};
