-- Add time_logs table for multiple clock in/out sessions per day
CREATE TABLE IF NOT EXISTS time_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  date date NOT NULL,
  clock_in timestamptz NOT NULL,
  clock_out timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_time_logs_employee_id_date ON time_logs(employee_id, date);

-- Add chat_messages table for persistent chat
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'employee', 'bot')),
  content text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id_timestamp ON chat_messages(user_id, timestamp DESC);

-- RLS for time_logs
ALTER TABLE time_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read/write own time logs" ON time_logs;
DROP POLICY IF EXISTS "Admin can read all time logs" ON time_logs;

CREATE POLICY "Users can read/write own time logs" ON time_logs
  FOR ALL TO authenticated
  USING (employee_id = (SELECT auth.jwt() ->> 'sub'));

CREATE POLICY "Admin can read all time logs" ON time_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM employees WHERE clerk_user_id = (SELECT auth.jwt() ->> 'sub') AND (email = 'admin@letsinsure.hr' OR position = 'HR Manager')));

-- RLS for chat_messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read/write own chat messages" ON chat_messages
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.jwt() ->> 'sub'));
CREATE POLICY "Admin can read all chat messages" ON chat_messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM employees WHERE clerk_user_id = (SELECT auth.jwt() ->> 'sub') AND (email = 'admin@letsinsure.hr' OR position = 'HR Manager'))); 