-- Migration: Add edit clock time support
-- Date: 2025-01-28

-- Add new columns to existing requests table
ALTER TABLE requests 
ADD COLUMN IF NOT EXISTS clock_in_time time,
ADD COLUMN IF NOT EXISTS clock_out_time time;

-- Update the type constraint to include the new request type
ALTER TABLE requests 
DROP CONSTRAINT IF EXISTS requests_type_check;

ALTER TABLE requests 
ADD CONSTRAINT requests_type_check 
CHECK (type IN ('overtime', 'vacation', 'sick', 'edit-clock-time', 'other'));

-- Add index for better performance on type filtering
CREATE INDEX IF NOT EXISTS idx_requests_type ON requests(type);