-- ============================================
-- PRODUCTION-READY DATABASE SCHEMA
-- State Management mit Auto-Updates
-- ============================================

-- Drop views if exist
DROP VIEW IF EXISTS v_active_users CASCADE;
DROP VIEW IF EXISTS v_pending_payments CASCADE;
DROP VIEW IF EXISTS v_active_games CASCADE;
DROP VIEW IF EXISTS v_user_dashboard CASCADE;

-- ============================================
-- ADD MISSING COLUMNS (Idempotent)
-- ============================================

-- User state columns
ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS game_status VARCHAR(20) DEFAULT 'idle',
    ADD COLUMN IF NOT EXISTS current_game_id INTEGER,
    ADD COLUMN IF NOT EXISTS total_games_played INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_wagered DECIMAL(20, 8) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_winnings DECIMAL(20, 8) DEFAULT 0;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_payment_status ON users(payment_status);
CREATE INDEX IF NOT EXISTS idx_users_game_status ON users(game_status);
CREATE INDEX IF NOT EXISTS idx_users_verified ON users(is_verified);

-- ============================================
-- GAME SESSIONS TABLE (Server-Side State)
-- ============================================

CREATE TABLE IF NOT EXISTS game_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    game_type VARCHAR(50) NOT NULL,
    buy_in_amount DECIMAL(20, 8) NOT NULL,
    current_balance DECIMAL(20, 8) NOT NULL,
    total_bets INTEGER DEFAULT 0,
    total_wagered DECIMAL(20, 8) DEFAULT 0,
    total_won DECIMAL(20, 8) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    last_action TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    session_data JSONB, -- Stores complete game state for recovery
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_user ON game_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON game_sessions(status);
CREATE INDEX IF NOT EXISTS idx_game_sessions_active ON game_sessions(status) 
    WHERE status = 'active';

-- ============================================
-- GAME BET HISTORY (Individual Bets)
-- ============================================

CREATE TABLE IF NOT EXISTS game_bets (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES game_sessions(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    bet_amount DECIMAL(20, 8) NOT NULL,
    payout_amount DECIMAL(20, 8) DEFAULT 0,
    multiplier DECIMAL(10, 4),
    result VARCHAR(20),
    bet_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_game_bets_session ON game_bets(session_id);
CREATE INDEX IF NOT EXISTS idx_game_bets_user ON game_bets(user_id);
CREATE INDEX IF NOT EXISTS idx_game_bets_created ON game_bets(created_at DESC);

-- ============================================
-- PAYMENT TRACKING TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS payment_queue (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    kaspa_address VARCHAR(100) NOT NULL,
    amount_expected DECIMAL(20, 8) NOT NULL,
    amount_received DECIMAL(20, 8) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending', -- pending, partial, confirmed, expired
    tx_hash VARCHAR(255),
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    confirmed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_queue_user ON payment_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_queue_status ON payment_queue(status);
CREATE INDEX IF NOT EXISTS idx_payment_queue_kaspa ON payment_queue(kaspa_address);

-- ============================================
-- AUTO-UPDATE TRIGGERS
-- ============================================

-- Function: Auto-update timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trigger_game_sessions_updated_at ON game_sessions;
CREATE TRIGGER trigger_game_sessions_updated_at
    BEFORE UPDATE ON game_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trigger_payment_queue_updated_at ON payment_queue;
CREATE TRIGGER trigger_payment_queue_updated_at
    BEFORE UPDATE ON payment_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- ============================================
-- Function: Auto-Update User Game Status
-- ============================================

CREATE OR REPLACE FUNCTION update_user_game_status()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Set user game_status to 'playing' when session starts
        IF NEW.status = 'active' THEN
            UPDATE users 
            SET 
                game_status = 'playing',
                current_game_id = NEW.id
            WHERE id = NEW.user_id;
        END IF;

        -- Set user game_status back to 'idle' when session ends
        IF NEW.status IN ('completed', 'abandoned', 'expired') THEN
            UPDATE users 
            SET 
                game_status = 'idle',
                current_game_id = NULL,
                total_games_played = total_games_played + 1,
                total_wagered = total_wagered + NEW.total_wagered,
                total_winnings = total_winnings + NEW.total_won
            WHERE id = NEW.user_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_game_status ON game_sessions;
CREATE TRIGGER trigger_update_user_game_status
    AFTER INSERT OR UPDATE ON game_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_game_status();

-- ============================================
-- Function: Auto-Update Payment Status
-- ============================================

CREATE OR REPLACE FUNCTION update_user_payment_status()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Update user payment_status based on sacrifice_points
        IF EXISTS (
            SELECT 1 FROM users 
            WHERE id = NEW.user_id 
            AND sacrifice_points >= 100
        ) THEN
            UPDATE users 
            SET 
                payment_status = 'confirmed',
                is_verified = TRUE
            WHERE id = NEW.user_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_payment_status ON sacrifice_transactions;
CREATE TRIGGER trigger_update_payment_status
    AFTER INSERT OR UPDATE ON sacrifice_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_payment_status();

-- ============================================
-- PRODUCTION VIEWS (Real-Time Status)
-- ============================================

-- View: Active Users (Currently Online & Playing)
CREATE OR REPLACE VIEW v_active_users AS
SELECT 
    u.id,
    u.username,
    u.address,
    u.kaspa_address,
    u.is_online,
    u.game_status,
    u.payment_status,
    u.sacrifice_points,
    u.total_games_played,
    u.last_seen,
    gs.id AS current_session_id,
    gs.game_type,
    gs.current_balance,
    gs.started_at AS game_started_at
FROM users u
LEFT JOIN game_sessions gs ON u.current_game_id = gs.id
WHERE u.is_online = TRUE OR u.game_status = 'playing'
ORDER BY u.last_seen DESC;

-- View: Pending Payments (Awaiting Confirmation)
CREATE OR REPLACE VIEW v_pending_payments AS
SELECT 
    pq.id,
    pq.user_id,
    u.username,
    u.address,
    pq.kaspa_address,
    pq.amount_expected,
    pq.amount_received,
    pq.status,
    pq.tx_hash,
    pq.expires_at,
    pq.created_at,
    EXTRACT(EPOCH FROM (pq.expires_at - CURRENT_TIMESTAMP)) AS seconds_until_expiry
FROM payment_queue pq
JOIN users u ON pq.user_id = u.id
WHERE pq.status IN ('pending', 'partial')
    AND pq.expires_at > CURRENT_TIMESTAMP
ORDER BY pq.created_at DESC;

-- View: Active Game Sessions
CREATE OR REPLACE VIEW v_active_games AS
SELECT 
    gs.id,
    gs.user_id,
    u.username,
    gs.game_type,
    gs.buy_in_amount,
    gs.current_balance,
    gs.total_bets,
    gs.total_wagered,
    gs.total_won,
    gs.last_action,
    gs.started_at,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - gs.last_action)) AS seconds_since_action,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - gs.started_at)) AS session_duration
