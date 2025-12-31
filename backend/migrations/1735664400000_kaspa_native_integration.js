/**
 * Database migration: Add Kaspa payment tables
 */

exports.shorthands = undefined;

exports.up = async (pgm) => {
    // Create kaspa_payments table for native Kaspa checkout
    pgm.createTable('kaspa_payments', {
        id: 'id',
        order_id: {
            type: 'integer',
            references: '"orders"',
            onDelete: 'cascade',
            notNull: true
        },
        payment_address: {
            type: 'varchar(100)',
            notNull: true,
            unique: true
        },
        expected_amount: {
            type: 'decimal(18,8)',
            notNull: true
        },
        received_amount: {
            type: 'decimal(18,8)',
            default: 0
        },
        tx_hash: {
            type: 'varchar(100)',
            unique: true
        },
        status: {
            type: 'varchar(20)',
            default: 'pending'
        },
        created_at: {
            type: 'timestamp',
            default: pgm.func('current_timestamp')
        },
        confirmed_at: {
            type: 'timestamp'
        }
    });

    // Add Kaspa-specific fields to orders table
    pgm.addColumns('orders', {
        total_kas: {
            type: 'decimal(18,8)'
        },
        payment_method: {
            type: 'varchar(20)',
            default: 'eth'
        },
        paid_at: {
            type: 'timestamp'
        }
    });

    // Add sacrifice tracking table
    pgm.createTable('sacrifice_transactions', {
        id: 'id',
        kaspa_address: {
            type: 'varchar(100)',
            notNull: true
        },
        tx_hash: {
            type: 'varchar(100)',
            unique: true,
            notNull: true
        },
        amount_kas: {
            type: 'decimal(18,8)',
            notNull: true
        },
        points_awarded: {
            type: 'integer',
            notNull: true
        },
        block_time: {
            type: 'timestamp'
        },
        processed_at: {
            type: 'timestamp',
            default: pgm.func('current_timestamp')
        }
    });

    // Extend users table for sacrifice system
    pgm.addColumns('users', {
        kaspa_address: {
            type: 'varchar(100)'
        },
        sacrifice_points: {
            type: 'integer',
            default: 0
        },
        last_sacrifice_check: {
            type: 'timestamp'
        }
    });

    // Community tables
    pgm.createTable('community_posts', {
        id: 'id',
        user_id: {
            type: 'integer',
            references: '"users"',
            onDelete: 'cascade',
            notNull: true
        },
        title: {
            type: 'varchar(200)',
            notNull: true
        },
        content: {
            type: 'text',
            notNull: true
        },
        tags: {
            type: 'text[]',
            default: []
        },
        likes: {
            type: 'integer',
            default: 0
        },
        created_at: {
            type: 'timestamp',
            default: pgm.func('current_timestamp')
        }
    });

    pgm.createTable('community_comments', {
        id: 'id',
        post_id: {
            type: 'integer',
            references: '"community_posts"',
            onDelete: 'cascade',
            notNull: true
        },
        user_id: {
            type: 'integer',
            references: '"users"',
            onDelete: 'cascade',
            notNull: true
        },
        content: {
            type: 'text',
            notNull: true
        },
        created_at: {
            type: 'timestamp',
            default: pgm.func('current_timestamp')
        }
    });

    pgm.createTable('user_points', {
        user_id: {
            type: 'integer',
            references: '"users"',
            onDelete: 'cascade',
            notNull: true,
            primaryKey: true
        },
        points_total: {
            type: 'integer',
            default: 0
        },
        points_weekly: {
            type: 'integer',
            default: 0
        },
        last_reset: {
            type: 'timestamp',
            default: pgm.func('current_timestamp')
        }
    });

    pgm.createTable('user_achievements', {
        id: 'id',
        user_id: {
            type: 'integer',
            references: '"users"',
            onDelete: 'cascade',
            notNull: true
        },
        achievement_id: {
            type: 'varchar(50)',
            notNull: true
        },
        unlocked_at: {
            type: 'timestamp',
            default: pgm.func('current_timestamp')
        }
    });

    // Create indexes for performance
    pgm.createIndex('kaspa_payments', 'order_id');
    pgm.createIndex('kaspa_payments', 'payment_address');
    pgm.createIndex('kaspa_payments', 'status');
    pgm.createIndex('sacrifice_transactions', 'kaspa_address');
    pgm.createIndex('sacrifice_transactions', 'tx_hash');
    pgm.createIndex('community_posts', 'user_id');
    pgm.createIndex('community_posts', 'created_at');
    pgm.createIndex('community_comments', 'post_id');
    pgm.createIndex('user_achievements', ['user_id', 'achievement_id'], { unique: true });
};

exports.down = async (pgm) => {
    // Drop tables in reverse order
    pgm.dropTable('user_achievements');
    pgm.dropTable('user_points');
    pgm.dropTable('community_comments');
    pgm.dropTable('community_posts');
    pgm.dropTable('sacrifice_transactions');
    pgm.dropTable('kaspa_payments');
    
    // Remove columns from orders table
    pgm.dropColumns('orders', ['total_kas', 'payment_method', 'paid_at']);
    
    // Remove columns from users table
    pgm.dropColumns('users', ['kaspa_address', 'sacrifice_points', 'last_sacrifice_check']);
};