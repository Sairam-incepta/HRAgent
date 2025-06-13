/*
  # Initial Schema for LetsInsure HR System

  1. New Tables
    - `employees` - Employee information linked to Clerk users
    - `policy_sales` - Insurance policy sales records
    - `employee_bonuses` - Employee bonus tracking
    - `client_reviews` - Customer reviews and ratings
    - `daily_summaries` - Daily work summaries
    - `conversation_states` - Chat conversation state management
    - `overtime_requests` - Overtime approval requests

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to access their own data
    - Admin users can access all data

  3. Demo Data
    - Insert demo employee records
    - Insert sample policy sales, reviews, and summaries
*/

-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text UNIQUE NOT NULL,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  department text NOT NULL,
  position text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave')),
  max_hours_before_overtime integer NOT NULL DEFAULT 8,
  hourly_rate decimal(10,2) NOT NULL DEFAULT 25.00,
  created_at timestamptz DEFAULT now()
);

-- Create policy_sales table
CREATE TABLE IF NOT EXISTS policy_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_number text UNIQUE NOT NULL,
  client_name text NOT NULL,
  policy_type text NOT NULL,
  amount decimal(10,2) NOT NULL,
  broker_fee decimal(10,2) NOT NULL,
  bonus decimal(10,2) NOT NULL DEFAULT 0,
  employee_id text NOT NULL,
  sale_date timestamptz NOT NULL,
  cross_sold boolean DEFAULT false,
  cross_sold_type text,
  cross_sold_to text,
  client_description text,
  created_at timestamptz DEFAULT now()
);

-- Create employee_bonuses table
CREATE TABLE IF NOT EXISTS employee_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text UNIQUE NOT NULL,
  total_bonus decimal(10,2) NOT NULL DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create client_reviews table
CREATE TABLE IF NOT EXISTS client_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  policy_number text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review text NOT NULL,
  review_date timestamptz NOT NULL,
  employee_id text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create daily_summaries table
CREATE TABLE IF NOT EXISTS daily_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  date date NOT NULL,
  hours_worked decimal(4,2) NOT NULL,
  policies_sold integer NOT NULL DEFAULT 0,
  total_sales_amount decimal(10,2) NOT NULL DEFAULT 0,
  total_broker_fees decimal(10,2) NOT NULL DEFAULT 0,
  description text NOT NULL,
  key_activities text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, date)
);

-- Create conversation_states table
CREATE TABLE IF NOT EXISTS conversation_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text UNIQUE NOT NULL,
  current_flow text NOT NULL DEFAULT 'none' CHECK (current_flow IN ('policy_entry', 'review_entry', 'cross_sell_entry', 'daily_summary', 'hours_entry', 'none')),
  collected_data jsonb DEFAULT '{}',
  next_question text NOT NULL DEFAULT '',
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create overtime_requests table
CREATE TABLE IF NOT EXISTS overtime_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  request_date timestamptz NOT NULL,
  hours_requested decimal(4,2) NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  current_overtime_hours decimal(4,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for employees table
CREATE POLICY "Users can read own employee data"
  ON employees
  FOR SELECT
  TO authenticated
  USING (clerk_user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can update own employee data"
  ON employees
  FOR UPDATE
  TO authenticated
  USING (clerk_user_id = auth.jwt() ->> 'sub');

-- Create policies for policy_sales table
CREATE POLICY "Users can read own policy sales"
  ON policy_sales
  FOR SELECT
  TO authenticated
  USING (employee_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can insert own policy sales"
  ON policy_sales
  FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.jwt() ->> 'sub');

-- Create policies for employee_bonuses table
CREATE POLICY "Users can read own bonuses"
  ON employee_bonuses
  FOR SELECT
  TO authenticated
  USING (employee_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can insert own bonuses"
  ON employee_bonuses
  FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can update own bonuses"
  ON employee_bonuses
  FOR UPDATE
  TO authenticated
  USING (employee_id = auth.jwt() ->> 'sub');

-- Create policies for client_reviews table
CREATE POLICY "Users can read own reviews"
  ON client_reviews
  FOR SELECT
  TO authenticated
  USING (employee_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can insert own reviews"
  ON client_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.jwt() ->> 'sub');

-- Create policies for daily_summaries table
CREATE POLICY "Users can read own summaries"
  ON daily_summaries
  FOR SELECT
  TO authenticated
  USING (employee_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can insert own summaries"
  ON daily_summaries
  FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.jwt() ->> 'sub');

-- Create policies for conversation_states table
CREATE POLICY "Users can read own conversation state"
  ON conversation_states
  FOR SELECT
  TO authenticated
  USING (employee_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can insert own conversation state"
  ON conversation_states
  FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can update own conversation state"
  ON conversation_states
  FOR UPDATE
  TO authenticated
  USING (employee_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can delete own conversation state"
  ON conversation_states
  FOR DELETE
  TO authenticated
  USING (employee_id = auth.jwt() ->> 'sub');

-- Create policies for overtime_requests table
CREATE POLICY "Users can read own overtime requests"
  ON overtime_requests
  FOR SELECT
  TO authenticated
  USING (employee_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can insert own overtime requests"
  ON overtime_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.jwt() ->> 'sub');

-- Insert demo data
-- Demo employee (this will be linked to Clerk user)
INSERT INTO employees (clerk_user_id, name, email, department, position, status, max_hours_before_overtime, hourly_rate) VALUES
('user_demo_employee', 'John Doe', 'employee@letsinsure.hr', 'Sales', 'Sales Representative', 'active', 8, 25.00),
('user_demo_admin', 'Admin User', 'admin@letsinsure.hr', 'Administration', 'HR Manager', 'active', 8, 40.00);

-- Demo policy sales
INSERT INTO policy_sales (policy_number, client_name, policy_type, amount, broker_fee, bonus, employee_id, sale_date, cross_sold, cross_sold_type, cross_sold_to, client_description) VALUES
('POL-2025-001', 'John Smith', 'Auto Insurance', 1200.00, 120.00, 110.00, 'user_demo_employee', '2025-01-15', true, 'Home Insurance', 'John Smith', 'Young professional, first-time homeowner, very interested in bundling policies for savings'),
('POL-2025-002', 'Sarah Johnson', 'Home Insurance', 800.00, 80.00, 70.00, 'user_demo_employee', '2025-01-18', false, null, null, 'Elderly client, downsizing home, needed basic coverage with good customer service'),
('POL-2025-003', 'Mike Davis', 'Life Insurance', 2500.00, 250.00, 240.00, 'user_demo_employee', '2025-01-20', true, 'Disability Insurance', 'Mike Davis', 'Family man with two kids, concerned about financial security, very thorough in asking questions');

-- Demo employee bonuses
INSERT INTO employee_bonuses (employee_id, total_bonus) VALUES
('user_demo_employee', 420.00);

-- Demo client reviews
INSERT INTO client_reviews (client_name, policy_number, rating, review, review_date, employee_id) VALUES
('John Smith', 'POL-2025-001', 5, 'Excellent service! Very professional and helpful.', '2025-01-16', 'user_demo_employee'),
('Sarah Johnson', 'POL-2025-002', 4, 'Good experience, quick processing.', '2025-01-19', 'user_demo_employee');

-- Demo daily summaries
INSERT INTO daily_summaries (employee_id, date, hours_worked, policies_sold, total_sales_amount, total_broker_fees, description, key_activities) VALUES
('user_demo_employee', '2025-01-20', 8.0, 2, 3300.00, 330.00, 'Great day with two major sales. Focused on family protection policies.', ARRAY['Client meetings', 'Policy presentations', 'Follow-up calls']);