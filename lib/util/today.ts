import { supabase } from "../supabase";
import { PolicySale, ClientReview } from "../supabase";
import { getLocalDateString } from "./timezone";
import { getTimeLogsForDay } from "./time-logs";
import { calculateWorkHoursWithLunchDeduction } from "./misc";


// New function to get today's policy sales for an employee
export const getTodayPolicySales = async (employeeId: string): Promise<PolicySale[]> => {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  const { data, error } = await supabase
    .from('policy_sales')
    .select('*')
    .eq('employee_id', employeeId)
    .gte('sale_date', startOfDay.toISOString())
    .lte('sale_date', endOfDay.toISOString())
    .order('sale_date', { ascending: false });

  if (error) {
    console.error('Error fetching today\'s policy sales:', error);
    return [];
  }

  return data || [];
};

export const getTodayClientReviews = async (employeeId: string): Promise<ClientReview[]> => {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  const { data, error } = await supabase
    .from('client_reviews')
    .select('*')
    .eq('employee_id', employeeId)
    .gte('review_date', startOfDay.toISOString())
    .lte('review_date', endOfDay.toISOString())
    .order('review_date', { ascending: false });

  if (error) {
    console.error('Error fetching today\'s client reviews:', error);
    return [];
  }

  return data || [];
};

// Get today's time tracking data for an employee from actual time logs (with lunch deduction)
export const getTodayTimeTracking = async (employeeId: string): Promise<{ totalHours: number; clockedIn: boolean }> => {
  try {
    // Get today's date in local timezone
    const today = getLocalDateString();
    
    // Get all time logs for today
    const timeLogs = await getTimeLogsForDay(employeeId, today);
    
    let totalHours = 0;
    let clockedIn = false;
    
    // Calculate total hours worked and check if currently clocked in
    timeLogs.forEach(log => {
      if (log.clock_in && log.clock_out) {
        // Completed session with lunch deduction
        const clockInTime = new Date(log.clock_in);
        const clockOutTime = new Date(log.clock_out);
        totalHours += calculateWorkHoursWithLunchDeduction(clockInTime, clockOutTime);
      } else if (log.clock_in && !log.clock_out) {
        // Currently clocked in - calculate up to now with lunch deduction
        const clockInTime = new Date(log.clock_in);
        const now = new Date();
        totalHours += calculateWorkHoursWithLunchDeduction(clockInTime, now);
        clockedIn = true;
      }
    });
  
  return {
      totalHours: Math.round(totalHours * 100) / 100, // Round to 2 decimal places
      clockedIn
  };
  } catch (error) {
    console.error('Error getting today time tracking:', error);
    return { totalHours: 0, clockedIn: false };
  }
};