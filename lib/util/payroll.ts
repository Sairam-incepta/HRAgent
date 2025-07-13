import { supabase } from "../supabase";
import { getEmployee, getEmployees } from "./employee";
import { getPolicySales } from "./policies";
import { getLocalDateString } from "./timezone";
import { calculateWorkHoursWithLunchDeduction, calculateActualHoursForPeriod } from "./misc";
import { getEmployeeRateForDate } from "./misc";

// Enhanced Payroll Functions with Real Database Data
export interface PayrollPeriod {
  period: string;
  employees: number;
  total: number;
  status: 'current' | 'completed' | 'upcoming';
  startDate: string;
  endDate: string;
  details: {
    regularHours: number;
    overtimeHours: number;
    totalSales: number;
    totalBonuses: number;
    departmentBreakdown: Array<{
      department: string;
      employees: number;
      totalPay: number;
      avgHourlyRate: number;
    }>;
  };
}

export const getPayrollPeriods = async (): Promise<PayrollPeriod[]> => {
  try {
    console.log('📊 Getting payroll periods...');

    const [employees, policySales] = await Promise.all([
      getEmployees(),
      getPolicySales()
    ]);

    console.log(`👥 Found ${employees.length} employees, ${policySales.length} policy sales`);

    const activeEmployees = employees.filter(emp => emp.status === 'active');
    const activeEmployeeIds = activeEmployees.map(emp => emp.clerk_user_id);
    const periods: PayrollPeriod[] = [];
    const now = new Date();

    // Constants
    const REFERENCE_DATE = new Date('2025-01-06');
    const BIWEEKLY_DAYS = 14;
    const PERIOD_LENGTH_DAYS = 13;
    const HOURS_PER_EMPLOYEE_BIWEEKLY = 80;
    const MAX_PREVIOUS_PERIODS = 3; // Increased to show more history since it's actually useful

    // Helper functions
    const isAdmin = (emp: any): boolean => 
      emp.position === 'HR Manager' || emp.email === 'admin@letsinsure.hr';

    const calculatePeriodDates = (periodOffset: number): { startDate: Date; endDate: Date } => {
      const startDate = new Date(REFERENCE_DATE);
      startDate.setDate(REFERENCE_DATE.getDate() + (periodOffset * BIWEEKLY_DAYS));
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + PERIOD_LENGTH_DAYS);
      return { startDate, endDate };
    };

    const formatPeriodName = (startDate: Date, endDate: Date): string => 
      `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    const filterSalesForPeriod = (startDate: Date, endDate: Date) => 
      policySales.filter(sale => {
        const saleDate = new Date(sale.sale_date);
        return saleDate >= startDate && saleDate <= endDate;
      });

    const calculateTotalBonuses = (sales: any[]): number => 
      sales.reduce((sum, sale) => sum + (sale.bonus || 0), 0);

    const calculateHoursBreakdown = (totalHours: number, employeeCount: number) => {
      const maxRegularHours = employeeCount * HOURS_PER_EMPLOYEE_BIWEEKLY;
      return {
        regularHours: Math.round(Math.min(totalHours, maxRegularHours) * 10) / 10,
        overtimeHours: Math.round(Math.max(0, totalHours - maxRegularHours) * 10) / 10
      };
    };

    // Calculate current period offset
    const daysSinceReference = Math.floor((now.getTime() - REFERENCE_DATE.getTime()) / (24 * 60 * 60 * 1000));
    const currentPeriodOffset = Math.floor(daysSinceReference / BIWEEKLY_DAYS);

    console.log(`📅 Reference date: ${REFERENCE_DATE.toISOString()}, periods since: ${currentPeriodOffset}`);

    // OPTIMIZATION: Only fetch time logs for periods that will have meaningful data
    // Get date range for current + previous periods only (no future periods need time logs)
    const { startDate: allPeriodsStart } = calculatePeriodDates(currentPeriodOffset - MAX_PREVIOUS_PERIODS);
    const { endDate: allPeriodsEnd } = calculatePeriodDates(currentPeriodOffset);

    // Fetch all time logs for the date range
    const startDateStr = getLocalDateString(allPeriodsStart);
    const endDateStr = getLocalDateString(allPeriodsEnd);
    
    const { data: allTimeLogs, error: timeLogsError } = await supabase
      .from('time_logs')
      .select('*')
      .in('employee_id', activeEmployeeIds)
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .order('date', { ascending: true })
      .order('clock_in', { ascending: true });

    if (timeLogsError) {
      console.error('Error fetching time logs:', timeLogsError);
    }

    // Group time logs by employee for easy lookup
    const timeLogsByEmployee = new Map<string, any[]>();
    (allTimeLogs || []).forEach(log => {
      if (!timeLogsByEmployee.has(log.employee_id)) {
        timeLogsByEmployee.set(log.employee_id, []);
      }
      timeLogsByEmployee.get(log.employee_id)!.push(log);
    });

    // Helper function to calculate hours for a specific employee
    const calculateEmployeeHours = (employeeId: string, startDate: Date, endDate: Date): number => {
      const employeeLogs = timeLogsByEmployee.get(employeeId) || [];
      const startDateStr = getLocalDateString(startDate);
      const endDateStr = getLocalDateString(endDate);
      const today = getLocalDateString();
      
      const periodLogs = employeeLogs.filter(log => 
        log.date >= startDateStr && log.date <= endDateStr
      );

      let totalHours = 0;
      periodLogs.forEach(log => {
        if (log.clock_in && log.clock_out) {
          const clockInTime = new Date(log.clock_in);
          const clockOutTime = new Date(log.clock_out);
          totalHours += calculateWorkHoursWithLunchDeduction(clockInTime, clockOutTime);
        } else if (log.clock_in && !log.clock_out && log.date === today) {
          const clockInTime = new Date(log.clock_in);
          const now = new Date();
          totalHours += calculateWorkHoursWithLunchDeduction(clockInTime, now);
        }
      });

      return Math.round(totalHours * 100) / 100;
    };

    // Helper function to calculate total pay for a period
    const calculatePeriodPay = (startDate: Date, endDate: Date): { totalHours: number; totalPay: number } => {
      let totalHours = 0;
      let totalPay = 0;

      activeEmployees.forEach(emp => {
        if (!isAdmin(emp)) {
          const empHours = calculateEmployeeHours(emp.clerk_user_id, startDate, endDate);
          totalHours += empHours;
          totalPay += empHours * emp.hourly_rate;
        }
      });

      return { 
        totalHours: Math.round(totalHours * 100) / 100, 
        totalPay: Math.round(totalPay * 100) / 100 
      };
    };

    // Helper function to create a period object (only for periods with data)
    const createPeriodObject = (
      periodOffset: number, 
      status: 'completed' | 'current'
    ): PayrollPeriod => {
      const { startDate, endDate } = calculatePeriodDates(periodOffset);
      const periodSales = filterSalesForPeriod(startDate, endDate);
      const totalBonuses = calculateTotalBonuses(periodSales);
      const { totalHours, totalPay } = calculatePeriodPay(startDate, endDate);
      const finalTotalPay = totalPay + totalBonuses;
      const { regularHours, overtimeHours } = calculateHoursBreakdown(totalHours, activeEmployees.length);

      return {
        period: formatPeriodName(startDate, endDate),
        employees: activeEmployees.length,
        total: Math.round(finalTotalPay),
        status,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        details: {
          regularHours,
          overtimeHours,
          totalSales: periodSales.length,
          totalBonuses: Math.round(totalBonuses),
          departmentBreakdown: [] // Could be populated if needed for department analysis
        }
      };
    };

    // OPTIMIZATION: Create lightweight upcoming period (just next period for scheduling)
    const createUpcomingPeriod = (periodOffset: number): PayrollPeriod => {
      const { startDate, endDate } = calculatePeriodDates(periodOffset);
      
      return {
        period: formatPeriodName(startDate, endDate),
        employees: activeEmployees.length,
        total: 0,
        status: 'upcoming',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        details: {
          regularHours: 0,
          overtimeHours: 0,
          totalSales: 0,
          totalBonuses: 0,
          departmentBreakdown: []
        }
      };
    };

    // Log current period info
    const { startDate: currentStart, endDate: currentEnd } = calculatePeriodDates(currentPeriodOffset);
    console.log(`📅 Current period: ${currentStart.toISOString().split('T')[0]} to ${currentEnd.toISOString().split('T')[0]}`);

    const currentPeriodSales = filterSalesForPeriod(currentStart, currentEnd);
    const currentTotalBonuses = calculateTotalBonuses(currentPeriodSales);
    const { totalHours: currentTotalHours, totalPay: currentBasePay } = calculatePeriodPay(currentStart, currentEnd);

    console.log(`💰 Current period sales: ${currentPeriodSales.length}`);
    console.log(`💵 Current period calculation:`, {
      employees: activeEmployees.length,
      actualHours: currentTotalHours,
      basePay: currentBasePay,
      bonuses: currentTotalBonuses,
      totalPay: currentBasePay + currentTotalBonuses
    });

    // OPTIMIZED: Generate periods based on actual usage patterns
    // 1. Add previous periods that have meaningful data (up to MAX_PREVIOUS_PERIODS)
    for (let i = MAX_PREVIOUS_PERIODS; i >= 1; i--) {
      const periodOffset = currentPeriodOffset - i;
      const { startDate, endDate } = calculatePeriodDates(periodOffset);
      
      // Quick check: Do we have any time logs or sales for this period?
      const periodSales = filterSalesForPeriod(startDate, endDate);
      const startDateStr = getLocalDateString(startDate);
      const endDateStr = getLocalDateString(endDate);
      const hasTimeLogs = (allTimeLogs || []).some(log => 
        log.date >= startDateStr && log.date <= endDateStr
      );
      
      // Only calculate full period data if there's any activity
      if (hasTimeLogs || periodSales.length > 0) {
        periods.push(createPeriodObject(periodOffset, 'completed'));
      }
    }

    // 2. Add current period (always included)
    periods.push(createPeriodObject(currentPeriodOffset, 'current'));

    // 3. OPTIMIZATION: Add only next upcoming period (not 2) since future periods have limited value
    // This reduces computation and UI clutter while still showing the next pay period dates
    periods.push(createUpcomingPeriod(currentPeriodOffset + 1));

    console.log(`📊 Generated ${periods.length} payroll periods (optimized for actual usage)`);
    return periods;
  } catch (error) {
    console.error('❌ Error getting payroll periods:', error);
    return [];
  }
};

// Get detailed payroll data for a specific period
export const getPayrollPeriodDetails = async (startDate: string, endDate: string): Promise<{
  employees: Array<{
    id: string;
    name: string;
    department: string;
    position: string;
    hourlyRate: number;
    regularHours: number;
    overtimeHours: number;
    regularPay: number;
    overtimePay: number;
    bonuses: number;
    totalPay: number;
    salesCount: number;
    salesAmount: number;
    bonusBreakdown: {
      brokerFeeBonuses: { count: number; amount: number };
      crossSellingBonuses: { count: number; amount: number };
      lifeInsuranceBonuses: { count: number; amount: number };
      reviewBonuses: { count: number; amount: number };
      highValuePolicyBonuses: { count: number; amount: number };
    };
  }>;
  summary: {
    totalEmployees: number;
    totalRegularHours: number;
    totalOvertimeHours: number;
    totalRegularPay: number;
    totalOvertimePay: number;
    totalBonuses: number;
    totalPay: number;
    totalSales: number;
    totalSalesAmount: number;
    totalBrokerFees: number;
    bonusBreakdown: {
      brokerFeeBonuses: { count: number; amount: number };
      crossSellingBonuses: { count: number; amount: number };
      lifeInsuranceBonuses: { count: number; amount: number };
      reviewBonuses: { count: number; amount: number };
      highValuePolicyBonuses: { count: number; amount: number };
    };
  };
}> => {
  try {
    console.log(`🔍 Getting payroll details for period: ${startDate} to ${endDate}`);
    
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Constants - shared with getPayrollPeriods
    const BIWEEKLY_REGULAR_HOURS = 80;
    const OVERTIME_MULTIPLIER = 1.0;

    // Helper functions - extracted and reusable
    const isAdmin = (emp: any): boolean => 
      emp.position === 'HR Manager' || emp.email === 'admin@letsinsure.hr';

    const calculateHoursBreakdown = (totalHours: number) => {
      const regularHours = Math.min(totalHours, BIWEEKLY_REGULAR_HOURS);
      const overtimeHours = Math.max(0, totalHours - BIWEEKLY_REGULAR_HOURS);
      return {
        regularHours: Math.round(regularHours * 10) / 10,
        overtimeHours: Math.round(overtimeHours * 10) / 10
      };
    };

    // OPTIMIZATION: Get employees first, then fetch all data in parallel
    const employees = await getEmployees();
    const activeEmployees = employees.filter(emp => emp.status === 'active');
    const activeEmployeeIds = activeEmployees.map(emp => emp.clerk_user_id);
    
    console.log(`📊 Found ${activeEmployees.length} active employees`);

    // OPTIMIZATION: Fetch all data in parallel with optimized queries
    const [
      policySales, 
      highValueNotificationsResult, 
      clientReviewsResult,
      timeLogsResult
    ] = await Promise.all([
      getPolicySales(),
      // OPTIMIZATION: More targeted high value policy query
      supabase
        .from('high_value_policy_notifications')
        .select('*')
        .in('employee_id', activeEmployeeIds)
        .lte('biweekly_period_start', endDate)
        .gte('biweekly_period_end', startDate),
      // OPTIMIZATION: Only get reviews for active employees
      supabase
        .from('client_reviews')
        .select('*')
        .in('employee_id', activeEmployeeIds)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString()),
      // OPTIMIZATION: Only get time logs for active employees
      supabase
        .from('time_logs')
        .select('*')
        .in('employee_id', activeEmployeeIds)
        .gte('date', getLocalDateString(start))
        .lte('date', getLocalDateString(end))
        .order('date', { ascending: true })
        .order('clock_in', { ascending: true })
    ]);

    // Safe data extraction
    const highValueNotifications = highValueNotificationsResult?.data || [];
    const clientReviews = clientReviewsResult?.data || [];
    const allTimeLogs = timeLogsResult?.data || [];

    console.log(`📊 Data fetched: ${allTimeLogs.length} time logs, ${highValueNotifications.length} HV notifications, ${clientReviews.length} reviews`);
    
    if (timeLogsResult?.error) {
      console.error('❌ Error fetching time logs:', timeLogsResult.error);
    }

    // OPTIMIZATION: Filter sales once and create lookup maps
    const periodSales = policySales.filter((sale: any) => {
      const saleDate = new Date(sale.sale_date);
      return saleDate >= start && saleDate <= end;
    });

    console.log(`📈 Found ${periodSales.length} sales in period`);

    // OPTIMIZATION: Create lookup maps for O(1) access
    const timeLogsByEmployee = new Map<string, any[]>();
    const salesByEmployee = new Map<string, any[]>();
    const reviewsByEmployee = new Map<string, any[]>();
    const hvNotificationsByEmployee = new Map<string, any[]>();

    // Group time logs by employee
    allTimeLogs.forEach(log => {
      if (!timeLogsByEmployee.has(log.employee_id)) {
        timeLogsByEmployee.set(log.employee_id, []);
      }
      timeLogsByEmployee.get(log.employee_id)!.push(log);
    });

    // Group sales by employee
    periodSales.forEach(sale => {
      if (!salesByEmployee.has(sale.employee_id)) {
        salesByEmployee.set(sale.employee_id, []);
      }
      salesByEmployee.get(sale.employee_id)!.push(sale);
    });

    // Group reviews by employee
    clientReviews.forEach(review => {
      if (!reviewsByEmployee.has(review.employee_id)) {
        reviewsByEmployee.set(review.employee_id, []);
      }
      reviewsByEmployee.get(review.employee_id)!.push(review);
    });

    // Group HV notifications by employee
    highValueNotifications.forEach(hvn => {
      if (!hvNotificationsByEmployee.has(hvn.employee_id)) {
        hvNotificationsByEmployee.set(hvn.employee_id, []);
      }
      hvNotificationsByEmployee.get(hvn.employee_id)!.push(hvn);
    });

    // OPTIMIZATION: Calculate hours for a specific employee using pre-grouped data
    const calculateEmployeeHours = (employeeId: string): number => {
      const employeeLogs = timeLogsByEmployee.get(employeeId) || [];
      const today = getLocalDateString();
      let totalHours = 0;

      employeeLogs.forEach(log => {
        if (log.clock_in && log.clock_out) {
          const clockInTime = new Date(log.clock_in);
          const clockOutTime = new Date(log.clock_out);
          totalHours += calculateWorkHoursWithLunchDeduction(clockInTime, clockOutTime);
        } else if (log.clock_in && !log.clock_out && log.date === today) {
          const clockInTime = new Date(log.clock_in);
          const now = new Date();
          totalHours += calculateWorkHoursWithLunchDeduction(clockInTime, now);
        }
      });

      return Math.round(totalHours * 100) / 100;
    };

    // OPTIMIZATION: Process all employees in parallel using map instead of sequential for loop
    const employeeDetails = [];
    let summaryBonusBreakdown = {
      brokerFeeBonuses: { count: 0, amount: 0 },
      crossSellingBonuses: { count: 0, amount: 0 },
      lifeInsuranceBonuses: { count: 0, amount: 0 },
      reviewBonuses: { count: 0, amount: 0 },
      highValuePolicyBonuses: { count: 0, amount: 0 }
    };

    // OPTIMIZATION: Process all employees at once
    activeEmployees.forEach(emp => {
      const empSales = salesByEmployee.get(emp.clerk_user_id) || [];
      const empReviews = reviewsByEmployee.get(emp.clerk_user_id) || [];
      const empHVNotifications = hvNotificationsByEmployee.get(emp.clerk_user_id) || [];
      
      // Calculate hours (skip for admin users)
      let actualHours = 0;
      if (!isAdmin(emp)) {
        actualHours = calculateEmployeeHours(emp.clerk_user_id);
      }
      
      // Calculate detailed bonus breakdown
      let empBonusBreakdown = {
        brokerFeeBonuses: { count: 0, amount: 0 },
        crossSellingBonuses: { count: 0, amount: 0 },
        lifeInsuranceBonuses: { count: 0, amount: 0 },
        reviewBonuses: { count: 0, amount: 0 },
        highValuePolicyBonuses: { count: 0, amount: 0 }
      };

      // FIXED: Process policy sales bonuses with correct cross-selling logic
      empSales.forEach((sale: any) => {
        // Broker fee bonus: 10% of (broker fee - 100)
        if (sale.broker_fee > 100) {
          const baseBonus = (sale.broker_fee - 100) * 0.1;
          
          // FIXED: Cross-selling gets 2x the base bonus (total, not additional)
          if (sale.cross_sold || sale.is_cross_sold_policy) {
            empBonusBreakdown.crossSellingBonuses.count++;
            empBonusBreakdown.crossSellingBonuses.amount += baseBonus * 2; // 2x total bonus for cross-selling
          } else {
            empBonusBreakdown.brokerFeeBonuses.count++;
            empBonusBreakdown.brokerFeeBonuses.amount += baseBonus; // Regular 1x bonus
          }
        }
        
        // Life insurance bonus: $10 for life insurance policies
        if (sale.policy_type?.toLowerCase().includes('life') || 
            (sale.cross_sold_type && sale.cross_sold_type.toLowerCase().includes('life'))) {
          empBonusBreakdown.lifeInsuranceBonuses.count++;
          empBonusBreakdown.lifeInsuranceBonuses.amount += 10.00;
        }
      });

      // Review bonuses - 5-star reviews only
      const fiveStarReviews = empReviews.filter((review: any) => review.rating === 5);
      empBonusBreakdown.reviewBonuses.count = fiveStarReviews.length;
      empBonusBreakdown.reviewBonuses.amount = fiveStarReviews.length * 10;

      // High value policy bonuses
      const resolvedHVNotifications = empHVNotifications
        .filter((hvn: any) => hvn.status === 'reviewed' || hvn.status === 'resolved');
      
      let empHighValueBonusAmount = 0;
      let empHighValueBonusCount = 0;
      
      resolvedHVNotifications.forEach((hvn: any) => {
        let bonusAmount = 0;
        if (hvn.admin_bonus && hvn.admin_bonus > 0) {
          bonusAmount += hvn.admin_bonus;
        } else if (hvn.current_bonus && hvn.current_bonus > 0) {
          bonusAmount += hvn.current_bonus;
        }
        
        if (bonusAmount > 0) {
          empHighValueBonusAmount += bonusAmount;
          empHighValueBonusCount++;
        }
      });
      
      empBonusBreakdown.highValuePolicyBonuses.count = empHighValueBonusCount;
      empBonusBreakdown.highValuePolicyBonuses.amount = empHighValueBonusAmount;

      // Calculate totals
      const totalBonuses = 
        empBonusBreakdown.brokerFeeBonuses.amount +
        empBonusBreakdown.crossSellingBonuses.amount +
        empBonusBreakdown.lifeInsuranceBonuses.amount +
        empBonusBreakdown.reviewBonuses.amount +
        empBonusBreakdown.highValuePolicyBonuses.amount;

      const { regularHours, overtimeHours } = calculateHoursBreakdown(actualHours);
      const regularPay = regularHours * emp.hourly_rate;
      const overtimePay = overtimeHours * emp.hourly_rate * OVERTIME_MULTIPLIER;
      const totalPay = regularPay + overtimePay + totalBonuses;
      const salesAmount = empSales.reduce((sum: number, s: any) => sum + s.amount, 0);

      // Add to summary breakdown
      Object.keys(summaryBonusBreakdown).forEach(key => {
        summaryBonusBreakdown[key].count += empBonusBreakdown[key].count;
        summaryBonusBreakdown[key].amount += empBonusBreakdown[key].amount;
      });

      employeeDetails.push({
        id: emp.clerk_user_id,
        name: emp.name,
        department: emp.department,
        position: emp.position,
        hourlyRate: emp.hourly_rate,
        regularHours,
        overtimeHours,
        regularPay: Math.round(regularPay * 100) / 100,
        overtimePay: Math.round(overtimePay * 100) / 100,
        bonuses: Math.round(totalBonuses * 100) / 100,
        totalPay: Math.round(totalPay * 100) / 100,
        salesCount: empSales.length,
        salesAmount: Math.round(salesAmount),
        bonusBreakdown: {
          brokerFeeBonuses: { 
            count: empBonusBreakdown.brokerFeeBonuses.count, 
            amount: Math.round(empBonusBreakdown.brokerFeeBonuses.amount * 100) / 100 
          },
          crossSellingBonuses: { 
            count: empBonusBreakdown.crossSellingBonuses.count, 
            amount: Math.round(empBonusBreakdown.crossSellingBonuses.amount * 100) / 100 
          },
          lifeInsuranceBonuses: { 
            count: empBonusBreakdown.lifeInsuranceBonuses.count, 
            amount: Math.round(empBonusBreakdown.lifeInsuranceBonuses.amount * 100) / 100 
          },
          reviewBonuses: { 
            count: empBonusBreakdown.reviewBonuses.count, 
            amount: Math.round(empBonusBreakdown.reviewBonuses.amount * 100) / 100 
          },
          highValuePolicyBonuses: { 
            count: empBonusBreakdown.highValuePolicyBonuses.count, 
            amount: Math.round(empBonusBreakdown.highValuePolicyBonuses.amount * 100) / 100 
          }
        }
      });
    });

    // OPTIMIZATION: Calculate summary using reduce for better performance
    const totalBrokerFees = periodSales.reduce((sum: number, sale: any) => sum + (sale.broker_fee || 0), 0);

    const summary = {
      totalEmployees: activeEmployees.length,
      totalRegularHours: employeeDetails.reduce((sum, emp) => sum + emp.regularHours, 0),
      totalOvertimeHours: employeeDetails.reduce((sum, emp) => sum + emp.overtimeHours, 0),
      totalRegularPay: employeeDetails.reduce((sum, emp) => sum + emp.regularPay, 0),
      totalOvertimePay: employeeDetails.reduce((sum, emp) => sum + emp.overtimePay, 0),
      totalBonuses: employeeDetails.reduce((sum, emp) => sum + emp.bonuses, 0),
      totalPay: employeeDetails.reduce((sum, emp) => sum + emp.totalPay, 0),
      totalSales: periodSales.length,
      totalSalesAmount: periodSales.reduce((sum: number, sale: any) => sum + sale.amount, 0),
      totalBrokerFees: Math.round(totalBrokerFees * 100) / 100,
      bonusBreakdown: {
        brokerFeeBonuses: { 
          count: summaryBonusBreakdown.brokerFeeBonuses.count, 
          amount: Math.round(summaryBonusBreakdown.brokerFeeBonuses.amount * 100) / 100 
        },
        crossSellingBonuses: { 
          count: summaryBonusBreakdown.crossSellingBonuses.count, 
          amount: Math.round(summaryBonusBreakdown.crossSellingBonuses.amount * 100) / 100 
        },
        lifeInsuranceBonuses: { 
          count: summaryBonusBreakdown.lifeInsuranceBonuses.count, 
          amount: Math.round(summaryBonusBreakdown.lifeInsuranceBonuses.amount * 100) / 100 
        },
        reviewBonuses: { 
          count: summaryBonusBreakdown.reviewBonuses.count, 
          amount: Math.round(summaryBonusBreakdown.reviewBonuses.amount * 100) / 100 
        },
        highValuePolicyBonuses: { 
          count: summaryBonusBreakdown.highValuePolicyBonuses.count, 
          amount: Math.round(summaryBonusBreakdown.highValuePolicyBonuses.amount * 100) / 100 
        }
      }
    };

    console.log('📊 Final payroll summary (optimized):', {
      employees: summary.totalEmployees,
      totalPay: summary.totalPay,
      totalHours: summary.totalRegularHours + summary.totalOvertimeHours,
      totalBonuses: summary.totalBonuses
    });

    return { employees: employeeDetails, summary };
  } catch (error) {
    console.error('❌ Error getting payroll period details:', error);
    return {
      employees: [],
      summary: {
        totalEmployees: 0,
        totalRegularHours: 0,
        totalOvertimeHours: 0,
        totalRegularPay: 0,
        totalOvertimePay: 0,
        totalBonuses: 0,
        totalPay: 0,
        totalSales: 0,
        totalSalesAmount: 0,
        totalBrokerFees: 0,
        bonusBreakdown: {
          brokerFeeBonuses: { count: 0, amount: 0 },
          crossSellingBonuses: { count: 0, amount: 0 },
          lifeInsuranceBonuses: { count: 0, amount: 0 },
          reviewBonuses: { count: 0, amount: 0 },
          highValuePolicyBonuses: { count: 0, amount: 0 }
        }
      }
    };
  }
};

// Get historical payroll data for a specific employee
export const getEmployeePayrollHistory = async (employeeId: string): Promise<Array<{
  period: string;
  startDate: string;
  endDate: string;
  regularHours: number;
  overtimeHours: number;
  regularPay: number;
  overtimePay: number;
  bonuses: number;
  totalPay: number;
  salesCount: number;
  salesAmount: number;
}>> => {
  try {
    const [employee, policySales] = await Promise.all([
      getEmployee(employeeId),
      getPolicySales(employeeId)
    ]);

    if (!employee) return [];

    const history = [];
    const now = new Date();
    
    // Use the same biweekly calculation as the main payroll system
    const referenceDate = new Date('2025-01-06'); // Monday, January 6, 2025 as reference
    const daysSinceReference = Math.floor((now.getTime() - referenceDate.getTime()) / (24 * 60 * 60 * 1000));
    const biweeklyPeriodsSinceReference = Math.floor(daysSinceReference / 14);

    // Calculate date range for all 12 periods
    const oldestPeriodStart = biweeklyPeriodsSinceReference - 11; // 12 periods back (0-11)
    const oldestStartDate = new Date(referenceDate);
    oldestStartDate.setDate(referenceDate.getDate() + (oldestPeriodStart * 14));

    const newestPeriodStart = biweeklyPeriodsSinceReference;
    const newestStartDate = new Date(referenceDate);
    newestStartDate.setDate(referenceDate.getDate() + (newestPeriodStart * 14));
    const newestEndDate = new Date(newestStartDate);
    newestEndDate.setDate(newestStartDate.getDate() + 13);

    // OPTIMIZATION 1: Bulk fetch all time logs for the entire history range
    const allStartDateStr = getLocalDateString(oldestStartDate);
    const allEndDateStr = getLocalDateString(newestEndDate);

    // OPTIMIZATION 2: Bulk fetch all high value notifications for the date range
    const [timeLogsResult, highValueNotificationsResult] = await Promise.all([
      supabase
        .from('time_logs')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('date', allStartDateStr)
        .lte('date', allEndDateStr)
        .order('date', { ascending: true })
        .order('clock_in', { ascending: true }),
      
      supabase
        .from('high_value_policy_notifications')
        .select('admin_bonus, current_bonus, status, biweekly_period_start, biweekly_period_end')
        .eq('employee_id', employeeId)
        .lte('biweekly_period_start', allEndDateStr)
        .gte('biweekly_period_end', allStartDateStr)
        .in('status', ['reviewed', 'resolved'])
    ]);

    const allTimeLogs = timeLogsResult.data || [];
    const allHighValueNotifications = highValueNotificationsResult.data || [];

    if (timeLogsResult.error) {
      console.error('Error fetching time logs for payroll history:', timeLogsResult.error);
    }

    // Helper function to calculate hours for a specific period using pre-fetched logs
    const calculateHoursForPeriod = (startDate: Date, endDate: Date): number => {
      const startDateStr = getLocalDateString(startDate);
      const endDateStr = getLocalDateString(endDate);
      const today = getLocalDateString();
      
      const periodLogs = allTimeLogs.filter(log => 
        log.date >= startDateStr && log.date <= endDateStr
      );

      let totalHours = 0;
      periodLogs.forEach(log => {
        if (log.clock_in && log.clock_out) {
          const clockInTime = new Date(log.clock_in);
          const clockOutTime = new Date(log.clock_out);
          totalHours += calculateWorkHoursWithLunchDeduction(clockInTime, clockOutTime);
        } else if (log.clock_in && !log.clock_out && log.date === today) {
          const clockInTime = new Date(log.clock_in);
          const now = new Date();
          totalHours += calculateWorkHoursWithLunchDeduction(clockInTime, now);
        }
      });

      return Math.round(totalHours * 100) / 100;
    };

    // Helper function to get high value bonuses for a specific period
    const getHighValueBonusesForPeriod = (startDate: Date, endDate: Date): number => {
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      const periodNotifications = allHighValueNotifications.filter(hvn => 
        hvn.biweekly_period_start <= endDateStr && hvn.biweekly_period_end >= startDateStr
      );

      return periodNotifications.reduce((sum, hvn) => {
        let bonusAmount = 0;
        // Include admin bonus if set
        if (hvn.admin_bonus && hvn.admin_bonus > 0) {
          bonusAmount += hvn.admin_bonus;
        }
        // Include current bonus (auto-calculated) if no admin bonus is set
        if ((!hvn.admin_bonus || hvn.admin_bonus <= 0) && hvn.current_bonus && hvn.current_bonus > 0) {
          bonusAmount += hvn.current_bonus;
        }
        return sum + bonusAmount;
      }, 0);
    };

    // FIX: Generate periods in chronological order (oldest to newest)
    for (let i = 11; i >= 0; i--) {  // Start from oldest (11 periods back) to newest (0 periods back)
      const periodsBack = i;
      const currentPeriodStart = biweeklyPeriodsSinceReference - periodsBack;
      
      const startDate = new Date(referenceDate);
      startDate.setDate(referenceDate.getDate() + (currentPeriodStart * 14));
      
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 13); // 14 days total (0-13)

      // Filter sales for this period
      const periodSales = policySales.filter(sale => {
        const saleDate = new Date(sale.sale_date);
        return saleDate >= startDate && saleDate <= endDate;
      });
      
      // OPTIMIZED: Calculate actual hours worked using pre-fetched time logs
      const totalHours = calculateHoursForPeriod(startDate, endDate);
      const baseBonuses = periodSales.reduce((sum, sale) => sum + sale.bonus, 0);
      
      // OPTIMIZED: Get high value bonuses using pre-fetched data
      const highValueBonuses = getHighValueBonusesForPeriod(startDate, endDate);
      
      const totalBonuses = baseBonuses + highValueBonuses;
      
      // Calculate overtime for biweekly period (80 regular hours)
      const biweeklyRegularLimit = 80; // 40 hours per week × 2 weeks
      const regularHours = Math.min(totalHours, biweeklyRegularLimit);
      const overtimeHours = Math.max(0, totalHours - biweeklyRegularLimit);
      
      // Use employee.hourly_rate consistently
      const regularPay = regularHours * employee.hourly_rate;
      const overtimePay = overtimeHours * employee.hourly_rate * 1.0; // 1x rate for overtime
      const totalPay = regularPay + overtimePay + totalBonuses;
      
      const salesAmount = periodSales.reduce((sum, sale) => sum + sale.amount, 0);

      history.push({
        period: `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        regularHours: Math.round(regularHours * 10) / 10,
        overtimeHours: Math.round(overtimeHours * 10) / 10,
        regularPay: Math.round(regularPay * 100) / 100,
        overtimePay: Math.round(overtimePay * 100) / 100,
        bonuses: Math.round(totalBonuses * 100) / 100,
        totalPay: Math.round(totalPay * 100) / 100,
        salesCount: periodSales.length,
        salesAmount: Math.round(salesAmount)
      });
    }
    
    return history;
  } catch (error) {
    console.error('Error getting employee payroll history:', error);
    return [];
  }
};