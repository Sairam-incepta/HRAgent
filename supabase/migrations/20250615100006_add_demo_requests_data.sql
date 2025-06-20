-- Add demo requests data
-- This will add some sample requests to the database
-- You can run this after creating the requests table

-- First, let's get a user ID from the employees table to use for demo data
-- Replace 'your_clerk_user_id_here' with an actual user ID from your employees table

INSERT INTO requests (employee_id, type, title, description, request_date, status, hours_requested, reason, start_date, end_date) VALUES
('your_clerk_user_id_here', 'vacation', 'Vacation Request', 'Annual family vacation to the beach', '2025-01-15', 'approved', NULL, 'Family vacation planned for summer', '2025-07-15', '2025-07-22'),
('your_clerk_user_id_here', 'overtime', 'Overtime Request', 'Additional hours for project completion', '2025-01-20', 'pending', 8.0, 'Need extra time to complete quarterly reports', '2025-01-25', NULL),
('your_clerk_user_id_here', 'sick', 'Sick Leave Request', 'Medical appointment and recovery', '2025-01-10', 'approved', NULL, 'Doctor appointment and follow-up care', '2025-01-12', '2025-01-13'),
('your_clerk_user_id_here', 'other', 'Other Request', 'Request for flexible work hours', '2025-01-18', 'pending', NULL, 'Need to adjust schedule for childcare', '2025-02-01', NULL);

-- To use this:
-- 1. Replace 'your_clerk_user_id_here' with your actual Clerk user ID
-- 2. Run this SQL in your Supabase SQL editor
-- 3. The requests will appear in your employee dashboard 