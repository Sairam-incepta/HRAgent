-- Database Updates for HR Agent Application
-- Run this in your Supabase Dashboard > SQL Editor
-- This script disables RLS and fixes all database issues

-- ============================================
-- DISABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================

ALTER TABLE IF EXISTS employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS policy_sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS client_reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS daily_summaries DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS time_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS overtime_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS high_value_policy_notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS conversation_states DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS employee_bonuses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bonus_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS password_resets DISABLE ROW LEVEL SECURITY;

-- ============================================
-- DROP ALL EXISTING RLS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Admin can manage all employees" ON employees;
DROP POLICY IF EXISTS "Users can view own employee record" ON employees;
DROP POLICY IF EXISTS "Admin can manage policy sales" ON policy_sales;
DROP POLICY IF EXISTS "Users can view own policy sales" ON policy_sales;
DROP POLICY IF EXISTS "Admin can manage client reviews" ON client_reviews;
DROP POLICY IF EXISTS "Users can view own client reviews" ON client_reviews;
DROP POLICY IF EXISTS "Admin can manage daily summaries" ON daily_summaries;
DROP POLICY IF EXISTS "Users can view own daily summaries" ON daily_summaries;
DROP POLICY IF EXISTS "Admin can manage time logs" ON time_logs;
DROP POLICY IF EXISTS "Users can view own time logs" ON time_logs;
DROP POLICY IF EXISTS "Admin can manage requests" ON requests;
DROP POLICY IF EXISTS "Users can view own requests" ON requests;
DROP POLICY IF EXISTS "Admin can manage overtime requests" ON overtime_requests;
DROP POLICY IF EXISTS "Users can view own overtime requests" ON overtime_requests;
DROP POLICY IF EXISTS "Admin can manage notifications" ON high_value_policy_notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON high_value_policy_notifications;
DROP POLICY IF EXISTS "Admin can manage chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can view own chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Admin can manage conversation states" ON conversation_states;
DROP POLICY IF EXISTS "Users can view own conversation states" ON conversation_states;
DROP POLICY IF EXISTS "Admin can manage employee bonuses" ON employee_bonuses;
DROP POLICY IF EXISTS "Users can view own employee bonuses" ON employee_bonuses;
DROP POLICY IF EXISTS "Admin can manage bonus events" ON bonus_events;
DROP POLICY IF EXISTS "Users can view own bonus events" ON bonus_events;
DROP POLICY IF EXISTS "Admin can manage password resets" ON password_resets;

-- ============================================
-- ENSURE ALL REQUIRED COLUMNS EXIST
-- ============================================

-- Add missing columns to policy_sales if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'policy_sales' 
                   AND column_name = 'is_cross_sold_policy') THEN
        ALTER TABLE policy_sales ADD COLUMN is_cross_sold_policy boolean DEFAULT false;
    END IF;
END $$;

-- Add missing columns to client_reviews if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'client_reviews' 
                   AND column_name = 'bonus') THEN
        ALTER TABLE client_reviews ADD COLUMN bonus DECIMAL(10,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'client_reviews' 
                   AND column_name = 'updated_at') THEN
        ALTER TABLE client_reviews ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Ensure high_value_policy_notifications has all required columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'high_value_policy_notifications' 
                   AND column_name = 'client_name') THEN
        ALTER TABLE high_value_policy_notifications ADD COLUMN client_name TEXT;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'high_value_policy_notifications' 
                   AND column_name = 'policy_id') THEN
        ALTER TABLE high_value_policy_notifications ADD COLUMN policy_id UUID;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'high_value_policy_notifications' 
                   AND column_name = 'employee_name') THEN
        ALTER TABLE high_value_policy_notifications ADD COLUMN employee_name TEXT;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'high_value_policy_notifications' 
                   AND column_name = 'reviewed_by') THEN
        ALTER TABLE high_value_policy_notifications ADD COLUMN reviewed_by TEXT;
    END IF;
