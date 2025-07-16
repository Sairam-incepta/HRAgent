
ALTER TABLE public.time_logs 
ADD COLUMN IF NOT EXISTS break_start timestamp with time zone null,
ADD COLUMN IF NOT EXISTS break_end timestamp with time zone null;

-- Add comment for documentation
COMMENT ON COLUMN public.time_logs.break_start IS 'Timestamp when employee started their break/lunch';
COMMENT ON COLUMN public.time_logs.break_end IS 'Timestamp when employee ended their break/lunch';

-- Create index for efficient break queries
CREATE INDEX IF NOT EXISTS idx_time_logs_employee_break 
ON public.time_logs (employee_id, date, break_start) 
WHERE break_start IS NOT NULL;

-- Create index for finding active breaks (started but not ended)
CREATE INDEX IF NOT EXISTS idx_time_logs_active_breaks 
ON public.time_logs (employee_id, break_start) 
WHERE break_start IS NOT NULL AND break_end IS NULL;
