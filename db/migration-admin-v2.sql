-- ============================================
-- KLASSIK ADMIN V2 - DATABASE MIGRATION
-- ============================================
-- Adds admin panel tracking tables without breaking existing structure
-- 
-- Changes:
-- 1. Add new columns to existing users table
-- 2. Create new tracking tables (sessions, sacrifices, searches, etc.)
-- 3. Create admin views for monitoring
-- ============================================

BEGIN;

-- ============================================
-- 1. EXTEND EXISTING USERS TABLE
-- ============================================

-- Add admin panel columns to existing users table
ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS kaspa_address VARCHAR(64),
    ADD COLUMN IF NOT EXISTS sacrifice_points INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_users_kaspa_address ON users(kaspa_address);
CREATE INDEX IF NOT EXISTS idx_users_online ON users(is_online) WHERE is_online = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_admin ON users(is_admin) WHERE is_admin = TRUE;

-- Make sure address column is unique (might not be in existing schema)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_address_unique'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_address_unique UNIQUE (address);
    END IF;
END $$;

-- ============================================
-- 2. CREATE USER SESSIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

-- ============================================
-- 3. CREATE SACRIFICE TRANSACTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS sacrifice_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    tx_hash VARCHAR(128) NOT NULL UNIQUE,
    kaspa_address VARCHAR(64) NOT NULL,
    amount BIGINT NOT NULL,
    points_earned INTEGER NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sacrifice_user_id ON sacrifice_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_sacrifice_kaspa_address ON sacrifice_transactions(kaspa_address);
CREATE INDEX IF NOT EXISTS idx_sacrifice_verified ON sacrifice_transactions(verified) WHERE verified = TRUE;
CREATE INDEX IF NOT EXISTS idx_sacrifice_created ON sacrifice_transactions(created_at DESC);

-- ============================================
-- 4. CREATE SEARCH HISTORY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS search_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    search_query VARCHAR(255) NOT NULL,
    search_type VARCHAR(50),
    result_found BOOLEAN DEFAULT TRUE,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_search_user_id ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_type ON search_history(search_type);
CREATE INDEX IF NOT EXISTS idx_search_created ON search_history(created_at DESC);

-- ============================================
-- 5. CREATE ANALYTICS EVENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS analytics_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_data ON analytics_events USING gin(event_data);

-- ============================================
-- 6. CREATE ADMIN LOGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS admin_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target ON admin_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at DESC);

-- ============================================
-- 7. CREATE ADMIN VIEWS
-- ============================================

-- View: Online users with session info
CREATE OR REPLACE VIEW v_online_users AS
SELECT 
    u.id,
    u.username,
    u.address,
    u.kaspa_address,
    u.sacrifice_points,
    u.is_admin,
    u.last_seen,
    s.ip_address,
    s.last_activity,
    s.started_at as session_started
FROM users u
LEFT JOIN user_sessions s ON s.user_id = u.id AND s.is_active = TRUE
WHERE u.is_online = TRUE
ORDER BY u.last_seen DESC;

-- View: Recent sacrifices with user info
CREATE OR REPLACE VIEW v_recent_sacrifices AS
SELECT 
    st.id,
    st.tx_hash,
    st.amount,
    st.points_earned,
    st.verified,
    st.created_at,
    u.id as user_id,
    u.username,
    u.address as eth_address,
    st.kaspa_address
FROM sacrifice_transactions st
LEFT JOIN users u ON u.id = st.user_id
ORDER BY st.created_at DESC
LIMIT 100;

-- View: Search activity with user info
CREATE OR REPLACE VIEW v_search_activity AS
SELECT 
    sh.id,
    sh.search_query,
    sh.search_type,
    sh.result_found,
    sh.created_at,
    u.id as user_id,
    u.username,
    u.address
FROM search_history sh
LEFT JOIN users u ON u.id = sh.user_id
ORDER BY sh.created_at DESC
LIMIT 200;

