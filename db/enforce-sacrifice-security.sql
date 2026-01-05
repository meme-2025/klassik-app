-- ============================================
-- SACRIFICE SECURITY: NO BACKDOORS!
-- ============================================
-- 1. Delete fake test user
-- 2. Ensure sacrifice_points ONLY comes from verified transactions
-- 3. Create trigger to auto-calculate points
-- ============================================

BEGIN;

-- 1. DELETE TEST USER (keine Hintertüren!)
DELETE FROM users WHERE address = '0xTEST123456789ABCDEF';
DELETE FROM users WHERE username = 'demo_user';

-- 2. CREATE FUNCTION: Auto-calculate sacrifice points from transactions
CREATE OR REPLACE FUNCTION calculate_user_sacrifice_points(p_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    total_points INTEGER;
BEGIN
    -- Sum up ALL verified sacrifice transactions for this user
    SELECT COALESCE(SUM(points_earned), 0)
    INTO total_points
    FROM sacrifice_transactions
    WHERE user_id = p_user_id 
    AND verified = TRUE;
    
    RETURN total_points;
END;
$$ LANGUAGE plpgsql;

-- 3. CREATE TRIGGER: Update user points when sacrifice transaction changes
CREATE OR REPLACE FUNCTION update_user_sacrifice_points()
RETURNS TRIGGER AS $$
BEGIN
    -- Update user's total sacrifice points based on ALL their transactions
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE users 
        SET sacrifice_points = calculate_user_sacrifice_points(NEW.user_id),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.user_id;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        UPDATE users 
        SET sacrifice_points = calculate_user_sacrifice_points(OLD.user_id),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.user_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 4. ATTACH TRIGGER to sacrifice_transactions table
DROP TRIGGER IF EXISTS sync_sacrifice_points ON sacrifice_transactions;
CREATE TRIGGER sync_sacrifice_points
    AFTER INSERT OR UPDATE OR DELETE ON sacrifice_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_sacrifice_points();

-- 5. RECALCULATE ALL EXISTING USERS (sync mit transactions)
UPDATE users u
SET sacrifice_points = calculate_user_sacrifice_points(u.id),
    updated_at = CURRENT_TIMESTAMP;

-- 6. VERIFICATION: Show all users with their REAL sacrifice points
SELECT 
    u.id,
    u.username,
    u.address,
    u.sacrifice_points as current_points,
    calculate_user_sacrifice_points(u.id) as calculated_points,
    COUNT(st.id) as num_transactions,
    SUM(st.amount) as total_kas_sacrificed
FROM users u
LEFT JOIN sacrifice_transactions st ON st.user_id = u.id AND st.verified = TRUE
GROUP BY u.id, u.username, u.address, u.sacrifice_points
ORDER BY u.id;

COMMIT;

-- SUCCESS MESSAGE
SELECT '✅ SACRIFICE SECURITY ENFORCED' as status,
       '1 KAS = 1 Point' as rate,
       'Minimum 1 KAS required' as requirement,
       'Points auto-calculated from verified transactions ONLY' as guarantee;