FROM game_sessions gs
JOIN users u ON gs.user_id = u.id
WHERE gs.status = 'active'
ORDER BY gs.last_action DESC;

-- View: User Dashboard (Complete Status)
CREATE OR REPLACE VIEW v_user_dashboard AS
SELECT 
    u.id,
    u.username,
    u.address,
    u.kaspa_address,
    u.sacrifice_points,
    u.is_verified,
    u.payment_status,
    u.game_status,
    u.is_online,
    u.total_games_played,
    u.total_wagered,
    u.total_winnings,
    u.created_at,
    u.last_seen,
    -- Aggregated data
    COUNT(DISTINCT gs.id) FILTER (WHERE gs.status = 'completed') AS completed_games,
    COUNT(DISTINCT st.id) AS total_sacrifices,
    COALESCE(SUM(st.amount), 0) AS total_kas_sacrificed,
    -- Current game info
    current_gs.id AS active_game_id,
    current_gs.game_type AS active_game_type,
    current_gs.current_balance AS active_game_balance
FROM users u
LEFT JOIN game_sessions gs ON u.id = gs.user_id
LEFT JOIN sacrifice_transactions st ON u.id = st.user_id
LEFT JOIN game_sessions current_gs ON u.current_game_id = current_gs.id
GROUP BY 
    u.id, 
    current_gs.id, 
    current_gs.game_type, 
    current_gs.current_balance
ORDER BY u.last_seen DESC NULLS LAST;

-- ============================================
-- CLEANUP FUNCTIONS (Run Periodically)
-- ============================================

-- Function: Expire old payment requests
CREATE OR REPLACE FUNCTION expire_old_payments()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE payment_queue
    SET status = 'expired'
    WHERE status IN ('pending', 'partial')
        AND expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function: End abandoned game sessions
CREATE OR REPLACE FUNCTION end_abandoned_sessions()
RETURNS INTEGER AS $$
DECLARE
    abandoned_count INTEGER;
BEGIN
    UPDATE game_sessions
    SET 
        status = 'abandoned',
        ended_at = CURRENT_TIMESTAMP
    WHERE status = 'active'
        AND last_action < CURRENT_TIMESTAMP - INTERVAL '30 minutes';
    
    GET DIAGNOSTICS abandoned_count = ROW_COUNT;
    RETURN abandoned_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Cleanup old sessions (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS TABLE(
    deleted_sessions INTEGER,
    deleted_bets INTEGER,
    deleted_payments INTEGER
) AS $$
DECLARE
    session_count INTEGER;
    bet_count INTEGER;
    payment_count INTEGER;
BEGIN
    -- Delete old completed sessions
    DELETE FROM game_sessions
    WHERE status IN ('completed', 'abandoned')
        AND ended_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    GET DIAGNOSTICS session_count = ROW_COUNT;

    -- Delete old bets (cascades)
    DELETE FROM game_bets
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    GET DIAGNOSTICS bet_count = ROW_COUNT;

    -- Delete expired payments
    DELETE FROM payment_queue
    WHERE status = 'expired'
        AND expires_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
    GET DIAGNOSTICS payment_count = ROW_COUNT;

    RETURN QUERY SELECT session_count, bet_count, payment_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO klassik3_writer;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO klassik3_writer;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO klassik3_reader;

-- ============================================
-- VERIFICATION
-- ============================================

-- Run these to verify setup:
-- SELECT * FROM v_active_users;
-- SELECT * FROM v_pending_payments;
-- SELECT * FROM v_active_games;
-- SELECT expire_old_payments();
-- SELECT end_abandoned_sessions();
