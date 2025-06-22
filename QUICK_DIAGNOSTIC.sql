-- QUICK DIAGNOSTIC - Check current database state
-- Run this to see what's actually in your database

-- 1. Check if John Smith employee record exists
SELECT 
    'JOHN SMITH EMPLOYEE CHECK:' as check_type,
    clerk_user_id,
    name,
    email,
    department,
    position
FROM employees 
WHERE clerk_user_id = 'user_2yQeD2Af9ndPLFcOiLMoQ2QyFmO';

-- 2. Check all employees
SELECT 
    'ALL EMPLOYEES:' as check_type,
    clerk_user_id,
    name,
    email
FROM employees
ORDER BY created_at DESC;

-- 3. Check high-value policy notifications
SELECT 
    'HIGH-VALUE NOTIFICATIONS:' as check_type,
    id,
    policy_number,
    employee_id,
    policy_amount,
    status
FROM high_value_policy_notifications
ORDER BY created_at DESC;

-- 4. Check policy sales for reference
SELECT 
    'POLICY SALES:' as check_type,
    policy_number,
    employee_id,
    client_name,
    amount
FROM policy_sales
WHERE amount >= 5000
ORDER BY created_at DESC;

-- 5. Check the JOIN that the frontend uses
SELECT 
    'FRONTEND JOIN SIMULATION:' as check_type,
    hvpn.policy_number,
    hvpn.employee_id,
    hvpn.policy_amount,
    e.name as employee_name,
    CASE 
        WHEN e.name IS NULL THEN 'WILL SHOW: Unknown Employee'
        ELSE CONCAT('WILL SHOW: ', e.name)
    END as display_result
FROM high_value_policy_notifications hvpn
LEFT JOIN employees e ON hvpn.employee_id = e.clerk_user_id
ORDER BY hvpn.created_at DESC; 