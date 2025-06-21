/*
  # Update existing policy_sales records with is_cross_sold_policy field
  
  This migration updates existing policy sales records to set the is_cross_sold_policy field
  based on the existing cross_sold field.
  
  1. Changes
    - Create high_value_policy_notifications table for tracking policies over $5,000
    - Add is_cross_sold_policy field to policy_sales table
    - Update existing records where cross_sold = true to set is_cross_sold_policy = true
    - Ensure all records have the new field properly set
  
  2. Notes
    - This maintains backward compatibility while adding the new field
    - Cross-sold policies will now be properly tracked for double commission
    - High-value policies require manual bonus review
*/

-- Create high_value_policy_notifications table
CREATE TABLE IF NOT EXISTS high_value_policy_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  policy_number text NOT NULL,
  policy_amount decimal(10,2) NOT NULL,
  broker_fee decimal(10,2) NOT NULL,
  current_bonus decimal(10,2) NOT NULL,
  is_cross_sold_policy boolean DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed')),
  admin_bonus decimal(10,2),
  admin_notes text,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on high_value_policy_notifications
ALTER TABLE high_value_policy_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for high_value_policy_notifications table
CREATE POLICY "Users can read own high-value notifications"
  ON high_value_policy_notifications
  FOR SELECT
  TO authenticated
  USING (employee_id = auth.jwt() ->> 'sub');

CREATE POLICY "Admins can read all high-value notifications"
  ON high_value_policy_notifications
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'admin@letsinsure.hr');

CREATE POLICY "Admins can update high-value notifications"
  ON high_value_policy_notifications
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'admin@letsinsure.hr');

CREATE POLICY "System can insert high-value notifications"
  ON high_value_policy_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add is_cross_sold_policy field to policy_sales table if it doesn't exist
ALTER TABLE policy_sales 
ADD COLUMN IF NOT EXISTS is_cross_sold_policy boolean DEFAULT false;

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

-- Add bonus field to client_reviews table if it doesn't exist
ALTER TABLE client_reviews 
ADD COLUMN IF NOT EXISTS bonus decimal(10,2) DEFAULT 0; 