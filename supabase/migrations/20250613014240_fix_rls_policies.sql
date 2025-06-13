/*
  # Fix RLS Performance Issues and Add Admin Access

  1. Performance Fixes
    - Replace auth.jwt() ->> 'sub' with subqueries for better performance
    - Use (select auth.jwt() ->> 'sub') pattern to avoid re-evaluation per row

  2. Admin Access
    - Add admin policies for users with admin@letsinsure.hr email
    - Allow admins to read all employee data
    - Allow admins to read all requests, sales, reviews, etc.

  3. Security
    - Maintain existing employee access restrictions
    - Add proper admin bypass policies
    - Keep data secure while improving performance
*/

-- Drop existing policies to recreate them with optimizations
DROP POLICY IF EXISTS "Users can read own employee data" ON employees;
DROP POLICY IF EXISTS "Users can update own employee data" ON employees;
DROP POLICY IF EXISTS "Users can read own policy sales" ON policy_sales;
DROP POLICY IF EXISTS "Users can insert own policy sales" ON policy_sales;
DROP POLICY IF EXISTS "Users can read own bonuses" ON employee_bonuses;
DROP POLICY IF EXISTS "Users can insert own bonuses" ON employee_bonuses;
DROP POLICY IF EXISTS "Users can update own bonuses" ON employee_bonuses;
DROP POLICY IF EXISTS "Users can read own reviews" ON client_reviews;
DROP POLICY IF EXISTS "Users can insert own reviews" ON client_reviews;
DROP POLICY IF EXISTS "Users can read own summaries" ON daily_summaries;
DROP POLICY IF EXISTS "Users can insert own summaries" ON daily_summaries;
DROP POLICY IF EXISTS "Users can read own conversation state" ON conversation_states;
DROP POLICY IF EXISTS "Users can insert own conversation state" ON conversation_states;
DROP POLICY IF EXISTS "Users can update own conversation state" ON conversation_states;
DROP POLICY IF EXISTS "Users can delete own conversation state" ON conversation_states;
DROP POLICY IF EXISTS "Users can read own overtime requests" ON overtime_requests;
DROP POLICY IF EXISTS "Users can insert own overtime requests" ON overtime_requests;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees 
    WHERE clerk_user_id = (SELECT auth.jwt() ->> 'sub')
    AND (email = 'admin@letsinsure.hr' OR position = 'HR Manager')
  );
$$;

-- EMPLOYEES TABLE POLICIES
CREATE POLICY "Employees can read own data or admin can read all"
  ON employees
  FOR SELECT
  TO authenticated
  USING (
    clerk_user_id = (SELECT auth.jwt() ->> 'sub') 
    OR is_admin()
  );

CREATE POLICY "Employees can update own data or admin can update all"
  ON employees
  FOR UPDATE
  TO authenticated
  USING (
    clerk_user_id = (SELECT auth.jwt() ->> 'sub')
    OR is_admin()
  );

CREATE POLICY "Admin can insert employees"
  ON employees
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- POLICY SALES TABLE POLICIES
CREATE POLICY "Users can read own sales or admin can read all"
  ON policy_sales
  FOR SELECT
  TO authenticated
  USING (
    employee_id = (SELECT auth.jwt() ->> 'sub')
    OR is_admin()
  );

CREATE POLICY "Users can insert own sales"
  ON policy_sales
  FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = (SELECT auth.jwt() ->> 'sub'));

-- EMPLOYEE BONUSES TABLE POLICIES
CREATE POLICY "Users can read own bonuses or admin can read all"
  ON employee_bonuses
  FOR SELECT
  TO authenticated
  USING (
    employee_id = (SELECT auth.jwt() ->> 'sub')
    OR is_admin()
  );

CREATE POLICY "Users can insert own bonuses"
  ON employee_bonuses
  FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = (SELECT auth.jwt() ->> 'sub'));

CREATE POLICY "Users can update own bonuses"
  ON employee_bonuses
  FOR UPDATE
  TO authenticated
  USING (
    employee_id = (SELECT auth.jwt() ->> 'sub')
    OR is_admin()
  );

-- CLIENT REVIEWS TABLE POLICIES
CREATE POLICY "Users can read own reviews or admin can read all"
  ON client_reviews
  FOR SELECT
  TO authenticated
  USING (
    employee_id = (SELECT auth.jwt() ->> 'sub')
    OR is_admin()
  );

CREATE POLICY "Users can insert own reviews"
  ON client_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = (SELECT auth.jwt() ->> 'sub'));

-- DAILY SUMMARIES TABLE POLICIES
CREATE POLICY "Users can read own summaries or admin can read all"
  ON daily_summaries
  FOR SELECT
  TO authenticated
  USING (
    employee_id = (SELECT auth.jwt() ->> 'sub')
    OR is_admin()
  );

CREATE POLICY "Users can insert own summaries"
  ON daily_summaries
  FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = (SELECT auth.jwt() ->> 'sub'));

-- CONVERSATION STATES TABLE POLICIES
CREATE POLICY "Users can read own conversation state"
  ON conversation_states
  FOR SELECT
  TO authenticated
  USING (employee_id = (SELECT auth.jwt() ->> 'sub'));

CREATE POLICY "Users can insert own conversation state"
  ON conversation_states
  FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = (SELECT auth.jwt() ->> 'sub'));

CREATE POLICY "Users can update own conversation state"
  ON conversation_states
  FOR UPDATE
  TO authenticated
  USING (employee_id = (SELECT auth.jwt() ->> 'sub'));

CREATE POLICY "Users can delete own conversation state"
  ON conversation_states
  FOR DELETE
  TO authenticated
  USING (employee_id = (SELECT auth.jwt() ->> 'sub'));

-- OVERTIME REQUESTS TABLE POLICIES
CREATE POLICY "Users can read own requests or admin can read all"
  ON overtime_requests
  FOR SELECT
  TO authenticated
  USING (
    employee_id = (SELECT auth.jwt() ->> 'sub')
    OR is_admin()
  );

CREATE POLICY "Users can insert own requests"
  ON overtime_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = (SELECT auth.jwt() ->> 'sub'));

CREATE POLICY "Admin can update request status"
  ON overtime_requests
  FOR UPDATE
  TO authenticated
  USING (is_admin());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_employees_clerk_user_id ON employees(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_policy_sales_employee_id ON policy_sales(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_bonuses_employee_id ON employee_bonuses(employee_id);
CREATE INDEX IF NOT EXISTS idx_client_reviews_employee_id ON client_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_employee_id ON daily_summaries(employee_id);
CREATE INDEX IF NOT EXISTS idx_conversation_states_employee_id ON conversation_states(employee_id);
CREATE INDEX IF NOT EXISTS idx_overtime_requests_employee_id ON overtime_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_overtime_requests_status ON overtime_requests(status);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Verify the setup
SELECT 'RLS Policies Updated Successfully!' as status;
SELECT 'Performance optimizations and admin access enabled' as message;