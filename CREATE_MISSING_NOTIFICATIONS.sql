-- CREATE MISSING NOTIFICATIONS - For new high-value policies
-- This script creates notifications for any policies >= $5000 that don't have notifications yet

-- 1. Check what policies >= $5000 are missing notifications
SELECT 
    'MISSING NOTIFICATIONS FOR HIGH-VALUE POLICIES:' as status,
    ps.policy_number,
    ps.employee_id,
    ps.client_name,
    ps.amount,
    ps.created_at,
    CASE 
        WHEN hvpn.policy_number IS NULL THEN 'MISSING NOTIFICATION'
        ELSE 'HAS NOTIFICATION'
    END as notification_status
FROM policy_sales ps
LEFT JOIN high_value_policy_notifications hvpn ON ps.policy_number = hvpn.policy_number
WHERE ps.amount >= 5000
ORDER BY ps.created_at DESC;

-- 2. Create missing high-value policy notifications for ALL policies >= $5000
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

-- 3. Verify all notifications now exist with proper employee names
SELECT 
    'ALL HIGH-VALUE NOTIFICATIONS WITH EMPLOYEE NAMES:' as status,
    hvpn.policy_number,
    hvpn.employee_id,
    hvpn.policy_amount,
    hvpn.status,
    e.name as employee_name,
    CASE 
        WHEN e.name IS NULL THEN 'WILL SHOW: Unknown Employee'
        ELSE CONCAT('WILL SHOW: ', e.name)
    END as display_result
FROM high_value_policy_notifications hvpn
LEFT JOIN employees e ON hvpn.employee_id = e.clerk_user_id
ORDER BY hvpn.created_at DESC;

-- 4. Count summary
SELECT 
    'SUMMARY:' as status,
    COUNT(*) as total_notifications,
    COUNT(e.name) as notifications_with_employee_names,
    COUNT(*) - COUNT(e.name) as notifications_missing_employee_names
FROM high_value_policy_notifications hvpn
LEFT JOIN employees e ON hvpn.employee_id = e.clerk_user_id; 