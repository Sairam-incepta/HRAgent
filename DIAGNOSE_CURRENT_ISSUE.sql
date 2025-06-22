-- DIAGNOSE CURRENT ISSUE - Check why policies show "Unknown Employee"
-- Run this to see exactly what's happening

-- 1. Check all recent high-value policies in policy_sales
SELECT 
    'RECENT HIGH-VALUE POLICIES IN policy_sales:' as section,
    policy_number,
    client_name,
    amount,
    employee_id,
    created_at,
    sale_date
FROM policy_sales 
WHERE amount >= 5000 
ORDER BY created_at DESC 
LIMIT 10;

-- 2. Check all high-value notifications
SELECT 
    'ALL HIGH-VALUE NOTIFICATIONS:' as section,
    policy_number,
    employee_id,
    policy_amount,
    status,
    created_at
FROM high_value_policy_notifications 
ORDER BY created_at DESC 
LIMIT 10;

-- 3. Check employee records and their clerk_user_id mapping
SELECT 
    'ALL EMPLOYEES:' as section,
    id,
    name,
    email,
    clerk_user_id,
    created_at
FROM employees 
ORDER BY created_at DESC;

-- 4. Check specific employee mapping for user_2yQeD2Af9ndPLFcOiLMoQ2QyFmO
SELECT 
    'SPECIFIC EMPLOYEE MAPPING:' as section,
    CASE 
        WHEN EXISTS (SELECT 1 FROM employees WHERE clerk_user_id = 'user_2yQeD2Af9ndPLFcOiLMoQ2QyFmO') 
        THEN 'EMPLOYEE RECORD EXISTS'
        ELSE 'EMPLOYEE RECORD MISSING'
    END as employee_status,
    (SELECT name FROM employees WHERE clerk_user_id = 'user_2yQeD2Af9ndPLFcOiLMoQ2QyFmO') as employee_name,
    (SELECT email FROM employees WHERE clerk_user_id = 'user_2yQeD2Af9ndPLFcOiLMoQ2QyFmO') as employee_email;

-- 5. Check the JOIN that the frontend uses
SELECT 
    'FRONTEND JOIN SIMULATION:' as section,
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
WHERE hvpn.policy_number IN ('POL-2025-232', 'POL-2025-233')
ORDER BY hvpn.created_at DESC;

-- 6. Check if trigger is working by looking for notifications created today
SELECT 
    'NOTIFICATIONS CREATED TODAY:' as section,
    COUNT(*) as count_created_today,
    STRING_AGG(policy_number, ', ') as policy_numbers
FROM high_value_policy_notifications 
WHERE DATE(created_at) = CURRENT_DATE;

-- 7. Check if automatic trigger exists and is enabled
SELECT 
    'TRIGGER STATUS:' as section,
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_high_value_policy_notification'; 