-- supabase/migrations/20250615100000_fix_rls_policies.sql

-- This migration fixes the Row Level Security (RLS) policies for the `time_logs` table.
-- The previous policies caused "failed to check in" errors due to a type mismatch
-- when comparing the `employee_id` (text) with the authenticated user's ID.

-- This version uses `auth.jwt() ->> 'sub'` to correctly get the user's ID as `text`.

-- Step 1: Drop the old, incorrect policies to ensure a clean slate.
DROP POLICY IF EXISTS "Users can read/write own time logs" ON time_logs;
DROP POLICY IF EXISTS "Admin can read all time logs" ON time_logs;

-- Step 2: Create the new, correct policy for users.
-- This policy allows authenticated users to perform all actions on rows in `time_logs`
-- where the `employee_id` matches their own user ID from the authentication token.
-- The `WITH CHECK` clause is crucial to prevent a user from creating logs for another user.
CREATE POLICY "Users can read/write own time logs" ON time_logs
  FOR ALL TO authenticated
  USING (employee_id = (auth.jwt() ->> 'sub'))
  WITH CHECK (employee_id = (auth.jwt() ->> 'sub'));

-- Step 3: Create the policy for administrators.
-- This allows users who are admins to view all records in the `time_logs` table.
CREATE POLICY "Admin can read all time logs" ON time_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE
        clerk_user_id = (auth.jwt() ->> 'sub') AND
        (email = 'admin@letsinsure.hr' OR position = 'HR Manager')
    )
  );

-- Step 4: Apply the same consistent policies to `chat_messages`.
DROP POLICY IF EXISTS "Users can read/write own chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Admin can read all chat messages" ON chat_messages;

CREATE POLICY "Users can read/write own chat messages" ON chat_messages
  FOR ALL TO authenticated
  USING (user_id = (auth.jwt() ->> 'sub'))
  WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "Admin can read all chat messages" ON chat_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE
        clerk_user_id = (auth.jwt() ->> 'sub') AND
        (email = 'admin@letsinsure.hr' OR position = 'HR Manager')
    )
  ); 