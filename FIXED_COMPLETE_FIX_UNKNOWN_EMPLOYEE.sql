-- COMPLETE FIX FOR UNKNOWN EMPLOYEE ISSUE (CORRECTED)
-- This script will fix all aspects of the problem without using updated_at column

-- 1. Ensure John Smith employee record exists with correct clerk_user_id
INSERT INTO employees (
    id,
    name,
    email,
    clerk_user_id,
    hourly_rate,
    created_at
) VALUES (
    gen_random_uuid(),
    'John Smith',
    'john.smith@letsinsure.hr',
    'user_2yQeD2Af9ndPLFcOiLMoQ2QyFmO',
    25.00,
    NOW()
)
ON CONFLICT (clerk_user_id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email;

-- 2. Create missing high-value policy notifications for recent policies
INSERT INTO high_value_policy_notifications (
    employee_id,
    policy_number,
    policy_type,
    policy_amount,
    broker_fee,
    current_bonus,
    admin_bonus,
    status,
    biweekly_period_start,
    biweekly_period_end,
    is_cross_sold_policy,
    is_editable,
    client_name,
    created_at
)
SELECT DISTINCT
    ps.employee_id,
    ps.policy_number,
    ps.policy_type,
    ps.amount,
    ps.broker_fee,
    ps.bonus,
    0, -- admin_bonus
    'pending',
    -- Calculate biweekly period start (Monday of the week)
    CASE 
        WHEN EXTRACT(DOW FROM ps.sale_date) >= 1 THEN 
            ps.sale_date::date - INTERVAL '1 day' * (EXTRACT(DOW FROM ps.sale_date) - 1)
        ELSE 
            ps.sale_date::date - INTERVAL '6 days'
    END,
    -- Calculate biweekly period end (Sunday, 13 days later)
    CASE 
        WHEN EXTRACT(DOW FROM ps.sale_date) >= 1 THEN 
            ps.sale_date::date - INTERVAL '1 day' * (EXTRACT(DOW FROM ps.sale_date) - 1) + INTERVAL '13 days'
        ELSE 
            ps.sale_date::date - INTERVAL '6 days' + INTERVAL '13 days'
    END,
    COALESCE(ps.is_cross_sold_policy, FALSE),
    TRUE, -- is_editable
    ps.client_name,
    NOW()
FROM policy_sales ps
LEFT JOIN high_value_policy_notifications hvpn ON ps.policy_number = hvpn.policy_number
WHERE ps.amount >= 5000 
  AND hvpn.policy_number IS NULL
  AND ps.policy_number IN ('POL-2025-232', 'POL-2025-233');

-- 3. Fix/recreate the automatic trigger
CREATE OR REPLACE FUNCTION create_high_value_policy_notification()
RETURNS TRIGGER AS $$
DECLARE
    biweekly_start DATE;
    biweekly_end DATE;
    existing_count INT;
BEGIN
    -- Only create notification for policies >= $5000
    IF NEW.amount >= 5000 THEN
        -- Check if notification already exists
        SELECT COUNT(*) INTO existing_count
        FROM high_value_policy_notifications
        WHERE policy_number = NEW.policy_number;
        
        -- Only create if no existing notification
        IF existing_count = 0 THEN
            -- Calculate biweekly period
            IF EXTRACT(DOW FROM NEW.sale_date) >= 1 THEN -- Monday or later
                biweekly_start := NEW.sale_date::date - INTERVAL '1 day' * (EXTRACT(DOW FROM NEW.sale_date) - 1);
            ELSE -- Sunday
                biweekly_start := NEW.sale_date::date - INTERVAL '6 days';
            END IF;
            
            biweekly_end := biweekly_start + INTERVAL '13 days';
            
            -- Insert notification
            INSERT INTO high_value_policy_notifications (
                employee_id,
                policy_number,
                policy_type,
                policy_amount,
                broker_fee,
                current_bonus,
                admin_bonus,
                status,
                biweekly_period_start,
                biweekly_period_end,
                is_cross_sold_policy,
                is_editable,
                client_name,
                created_at
            ) VALUES (
                NEW.employee_id,
                NEW.policy_number,
                NEW.policy_type,
                NEW.amount,
                NEW.broker_fee,
                NEW.bonus,
                0, -- admin_bonus
                'pending',
                biweekly_start,
                biweekly_end,
                COALESCE(NEW.is_cross_sold_policy, FALSE),
                TRUE, -- is_editable
                NEW.client_name,
                NOW()
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_high_value_policy_notification ON policy_sales;
CREATE TRIGGER trigger_high_value_policy_notification
    AFTER INSERT ON policy_sales
    FOR EACH ROW
    EXECUTE FUNCTION create_high_value_policy_notification();

-- 4. Verify the fix worked
SELECT 
    'VERIFICATION - Employee exists:' as check_type,
    name,
    email,
    clerk_user_id
FROM employees 
WHERE clerk_user_id = 'user_2yQeD2Af9ndPLFcOiLMoQ2QyFmO';

SELECT 
    'VERIFICATION - Notifications with employee names:' as check_type,
    hvpn.policy_number,
    hvpn.policy_amount,
    e.name as employee_name,
    CASE 
        WHEN e.name IS NULL THEN 'WILL SHOW: Unknown Employee'
        ELSE CONCAT('WILL SHOW: ', e.name)
    END as display_result
FROM high_value_policy_notifications hvpn
LEFT JOIN employees e ON hvpn.employee_id = e.clerk_user_id
WHERE hvpn.policy_number IN ('POL-2025-232', 'POL-2025-233')
ORDER BY hvpn.created_at DESC;

SELECT 
    'VERIFICATION - Trigger status:' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_name = 'trigger_high_value_policy_notification'
        ) THEN 'TRIGGER EXISTS AND ACTIVE'
        ELSE 'TRIGGER MISSING'
    END as trigger_status; 