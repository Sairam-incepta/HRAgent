-- UNIVERSAL FIX SCRIPT - Fixes employee mapping for ALL employees with high-value policies
-- This script will work for any employee, not just John Smith

-- 1. First, ensure John Smith exists (since we know he's the current user)
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

-- 2. Create missing employee records for ANY employee_id found in policy_sales or high_value_policy_notifications
-- This ensures that any future employee who creates high-value policies will have a record
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
)
SELECT DISTINCT
    missing_employees.employee_id,
    CASE 
        WHEN missing_employees.employee_id = 'user_2yQeD2Af9ndPLFcOiLMoQ2QyFmO' THEN 'John Smith'
        ELSE 'Employee ' || SUBSTRING(missing_employees.employee_id FROM 6 FOR 8) -- Extract part of user ID for name
    END as name,
    CASE 
        WHEN missing_employees.employee_id = 'user_2yQeD2Af9ndPLFcOiLMoQ2QyFmO' THEN 'john.smith@company.com'
        ELSE LOWER('employee' || SUBSTRING(missing_employees.employee_id FROM 6 FOR 8) || '@company.com')
    END as email,
    'Sales' as department,
    'Insurance Agent' as position,
    'active' as status,
    25.00 as hourly_rate,
    40 as max_hours_before_overtime,
    NOW(),
    NOW()
FROM (
    -- Get all unique employee IDs from policy_sales
    SELECT DISTINCT employee_id FROM policy_sales WHERE amount >= 5000
    UNION
    -- Get all unique employee IDs from high_value_policy_notifications
    SELECT DISTINCT employee_id FROM high_value_policy_notifications
) AS missing_employees
LEFT JOIN employees e ON missing_employees.employee_id = e.clerk_user_id
WHERE e.clerk_user_id IS NULL; -- Only insert if employee doesn't exist

-- 3. Show current state before fixing notifications
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

-- 4. Create missing high-value policy notifications for ALL policies >= $5000
-- This ensures all high-value policies have notifications regardless of employee
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
  AND hvpn.policy_number IS NULL; -- Only create if notification doesn't exist

-- 5. Update any existing notifications to ensure they're properly configured
UPDATE high_value_policy_notifications 
SET 
    is_editable = true,
    updated_at = NOW()
WHERE policy_amount >= 5000;

-- 6. Clean up any duplicate notifications (keep the most recent one for each policy)
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

-- 7. Verify the fix worked - show final state for ALL employees
SELECT 
    'AFTER FIX - All Notifications:' as status,
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

-- 8. Show all employees for reference
SELECT 
    'ALL EMPLOYEES:' as status,
    clerk_user_id,
    name,
    email,
    department,
    position,
    status as employee_status,
    created_at
FROM employees
ORDER BY created_at DESC;

-- 9. Show count of high-value policies by employee
SELECT 
    'HIGH-VALUE POLICIES BY EMPLOYEE:' as status,
    e.name as employee_name,
    e.clerk_user_id,
    COUNT(ps.id) as total_high_value_policies,
    SUM(ps.amount) as total_policy_value,
    COUNT(hvpn.id) as notifications_created
FROM employees e
LEFT JOIN policy_sales ps ON e.clerk_user_id = ps.employee_id AND ps.amount >= 5000
LEFT JOIN high_value_policy_notifications hvpn ON e.clerk_user_id = hvpn.employee_id
GROUP BY e.clerk_user_id, e.name
HAVING COUNT(ps.id) > 0 OR COUNT(hvpn.id) > 0
ORDER BY total_policy_value DESC; 