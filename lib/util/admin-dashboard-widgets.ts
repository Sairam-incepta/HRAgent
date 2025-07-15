import { supabase } from "../supabase";
import { getEmployees } from "./employee";
import { getLocalDateString, getLocalStartOfWeek, getLocalEndOfWeek } from "./timezone";
import { calculateWorkHoursWithLunchDeduction } from "./misc";

// Get number of employees currently clocked in
export const getClockedInEmployeesCount = async (): Promise<{ clockedIn: number; total: number }> => {
  try {
    const employees = await getEmployees();
    
    // Filter out admin users
    const nonAdminEmployees = employees.filter(emp => {
      const isAdmin = emp.position === 'Administrator';
      return !isAdmin;
    });

    if (nonAdminEmployees.length === 0) {
      return { clockedIn: 0, total: 0 };
    }

    // OPTIMIZATION: Get all time logs for today in one query
    const today = getLocalDateString();
    const employeeIds = nonAdminEmployees.map(emp => emp.clerk_user_id);

    const { data: todayTimeLogs, error } = await supabase
      .from('time_logs')
      .select('employee_id, clock_in, clock_out')
      .in('employee_id', employeeIds)
      .eq('date', today);

    if (error) {
      console.error('Error fetching today time logs:', error);
      return { clockedIn: 0, total: nonAdminEmployees.length };
    }

    // Group logs by employee and check who's currently clocked in
    const employeeLogMap = new Map();
    (todayTimeLogs || []).forEach(log => {
      if (!employeeLogMap.has(log.employee_id)) {
        employeeLogMap.set(log.employee_id, []);
      }
      employeeLogMap.get(log.employee_id).push(log);
    });

    let clockedInCount = 0;

    nonAdminEmployees.forEach(employee => {
      const employeeLogs = employeeLogMap.get(employee.clerk_user_id) || [];
      
      // Check if any log has clock_in but no clock_out (currently clocked in)
      const isClockedIn = employeeLogs.some(log => log.clock_in && !log.clock_out);
      
      if (isClockedIn) {
        clockedInCount++;
      }
    });

    return {
      clockedIn: clockedInCount,
      total: nonAdminEmployees.length
    };
  } catch (error) {
    console.error('Error getting clocked in employees count:', error);
    return { clockedIn: 0, total: 0 };
  }
};

// Get total policy sales amount (not bonuses)
export const getTotalPolicySalesAmount = async (): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('policy_sales')
      .select('amount');
    
    if (error) {
      console.error('Error getting total policy sales amount:', error);
      return 0;
    }
    
    return data?.reduce((sum, record) => sum + (record.amount || 0), 0) || 0;
  } catch (error) {
    console.error('Error getting total policy sales amount:', error);
    return 0;
  }
};

// Get overtime hours for current week for all employees
export const getOvertimeHoursThisWeek = async (): Promise<number> => {
  try {
    const employees = await getEmployees();
    
    // Filter out admin users
    const nonAdminEmployees = employees.filter(emp => {
      const isAdmin = emp.position === 'Administrator';
      return !isAdmin;
    });

    if (nonAdminEmployees.length === 0) {
      return 0;
    }

    // Get current week dates
    const now = new Date();
    const startOfWeek = getLocalStartOfWeek(now);
    const endOfWeek = getLocalEndOfWeek(now);

    // OPTIMIZATION: Get all time logs for the week in one query
    const startDateStr = getLocalDateString(startOfWeek);
    const endDateStr = getLocalDateString(endOfWeek);
    const employeeIds = nonAdminEmployees.map(emp => emp.clerk_user_id);

    const { data: weekTimeLogs, error } = await supabase
      .from('time_logs')
      .select('*')
      .in('employee_id', employeeIds)
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .order('date', { ascending: true })
      .order('clock_in', { ascending: true });

    if (error) {
      console.error('Error fetching week time logs:', error);
      return 0;
    }

    // Group time logs by employee
    const timeLogsByEmployee = new Map();
    (weekTimeLogs || []).forEach(log => {
      if (!timeLogsByEmployee.has(log.employee_id)) {
        timeLogsByEmployee.set(log.employee_id, []);
      }
      timeLogsByEmployee.get(log.employee_id).push(log);
    });

    // Calculate overtime for each employee
    let totalOvertimeHours = 0;
    const today = getLocalDateString();

    nonAdminEmployees.forEach(employee => {
      const employeeLogs = timeLogsByEmployee.get(employee.clerk_user_id) || [];
      let employeeWeekHours = 0;

      employeeLogs.forEach(log => {
        if (log.clock_in && log.clock_out && !log.break_start && !log.break_end) {
          const clockInTime = new Date(log.clock_in);
          const clockOutTime = new Date(log.clock_out);
          employeeWeekHours += calculateWorkHoursWithLunchDeduction(clockInTime, clockOutTime);
        } else if (log.clock_in && !log.clock_out && log.date === today && !log.break_start && !log.break_end) {
          // If currently clocked in, calculate up to now
          const clockInTime = new Date(log.clock_in);
          const now = new Date();
          employeeWeekHours += calculateWorkHoursWithLunchDeduction(clockInTime, now);
        }
      });

      const weeklyOvertimeLimit = 40; // Standard 40-hour work week
      if (employeeWeekHours > weeklyOvertimeLimit) {
        totalOvertimeHours += (employeeWeekHours - weeklyOvertimeLimit);
      }
    });

    return Math.round(totalOvertimeHours * 100) / 100;
  } catch (error) {
    console.error('Error getting overtime hours this week:', error);
    return 0;
  }
};