-- Add rate history tracking to employees table
-- This allows us to track when rates changed and what the previous rate was

ALTER TABLE employees ADD COLUMN rate_effective_date date DEFAULT CURRENT_DATE;
ALTER TABLE employees ADD COLUMN previous_rate numeric;
ALTER TABLE employees ADD COLUMN rate_changed_at timestamp with time zone;
ALTER TABLE employees ADD COLUMN rate_changed_by text;

-- Add comment explaining the rate history system
COMMENT ON COLUMN employees.rate_effective_date IS 'Date when current hourly_rate became effective';
COMMENT ON COLUMN employees.previous_rate IS 'Previous hourly rate before the most recent change';
COMMENT ON COLUMN employees.rate_changed_at IS 'Timestamp when the rate was last changed';
COMMENT ON COLUMN employees.rate_changed_by IS 'User who made the rate change';

-- Create index for efficient rate history queries
CREATE INDEX idx_employees_rate_effective_date ON employees(rate_effective_date); 