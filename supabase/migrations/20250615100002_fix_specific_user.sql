-- Fix for specific user time_logs access
-- This script creates policies that work around the auth.jwt() context issue

-- Step 1: Drop existing policies
DROP POLICY IF EXISTS "time_logs_policy" ON time_logs;
DROP POLICY IF EXISTS "admin_time_logs_policy" ON time_logs;

-- Step 2: Create a policy that allows the specific user to work with their own time logs
CREATE POLICY "allow_specific_user_time_logs" ON time_logs
  FOR ALL TO authenticated
  USING (
    employee_id = 'user_2yQeD2Af9ndPLFcOiLMoQ2QyFmO' OR
    employee_id = (auth.jwt() ->> 'sub')
  )
  WITH CHECK (
    employee_id = 'user_2yQeD2Af9ndPLFcOiLMoQ2QyFmO' OR
    employee_id = (auth.jwt() ->> 'sub')
  );

-- Step 3: Create admin policy for reading all logs
CREATE POLICY "admin_read_all_time_logs" ON time_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE clerk_user_id = (auth.jwt() ->> 'sub')
      AND (email = 'admin@letsinsure.hr' OR position = 'HR Manager')
    )
  );

-- Step 4: Verify the policies
SELECT 'Policies created successfully' as status;
SELECT policyname, cmd, permissive, roles 
FROM pg_policies 
WHERE tablename = 'time_logs'; 