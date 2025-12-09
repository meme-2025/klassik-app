-- Migration: Add wallet support to existing users table
-- Run this if you need to add wallet address support

-- Add address column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'address'
  ) THEN
    ALTER TABLE users ADD COLUMN address VARCHAR(42);
    CREATE INDEX idx_users_address ON users(LOWER(address));
  END IF;
END $$;

-- Rename password to password_hash if needed
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'password'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE users RENAME COLUMN password TO password_hash;
  END IF;
END $$;

-- Create nonces table for wallet authentication
CREATE TABLE IF NOT EXISTS nonces (
  address VARCHAR(42) PRIMARY KEY,
  nonce VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nonces_expires_at ON nonces(expires_at);

-- Allow users to register with either email+password OR wallet address
-- Make password_hash nullable for wallet-only users
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'password_hash' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
  END IF;
END $$;

-- Add constraint: must have either email+password OR address
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_auth_method_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_auth_method_check 
      CHECK (
        (email IS NOT NULL AND password_hash IS NOT NULL) OR 
        (address IS NOT NULL)
      );
  END IF;
END $$;