-- View: User stats aggregation
CREATE OR REPLACE VIEW v_user_stats AS
SELECT 
    u.id,
    u.username,
    u.address,
    u.kaspa_address,
    u.sacrifice_points,
    u.is_admin,
    u.is_online,
    u.last_seen,
    u.created_at,
    COALESCE(sacrifice_count.count, 0) as total_sacrifices,
    COALESCE(sacrifice_sum.total, 0) as total_sacrificed_amount,
    COALESCE(search_count.count, 0) as total_searches,
    COALESCE(session_count.count, 0) as total_sessions,
    latest_session.last_activity as latest_session_activity
FROM users u
LEFT JOIN (
    SELECT user_id, COUNT(*) as count FROM sacrifice_transactions GROUP BY user_id
) sacrifice_count ON sacrifice_count.user_id = u.id
LEFT JOIN (
    SELECT user_id, SUM(amount) as total FROM sacrifice_transactions WHERE verified = TRUE GROUP BY user_id
) sacrifice_sum ON sacrifice_sum.user_id = u.id
LEFT JOIN (
    SELECT user_id, COUNT(*) as count FROM search_history GROUP BY user_id
) search_count ON search_count.user_id = u.id
LEFT JOIN (
    SELECT user_id, COUNT(*) as count FROM user_sessions GROUP BY user_id
) session_count ON session_count.user_id = u.id
LEFT JOIN (
    SELECT DISTINCT ON (user_id) user_id, last_activity 
    FROM user_sessions 
    ORDER BY user_id, last_activity DESC
) latest_session ON latest_session.user_id = u.id
ORDER BY u.created_at DESC;

-- ============================================
-- 8. CREATE TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
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

-- Function to update user online status based on sessions
CREATE OR REPLACE FUNCTION update_user_online_status()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE users 
        SET is_online = TRUE, last_seen = CURRENT_TIMESTAMP 
        WHERE id = NEW.user_id;
    END IF;
    
    IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.is_active = FALSE) THEN
        -- Check if user has any other active sessions
        UPDATE users 
        SET is_online = EXISTS(
            SELECT 1 FROM user_sessions 
            WHERE user_id = OLD.user_id 
            AND is_active = TRUE 
            AND id != OLD.id
        )
        WHERE id = OLD.user_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Trigger for session-based online status
DROP TRIGGER IF EXISTS update_online_status ON user_sessions;
CREATE TRIGGER update_online_status
    AFTER INSERT OR UPDATE OR DELETE ON user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_online_status();

-- ============================================
-- 9. UPDATE ADMIN USER
-- ============================================

-- Set existing admin user (if exists) as admin
UPDATE users 
SET is_admin = TRUE, sacrifice_points = 100000
WHERE LOWER(address) = LOWER('0x2a04b64d4641cda7271289d2da6bbf27de02d823');

-- If admin doesn't exist, create it
INSERT INTO users (address, username, is_admin, sacrifice_points, created_at)
SELECT 
    '0x2a04b64d4641cda7271289d2da6bbf27de02d823',
    'admin',
    TRUE,
    100000,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM users 
    WHERE LOWER(address) = LOWER('0x2a04b64d4641cda7271289d2da6bbf27de02d823')
);

-- ============================================
-- 10. GRANT PERMISSIONS
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO klassik3_writer;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO klassik3_writer;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO klassik3_writer;

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check new tables
SELECT 'Tables created:' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_sessions', 'sacrifice_transactions', 'search_history', 'analytics_events', 'admin_logs')
ORDER BY table_name;

-- Check new columns in users table
SELECT 'New user columns:' as status;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('kaspa_address', 'sacrifice_points', 'is_admin', 'is_online', 'last_seen', 'updated_at')
ORDER BY column_name;

-- Check views
SELECT 'Views created:' as status;
SELECT table_name FROM information_schema.views
WHERE table_schema = 'public'
AND table_name LIKE 'v_%'
ORDER BY table_name;

-- Check admin user
SELECT 'Admin user:' as status;
SELECT id, username, address, is_admin, sacrifice_points FROM users WHERE is_admin = TRUE;
