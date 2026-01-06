-- Klassik Gaming Platform Database Schema
-- PostgreSQL 16+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- USERS TABLE
-- ========================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kaspa_address VARCHAR(100) UNIQUE NOT NULL,
    username VARCHAR(50),
    email VARCHAR(255),
    total_wagered DECIMAL(18, 8) DEFAULT 0,
    total_won DECIMAL(18, 8) DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- ========================================
-- LOBBIES TABLE
-- ========================================
CREATE TABLE lobbies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status VARCHAR(20) NOT NULL CHECK (status IN ('waiting', 'countdown', 'playing', 'finished')),
    buy_in_kas DECIMAL(18, 8) NOT NULL DEFAULT 0.1,
    max_players INTEGER DEFAULT 10,
    current_players INTEGER DEFAULT 0,
    pot_kas DECIMAL(18, 8) DEFAULT 0,
    crash_point DECIMAL(10, 2),
    server_seed VARCHAR(200),
    server_seed_hash VARCHAR(200),
    public_seed VARCHAR(200),
    house_edge DECIMAL(5, 4) DEFAULT 0.02,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    countdown_started_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE
);

-- ========================================
-- LOBBY ENTRIES TABLE
-- ========================================
CREATE TABLE lobby_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lobby_id UUID REFERENCES lobbies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    socket_id VARCHAR(100),
    deposit_tx_id VARCHAR(100) UNIQUE,
    deposit_confirmed BOOLEAN DEFAULT FALSE,
    bet_amount DECIMAL(18, 8) NOT NULL,
    cashout_multiplier DECIMAL(10, 2),
    cashout_time TIMESTAMP WITH TIME ZONE,
    win_amount DECIMAL(18, 8),
    payout_tx_id VARCHAR(100),
    payout_confirmed BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) CHECK (status IN ('pending', 'active', 'cashed_out', 'lost', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- KASPA TRANSACTIONS TABLE
-- ========================================
CREATE TABLE kaspa_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tx_id VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(20) CHECK (type IN ('deposit', 'payout')),
    from_address VARCHAR(100),
    to_address VARCHAR(100),
    amount_kas DECIMAL(18, 8) NOT NULL,
    amount_sompi BIGINT NOT NULL,
    confirmations INTEGER DEFAULT 0,
    status VARCHAR(20) CHECK (status IN ('pending', 'confirmed', 'failed')),
    lobby_id UUID REFERENCES lobbies(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    block_hash VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB
);

-- ========================================
-- GAME HISTORY TABLE
-- ========================================
CREATE TABLE game_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lobby_id UUID REFERENCES lobbies(id) ON DELETE CASCADE,
    crash_point DECIMAL(10, 2) NOT NULL,
    total_players INTEGER NOT NULL,
    total_wagered DECIMAL(18, 8) NOT NULL,
    total_paid_out DECIMAL(18, 8) NOT NULL,
    house_profit DECIMAL(18, 8),
    server_seed VARCHAR(200),
    public_seed VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- INDEXES
-- ========================================
CREATE INDEX idx_users_kaspa_address ON users(kaspa_address);
CREATE INDEX idx_users_created_at ON users(created_at);

CREATE INDEX idx_lobbies_status ON lobbies(status);
CREATE INDEX idx_lobbies_created_at ON lobbies(created_at);

CREATE INDEX idx_lobby_entries_lobby_id ON lobby_entries(lobby_id);
CREATE INDEX idx_lobby_entries_user_id ON lobby_entries(user_id);
CREATE INDEX idx_lobby_entries_status ON lobby_entries(status);

CREATE INDEX idx_transactions_tx_id ON kaspa_transactions(tx_id);
CREATE INDEX idx_transactions_type ON kaspa_transactions(type);
CREATE INDEX idx_transactions_status ON kaspa_transactions(status);
CREATE INDEX idx_transactions_user_id ON kaspa_transactions(user_id);

CREATE INDEX idx_game_history_created_at ON game_history(created_at);

-- ========================================
-- TRIGGERS
-- ========================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lobby_entries_updated_at BEFORE UPDATE ON lobby_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- SAMPLE DATA (Development Only)
-- ========================================

-- Insert a test user
INSERT INTO users (kaspa_address, username, total_wagered, total_won, games_played)
VALUES 
    ('kaspa:qz0000000000000000000000000000000000000000000000000000000000000000', 'TestUser1', 10.5, 15.2, 42),
    ('kaspa:qz1111111111111111111111111111111111111111111111111111111111111111', 'TestUser2', 5.0, 3.8, 20)
ON CONFLICT DO NOTHING;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Klassik Gaming database schema created successfully!';
    RAISE NOTICE '📊 Tables: users, lobbies, lobby_entries, kaspa_transactions, game_history';
    RAISE NOTICE '🔍 Indexes and triggers configured';
END
$$;
