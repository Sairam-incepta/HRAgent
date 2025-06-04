-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clerk_id VARCHAR UNIQUE NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    name VARCHAR NOT NULL,
    employee_id VARCHAR UNIQUE,
    hourly_rate DECIMAL(10,2) DEFAULT 0,
    role VARCHAR DEFAULT 'employee',
    first_login BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Time logs table
CREATE TABLE IF NOT EXISTS time_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    clock_in TIMESTAMP WITH TIME ZONE,
    clock_out TIMESTAMP WITH TIME ZONE,
    lunch_start TIMESTAMP WITH TIME ZONE,
    lunch_end TIMESTAMP WITH TIME ZONE,
    total_hours DECIMAL(5,2),
    overtime_hours DECIMAL(5,2) DEFAULT 0,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Requests table
CREATE TABLE IF NOT EXISTS requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    type VARCHAR NOT NULL CHECK (type IN ('overtime', 'vacation')),
    reason TEXT,
    status VARCHAR DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_date DATE,
    approved_by UUID REFERENCES employees(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Policy sales table
CREATE TABLE IF NOT EXISTS policy_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    policy_id VARCHAR NOT NULL,
    policy_type VARCHAR,
    sale_amount DECIMAL(10,2),
    commission_amount DECIMAL(10,2),
    bonus_triggered BOOLEAN DEFAULT false,
    cancelled BOOLEAN DEFAULT false,
    conversation_log JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bonus events table
CREATE TABLE IF NOT EXISTS bonus_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    policy_sale_id UUID REFERENCES policy_sales(id),
    bonus_type VARCHAR,
    bonus_amount DECIMAL(10,2),
    status VARCHAR DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'paid')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Password resets table
CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR NOT NULL,
    otp VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_employees_clerk_id ON employees(clerk_id);
CREATE INDEX idx_time_logs_employee_date ON time_logs(employee_id, date);
CREATE INDEX idx_requests_employee_status ON requests(employee_id, status);
CREATE INDEX idx_policy_sales_employee ON policy_sales(employee_id);
CREATE INDEX idx_password_resets_email ON password_resets(email);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for employees table
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE
    ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();