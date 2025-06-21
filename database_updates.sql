-- Database Updates for HR Agent Application
-- Run this in your Supabase Dashboard > SQL Editor
-- No RLS (Row Level Security) - simplified version

-- 1. Create high_value_policy_notifications table
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

-- 2. Add missing columns to existing tables
ALTER TABLE policy_sales 
ADD COLUMN IF NOT EXISTS is_cross_sold_policy boolean DEFAULT false;

ALTER TABLE client_reviews 
ADD COLUMN IF NOT EXISTS bonus decimal(10,2) DEFAULT 0;

-- 3. Update existing data
UPDATE policy_sales 
SET is_cross_sold_policy = true 
WHERE cross_sold = true AND is_cross_sold_policy IS NULL;

UPDATE policy_sales 
SET is_cross_sold_policy = false 
WHERE is_cross_sold_policy IS NULL;

-- 4. Create notifications for existing high-value policies
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

-- 5. Verify the changes (optional - shows what was created)
SELECT 'High-value notifications created' as status, COUNT(*) as count
FROM high_value_policy_notifications
UNION ALL
SELECT 'Policy sales with cross-sold flag' as status, COUNT(*) as count
FROM policy_sales WHERE is_cross_sold_policy = true
UNION ALL
SELECT 'Total policy sales' as status, COUNT(*) as count
FROM policy_sales; 