END $$;

-- Add biweekly period management columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'high_value_policy_notifications' 
                   AND column_name = 'biweekly_period_start') THEN
        ALTER TABLE high_value_policy_notifications ADD COLUMN biweekly_period_start TIMESTAMPTZ;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'high_value_policy_notifications' 
                   AND column_name = 'biweekly_period_end') THEN
        ALTER TABLE high_value_policy_notifications ADD COLUMN biweekly_period_end TIMESTAMPTZ;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'high_value_policy_notifications' 
                   AND column_name = 'is_editable') THEN
        ALTER TABLE high_value_policy_notifications ADD COLUMN is_editable BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'high_value_policy_notifications' 
                   AND column_name = 'policy_type') THEN
        ALTER TABLE high_value_policy_notifications ADD COLUMN policy_type TEXT;
    END IF;
END $$;

-- ============================================
-- UPDATE EXISTING DATA
-- ============================================

-- Update existing policy sales data
UPDATE policy_sales 
SET is_cross_sold_policy = true 
WHERE cross_sold = true AND is_cross_sold_policy IS NULL;

UPDATE policy_sales 
SET is_cross_sold_policy = false 
WHERE is_cross_sold_policy IS NULL;

-- ============================================
-- CREATE PERFORMANCE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_policy_sales_amount ON policy_sales(amount);
CREATE INDEX IF NOT EXISTS idx_policy_sales_employee_id ON policy_sales(employee_id);
CREATE INDEX IF NOT EXISTS idx_high_value_notifications_status ON high_value_policy_notifications(status);
CREATE INDEX IF NOT EXISTS idx_employees_clerk_user_id ON employees(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_employee_id ON time_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_requests_employee_id ON requests(employee_id);

-- ============================================
-- CREATE TRIGGER FOR HIGH-VALUE NOTIFICATIONS
-- ============================================

-- Create trigger function to automatically create high-value policy notifications
CREATE OR REPLACE FUNCTION create_high_value_notification()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create notification for policies over $5,000
    IF NEW.amount > 5000 THEN
        INSERT INTO high_value_policy_notifications (
            employee_id,
            policy_number,
            policy_amount,
            broker_fee,
            current_bonus,
            is_cross_sold_policy,
            status,
            client_name,
            policy_id,
            biweekly_period_start,
            biweekly_period_end,
            created_at
        ) VALUES (
            NEW.employee_id,
            NEW.policy_number,
            NEW.amount,
            NEW.broker_fee,
            NEW.bonus,
            COALESCE(NEW.is_cross_sold_policy, FALSE),
            'pending',
            NEW.client_name,
            NEW.id,
            -- Start of current biweekly period (most recent Monday)
            date_trunc('week', CURRENT_DATE) - INTERVAL '1 week' * (EXTRACT(week FROM CURRENT_DATE)::INTEGER % 2),
            -- End of current biweekly period (Sunday after next)
            date_trunc('week', CURRENT_DATE) - INTERVAL '1 week' * (EXTRACT(week FROM CURRENT_DATE)::INTEGER % 2) + INTERVAL '13 days',
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on policy_sales table
DROP TRIGGER IF EXISTS trigger_high_value_notification ON policy_sales;
CREATE TRIGGER trigger_high_value_notification
    AFTER INSERT ON policy_sales
    FOR EACH ROW
    EXECUTE FUNCTION create_high_value_notification();

-- ============================================
-- CREATE NOTIFICATIONS FOR EXISTING HIGH-VALUE POLICIES
-- ============================================

-- Create notifications for existing high-value policies (only if they don't exist)
INSERT INTO high_value_policy_notifications (
    policy_id,
    policy_number,
    client_name,
    policy_amount,
    broker_fee,
    current_bonus,
    employee_id,
    employee_name,
    is_cross_sold_policy,
    status
)
SELECT 
    ps.id,
    ps.policy_number,
    ps.client_name,
    ps.amount,
    ps.broker_fee,
    ps.bonus,
    ps.employee_id,
    COALESCE(e.name, 'Unknown Employee'),
    ps.is_cross_sold_policy,
    'pending'
FROM policy_sales ps
LEFT JOIN employees e ON e.clerk_user_id = ps.employee_id
WHERE ps.amount > 5000
AND NOT EXISTS (
    SELECT 1 FROM high_value_policy_notifications hvpn 
    WHERE hvpn.policy_number = ps.policy_number
);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Show summary of what was created/updated
SELECT 
    'RLS Status' as check_type,
    'All tables have RLS disabled' as result
UNION ALL
SELECT 
    'High-value notifications' as check_type,
    COUNT(*)::text || ' notifications exist' as result
FROM high_value_policy_notifications
UNION ALL
SELECT 
    'Policy sales with cross-sold flag' as check_type,
    COUNT(*)::text || ' policies marked' as result
FROM policy_sales 
WHERE is_cross_sold_policy = true
UNION ALL
SELECT 
    'Total employees' as check_type,
    COUNT(*)::text || ' employees in system' as result
FROM employees
UNION ALL
SELECT 
    'Total policy sales' as check_type,
    COUNT(*)::text || ' total policies' as result
FROM policy_sales;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
    RAISE NOTICE 'Database update completed successfully!';
    RAISE NOTICE 'RLS has been disabled on all tables.';
    RAISE NOTICE 'Employee creation should now work properly.';
    RAISE NOTICE 'High-value policy notifications are set up.';
END $$;

-- ============================================
-- BIWEEKLY PERIOD MANAGEMENT FUNCTIONS
-- ============================================

-- Function to close biweekly periods and make policies non-editable
CREATE OR REPLACE FUNCTION close_expired_biweekly_periods()
RETURNS void AS $$
BEGIN
    -- Mark policies as non-editable if their biweekly period has ended
    UPDATE high_value_policy_notifications 
    SET is_editable = false
    WHERE biweekly_period_end < CURRENT_DATE 
    AND is_editable = true;
    
    -- Set admin_bonus to 0 for policies that weren't assigned bonuses before period end
    UPDATE high_value_policy_notifications 
    SET admin_bonus = 0
    WHERE biweekly_period_end < CURRENT_DATE 
    AND admin_bonus IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to check if biweekly period end notification should be sent
CREATE OR REPLACE FUNCTION should_send_period_end_notification()
RETURNS boolean AS $$
DECLARE
    policies_needing_review integer;
    days_until_period_end integer;
BEGIN
    -- Find policies with biweekly periods ending in 1-2 days that haven't been reviewed
    SELECT COUNT(*), 
           MIN(biweekly_period_end - CURRENT_DATE)
    INTO policies_needing_review, days_until_period_end
    FROM high_value_policy_notifications
    WHERE biweekly_period_end BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 2
    AND status = 'pending'
    AND is_editable = true;
    
    -- Send notification if there are policies needing review and 1-2 days left
    RETURN policies_needing_review > 0 AND days_until_period_end BETWEEN 1 AND 2;
END;
$$ LANGUAGE plpgsql;

-- Function to get policies requiring urgent review (period ending soon)
CREATE OR REPLACE FUNCTION get_urgent_review_policies()
RETURNS TABLE(
    policy_count integer,
    days_remaining integer,
    period_end date
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::integer as policy_count,
        MIN(biweekly_period_end - CURRENT_DATE)::integer as days_remaining,
        MIN(biweekly_period_end) as period_end
    FROM high_value_policy_notifications
    WHERE biweekly_period_end BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 2
    AND status = 'pending'
    AND is_editable = true
    HAVING COUNT(*) > 0;
END;
$$ LANGUAGE plpgsql;

-- Update status column constraint to include 'resolved'
DO $$ 
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (SELECT 1 FROM information_schema.check_constraints 
               WHERE constraint_name = 'high_value_policy_notifications_status_check') THEN
        ALTER TABLE high_value_policy_notifications DROP CONSTRAINT high_value_policy_notifications_status_check;
    END IF;
    
    -- Add new constraint with 'resolved' status
    ALTER TABLE high_value_policy_notifications 
    ADD CONSTRAINT high_value_policy_notifications_status_check 
    CHECK (status IN ('pending', 'reviewed', 'resolved'));
END $$;

-- Add missing columns to daily_summaries table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'daily_summaries' AND column_name = 'high_networth_policy_count') THEN
        ALTER TABLE daily_summaries ADD COLUMN high_networth_policy_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add missing columns to policy_sales table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'policy_sales' AND column_name = 'is_cross_sold_policy') THEN
        ALTER TABLE policy_sales ADD COLUMN is_cross_sold_policy BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add missing indexes for better performance
CREATE INDEX IF NOT EXISTS idx_policy_sales_employee_id ON policy_sales(employee_id);
CREATE INDEX IF NOT EXISTS idx_policy_sales_sale_date ON policy_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_policy_sales_amount ON policy_sales(amount);
CREATE INDEX IF NOT EXISTS idx_client_reviews_employee_id ON client_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_client_reviews_rating ON client_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_high_value_notifications_employee_id ON high_value_policy_notifications(employee_id);
CREATE INDEX IF NOT EXISTS idx_high_value_notifications_status ON high_value_policy_notifications(status);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_employee_id ON daily_summaries(employee_id);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_summaries(date);
CREATE INDEX IF NOT EXISTS idx_time_logs_employee_id ON time_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_date ON time_logs(date);

-- Create function to get current biweekly period info
CREATE OR REPLACE FUNCTION get_current_biweekly_period()
RETURNS TABLE(
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    days_remaining INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        date_trunc('week', CURRENT_DATE) - INTERVAL '1 week' * (EXTRACT(week FROM CURRENT_DATE)::INTEGER % 2) as period_start,
        date_trunc('week', CURRENT_DATE) - INTERVAL '1 week' * (EXTRACT(week FROM CURRENT_DATE)::INTEGER % 2) + INTERVAL '13 days' as period_end,
        EXTRACT(days FROM (date_trunc('week', CURRENT_DATE) - INTERVAL '1 week' * (EXTRACT(week FROM CURRENT_DATE)::INTEGER % 2) + INTERVAL '13 days') - CURRENT_DATE)::INTEGER as days_remaining;
END;
$$ LANGUAGE plpgsql;

-- Update existing high-value policy notifications with biweekly periods if they don't have them
UPDATE high_value_policy_notifications 
SET 
    biweekly_period_start = date_trunc('week', CURRENT_DATE) - INTERVAL '1 week' * (EXTRACT(week FROM CURRENT_DATE)::INTEGER % 2),
    biweekly_period_end = date_trunc('week', CURRENT_DATE) - INTERVAL '1 week' * (EXTRACT(week FROM CURRENT_DATE)::INTEGER % 2) + INTERVAL '13 days'
WHERE biweekly_period_start IS NULL OR biweekly_period_end IS NULL;

-- Display current status
SELECT 'RLS Status Check' as info;
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'employees', 
    'policy_sales', 
    'client_reviews', 
    'daily_summaries', 
    'time_logs', 
    'requests', 
    'overtime_requests', 
    'high_value_policy_notifications', 
    'chat_messages', 
    'conversation_states', 
    'employee_bonuses', 
    'bonus_events', 
    'password_resets'
)
ORDER BY tablename;

SELECT 'High-Value Policy Notifications Count' as info;
SELECT COUNT(*) as notification_count FROM high_value_policy_notifications;

SELECT 'Employee Count' as info;
SELECT COUNT(*) as employee_count FROM employees;

SELECT 'Total Policy Sales Count' as info;
SELECT COUNT(*) as total_policies FROM policy_sales;

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_client_reviews_updated_at ON client_reviews;
CREATE TRIGGER update_client_reviews_updated_at
    BEFORE UPDATE ON client_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
CREATE TRIGGER update_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_time_logs_updated_at ON time_logs;
CREATE TRIGGER update_time_logs_updated_at
    BEFORE UPDATE ON time_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_requests_updated_at ON requests;
CREATE TRIGGER update_requests_updated_at
    BEFORE UPDATE ON requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_overtime_requests_updated_at ON overtime_requests;
CREATE TRIGGER update_overtime_requests_updated_at
    BEFORE UPDATE ON overtime_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Note: chat_messages table doesn't have updated_at column in schema

DROP TRIGGER IF EXISTS update_conversation_states_updated_at ON conversation_states;
CREATE TRIGGER update_conversation_states_updated_at
    BEFORE UPDATE ON conversation_states
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_employee_bonuses_updated_at ON employee_bonuses;
CREATE TRIGGER update_employee_bonuses_updated_at
    BEFORE UPDATE ON employee_bonuses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Note: bonus_events table doesn't have updated_at column in schema

-- Note: password_resets table doesn't have updated_at column in schema

-- Note: policy_sales table doesn't have biweekly_period columns in current schema

-- Update biweekly periods for existing high-value policy notifications
UPDATE high_value_policy_notifications 
SET 
    biweekly_period_start = CASE 
        WHEN EXTRACT(DOW FROM created_at) >= 1 THEN -- Monday or later
            created_at::date - INTERVAL '1 day' * (EXTRACT(DOW FROM created_at) - 1)
        ELSE -- Sunday
            created_at::date - INTERVAL '6 days'
    END,
    biweekly_period_end = CASE 
        WHEN EXTRACT(DOW FROM created_at) >= 1 THEN -- Monday or later
            created_at::date - INTERVAL '1 day' * (EXTRACT(DOW FROM created_at) - 1) + INTERVAL '13 days'
        ELSE -- Sunday
            created_at::date - INTERVAL '6 days' + INTERVAL '13 days'
    END
WHERE biweekly_period_start IS NULL OR biweekly_period_end IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_employees_clerk_user_id ON employees(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_position ON employees(position);
CREATE INDEX IF NOT EXISTS idx_employees_created_at ON employees(created_at);

CREATE INDEX IF NOT EXISTS idx_policy_sales_employee_id ON policy_sales(employee_id);
CREATE INDEX IF NOT EXISTS idx_policy_sales_sale_date ON policy_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_policy_sales_policy_type ON policy_sales(policy_type);
CREATE INDEX IF NOT EXISTS idx_policy_sales_amount ON policy_sales(amount);
CREATE INDEX IF NOT EXISTS idx_policy_sales_cross_sold ON policy_sales(cross_sold);
CREATE INDEX IF NOT EXISTS idx_policy_sales_is_cross_sold_policy ON policy_sales(is_cross_sold_policy);

CREATE INDEX IF NOT EXISTS idx_client_reviews_employee_id ON client_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_client_reviews_rating ON client_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_client_reviews_review_date ON client_reviews(review_date);

CREATE INDEX IF NOT EXISTS idx_daily_summaries_employee_id ON daily_summaries(employee_id);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_summaries(date);

CREATE INDEX IF NOT EXISTS idx_time_logs_employee_id ON time_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_date ON time_logs(date);
CREATE INDEX IF NOT EXISTS idx_time_logs_employee_date ON time_logs(employee_id, date);

CREATE INDEX IF NOT EXISTS idx_requests_employee_id ON requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);

CREATE INDEX IF NOT EXISTS idx_overtime_requests_employee_id ON overtime_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_overtime_requests_status ON overtime_requests(status);
CREATE INDEX IF NOT EXISTS idx_overtime_requests_request_date ON overtime_requests(request_date);

CREATE INDEX IF NOT EXISTS idx_high_value_policy_notifications_employee_id ON high_value_policy_notifications(employee_id);
CREATE INDEX IF NOT EXISTS idx_high_value_policy_notifications_status ON high_value_policy_notifications(status);
CREATE INDEX IF NOT EXISTS idx_high_value_policy_notifications_policy_amount ON high_value_policy_notifications(policy_amount);
CREATE INDEX IF NOT EXISTS idx_high_value_policy_notifications_biweekly_period ON high_value_policy_notifications(biweekly_period_start, biweekly_period_end);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_conversation_states_employee_id ON conversation_states(employee_id);
CREATE INDEX IF NOT EXISTS idx_conversation_states_current_flow ON conversation_states(current_flow);

CREATE INDEX IF NOT EXISTS idx_employee_bonuses_employee_id ON employee_bonuses(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_bonuses_last_updated ON employee_bonuses(last_updated);

CREATE INDEX IF NOT EXISTS idx_bonus_events_employee_id ON bonus_events(employee_id);
CREATE INDEX IF NOT EXISTS idx_bonus_events_created_at ON bonus_events(created_at);

CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);
CREATE INDEX IF NOT EXISTS idx_password_resets_created_at ON password_resets(created_at);

-- Create function to automatically create high-value policy notifications
CREATE OR REPLACE FUNCTION create_high_value_policy_notification()
RETURNS TRIGGER AS $$
DECLARE
    biweekly_start DATE;
    biweekly_end DATE;
BEGIN
    -- Only create notification for policies over $5000
    IF NEW.amount >= 5000 THEN
        -- Calculate biweekly period
        IF EXTRACT(DOW FROM NEW.sale_date) >= 1 THEN -- Monday or later
            biweekly_start := NEW.sale_date::date - INTERVAL '1 day' * (EXTRACT(DOW FROM NEW.sale_date) - 1);
        ELSE -- Sunday
            biweekly_start := NEW.sale_date::date - INTERVAL '6 days';
        END IF;
        
        biweekly_end := biweekly_start + INTERVAL '13 days';
        
        -- Insert high-value policy notification
        INSERT INTO high_value_policy_notifications (
            employee_id,
            policy_number,
            policy_type,
            policy_amount,
            broker_fee,
            current_bonus,
            admin_bonus,
            status,
            biweekly_period_start,
            biweekly_period_end,
            is_cross_sold_policy
        ) VALUES (
            NEW.employee_id,
            NEW.policy_number,
            NEW.policy_type,
            NEW.amount,
            NEW.broker_fee,
            NEW.bonus,
            0, -- Default admin bonus
            'pending',
            biweekly_start,
            biweekly_end,
            COALESCE(NEW.is_cross_sold_policy, FALSE)
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for high-value policy notifications
DROP TRIGGER IF EXISTS trigger_high_value_policy_notification ON policy_sales;
CREATE TRIGGER trigger_high_value_policy_notification
    AFTER INSERT ON policy_sales
    FOR EACH ROW
    EXECUTE FUNCTION create_high_value_policy_notification();

-- Display summary of changes
SELECT 
    'Tables with RLS disabled:' as info,
    array_to_string(ARRAY[
        'employees',
        'policy_sales', 
        'client_reviews',
        'daily_summaries',
        'time_logs',
        'requests',
        'overtime_requests',
        'high_value_policy_notifications',
        'chat_messages',
        'conversation_states',
        'employee_bonuses',
        'bonus_events',
        'password_resets'
    ], ', ') as tables;

SELECT 'High-value policy notifications:' as info, COUNT(*) as count FROM high_value_policy_notifications;
SELECT 'Employees:' as info, COUNT(*) as count FROM employees;
SELECT 'Policy sales:' as info, COUNT(*) as count FROM policy_sales;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema'; 