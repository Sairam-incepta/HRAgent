/*
  # Update existing policy_sales records with is_cross_sold_policy field
  
  This migration updates existing policy sales records to set the is_cross_sold_policy field
  based on the existing cross_sold field.
  
  1. Changes
    - Update existing records where cross_sold = true to set is_cross_sold_policy = true
    - Ensure all records have the new field properly set
  
  2. Notes
    - This maintains backward compatibility while adding the new field
    - Cross-sold policies will now be properly tracked for double commission
*/

-- Update existing records to set is_cross_sold_policy based on cross_sold field
UPDATE policy_sales 
SET is_cross_sold_policy = true 
WHERE cross_sold = true AND is_cross_sold_policy IS NULL;

-- Set remaining records to false if not already set
UPDATE policy_sales 
SET is_cross_sold_policy = false 
WHERE is_cross_sold_policy IS NULL;

-- Verify the update
SELECT 
  COUNT(*) as total_policies,
  COUNT(*) FILTER (WHERE is_cross_sold_policy = true) as cross_sold_policies,
  COUNT(*) FILTER (WHERE is_cross_sold_policy = false) as regular_policies
FROM policy_sales;

-- Create any missing high-value policy notifications for existing policies over $5000
INSERT INTO high_value_policy_notifications (
  employee_id,
  policy_number,
  policy_amount,
  broker_fee,
  current_bonus,
  is_cross_sold_policy,
  status
)
SELECT 
  ps.employee_id,
  ps.policy_number,
  ps.amount,
  ps.broker_fee,
  ps.bonus,
  ps.is_cross_sold_policy,
  'pending'
FROM policy_sales ps
WHERE ps.amount > 5000
AND NOT EXISTS (
  SELECT 1 FROM high_value_policy_notifications hvpn 
  WHERE hvpn.policy_number = ps.policy_number
);

-- Verify high-value notifications were created
SELECT 
  COUNT(*) as total_high_value_notifications,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_reviews,
  COUNT(*) FILTER (WHERE status = 'reviewed') as reviewed
FROM high_value_policy_notifications; 