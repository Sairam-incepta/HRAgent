-- ============================================
-- RESET DATABASE FOR DEPLOYMENT
-- Only keep salar@letsinsure.org as admin
-- ============================================

-- Start transaction
BEGIN;

-- Clear all existing data (except the admin user we want to keep)
DELETE FROM chat_messages;
DELETE FROM conversation_states;
DELETE FROM bonus_events;
DELETE FROM employee_bonuses;
DELETE FROM high_value_policy_notifications;
DELETE FROM overtime_requests;
DELETE FROM requests;
DELETE FROM daily_summaries;
DELETE FROM client_reviews;
DELETE FROM policy_sales;
DELETE FROM time_logs;
DELETE FROM password_resets;

-- Delete all employees except salar@letsinsure.org
DELETE FROM employees 
WHERE email != 'salar@letsinsure.org';

-- Update salar@letsinsure.org to ensure admin role and correct details
UPDATE employees 
SET 
    name = 'Salar Admin',
    department = 'Administration',
    position = 'Administrator',
    status = 'active',
    role = 'admin',
    hourly_rate = 50.00,
    max_hours_before_overtime = 40,
    updated_at = NOW()
WHERE email = 'salar@letsinsure.org';

-- If salar@letsinsure.org doesn't exist, create it
INSERT INTO employees (
    clerk_user_id,
    name,
    email,
    department,
    position,
    status,
    role,
    hourly_rate,
    max_hours_before_overtime,
    created_at,
    updated_at
)
SELECT 
    'admin_salar_lets_insure',
    'Salar Admin',
    'salar@letsinsure.org',
    'Administration',
    'Administrator',
    'active',
    'admin',
    50.00,
    40,
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM employees WHERE email = 'salar@letsinsure.org'
);

-- Reset all sequences to start fresh
SELECT setval('employees_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM employees));
SELECT setval('policy_sales_id_seq', 1);
SELECT setval('client_reviews_id_seq', 1);
SELECT setval('daily_summaries_id_seq', 1);
SELECT setval('time_logs_id_seq', 1);
SELECT setval('requests_id_seq', 1);
SELECT setval('overtime_requests_id_seq', 1);
SELECT setval('high_value_policy_notifications_id_seq', 1);
SELECT setval('conversation_states_id_seq', 1);
SELECT setval('employee_bonuses_id_seq', 1);
SELECT setval('bonus_events_id_seq', 1);
SELECT setval('chat_messages_id_seq', 1);
SELECT setval('password_resets_id_seq', 1);

-- Ensure all necessary columns exist and have correct defaults
DO $$ 
BEGIN
    -- Add step column to conversation_states if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'conversation_states' 
                   AND column_name = 'step') THEN
        ALTER TABLE conversation_states ADD COLUMN step INTEGER DEFAULT 1;
    END IF;
    
    -- Add role column to employees if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' 
                   AND column_name = 'role') THEN
        ALTER TABLE employees ADD COLUMN role TEXT DEFAULT 'employee';
    END IF;
    
    -- Add updated_at column to employees if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' 
                   AND column_name = 'updated_at') THEN
        ALTER TABLE employees ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Ensure RLS is disabled for all tables
ALTER TABLE IF EXISTS employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS policy_sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS client_reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS daily_summaries DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS time_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS overtime_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS high_value_policy_notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS conversation_states DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS employee_bonuses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bonus_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS password_resets DISABLE ROW LEVEL SECURITY;

-- Create or update the updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create updated_at trigger for employees table
DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
CREATE TRIGGER update_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Commit transaction
COMMIT;

-- Display final state
SELECT 
    'Database reset complete. Admin user:' as message,
    name,
    email,
    department,
    position,
    role,
    status
FROM employees 
WHERE email = 'salar@letsinsure.org';

-- Show table counts
SELECT 
    'employees' as table_name, 
    COUNT(*) as record_count 
FROM employees
UNION ALL
SELECT 'policy_sales', COUNT(*) FROM policy_sales
UNION ALL
SELECT 'client_reviews', COUNT(*) FROM client_reviews
UNION ALL
SELECT 'daily_summaries', COUNT(*) FROM daily_summaries
UNION ALL
SELECT 'time_logs', COUNT(*) FROM time_logs
UNION ALL
SELECT 'requests', COUNT(*) FROM requests
UNION ALL
SELECT 'overtime_requests', COUNT(*) FROM overtime_requests
UNION ALL
SELECT 'high_value_policy_notifications', COUNT(*) FROM high_value_policy_notifications
UNION ALL
SELECT 'conversation_states', COUNT(*) FROM conversation_states
UNION ALL
SELECT 'employee_bonuses', COUNT(*) FROM employee_bonuses
UNION ALL
SELECT 'bonus_events', COUNT(*) FROM bonus_events
UNION ALL
SELECT 'chat_messages', COUNT(*) FROM chat_messages
UNION ALL
SELECT 'password_resets', COUNT(*) FROM password_resets
ORDER BY table_name; 