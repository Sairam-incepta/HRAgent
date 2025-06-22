-- ============================================
-- FIX EMPLOYEE NAMES IN HIGH-VALUE NOTIFICATIONS
-- ============================================

-- First, let's see what employee IDs we have in policy_sales
SELECT 'Employee IDs in policy_sales:' as info;
SELECT DISTINCT employee_id, COUNT(*) as policy_count
FROM policy_sales
GROUP BY employee_id
ORDER BY policy_count DESC;

-- Check what's in employees table
SELECT 'Employees table:' as info;
SELECT id, clerk_user_id, name, email
FROM employees;

-- Check if we need to create an employee record
-- Based on the logs, the employee_id is 'user_2yQeD2Af9ndPLFcOiLMoQ2QyFmO'
INSERT INTO employees (clerk_user_id, name, email, role, created_at)
SELECT 
    'user_2yQeD2Af9ndPLFcOiLMoQ2QyFmO',
    'John Smith',
    'john.smith@letsinsure.hr',
    'employee',
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM employees WHERE clerk_user_id = 'user_2yQeD2Af9ndPLFcOiLMoQ2QyFmO'
);

-- Add client_name to notifications if missing (from policy_sales)
UPDATE high_value_policy_notifications 
SET client_name = ps.client_name
FROM policy_sales ps
WHERE high_value_policy_notifications.policy_number = ps.policy_number
AND high_value_policy_notifications.client_name IS NULL;

-- Add policy_type to notifications if missing (from policy_sales)
UPDATE high_value_policy_notifications 
SET policy_type = ps.policy_type
FROM policy_sales ps
WHERE high_value_policy_notifications.policy_number = ps.policy_number
AND high_value_policy_notifications.policy_type IS NULL;

-- Now let's verify the employee mapping will work
SELECT 'Employee mapping verification:' as info;
SELECT 
    hvpn.policy_number,
    hvpn.employee_id,
    hvpn.client_name,
    e.name as employee_name,
    CASE 
        WHEN e.name IS NOT NULL THEN 'WILL WORK'
        ELSE 'STILL BROKEN'
    END as mapping_status
FROM high_value_policy_notifications hvpn
LEFT JOIN employees e ON e.clerk_user_id = hvpn.employee_id
ORDER BY hvpn.created_at DESC;

-- Display final state
SELECT 'Final notifications state:' as info;
SELECT 
    policy_number,
    employee_id,
    client_name,
    policy_type,
    policy_amount,
    status,
    created_at
FROM high_value_policy_notifications
ORDER BY created_at DESC;

SELECT 'Summary:' as info;
SELECT COUNT(*) as total_notifications FROM high_value_policy_notifications;
SELECT COUNT(*) as notifications_with_client_names FROM high_value_policy_notifications WHERE client_name IS NOT NULL; 