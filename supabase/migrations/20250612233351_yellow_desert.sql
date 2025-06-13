/*
  # Setup Production Users for LetsInsure HR System

  1. Clear Demo Data
    - Remove existing demo entries
    - Prepare for real user data

  2. Production Setup
    - Ready for 3 Clerk users (1 admin + 2 employees)
    - Clean slate for real data entry

  3. Notes
    - Run this after setting up your 3 Clerk users
    - Replace the clerk_user_id values with your actual Clerk user IDs
*/

-- Clear existing demo data
DELETE FROM conversation_states WHERE employee_id IN ('user_demo_employee', 'user_demo_admin');
DELETE FROM daily_summaries WHERE employee_id IN ('user_demo_employee', 'user_demo_admin');
DELETE FROM client_reviews WHERE employee_id IN ('user_demo_employee', 'user_demo_admin');
DELETE FROM employee_bonuses WHERE employee_id IN ('user_demo_employee', 'user_demo_admin');
DELETE FROM policy_sales WHERE employee_id IN ('user_demo_employee', 'user_demo_admin');
DELETE FROM overtime_requests WHERE employee_id IN ('user_demo_employee', 'user_demo_admin');
DELETE FROM employees WHERE clerk_user_id IN ('user_demo_employee', 'user_demo_admin');

-- Insert your 3 real users
-- IMPORTANT: Replace these clerk_user_id values with your actual Clerk user IDs

-- Admin User (replace 'your_admin_clerk_id' with actual Clerk user ID)
INSERT INTO employees (clerk_user_id, name, email, department, position, status, max_hours_before_overtime, hourly_rate) VALUES
('user_2y2ylH58JkmHljhJT0BXIfjHQui', 'Admin User', 'admin@example.com', 'Administration', 'HR Manager', 'active', 8, 40.00);

-- Employee 1 (replace 'your_employee1_clerk_id' with actual Clerk user ID)
INSERT INTO employees (clerk_user_id, name, email, department, position, status, max_hours_before_overtime, hourly_rate) VALUES
('user_2yQeD2Af9ndPLFcOiLMoQ2QyFmO', 'John Smith', 'emp@example.com', 'Sales', 'Sales Representative', 'active', 8, 25.00);

-- Employee 2 (replace 'your_employee2_clerk_id' with actual Clerk user ID)
INSERT INTO employees (clerk_user_id, name, email, department, position, status, max_hours_before_overtime, hourly_rate) VALUES
('user_2y2yiMOOj7TfqzywdIrEILnIkoS', 'Sarah Johnson', 'abc@example.com', 'Customer Service', 'Customer Service Representative', 'active', 8, 22.00);

-- Optional: Add one sample policy sale for Employee 1 to demonstrate the system
-- (replace 'your_employee1_clerk_id' with actual Clerk user ID)
INSERT INTO policy_sales (policy_number, client_name, policy_type, amount, broker_fee, bonus, employee_id, sale_date, cross_sold, cross_sold_type, cross_sold_to, client_description) VALUES
('POL-2025-001', 'Demo Client', 'Auto Insurance', 1200.00, 120.00, 110.00, 'your_employee1_clerk_id', '2025-01-15', false, null, null, 'Sample policy sale to demonstrate the system');

-- Add corresponding bonus for Employee 1
INSERT INTO employee_bonuses (employee_id, total_bonus) VALUES
('your_employee1_clerk_id', 110.00);

-- Add sample client review for Employee 1
INSERT INTO client_reviews (client_name, policy_number, rating, review, review_date, employee_id) VALUES
('Demo Client', 'POL-2025-001', 5, 'Excellent service! Very professional and helpful.', '2025-01-16', 'your_employee1_clerk_id');