-- ============================================
-- CLEANUP DUPLICATE HIGH-VALUE POLICY NOTIFICATIONS
-- ============================================

-- This script removes duplicate high-value policy notifications,
-- keeping only the most recent entry for each policy_number

-- First, let's see what duplicates we have
SELECT 
    policy_number,
    COUNT(*) as duplicate_count,
    STRING_AGG(status, ', ') as statuses,
    STRING_AGG(id::text, ', ') as notification_ids
FROM high_value_policy_notifications
GROUP BY policy_number
HAVING COUNT(*) > 1
ORDER BY policy_number;

-- Delete duplicate entries, keeping only the most recent one for each policy_number
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

-- Verify cleanup - this should show no duplicates
SELECT 
    policy_number,
    COUNT(*) as count_after_cleanup
FROM high_value_policy_notifications
GROUP BY policy_number
HAVING COUNT(*) > 1;

-- Show final results
SELECT 
    policy_number,
    status,
    created_at,
    biweekly_period_start,
    biweekly_period_end
FROM high_value_policy_notifications
ORDER BY created_at DESC; 