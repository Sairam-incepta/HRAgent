-- Add unique constraint on policy_number to prevent duplicate high value policy notifications
-- This will prevent the same policy from being added multiple times

-- First, remove any existing duplicates (keep the most recent one for each policy_number)
DELETE FROM high_value_policy_notifications 
WHERE id NOT IN (
  SELECT DISTINCT ON (policy_number) id 
  FROM high_value_policy_notifications 
  ORDER BY policy_number, created_at DESC
);

-- Add unique constraint on policy_number
ALTER TABLE high_value_policy_notifications 
ADD CONSTRAINT high_value_policy_notifications_policy_number_unique 
UNIQUE (policy_number);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT high_value_policy_notifications_policy_number_unique 
ON high_value_policy_notifications 
IS 'Ensures each policy can only have one high-value notification entry'; 