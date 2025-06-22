-- ============================================
-- FINAL DATABASE UPDATE SCRIPT
-- ============================================

-- Fix schema issues first
ALTER TABLE daily_summaries ALTER COLUMN key_activities SET DEFAULT '{}';

-- Disable Row Level Security for all tables
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
ALTER TABLE IF EXISTS password_resets DISABLE ROW LEVEL SECURITY;

-- Add missing columns
DO $$ 
BEGIN
    -- Add policy_type column to high_value_policy_notifications
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'high_value_policy_notifications' 
                   AND column_name = 'policy_type') THEN
        ALTER TABLE high_value_policy_notifications ADD COLUMN policy_type TEXT;
    END IF;
    
    -- Add updated_at column to client_reviews
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'client_reviews' 
                   AND column_name = 'updated_at') THEN
        ALTER TABLE client_reviews ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    -- Add biweekly period columns to high_value_policy_notifications
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'high_value_policy_notifications' 
                   AND column_name = 'biweekly_period_start') THEN
        ALTER TABLE high_value_policy_notifications ADD COLUMN biweekly_period_start DATE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'high_value_policy_notifications' 
                   AND column_name = 'biweekly_period_end') THEN
        ALTER TABLE high_value_policy_notifications ADD COLUMN biweekly_period_end DATE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'high_value_policy_notifications' 
                   AND column_name = 'is_editable') THEN
        ALTER TABLE high_value_policy_notifications ADD COLUMN is_editable BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- Create performance indexes
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

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- Display summary
SELECT 'Database update completed successfully!' as status;
SELECT COUNT(*) as high_value_notifications FROM high_value_policy_notifications;
SELECT COUNT(*) as policy_sales FROM policy_sales;
SELECT COUNT(*) as employees FROM employees; 