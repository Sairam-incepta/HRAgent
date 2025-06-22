-- SYNC CLERK USERS SCRIPT - Identifies missing employee records and provides guidance
-- This script identifies employees who have policy sales but no employee records

-- 1. First, let's see what employee IDs exist in policy_sales but not in employees
SELECT 
    'MISSING EMPLOYEE RECORDS:' as status,
    ps.employee_id,
    COUNT(ps.id) as total_policies,
    SUM(ps.amount) as total_policy_value,
    MIN(ps.sale_date) as first_sale_date,
    MAX(ps.sale_date) as last_sale_date
FROM policy_sales ps
LEFT JOIN employees e ON ps.employee_id = e.clerk_user_id
WHERE e.clerk_user_id IS NULL
GROUP BY ps.employee_id
ORDER BY total_policy_value DESC;

-- 2. Show current high-value policy notifications with missing employee mappings
SELECT 
    'HIGH-VALUE NOTIFICATIONS WITH MISSING EMPLOYEES:' as status,
    hvpn.id,
    hvpn.policy_number,
    hvpn.employee_id,
    hvpn.policy_amount,
    hvpn.status,
    CASE 
        WHEN e.name IS NULL THEN 'MISSING EMPLOYEE RECORD'
        ELSE e.name
    END as employee_name
FROM high_value_policy_notifications hvpn
LEFT JOIN employees e ON hvpn.employee_id = e.clerk_user_id
ORDER BY hvpn.created_at DESC;

-- 3. Temporary fix: Create basic employee record for John Smith
-- (This should be replaced with proper Clerk sync in production)
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
    updated_at = NOW();

-- 4. Create missing high-value policy notifications for ALL policies >= $5000
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
    ps.sale_date::date as biweekly_period_start,
    (ps.sale_date::date + INTERVAL '14 days')::date as biweekly_period_end,
    true as is_editable,
    'pending' as status,
    NOW(),
    NOW()
FROM policy_sales ps
LEFT JOIN high_value_policy_notifications hvpn ON ps.policy_number = hvpn.policy_number
WHERE ps.amount >= 5000 
  AND hvpn.policy_number IS NULL;

-- 5. Clean up any duplicate notifications
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

-- 6. Verify the fix worked
SELECT 
    'AFTER FIX - All Notifications:' as status,
    hvpn.id,
    hvpn.policy_number,
    hvpn.employee_id,
    hvpn.policy_amount,
    hvpn.status,
    e.name as employee_name,
    CASE 
        WHEN e.name IS NULL THEN 'STILL MISSING'
        ELSE 'FOUND'
    END as mapping_status
FROM high_value_policy_notifications hvpn
LEFT JOIN employees e ON hvpn.employee_id = e.clerk_user_id
ORDER BY hvpn.created_at DESC;

-- 7. Show all employees now
SELECT 
    'ALL EMPLOYEES AFTER FIX:' as status,
    clerk_user_id,
    name,
    email,
    department,
    position,
    status as employee_status
FROM employees
ORDER BY created_at DESC;

/*
IMPORTANT NOTES FOR PRODUCTION:

1. This script provides a TEMPORARY FIX for John Smith specifically.

2. For a PERMANENT SOLUTION, you should:
   - Use the admin interface to properly create employee records
   - Go to your dashboard as admin
   - Use "Add Employee" to create employees with their real Clerk data
   - This will sync the real names, emails, etc. from Clerk

3. For John Smith specifically:
   - You need to get his real name and email from Clerk
   - Either create him through the admin interface
   - Or update the INSERT statement above with his real information

4. Future employees should ALWAYS be created through the admin interface
   to ensure proper Clerk synchronization.
*/ 