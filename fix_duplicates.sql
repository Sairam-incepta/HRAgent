-- Fix duplicate high value policy notifications
-- This script identifies and removes duplicate notifications, keeping only the most recent one for each policy_number

-- First, let's see what duplicates exist
SELECT 
    policy_number,
    COUNT(*) as duplicate_count,
    STRING_AGG(id::text, ', ') as all_ids,
    STRING_AGG(status, ', ') as all_statuses
FROM high_value_policy_notifications 
GROUP BY policy_number 
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Remove duplicates, keeping only the most recent record for each policy_number
WITH duplicates_to_remove AS (
    SELECT 
        id,
        policy_number,
        created_at,
        ROW_NUMBER() OVER (PARTITION BY policy_number ORDER BY created_at DESC) as rn
    FROM high_value_policy_notifications
)
DELETE FROM high_value_policy_notifications 
WHERE id IN (
    SELECT id 
    FROM duplicates_to_remove 
    WHERE rn > 1
);

-- Verify duplicates are removed
SELECT 
    policy_number,
    COUNT(*) as record_count
FROM high_value_policy_notifications 
GROUP BY policy_number 
HAVING COUNT(*) > 1;

-- Show final count and status breakdown
SELECT 
    COUNT(*) as total_notifications,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE status = 'reviewed') as reviewed_count,
    COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count
FROM high_value_policy_notifications; 