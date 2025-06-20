-- Add demo requests for testing
-- Replace 'YOUR_CLERK_USER_ID_HERE' with your actual Clerk user ID from the employees table
-- You can find your user ID by checking the employees table or from the Clerk dashboard

-- Example: INSERT INTO requests (employee_id, type, title, description, request_date, status, hours_requested, reason, start_date, end_date) VALUES
-- ('user_2abc123def456', 'vacation', 'Vacation Request', 'Annual family vacation to the beach', '2025-01-15', 'approved', NULL, 'Family vacation planned for summer', '2025-07-15', '2025-07-22'),
-- ('user_2abc123def456', 'overtime', 'Overtime Request', 'Additional hours for project completion', '2025-01-20', 'pending', 8.0, 'Need extra time to complete quarterly reports', '2025-01-25', NULL),
-- ('user_2abc123def456', 'sick', 'Sick Leave Request', 'Medical appointment and recovery', '2025-01-10', 'approved', NULL, 'Doctor appointment and follow-up care', '2025-01-12', '2025-01-13'),
-- ('user_2abc123def456', 'other', 'Other Request', 'Request for flexible work hours', '2025-01-18', 'pending', NULL, 'Need to adjust schedule for childcare', '2025-02-01', NULL);

-- To add demo data, uncomment the lines above and replace 'user_2abc123def456' with your actual user ID
-- Then run: npx supabase db push 