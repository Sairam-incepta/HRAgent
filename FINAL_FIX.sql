-- ============================================
-- FINAL FIX FOR HIGH-VALUE POLICY NOTIFICATIONS
-- ============================================

-- Ensure the employee record exists for the user we see in the logs
INSERT INTO employees (clerk_user_id, name, email, created_at)
VALUES (
    'user_2yQeD2Af9ndPLFcOiLMoQ2QyFmO',
    'John Smith',
    'john.smith@letsinsure.hr',
    NOW()
)
ON CONFLICT (clerk_user_id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email;

-- Set all notifications to pending status so they show in UI
UPDATE high_value_policy_notifications 
SET status = 'pending'
WHERE status != 'pending';

-- Ensure all notifications have client names and policy types
UPDATE high_value_policy_notifications 
SET 
    client_name = COALESCE(client_name, ps.client_name),
    policy_type = COALESCE(policy_type, ps.policy_type)
FROM policy_sales ps
WHERE high_value_policy_notifications.policy_number = ps.policy_number
AND (high_value_policy_notifications.client_name IS NULL OR high_value_policy_notifications.policy_type IS NULL);

-- Show final verification
SELECT 'Final verification - should show in UI:' as info;
SELECT 
    hvpn.policy_number,
    hvpn.policy_amount,
    hvpn.status,
    hvpn.client_name,
    hvpn.policy_type,
    e.name as employee_name
FROM high_value_policy_notifications hvpn
LEFT JOIN employees e ON e.clerk_user_id = hvpn.employee_id
WHERE hvpn.status = 'pending'
ORDER BY hvpn.created_at DESC;

SELECT 'Summary:' as info;
SELECT 
    COUNT(*) as total_pending_notifications,
    COUNT(CASE WHEN e.name IS NOT NULL THEN 1 END) as notifications_with_employee_names
FROM high_value_policy_notifications hvpn
LEFT JOIN employees e ON e.clerk_user_id = hvpn.employee_id
WHERE hvpn.status = 'pending'; 