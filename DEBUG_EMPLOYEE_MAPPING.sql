-- Debug script to check employee mapping issue
-- Check high-value policy notifications
SELECT 
    hvpn.id,
    hvpn.policy_number,
    hvpn.employee_id,
    hvpn.policy_amount,
    hvpn.status,
    e.name as employee_name,
    e.clerk_user_id
FROM high_value_policy_notifications hvpn
LEFT JOIN employees e ON hvpn.employee_id = e.clerk_user_id
ORDER BY hvpn.created_at DESC;

-- Check all employees
SELECT 
    clerk_user_id,
    name,
    email,
    department,
    position,
    status
FROM employees
ORDER BY created_at DESC;

-- Check policy sales for reference
SELECT 
    policy_number,
    employee_id,
    client_name,
    amount,
    created_at
FROM policy_sales
WHERE policy_number IN ('POL-2025-678', 'POL-2025-679')
ORDER BY created_at DESC; 