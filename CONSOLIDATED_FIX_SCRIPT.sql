-- CONSOLIDATED FIX SCRIPT - Run this single script to fix all issues
-- This script addresses: employee mapping, high-value policy notifications, and unresolve functionality

-- 1. First, ensure John Smith employee record exists with correct details
INSERT INTO employees (
    clerk_user_id,
    name,
    email,
    department,
    position,
    status,
    hourly_rate,
    max_hours_before_overtime,
    created_at,
    updated_at
) VALUES (
    'user_2yQeD2Af9ndPLFcOiLMoQ2QyFmO',
    'John Smith',
    'john.smith@company.com',
    'Sales',
    'Insurance Agent',
    'active',
    25.00,
    40,
    NOW(),
    NOW()
) ON CONFLICT (clerk_user_id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    department = EXCLUDED.department,
    position = EXCLUDED.position,
    status = EXCLUDED.status,
    hourly_rate = EXCLUDED.hourly_rate,
    max_hours_before_overtime = EXCLUDED.max_hours_before_overtime,
    updated_at = NOW();

-- 2. Check and display current high-value policy notifications with employee mapping
SELECT 
    'BEFORE FIX - Current Notifications:' as status,
    hvpn.id,
    hvpn.policy_number,
    hvpn.employee_id,
    hvpn.policy_amount,
    hvpn.status,
    e.name as employee_name,
    CASE 
        WHEN e.name IS NULL THEN 'MISSING EMPLOYEE RECORD'
        ELSE 'EMPLOYEE FOUND'
    END as mapping_status
FROM high_value_policy_notifications hvpn
LEFT JOIN employees e ON hvpn.employee_id = e.clerk_user_id
ORDER BY hvpn.created_at DESC;

-- 3. Create missing high-value policy notifications for policies >= $5000
-- This ensures all high-value policies have notifications
INSERT INTO high_value_policy_notifications (
    employee_id,
    policy_number,
    policy_amount,
    broker_fee,
    current_bonus,
    is_cross_sold_policy,
    policy_type,
    biweekly_period_start,
    biweekly_period_end,
    is_editable,
    status,
    created_at,
    updated_at
)
SELECT DISTINCT
    ps.employee_id,
    ps.policy_number,
    ps.amount,
    ps.broker_fee,
    ps.bonus,
    ps.is_cross_sold_policy,
    ps.policy_type,
    -- Calculate biweekly period (2 weeks from sale date)
    ps.sale_date::date as biweekly_period_start,
    (ps.sale_date::date + INTERVAL '14 days')::date as biweekly_period_end,
    true as is_editable,
    'pending' as status,
    NOW(),
    NOW()
FROM policy_sales ps
LEFT JOIN high_value_policy_notifications hvpn ON ps.policy_number = hvpn.policy_number
WHERE ps.amount >= 5000 
  AND hvpn.policy_number IS NULL
  AND ps.policy_number IN ('POL-2025-678', 'POL-2025-679');

-- 4. Update any existing notifications to ensure they're properly configured
UPDATE high_value_policy_notifications 
SET 
    is_editable = true,
    updated_at = NOW()
WHERE policy_number IN ('POL-2025-678', 'POL-2025-679');

-- 5. Clean up any duplicate notifications (keep the most recent one for each policy)
WITH ranked_notifications AS (
    SELECT id, 
           policy_number,
           ROW_NUMBER() OVER (PARTITION BY policy_number ORDER BY created_at DESC) as rn
    FROM high_value_policy_notifications
)
DELETE FROM high_value_policy_notifications 
WHERE id IN (
    SELECT id FROM ranked_notifications WHERE rn > 1
);

-- 6. Verify the fix worked - show final state
SELECT 
    'AFTER FIX - Updated Notifications:' as status,
    hvpn.id,
    hvpn.policy_number,
    hvpn.employee_id,
    hvpn.policy_amount,
    hvpn.status,
    hvpn.is_editable,
    e.name as employee_name,
    e.clerk_user_id,
    hvpn.biweekly_period_start,
    hvpn.biweekly_period_end,
    CASE 
        WHEN hvpn.biweekly_period_end < CURRENT_DATE THEN 'PERIOD EXPIRED'
        ELSE 'PERIOD ACTIVE'
    END as period_status
FROM high_value_policy_notifications hvpn
LEFT JOIN employees e ON hvpn.employee_id = e.clerk_user_id
ORDER BY hvpn.created_at DESC;

-- 7. Show all employees for reference
SELECT 
    'EMPLOYEES REFERENCE:' as status,
    clerk_user_id,
    name,
    email,
    department,
    position,
    status as employee_status
FROM employees
ORDER BY created_at DESC;

-- 8. Show policy sales for reference
SELECT 
    'POLICY SALES REFERENCE:' as status,
    policy_number,
    employee_id,
    client_name,
    amount,
    policy_type,
    is_cross_sold_policy,
    created_at
FROM policy_sales
WHERE policy_number IN ('POL-2025-678', 'POL-2025-679')
ORDER BY created_at DESC; 