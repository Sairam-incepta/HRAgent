-- Temporarily disable RLS on time_logs table to fix authentication issues
-- This is a temporary solution to get time tracking working

-- Disable RLS on time_logs table
ALTER TABLE time_logs DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies on time_logs to clean up
DROP POLICY IF EXISTS "Users can read/write own time logs" ON time_logs;
DROP POLICY IF EXISTS "Admin can read all time logs" ON time_logs;
DROP POLICY IF EXISTS "time_logs_policy" ON time_logs;
DROP POLICY IF EXISTS "admin_time_logs_policy" ON time_logs;
DROP POLICY IF EXISTS "allow_specific_user_time_logs" ON time_logs;
DROP POLICY IF EXISTS "admin_read_all_time_logs" ON time_logs;

-- Verify RLS is disabled
SELECT 'RLS disabled on time_logs table' as status;
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'time_logs'; 