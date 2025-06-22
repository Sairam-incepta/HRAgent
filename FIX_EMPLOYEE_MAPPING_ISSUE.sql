-- Fix employee mapping issue for high-value policy notifications

-- First, ensure John Smith employee record exists
INSERT INTO employees (
    clerk_user_id,
    name,
    email,
    department,
    position,
    status,
    hourly_rate,
    max_hours_before_overtime,
    created_at,
    updated_at
) VALUES (
    'user_2yQeD2Af9ndPLFcOiLMoQ2QyFmO',
    'John Smith',
    'john.smith@company.com',
    'Sales',
    'Insurance Agent',
    'active',
    25.00,
    40,
    NOW(),
    NOW()
) ON CONFLICT (clerk_user_id) DO UPDATE SET
    name = EXCLUDED.name,
    department = EXCLUDED.department,
    position = EXCLUDED.position,
    status = EXCLUDED.status,
    updated_at = NOW();

-- Check current high-value policy notifications and their employee mappings
SELECT 
    hvpn.id,
    hvpn.policy_number,
    hvpn.employee_id,
    hvpn.policy_amount,
    hvpn.status,
    e.name as employee_name,
    CASE 
        WHEN e.name IS NULL THEN 'MISSING EMPLOYEE RECORD'
        ELSE 'EMPLOYEE FOUND'
    END as mapping_status
FROM high_value_policy_notifications hvpn
LEFT JOIN employees e ON hvpn.employee_id = e.clerk_user_id
ORDER BY hvpn.created_at DESC;

-- If there are any notifications with missing employee mappings, 
-- we can update them to use the correct employee_id
-- (This would be a manual fix if needed)

-- Verify the fix worked
SELECT 
    'After Fix:' as status,
    hvpn.policy_number,
    hvpn.employee_id,
    e.name as employee_name
FROM high_value_policy_notifications hvpn
LEFT JOIN employees e ON hvpn.employee_id = e.clerk_user_id
WHERE hvpn.policy_number IN ('POL-2025-678', 'POL-2025-679'); 