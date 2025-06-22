-- ============================================
-- FINAL COMPREHENSIVE FIX FOR ALL ISSUES
-- ============================================

-- 1. Clean up duplicate high-value policy notifications
WITH ranked_notifications AS (
    SELECT 
        id,
        policy_number,
        ROW_NUMBER() OVER (PARTITION BY policy_number ORDER BY created_at DESC) as rn
    FROM high_value_policy_notifications
)
DELETE FROM high_value_policy_notifications 
WHERE id IN (
    SELECT id FROM ranked_notifications WHERE rn > 1
);

-- 2. Fix the trigger function to prevent future duplicates
CREATE OR REPLACE FUNCTION create_high_value_policy_notification()
RETURNS TRIGGER AS $$
DECLARE
    biweekly_start DATE;
    biweekly_end DATE;
    existing_notification_count INT;
BEGIN
    -- Only create notification for policies over $5000
    IF NEW.amount >= 5000 THEN
        -- Check if notification already exists for this policy number
        SELECT COUNT(*) INTO existing_notification_count
        FROM high_value_policy_notifications
        WHERE policy_number = NEW.policy_number;
        
        -- Only create if no existing notification for this policy
        IF existing_notification_count = 0 THEN
            -- Calculate biweekly period
            IF EXTRACT(DOW FROM NEW.sale_date) >= 1 THEN -- Monday or later
                biweekly_start := NEW.sale_date::date - INTERVAL '1 day' * (EXTRACT(DOW FROM NEW.sale_date) - 1);
            ELSE -- Sunday
                biweekly_start := NEW.sale_date::date - INTERVAL '6 days';
            END IF;
            
            biweekly_end := biweekly_start + INTERVAL '13 days';
            
            -- Insert high-value policy notification
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
                client_name,
                created_at
            ) VALUES (
                NEW.employee_id,
                NEW.policy_number,
                NEW.policy_type,
                NEW.amount,
                NEW.broker_fee,
                NEW.bonus,
                0, -- Default admin bonus
                'pending',
                biweekly_start,
                biweekly_end,
                COALESCE(NEW.is_cross_sold_policy, FALSE),
                NEW.client_name,
                NOW()
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Ensure John Smith employee record exists with correct details
INSERT INTO employees (clerk_user_id, name, email, department, position, status, max_hours_before_overtime, hourly_rate, created_at)
VALUES (
    'user_2yQeD2Af9ndPLFcOiLMoQ2QyFmO',
    'John Smith',
    'john.smith@letsinsure.hr',
    'Sales',
    'Insurance Agent',
    'active',
    8,
    25.00,
    NOW()
)
ON CONFLICT (clerk_user_id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    department = EXCLUDED.department,
    position = EXCLUDED.position,
    status = EXCLUDED.status;

-- 4. Fix any missing client_reviews updated_at column issue
ALTER TABLE client_reviews ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT NOW();

-- 5. Create automatic biweekly period management
CREATE OR REPLACE FUNCTION auto_create_biweekly_periods()
RETURNS void AS $$
DECLARE
    current_period_start DATE;
    current_period_end DATE;
    next_period_start DATE;
    next_period_end DATE;
BEGIN
    -- Calculate current biweekly period
    current_period_start := DATE_TRUNC('week', CURRENT_DATE)::date;
    current_period_end := current_period_start + INTERVAL '13 days';
    
    -- Calculate next biweekly period
    next_period_start := current_period_end + INTERVAL '1 day';
    next_period_end := next_period_start + INTERVAL '13 days';
    
    -- Auto-resolve expired policies (periods that ended more than 1 day ago)
    UPDATE high_value_policy_notifications 
    SET status = 'resolved'
    WHERE biweekly_period_end < CURRENT_DATE - INTERVAL '1 day'
    AND status = 'pending';
    
    -- Log period information
    RAISE NOTICE 'Current period: % to %', current_period_start, current_period_end;
    RAISE NOTICE 'Next period: % to %', next_period_start, next_period_end;
END;
$$ LANGUAGE plpgsql;

-- 6. Create function for immediate hourly rate changes
CREATE OR REPLACE FUNCTION update_employee_hourly_rate(
    employee_clerk_id TEXT,
    new_hourly_rate DECIMAL(10,2)
)
RETURNS void AS $$
BEGIN
    -- Update the employee's hourly rate immediately
    UPDATE employees 
    SET hourly_rate = new_hourly_rate,
        updated_at = NOW()
    WHERE clerk_user_id = employee_clerk_id;
    
    -- Log the change
    INSERT INTO employee_hourly_rate_history (
        employee_id,
        old_rate,
        new_rate,
        changed_at,
        changed_by
    )
    SELECT 
        clerk_user_id,
        hourly_rate,
        new_hourly_rate,
        NOW(),
        'system'
    FROM employees 
    WHERE clerk_user_id = employee_clerk_id;
    
    RAISE NOTICE 'Hourly rate updated for employee % to $%', employee_clerk_id, new_hourly_rate;
END;
$$ LANGUAGE plpgsql;

-- 7. Create hourly rate history table if it doesn't exist
CREATE TABLE IF NOT EXISTS employee_hourly_rate_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id text NOT NULL,
    old_rate decimal(10,2),
    new_rate decimal(10,2) NOT NULL,
    changed_at timestamptz DEFAULT NOW(),
    changed_by text DEFAULT 'system',
    created_at timestamptz DEFAULT NOW()
);

-- 8. Run the auto period management
SELECT auto_create_biweekly_periods();

-- 9. Verification queries
SELECT 'VERIFICATION RESULTS:' as status;

SELECT 
    'High-value notifications count' as check_type,
    COUNT(*)::text as result
FROM high_value_policy_notifications;

SELECT 
    'Duplicate notifications' as check_type,
    COUNT(*)::text || ' duplicates found' as result
FROM (
    SELECT policy_number, COUNT(*) as cnt
    FROM high_value_policy_notifications
    GROUP BY policy_number
    HAVING COUNT(*) > 1
) duplicates;

SELECT 
    'Employee mapping' as check_type,
    COUNT(*)::text || ' employees with notifications' as result
FROM (
    SELECT DISTINCT hvpn.employee_id
    FROM high_value_policy_notifications hvpn
    INNER JOIN employees e ON e.clerk_user_id = hvpn.employee_id
) mapped;

SELECT 
    'Unknown employees' as check_type,
    COUNT(*)::text || ' notifications with unknown employees' as result
FROM high_value_policy_notifications hvpn
LEFT JOIN employees e ON e.clerk_user_id = hvpn.employee_id
WHERE e.clerk_user_id IS NULL;

-- Display final status
SELECT 'All fixes applied successfully!' as final_status; 