import { supabase } from "../supabase";
import { getLocalStartOfDay, getLocalStartOfWeek, 
    getLocalEndOfWeek, getLocalDateString 
} from "./timezone";
import { getPolicySales } from "./policies";
import { getTimeLogsForDay } from "./time-logs";
import { calculateWorkHoursWithLunchDeduction } from "./misc";

// Get weekly summary data for an employee using actual time_logs
export const getWeeklySummary = async (employeeId: string): Promise<Array<{
  date: string;
  dayName: string;
  hoursWorked: number;
  policiesSold: number;
  totalSales: number;
  isToday: boolean;
  isCurrentWeek: boolean;
}>> => {
  try {
    // Get current week dates using local timezone
    const now = new Date();
    const today = getLocalStartOfDay(now);
    const startOfWeek = getLocalStartOfWeek(now);
    const endOfWeek = getLocalEndOfWeek(now);
    
    // Get date range strings
    const startDateStr = getLocalDateString(startOfWeek);
    const endDateStr = getLocalDateString(endOfWeek);
    const todayStr = getLocalDateString(today);
    
    // OPTIMIZATION: Fetch all data for the week at once
    const [weekTimeLogs, policySales] = await Promise.all([
      // Get all time logs for the week in one query
      supabase
        .from('time_logs')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date', { ascending: true })
        .order('clock_in', { ascending: true }),
      
      // Get all policy sales for this employee
      getPolicySales(employeeId)
    ]);
    
    if (weekTimeLogs.error) {
      console.error('Error fetching weekly time logs:', weekTimeLogs.error);
    }
    
    // OPTIMIZATION: Group time logs by date for efficient lookup
    const timeLogsByDate = new Map<string, any[]>();
    (weekTimeLogs.data || []).forEach(log => {
      if (!timeLogsByDate.has(log.date)) {
        timeLogsByDate.set(log.date, []);
      }
      timeLogsByDate.get(log.date)!.push(log);
    });
    
    // OPTIMIZATION: Filter and group policy sales for the week
    const weekPolicySales = (policySales || []).filter(sale => {
      const saleDate = new Date(sale.sale_date);
      return saleDate >= startOfWeek && saleDate <= endOfWeek;
    });
    
    const salesByDate = new Map<string, any[]>();
    weekPolicySales.forEach(sale => {
      const dateString = getLocalDateString(new Date(sale.sale_date));
      if (!salesByDate.has(dateString)) {
        salesByDate.set(dateString, []);
      }
      salesByDate.get(dateString)!.push(sale);
    });
    
    // Generate array for the current week
    const weekData = [];
    
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      
      const dateString = getLocalDateString(currentDate);
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
      const isToday = dateString === todayStr;
      
      // PRESERVED LOGIC: Calculate net hours worked using session-based gap calculation
      let hoursWorked = 0;
      const timeLogs = timeLogsByDate.get(dateString) || [];
      
      if (timeLogs.length > 0) {
        // Sort by clock-in (should already be sorted from query, but ensure consistency)
        const sorted = timeLogs.sort((a: any, b: any) => 
          new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime()
        );
        
        let grossSeconds = 0;
        let gapSeconds = 0;
        
        for (let j = 0; j < sorted.length; j++) {
          const session = sorted[j];
          const inTime = new Date(session.clock_in);
          const outTime = session.clock_out ? new Date(session.clock_out) : new Date();
          
          grossSeconds += (outTime.getTime() - inTime.getTime()) / 1000;
          
          // Calculate gap to next session
          const nextSession = sorted[j + 1];
          if (nextSession && session.clock_out) {
            const nextIn = new Date(nextSession.clock_in);
            const gap = (nextIn.getTime() - outTime.getTime()) / 1000;
            if (gap > 0) gapSeconds += gap;
          }
        }
        
        const netSeconds = Math.max(0, grossSeconds - gapSeconds);
        hoursWorked = netSeconds / 3600;
      }
      
      // OPTIMIZATION: Get policy sales using pre-fetched and grouped data
      const dayPolicies = salesByDate.get(dateString) || [];
      const policiesSold = dayPolicies.length;
      const totalSales = dayPolicies.reduce((sum, sale) => sum + sale.amount, 0);
      
      weekData.push({
        date: dateString,
        dayName,
        hoursWorked: Math.round(hoursWorked * 100) / 100,
        policiesSold,
        totalSales,
        isToday,
        isCurrentWeek: true
      });
    }
    
    return weekData;
  } catch (error) {
    console.error('Error getting weekly summary:', error);
    return [];
  }
};

// Get today's total hours worked (with lunch deduction)
export const getTodayHours = async (employeeId: string): Promise<number> => {
  try {
    const today = getLocalDateString();
    const logs = await getTimeLogsForDay(employeeId, today);

    // No logs – worked 0 hours
    if (!logs || logs.length === 0) return 0;

    // Sort by clock-in just in case
    const sorted = logs.sort((a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime());

    let grossSeconds = 0;   // All time between clock-in and clock-out
    let gapSeconds  = 0;    // Breaks between sessions (e.g. unpaid lunch)

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      const clockIn  = new Date(current.clock_in);
      const clockOut = current.clock_out ? new Date(current.clock_out) : new Date();

      grossSeconds += (clockOut.getTime() - clockIn.getTime()) / 1000;

      // Gap until next session → unpaid break
      const next = sorted[i + 1];
      if (next && current.clock_out) {
        const nextIn = new Date(next.clock_in);
        const gap = (nextIn.getTime() - clockOut.getTime()) / 1000;
        if (gap > 0) gapSeconds += gap;
      }
    }

    // Net seconds worked = gross – break gaps
    const netSeconds = Math.max(0, grossSeconds - gapSeconds);

    // Convert to hours and round to 2 decimals
    return Math.round((netSeconds / 3600) * 100) / 100;
  } catch (error) {
    console.error('Error getting today hours:', error);
    return 0;
  }
};

// Get this week's total hours worked
export const getThisWeekHours = async (employeeId: string): Promise<number> => {
  try {
    // Get current week dates using local timezone
    const now = new Date();
    const startOfWeek = getLocalStartOfWeek(now);
    const endOfWeek = getLocalEndOfWeek(now);

    // Get only time logs for the week (more efficient than getWeeklySummary)
    const startDateStr = getLocalDateString(startOfWeek);
    const endDateStr = getLocalDateString(endOfWeek);

    const { data: timeLogs, error } = await supabase
      .from('time_logs')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('date', startDateStr)
      .lte('date', endDateStr);

    if (error) {
      console.error('Error fetching week time logs:', error);
      return 0;
    }

    const today = getLocalDateString();
    let totalHours = 0;

    (timeLogs || []).forEach(log => {
      if (log.clock_in && log.clock_out && !log.break_start && !log.break_end) {
        const clockInTime = new Date(log.clock_in);
        const clockOutTime = new Date(log.clock_out);
        totalHours += calculateWorkHoursWithLunchDeduction(clockInTime, clockOutTime);
      } else if (log.clock_in && !log.clock_out && log.date === today && !log.break_start && !log.break_end) {
        // If currently clocked in, calculate up to now with lunch deduction
        const clockInTime = new Date(log.clock_in);
        const now = new Date();
        totalHours += calculateWorkHoursWithLunchDeduction(clockInTime, now);
      }
    });

    return Math.round(totalHours * 100) / 100;
  } catch (error) {
    console.error('Error getting this week hours:', error);
    return 0;
  }
};