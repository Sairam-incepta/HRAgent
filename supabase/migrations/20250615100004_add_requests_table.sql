-- Drop the requests table if it exists to avoid type conflicts
DROP TABLE IF EXISTS requests CASCADE;

-- Add requests table for general employee requests (vacation, sick leave, etc.)
CREATE TABLE IF NOT EXISTS requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  type text NOT NULL CHECK (type IN ('overtime', 'vacation', 'sick', 'other')),
  title text NOT NULL,
  description text NOT NULL,
  request_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  hours_requested decimal(4,2),
  reason text,
  start_date date,
  end_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Disable RLS on requests table for now
ALTER TABLE requests DISABLE ROW LEVEL SECURITY;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_requests_employee_id ON requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_request_date ON requests(request_date); 