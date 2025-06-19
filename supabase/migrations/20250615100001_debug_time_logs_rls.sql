-- Comprehensive fix for time_logs RLS policy issues
-- This script will diagnose and fix the "new row violates row-level security policy" error

-- Step 1: First, let's see what's currently in the database
SELECT 'Current employees in database:' as info;
SELECT clerk_user_id, name, email, position FROM employees ORDER BY created_at DESC;

-- Step 2: Drop ALL existing policies on time_logs to start fresh
DROP POLICY IF EXISTS "Users can read own time logs" ON time_logs;
DROP POLICY IF EXISTS "Users can insert own time logs" ON time_logs;
DROP POLICY IF EXISTS "Users can update own time logs" ON time_logs;
DROP POLICY IF EXISTS "Users can delete own time logs" ON time_logs;
DROP POLICY IF EXISTS "Admin can read all time logs" ON time_logs;
DROP POLICY IF EXISTS "Users can read/write own time logs" ON time_logs;

-- Step 3: Temporarily disable RLS to test if the issue is with policies
ALTER TABLE time_logs DISABLE ROW LEVEL SECURITY;

-- Step 4: Create a simple test to verify the table structure
SELECT 'Testing table structure:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'time_logs' 
ORDER BY ordinal_position;

-- Step 5: Re-enable RLS
ALTER TABLE time_logs ENABLE ROW LEVEL SECURITY;

-- Step 6: Create a single, comprehensive policy that covers all operations
CREATE POLICY "time_logs_policy" ON time_logs
  FOR ALL TO authenticated
  USING (
    employee_id = (auth.jwt() ->> 'sub')
  )
  WITH CHECK (
    employee_id = (auth.jwt() ->> 'sub')
  );

-- Step 7: Create admin policy for reading all logs
CREATE POLICY "admin_time_logs_policy" ON time_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE clerk_user_id = (auth.jwt() ->> 'sub')
      AND (email = 'admin@letsinsure.hr' OR position = 'HR Manager')
    )
  );

-- Step 8: Verify the policies were created
SELECT 'Policies created:' as info;
SELECT policyname, cmd, permissive, roles 
FROM pg_policies 
WHERE tablename = 'time_logs';

-- Step 9: Test the authentication context
SELECT 'Current auth context test:' as info;
SELECT 
  (auth.jwt() ->> 'sub') as current_user_id,
  (auth.jwt() ->> 'email') as current_user_email;

-- Step 10: Verify the specific user exists
SELECT 'Verifying user exists:' as info;
SELECT 
  clerk_user_id,
  name,
  email,
  position,
  CASE 
    WHEN clerk_user_id = (auth.jwt() ->> 'sub') THEN 'MATCHES CURRENT USER'
    ELSE 'DOES NOT MATCH'
  END as user_match
FROM employees 
WHERE clerk_user_id = 'user_2yQeD2Af9ndPLFcOiLMoQ2QyFmO'; 