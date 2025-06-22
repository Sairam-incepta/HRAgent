-- ============================================
-- CHECK NOTIFICATION DATA FOR UI DISPLAY
-- ============================================

-- Show exactly what the UI should see
SELECT 'Data that should appear in UI:' as info;
SELECT 
    hvpn.id,
    hvpn.policy_number,
    hvpn.employee_id,
    hvpn.policy_amount,
    hvpn.status,
    hvpn.client_name,
    hvpn.policy_type,
    hvpn.biweekly_period_start,
    hvpn.biweekly_period_end,
    hvpn.created_at,
    e.name as employee_name_from_join,
    e.clerk_user_id
FROM high_value_policy_notifications hvpn
LEFT JOIN employees e ON e.clerk_user_id = hvpn.employee_id
ORDER BY hvpn.created_at DESC;

-- Check status distribution
SELECT 'Status breakdown:' as info;
SELECT 
    status,
    COUNT(*) as count
FROM high_value_policy_notifications
GROUP BY status;

-- Check if any are resolved (which would hide them from UI)
SELECT 'Resolved notifications (hidden from UI):' as info;
SELECT 
    policy_number,
    status,
    created_at
FROM high_value_policy_notifications
WHERE status = 'resolved'
ORDER BY created_at DESC;

-- Check pending notifications (should show in UI)
SELECT 'Pending notifications (should show in UI):' as info;
SELECT 
    hvpn.policy_number,
    hvpn.policy_amount,
    hvpn.status,
    hvpn.client_name,
    e.name as employee_name
FROM high_value_policy_notifications hvpn
LEFT JOIN employees e ON e.clerk_user_id = hvpn.employee_id
WHERE hvpn.status != 'resolved'
ORDER BY hvpn.created_at DESC;

-- Check for any null employee names
SELECT 'Notifications with null employee data:' as info;
SELECT 
    policy_number,
    employee_id,
    CASE 
        WHEN e.name IS NULL THEN 'EMPLOYEE NOT FOUND'
        ELSE e.name
    END as employee_status
FROM high_value_policy_notifications hvpn
LEFT JOIN employees e ON e.clerk_user_id = hvpn.employee_id
WHERE e.name IS NULL; 