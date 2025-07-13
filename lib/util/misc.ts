import { supabase } from '../supabase';
import { getLocalDateString } from './timezone';


// Get the correct hourly rate for a specific date
export const getEmployeeRateForDate = async (employeeId: string, targetDate: Date): Promise<number> => {
  const { data: employee, error } = await supabase
    .from('employees')
    .select('hourly_rate, rate_effective_date, previous_rate')
    .eq('id', employeeId)
    .single();

  if (error || !employee) {
    console.error('Error fetching employee for rate calculation:', error);
    return 0;
  }

  const targetDateStr = targetDate.toISOString().split('T')[0];
  
  // If the target date is before the current rate became effective,
  // use the previous rate (if available)
  if (employee.rate_effective_date && 
      targetDateStr < employee.rate_effective_date && 
      employee.previous_rate) {
    return employee.previous_rate;
  }
  
  // Otherwise use current rate
  return employee.hourly_rate;
};

// Helper function to format hours as "Xh Ym" format
export const formatHoursMinutes = (totalHours: number): string => {
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);
  
  if (hours === 0 && minutes === 0) {
    return '0h 0m';
  } else if (hours === 0) {
    return `${minutes}m`;
  } else if (minutes === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${minutes}m`;
  }
};

// Helper function to calculate work hours with lunch break deduction
export const calculateWorkHoursWithLunchDeduction = (clockInTime: Date, clockOutTime: Date): number => {
  // Return the exact time between clock-in and clock-out (in hours) without any heuristic deductions.
  // Any unpaid breaks should be recorded as separate sessions, so gaps are already excluded.
  const diffMs = clockOutTime.getTime() - clockInTime.getTime();
  return Math.max(0, diffMs) / (1000 * 60 * 60);
};

// Helper function to calculate actual hours worked from time_logs for a date range
export const calculateActualHoursForPeriod = async (employeeId: string, startDate: Date, endDate: Date): Promise<number> => {
  try {
    // Get ALL time logs for the period in one query
    const startDateStr = getLocalDateString(startDate);
    const endDateStr = getLocalDateString(endDate);
    
    const { data: timeLogs, error } = await supabase
      .from('time_logs')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .order('date', { ascending: true })
      .order('clock_in', { ascending: true });

    if (error) {
      console.error('Error fetching time logs for period:', error);
      return 0;
    }

    let totalHours = 0;
    const today = getLocalDateString();

    (timeLogs || []).forEach(log => {
      if (log.clock_in && log.clock_out) {
        const clockInTime = new Date(log.clock_in);
        const clockOutTime = new Date(log.clock_out);
        totalHours += calculateWorkHoursWithLunchDeduction(clockInTime, clockOutTime);
      } else if (log.clock_in && !log.clock_out) {
        // If currently clocked in, calculate up to now (only if it's today)
        if (log.date === today) {
          const clockInTime = new Date(log.clock_in);
          const now = new Date();
          totalHours += calculateWorkHoursWithLunchDeduction(clockInTime, now);
        }
      }
    });

    return Math.round(totalHours * 100) / 100;
  } catch (error) {
    console.error('Error calculating actual hours for period:', error);
    return 0;
  }
};

// Check if period end notification should be shown
export const shouldShowPeriodEndNotification = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .rpc('should_send_period_end_notification');

    if (error) {
      console.error('Error checking period end notification:', error);
      return false;
    }

    return data || false;
  } catch (error) {
    console.error('Exception in shouldShowPeriodEndNotification:', error);
    return false;
  }
};

// Close expired biweekly periods
export const closeExpiredBiweeklyPeriods = async (): Promise<void> => {
  try {
    const { error } = await supabase
      .rpc('close_expired_biweekly_periods');

    if (error) {
      console.error('Error closing expired biweekly periods:', error);
      throw new Error('Failed to close expired biweekly periods');
    }
  } catch (error) {
    console.error('Exception in closeExpiredBiweeklyPeriods:', error);
    throw error;
  }
};