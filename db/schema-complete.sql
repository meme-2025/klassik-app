-- ============================================
-- KLASSIK DATABASE SCHEMA - COMPLETE
-- Champions League Level Database Design 🏆
-- ============================================

-- Drop existing tables (careful!)
-- DROP TABLE IF EXISTS search_history, user_sessions, sacrifice_transactions, nonces, users CASCADE;

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    address VARCHAR(42) UNIQUE NOT NULL,           -- Ethereum wallet address
    kaspa_address VARCHAR(100),                     -- Kaspa wallet address
    username VARCHAR(30) UNIQUE NOT NULL,
    email VARCHAR(255),                             -- Optional email
    sacrifice_points INTEGER DEFAULT 0,             -- Points from sacrifice
    is_admin BOOLEAN DEFAULT FALSE,                 -- Admin flag
    is_online BOOLEAN DEFAULT FALSE,                -- Online status
    last_seen TIMESTAMP,                            -- Last activity
    last_sacrifice_check TIMESTAMP,                 -- Last sacrifice verification
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_address ON users(address);
CREATE INDEX IF NOT EXISTS idx_users_kaspa_address ON users(kaspa_address);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_online ON users(is_online);

-- ============================================
-- NONCES TABLE (for wallet signature)
-- ============================================
CREATE TABLE IF NOT EXISTS nonces (
    id SERIAL PRIMARY KEY,
    address VARCHAR(42) UNIQUE NOT NULL,
    nonce VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nonces_address ON nonces(address);
CREATE INDEX IF NOT EXISTS idx_nonces_expires ON nonces(expires_at);

-- ============================================
-- USER SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,               -- Hashed JWT token
    ip_address VARCHAR(45),                         -- IPv4 or IPv6
    user_agent TEXT,                                -- Browser info
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(is_active);

-- ============================================
-- SACRIFICE TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sacrifice_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    kaspa_address VARCHAR(100) NOT NULL,
    tx_hash VARCHAR(255) UNIQUE NOT NULL,           -- Kaspa transaction hash
    amount DECIMAL(20, 8) NOT NULL,                 -- KAS amount
    points_earned INTEGER NOT NULL,                 -- Points = amount * 100
    block_time TIMESTAMP,
    confirmations INTEGER DEFAULT 0,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sacrifice_user ON sacrifice_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_sacrifice_tx ON sacrifice_transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_sacrifice_verified ON sacrifice_transactions(verified);

-- ============================================
-- SEARCH HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS search_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    search_query VARCHAR(500) NOT NULL,
    search_type VARCHAR(50),                        -- 'address', 'block', 'transaction'
    result_found BOOLEAN DEFAULT FALSE,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_search_user ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_type ON search_history(search_type);
CREATE INDEX IF NOT EXISTS idx_search_created ON search_history(created_at);

-- ============================================
-- ANALYTICS / STATS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS analytics_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,               -- 'page_view', 'api_call', 'search', etc.
    event_data JSONB,                               -- Flexible event data
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at);

-- ============================================
-- ADMIN LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS admin_logs (
    id SERIAL PRIMARY KEY,
    admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON admin_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL ADMIN USER (OPTIONAL)
-- ============================================
-- Insert admin user if not exists (with admin wallet address)
INSERT INTO users (address, username, is_admin, sacrifice_points, created_at)
VALUES ('0x2a04b64d4641cda7271289d2da6bbf27de02d823', 'admin', TRUE, 100000, CURRENT_TIMESTAMP)
ON CONFLICT (address) DO UPDATE SET is_admin = TRUE;

-- ============================================
-- VIEWS FOR ADMIN PANEL
-- ============================================

-- View: Online Users
CREATE OR REPLACE VIEW v_online_users AS
SELECT 
    u.id,
    u.username,
    u.address,
    u.kaspa_address,
    u.sacrifice_points,
    u.last_seen,
    s.ip_address,
    s.user_agent,
    s.started_at AS session_started
FROM users u
LEFT JOIN user_sessions s ON u.id = s.user_id AND s.is_active = TRUE
WHERE u.is_online = TRUE
ORDER BY u.last_seen DESC;

-- View: Recent Sacrifices
CREATE OR REPLACE VIEW v_recent_sacrifices AS
SELECT 
    st.id,
    st.tx_hash,
    st.amount,
    st.points_earned,
    st.block_time,
    st.verified,
    u.username,
    u.address,
    st.created_at
FROM sacrifice_transactions st
LEFT JOIN users u ON st.user_id = u.id
ORDER BY st.created_at DESC;

-- View: Search Activity
CREATE OR REPLACE VIEW v_search_activity AS
SELECT 
    sh.id,
    sh.search_query,
    sh.search_type,
    sh.result_found,
    u.username,
    u.address,
    sh.created_at
FROM search_history sh
LEFT JOIN users u ON sh.user_id = u.id
ORDER BY sh.created_at DESC;

-- View: User Stats
CREATE OR REPLACE VIEW v_user_stats AS
SELECT 
    u.id,
    u.username,
    u.address,
    u.sacrifice_points,
    u.is_admin,
    u.is_online,
    u.created_at,
    COUNT(DISTINCT st.id) AS total_sacrifices,
    COALESCE(SUM(st.amount), 0) AS total_kas_sacrificed,
    COUNT(DISTINCT sh.id) AS total_searches,
    COUNT(DISTINCT s.id) AS total_sessions,
    MAX(s.last_activity) AS last_activity
FROM users u
LEFT JOIN sacrifice_transactions st ON u.id = st.user_id
LEFT JOIN search_history sh ON u.id = sh.user_id
LEFT JOIN user_sessions s ON u.id = s.user_id
GROUP BY u.id
ORDER BY u.created_at DESC;

-- ============================================
-- GRANT PERMISSIONS (adjust as needed)
-- ============================================
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO klassik3_writer;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO klassik3_writer;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
/*
-- Check all tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Check all views
SELECT viewname FROM pg_views WHERE schemaname = 'public';

-- Count records
SELECT 'users' AS table_name, COUNT(*) FROM users
UNION ALL
SELECT 'nonces', COUNT(*) FROM nonces
UNION ALL
SELECT 'user_sessions', COUNT(*) FROM user_sessions
UNION ALL
SELECT 'sacrifice_transactions', COUNT(*) FROM sacrifice_transactions
UNION ALL
SELECT 'search_history', COUNT(*) FROM search_history;
*/
