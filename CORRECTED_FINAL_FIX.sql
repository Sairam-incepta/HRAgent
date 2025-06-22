-- ============================================
-- CORRECTED FINAL FIX FOR HIGH-VALUE POLICY NOTIFICATIONS
-- Following the actual database schema
-- ============================================

-- Ensure the employee record exists with ALL required fields
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
    position = EXCLUDED.position;

-- Set all notifications to pending status so they show in UI
UPDATE high_value_policy_notifications 
SET status = 'pending'
WHERE status != 'pending';

-- Ensure all notifications have client names and policy types from policy_sales
UPDATE high_value_policy_notifications 
SET 
    client_name = COALESCE(high_value_policy_notifications.client_name, ps.client_name),
    policy_type = COALESCE(high_value_policy_notifications.policy_type, ps.policy_type)
FROM policy_sales ps
WHERE high_value_policy_notifications.policy_number = ps.policy_number
AND (high_value_policy_notifications.client_name IS NULL OR high_value_policy_notifications.policy_type IS NULL);

-- Show final verification
SELECT 'Final verification - what should appear in UI:' as info;
SELECT 
    hvpn.id,
    hvpn.policy_number,
    hvpn.employee_id,
    hvpn.policy_amount,
    hvpn.status,
    hvpn.client_name,
    hvpn.policy_type,
    hvpn.created_at,
    e.name as employee_name_from_join
FROM high_value_policy_notifications hvpn
LEFT JOIN employees e ON e.clerk_user_id = hvpn.employee_id
WHERE hvpn.status = 'pending'
ORDER BY hvpn.created_at DESC; 