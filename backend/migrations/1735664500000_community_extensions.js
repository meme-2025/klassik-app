/**
 * Add community tables and point system extensions
 */

exports.shorthands = undefined;

exports.up = async (pgm) => {
    // Add referral tracking to users table
    pgm.addColumns('users', {
        referred_by: {
            type: 'integer',
            references: '"users"'
        },
        referral_code: {
            type: 'varchar(20)',
            unique: true
        }
    });

    // Post likes table
    pgm.createTable('post_likes', {
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
        created_at: {
            type: 'timestamp',
            default: pgm.func('current_timestamp')
        }
    });

    // Point transactions log
    pgm.createTable('point_transactions', {
        id: 'id',
        user_id: {
            type: 'integer',
            references: '"users"',
            onDelete: 'cascade',
            notNull: true
        },
        action: {
            type: 'varchar(50)',
            notNull: true
        },
        points: {
            type: 'integer',
            notNull: true
        },
        created_at: {
            type: 'timestamp',
            default: pgm.func('current_timestamp')
        }
    });

    // Login tracking for consecutive days achievement
    pgm.createTable('user_logins', {
        id: 'id',
        user_id: {
            type: 'integer',
            references: '"users"',
            onDelete: 'cascade',
            notNull: true
        },
        login_date: {
            type: 'date',
            notNull: true,
            default: pgm.func('current_date')
        },
        created_at: {
            type: 'timestamp',
            default: pgm.func('current_timestamp')
        }
    });

    // Processed blocks tracking for blockchain monitor
    pgm.createTable('processed_blocks', {
        id: 'id',
        chain: {
            type: 'varchar(20)',
            notNull: true
        },
        block_hash: {
            type: 'varchar(100)',
            notNull: true
        },
        block_height: {
            type: 'bigint',
            notNull: true
        },
        processed_at: {
            type: 'timestamp',
            default: pgm.func('current_timestamp')
        }
    });

    // Create indexes for performance
    pgm.createIndex('post_likes', ['post_id', 'user_id'], { unique: true });
    pgm.createIndex('point_transactions', 'user_id');
    pgm.createIndex('point_transactions', 'created_at');
    pgm.createIndex('user_logins', ['user_id', 'login_date'], { unique: true });
    pgm.createIndex('processed_blocks', ['chain', 'block_height']);
    pgm.createIndex('users', 'referral_code');
    pgm.createIndex('users', 'referred_by');

    // Generate referral codes for existing users
    pgm.sql(`
        UPDATE users 
        SET referral_code = UPPER(SUBSTRING(MD5(id::text || created_at::text) FROM 1 FOR 8))
        WHERE referral_code IS NULL
    `);
};

exports.down = async (pgm) => {
    pgm.dropTable('processed_blocks');
    pgm.dropTable('user_logins');
    pgm.dropTable('point_transactions');
    pgm.dropTable('post_likes');
    pgm.dropColumns('users', ['referred_by', 'referral_code']);
};