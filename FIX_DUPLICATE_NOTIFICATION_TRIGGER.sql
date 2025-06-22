-- ============================================
-- FIX DUPLICATE HIGH-VALUE POLICY NOTIFICATION TRIGGER
-- ============================================

-- Update the trigger function to prevent duplicate notifications
CREATE OR REPLACE FUNCTION create_high_value_policy_notification()
RETURNS TRIGGER AS $$
DECLARE
    biweekly_start DATE;
    biweekly_end DATE;
    existing_notification_count INT;
BEGIN
    -- Only create notification for policies over $5000
    IF NEW.amount >= 5000 THEN
        -- Check if notification already exists for this policy number
        SELECT COUNT(*) INTO existing_notification_count
        FROM high_value_policy_notifications
        WHERE policy_number = NEW.policy_number;
        
        -- Only create if no existing notification found
        IF existing_notification_count = 0 THEN
            -- Calculate biweekly period
            IF EXTRACT(DOW FROM NEW.sale_date) >= 1 THEN 
                biweekly_start := NEW.sale_date::date - INTERVAL '1 day' * (EXTRACT(DOW FROM NEW.sale_date) - 1);
            ELSE 
                biweekly_start := NEW.sale_date::date - INTERVAL '6 days';
            END IF;
            
            biweekly_end := biweekly_start + INTERVAL '13 days';
            
            -- Insert high-value policy notification
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
                is_cross_sold_policy
            ) VALUES (
                NEW.employee_id,
                NEW.policy_number,
                NEW.policy_type,
                NEW.amount,
                NEW.broker_fee,
                NEW.bonus,
                0,
                'pending',
                biweekly_start,
                biweekly_end,
                COALESCE(NEW.is_cross_sold_policy, FALSE)
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_high_value_policy_notification ON policy_sales;
CREATE TRIGGER trigger_high_value_policy_notification
    AFTER INSERT ON policy_sales
    FOR EACH ROW
    EXECUTE FUNCTION create_high_value_policy_notification();

-- Clean up existing duplicates
WITH ranked_notifications AS (
    SELECT 
        id,
        policy_number,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY policy_number 
            ORDER BY created_at DESC
        ) as rn
    FROM high_value_policy_notifications
)
DELETE FROM high_value_policy_notifications
WHERE id IN (
    SELECT id 
    FROM ranked_notifications 
    WHERE rn > 1
);

-- Show final count after cleanup
SELECT 
    'Cleanup completed' as status,
    COUNT(*) as total_notifications,
    COUNT(DISTINCT policy_number) as unique_policies
FROM high_value_policy_notifications; 