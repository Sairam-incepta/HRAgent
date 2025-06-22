-- ============================================
-- FIX HIGH-VALUE POLICY NOTIFICATIONS
-- ============================================

-- Update all existing high-value policy notifications to be editable by default
UPDATE high_value_policy_notifications 
SET is_editable = TRUE 
WHERE is_editable IS NULL;

-- Populate missing high-value policy notifications from existing policy sales
INSERT INTO high_value_policy_notifications (
    employee_id,
    policy_number,
    policy_type,
    policy_amount,
    broker_fee,
    current_bonus,
    admin_bonus,
    status,
    biweekly_period_start,
    biweekly_period_end,
    is_cross_sold_policy,
    is_editable,
    client_name,
    created_at
)
SELECT 
    ps.employee_id,
    ps.policy_number,
    ps.policy_type,
    ps.amount,
    ps.broker_fee,
    ps.bonus,
    0, -- Default admin bonus
    'pending',
    -- Calculate biweekly period start (Monday of the week the policy was sold)
    CASE 
        WHEN EXTRACT(DOW FROM ps.sale_date) >= 1 THEN 
            ps.sale_date::date - INTERVAL '1 day' * (EXTRACT(DOW FROM ps.sale_date) - 1)
        ELSE 
            ps.sale_date::date - INTERVAL '6 days'
    END,
    -- Calculate biweekly period end (Sunday, 13 days after start)
    CASE 
        WHEN EXTRACT(DOW FROM ps.sale_date) >= 1 THEN 
            ps.sale_date::date - INTERVAL '1 day' * (EXTRACT(DOW FROM ps.sale_date) - 1) + INTERVAL '13 days'
        ELSE 
            ps.sale_date::date - INTERVAL '6 days' + INTERVAL '13 days'
    END,
    COALESCE(ps.is_cross_sold_policy, FALSE),
    TRUE, -- is_editable
    ps.client_name,
    ps.created_at
FROM policy_sales ps
WHERE ps.amount >= 5000
AND NOT EXISTS (
    SELECT 1 FROM high_value_policy_notifications hvpn 
    WHERE hvpn.policy_number = ps.policy_number
);

-- Display summary
SELECT 'High-value policy notifications created/updated successfully!' as status;
SELECT COUNT(*) as total_high_value_notifications FROM high_value_policy_notifications;
SELECT COUNT(*) as pending_notifications FROM high_value_policy_notifications WHERE status = 'pending';
SELECT COUNT(*) as high_value_policies FROM policy_sales WHERE amount >= 5000; 