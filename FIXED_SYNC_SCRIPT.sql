-- FIXED SYNC SCRIPT - Works with your actual database schema
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

-- 3. Create employee record for John Smith (fixed for your schema)
INSERT INTO employees (
    clerk_user_id,
    name,
    email,
    department,
    position,
    status,
    hourly_rate,
    max_hours_before_overtime,
    created_at
) VALUES (
    'user_2yQeD2Af9ndPLFcOiLMoQ2QyFmO',
    'John Smith',
    'john.smith@company.com',
    'Sales',
    'Insurance Agent',
    'active',
    25.00,
    40,
    NOW()
) ON CONFLICT (clerk_user_id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    department = EXCLUDED.department,
    position = EXCLUDED.position,
    status = EXCLUDED.status;

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
    created_at
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

-- 8. Show policy sales to verify data
SELECT 
    'POLICY SALES DATA:' as status,
    policy_number,
    employee_id,
    client_name,
    amount,
    created_at
FROM policy_sales
WHERE amount >= 5000
ORDER BY created_at DESC;

/*
IMPORTANT NOTES:

1. This script is fixed to work with your actual database schema.

2. It will:
   - Create John Smith employee record
   - Create missing high-value policy notifications
   - Clean up duplicates
   - Show you the results

3. After running this script, refresh your dashboard and the "Unknown Employee" 
   issue should be resolved.

4. The unresolve button should also work properly after this fix.
*/ 