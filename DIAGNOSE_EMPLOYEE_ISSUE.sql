-- ============================================
-- DIAGNOSE EMPLOYEE ID MISMATCH ISSUE
-- ============================================

-- Check what's in the high_value_policy_notifications table
SELECT 'High-Value Policy Notifications:' as section;
SELECT 
    id,
    employee_id,
    policy_number,
    policy_amount,
    client_name,
    status,
    created_at
FROM high_value_policy_notifications
ORDER BY created_at DESC;

-- Check what's in the employees table
SELECT 'Employees Table:' as section;
SELECT 
    id,
    clerk_user_id,
    name,
    email,
    created_at
FROM employees
ORDER BY created_at DESC;

-- Check what's in the policy_sales table for comparison
SELECT 'Policy Sales (High-Value):' as section;
SELECT 
    id,
    employee_id,
    policy_number,
    client_name,
    amount,
    sale_date,
    created_at
FROM policy_sales 
WHERE amount >= 5000
ORDER BY created_at DESC;

-- Check for employee ID matches/mismatches
SELECT 'Employee ID Matching Analysis:' as section;
SELECT 
    hvpn.policy_number,
    hvpn.employee_id as notification_employee_id,
    e.clerk_user_id as employee_clerk_id,
    e.name as employee_name,
    CASE 
        WHEN e.clerk_user_id IS NULL THEN 'NO MATCH - Employee not found'
        WHEN hvpn.employee_id = e.clerk_user_id THEN 'MATCH - IDs are identical'
        ELSE 'MISMATCH - IDs are different'
    END as match_status
FROM high_value_policy_notifications hvpn
LEFT JOIN employees e ON e.clerk_user_id = hvpn.employee_id
ORDER BY hvpn.created_at DESC;

-- Show summary counts
SELECT 'Summary:' as section;
SELECT 
    COUNT(*) as total_notifications,
    COUNT(CASE WHEN e.clerk_user_id IS NOT NULL THEN 1 END) as matched_employees,
    COUNT(CASE WHEN e.clerk_user_id IS NULL THEN 1 END) as unmatched_employees
FROM high_value_policy_notifications hvpn
LEFT JOIN employees e ON e.clerk_user_id = hvpn.employee_id; 