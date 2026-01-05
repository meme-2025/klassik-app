-- Create test user for testing without sacrifice
INSERT INTO users (address, username, kaspa_address, sacrifice_points, is_admin, created_at)
VALUES 
    ('0xTEST123456789ABCDEF', 'demo_user', 'kaspa:qztest123demo', 10000, FALSE, CURRENT_TIMESTAMP)
ON CONFLICT (address) DO UPDATE SET
    sacrifice_points = 10000,
    updated_at = CURRENT_TIMESTAMP;

-- Show created user
SELECT id, username, address, kaspa_address, sacrifice_points, is_admin 
FROM users 
WHERE address = '0xTEST123456789ABCDEF';
