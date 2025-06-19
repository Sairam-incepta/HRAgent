-- Drop existing time_logs policies
DROP POLICY IF EXISTS "Users can read/write own time logs" ON time_logs;
DROP POLICY IF EXISTS "Admin can read all time logs" ON time_logs;

-- Create new policies for time_logs with proper type casting
CREATE POLICY "Users can read/write own time logs" ON time_logs
  FOR ALL TO authenticated
  USING (
    employee_id = (
      SELECT clerk_user_id::text 
      FROM employees 
      WHERE clerk_user_id = auth.uid()::text
    )
  );

CREATE POLICY "Admin can read all time logs" ON time_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM employees 
      WHERE clerk_user_id = auth.uid()::text
      AND (email = 'admin@letsinsure.hr' OR position = 'HR Manager')
    )
  );

-- Verify the policies
SELECT * FROM pg_policies WHERE tablename = 'time_logs'; 