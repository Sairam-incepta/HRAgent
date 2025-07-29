import { supabase } from "../supabase";
import {
  getLocalStartOfDay, getLocalStartOfWeek,
  getLocalEndOfWeek, getLocalDateString
} from "./timezone";
import { getPolicySales } from "./policies";
import { getTimeLogsForDay } from "./time-logs";
import { calculateWorkHoursWithLunchDeduction } from "./misc";

// Get period summary data for an employee using actual time_logs
export const getPeriodSummary = async (employeeId: string, startDate: string, periodDays: number = 14): Promise<Array<{
  date: string;
  dayName: string;
  hoursWorked: number;
  policiesSold: number;
  totalSales: number;
  isToday: boolean;
  isCurrentWeek: boolean;
}>> => {
  try {
    // Parse start date
    const periodStart = new Date(startDate + 'T00:00:00');
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + periodDays - 1);

    // Get date range strings
    const startDateStr = getLocalDateString(periodStart);
    const endDateStr = getLocalDateString(periodEnd);

    // Get current info for comparisons
    const now = new Date();
    const todayStr = getLocalDateString(now);
    const currentWeekStart = getLocalStartOfWeek(now);
    const currentWeekEnd = getLocalEndOfWeek(now);

    // OPTIMIZATION: Fetch all data for the period at once
    const [periodTimeLogs, policySales] = await Promise.all([
      // Get all time logs for the period in one query
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

    if (periodTimeLogs.error) {
      console.error('Error fetching period time logs:', periodTimeLogs.error);
    }

    // OPTIMIZATION: Group time logs by date for efficient lookup
    const timeLogsByDate = new Map<string, any[]>();
    (periodTimeLogs.data || []).forEach(log => {
      if (!timeLogsByDate.has(log.date)) {
        timeLogsByDate.set(log.date, []);
      }
      timeLogsByDate.get(log.date)!.push(log);
    });

    // OPTIMIZATION: Filter and group policy sales for the period
    const periodPolicySales = (policySales || []).filter(sale => {
      const saleDate = new Date(sale.sale_date);
      return saleDate >= periodStart && saleDate <= periodEnd;
    });

    const salesByDate = new Map<string, any[]>();
    periodPolicySales.forEach(sale => {
      const dateString = getLocalDateString(new Date(sale.sale_date));
      if (!salesByDate.has(dateString)) {
        salesByDate.set(dateString, []);
      }
      salesByDate.get(dateString)!.push(sale);
    });

    // Generate array for the period
    const periodData = [];

    for (let i = 0; i < periodDays; i++) {
      const currentDate = new Date(periodStart);
      currentDate.setDate(periodStart.getDate() + i);

      const dateString = getLocalDateString(currentDate);
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
      const isToday = dateString === todayStr;
      const isCurrentWeek = currentDate >= currentWeekStart && currentDate <= currentWeekEnd;

      // Calculate net hours worked using break session exclusion (matches payroll calculations)
      let hoursWorked = 0;
      const timeLogs = timeLogsByDate.get(dateString) || [];

      if (timeLogs.length > 0) {
        timeLogs.forEach((log: any) => {
          if (log.clock_in && log.clock_out) {
            // Completed session - calculate total time
            const clockInTime = new Date(log.clock_in);
            const clockOutTime = new Date(log.clock_out);
            let sessionHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

            // Subtract break time if exists
            if (log.break_start && log.break_end) {
              const breakHours = (new Date(log.break_end).getTime() - new Date(log.break_start).getTime()) / (1000 * 60 * 60);
              sessionHours -= breakHours;
            }

            if (sessionHours > 0) {
              hoursWorked += sessionHours;
            }
          } else if (log.clock_in && !log.clock_out && log.date === dateString && dateString === todayStr) {
            // Currently active session (only for today)
            const clockInTime = new Date(log.clock_in);
            const now = new Date();
            let sessionHours = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

            // If currently on break, subtract break time
            if (log.break_start && !log.break_end) {
              const breakHours = (now.getTime() - new Date(log.break_start).getTime()) / (1000 * 60 * 60);
              sessionHours -= breakHours;
            }

            if (sessionHours > 0) {
              hoursWorked += sessionHours;
            }
          }
        });
      }

      // OPTIMIZATION: Get policy sales using pre-fetched and grouped data
      const dayPolicies = salesByDate.get(dateString) || [];
      const policiesSold = dayPolicies.length;
      const totalSales = dayPolicies.reduce((sum, sale) => sum + sale.amount, 0);

      periodData.push({
        date: dateString,
        dayName,
        hoursWorked: Math.round(hoursWorked * 100) / 100,
        policiesSold,
        totalSales,
        isToday,
        isCurrentWeek
      });
    }

    return periodData;
  } catch (error) {
    console.error('Error getting period summary:', error);
    return [];
  }
};

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

      // Calculate net hours worked using break session exclusion (matches payroll calculations)
      let hoursWorked = 0;
      const timeLogs = timeLogsByDate.get(dateString) || [];

      if (timeLogs.length > 0) {
        timeLogs.forEach((log: any) => {
          if (log.clock_in && log.clock_out) {
            // Completed session - calculate total time
            const clockInTime = new Date(log.clock_in);
            const clockOutTime = new Date(log.clock_out);
            let sessionHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

            // Subtract break time if exists
            if (log.break_start && log.break_end) {
              const breakHours = (new Date(log.break_end).getTime() - new Date(log.break_start).getTime()) / (1000 * 60 * 60);
              sessionHours -= breakHours;
            }

            if (sessionHours > 0) {
              hoursWorked += sessionHours;
            }
          } else if (log.clock_in && !log.clock_out && log.date === dateString && dateString === todayStr) {
            // Currently active session (only for today)
            const clockInTime = new Date(log.clock_in);
            const now = new Date();
            let sessionHours = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

            // If currently on break, subtract break time
            if (log.break_start && !log.break_end) {
              const breakHours = (now.getTime() - new Date(log.break_start).getTime()) / (1000 * 60 * 60);
              sessionHours -= breakHours;
            }

            if (sessionHours > 0) {
              hoursWorked += sessionHours;
            }
          }
        });
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

    if (!logs || logs.length === 0) return 0;

    let totalHours = 0;

    logs.forEach(log => {
      if (log.clock_in && log.clock_out) {
        // Completed session - calculate total time
        const clockInTime = new Date(log.clock_in);
        const clockOutTime = new Date(log.clock_out);
        let sessionHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

        // Subtract break time if it exists
        if (log.break_start && log.break_end) {
          const breakStart = new Date(log.break_start);
          const breakEnd = new Date(log.break_end);
          const breakHours = (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60 * 60);
          sessionHours -= breakHours;
        }

        // Only add positive time
        if (sessionHours > 0) {
          totalHours += sessionHours;
        }
      } else if (log.clock_in && !log.clock_out && log.date === today) {
        // Currently active session (only for today)
        const clockInTime = new Date(log.clock_in);
        const now = new Date();
        let sessionHours = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

        // If currently on break, subtract current break time
        if (log.break_start && !log.break_end) {
          const breakStart = new Date(log.break_start);
          const currentBreakHours = (now.getTime() - breakStart.getTime()) / (1000 * 60 * 60);
          sessionHours -= currentBreakHours;
        }

        // Only add positive time
        if (sessionHours > 0) {
          totalHours += sessionHours;
        }
      }
    });

    return Math.round(totalHours * 100) / 100;
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
      if (log.clock_in && log.clock_out) {
        // Completed session
        const clockInTime = new Date(log.clock_in);
        const clockOutTime = new Date(log.clock_out);
        let sessionHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

        // Subtract break time if exists
        if (log.break_start && log.break_end) {
          const breakHours = (new Date(log.break_end).getTime() - new Date(log.break_start).getTime()) / (1000 * 60 * 60);
          sessionHours -= breakHours;
        }

        if (sessionHours > 0) {
          totalHours += sessionHours;
        }
      } else if (log.clock_in && !log.clock_out && log.date === today) {
        // Currently active session (only for today)
        const clockInTime = new Date(log.clock_in);
        const now = new Date();
        let sessionHours = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

        // If currently on break, subtract break time
        if (log.break_start && !log.break_end) {
          const breakHours = (now.getTime() - new Date(log.break_start).getTime()) / (1000 * 60 * 60);
          sessionHours -= breakHours;
        }

        if (sessionHours > 0) {
          totalHours += sessionHours;
        }
      }
    });

    return Math.round(totalHours * 100) / 100;
  } catch (error) {
    console.error('Error getting this week hours:', error);
    return 0;
  }
};