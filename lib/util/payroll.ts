import { supabase } from "../supabase";
import { getEmployee, getEmployees } from "./employee";
import { getPolicySales } from "./policies";
import { getLocalDateString } from "./timezone";
import { calculateWorkHoursWithLunchDeduction, calculateActualHoursForPeriod } from "./misc";
import { getEmployeeRateForDate } from "./misc";
import { appSettings } from "../config/app-settings";

// Enhanced Payroll Functions with Real Database Data
export interface PayrollPeriod {
  period: string;  // ✅
  employees: number;  // ✅
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

interface EmployeeDetail {
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
}

export const getPayrollPeriods = async (): Promise<PayrollPeriod[]> => {
  try {
    const [employees, policySales] = await Promise.all([
      getEmployees(),
      getPolicySales()
    ]);

    const activeEmployees = employees.filter(emp => emp.status === 'active');
    const activeEmployeeIds = activeEmployees.map(emp => emp.clerk_user_id);
    const periods: PayrollPeriod[] = [];
    const now = new Date();

    // Constants
    const HOURS_PER_EMPLOYEE_BIWEEKLY = 80;
    const MAX_PREVIOUS_PERIODS = 3;

    // Helper functions
    const isAdmin = (emp: any): boolean => 
      emp.position === 'Administrator';

    // FIXED: Use the same period calculation as the working payroll dialog
    const calculatePeriodDates = (periodOffset: number): { startDate: Date; endDate: Date } => {
      const referenceDate = new Date('2025-01-06'); // Monday, January 6, 2025 as reference
      const daysSinceReference = Math.floor((now.getTime() - referenceDate.getTime()) / (24 * 60 * 60 * 1000));
      const biweeklyPeriodsSinceReference = Math.floor(daysSinceReference / 14);
      
      const actualPeriodOffset = biweeklyPeriodsSinceReference + periodOffset;
      
      const startDate = new Date(referenceDate);
      startDate.setDate(referenceDate.getDate() + (actualPeriodOffset * 14));
      
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 13); // 14 days total (0-13)
      
      return { startDate, endDate };
    };

    const formatPeriodName = (startDate: Date, endDate: Date): string => 
      `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    const filterSalesForPeriod = (startDate: Date, endDate: Date) => 
      policySales.filter(sale => {
        const saleDate = new Date(sale.sale_date);
        return saleDate >= startDate && saleDate <= endDate;
      });
    
    // FIXED: Updated calculateTotalBonuses function with correct logic
    const calculateTotalBonuses = async (sales: any[], startDate: Date, endDate: Date): Promise<number> => {
      try {
        if (!sales || sales.length === 0) return 0;

        const startDateStr = getLocalDateString(startDate);
        const endDateStr = getLocalDateString(endDate);
        const saleIds = sales.map(sale => sale.id);
        
        const employeeIds = Array.from(new Set(sales.map(sale => sale.employee_id)));

        const [
          { data: policySalesData, error: policySalesError },
          { data: highValueNotifications, error: highValueError },
          { data: clientReviews, error: reviewsError }
        ] = await Promise.all([
          supabase
            .from('policy_sales')
            .select('id, broker_fee, is_cross_sold_policy, policy_type, amount')
            .in('id', saleIds)
            .gte('sale_date', startDateStr)
            .lte('sale_date', endDateStr),
          
          supabase
            .from('high_value_policy_notifications')
            .select('id, employee_id, admin_bonus')
            .in('employee_id', employeeIds)
            .gte('reviewed_at', startDateStr)
            .lte('reviewed_at', endDateStr),
          
          supabase
            .from('client_reviews')
            .select('employee_id, rating, review_date')
            .in('employee_id', employeeIds)
            .gte('review_date', startDateStr)
            .lte('review_date', endDateStr)
        ]);

        if (policySalesError) {
          console.error('Error fetching policy sales data:', policySalesError);
          return 0;
        }

        const policySalesMap = new Map(
          (policySalesData || []).map(policy => [policy.id, policy])
        );
        
        const highValueByEmployee = new Map<string, any[]>();
        (highValueNotifications || []).forEach(notification => {
          if (!highValueByEmployee.has(notification.employee_id)) {
            highValueByEmployee.set(notification.employee_id, []);
          }
          highValueByEmployee.get(notification.employee_id)!.push(notification);
        });

        let totalBonuses = 0;

        // Calculate bonuses for regular policies < threshold
        sales.forEach(sale => {
          const policyData = policySalesMap.get(sale.id);
          if (!policyData) return;

          const {
            broker_fee = 0,
            is_cross_sold_policy = false,
            policy_type = '',
            amount = 0
          } = policyData;

          // Only calculate individual bonuses for policies < threshold
          if (amount < appSettings.highValueThreshold) {
            let saleBonus = 0;

            // 1. Broker fee bonus: 10% of (broker fee - 100)
            if (broker_fee > 100) {
              const baseBrokerBonus = (broker_fee - 100) * 0.1;
              saleBonus += baseBrokerBonus;

              // 2. Cross-selling bonus: additional base broker bonus
              if (is_cross_sold_policy) {
                saleBonus += baseBrokerBonus;
              }
            }

            // 3. Life insurance bonus: $10
            const policyTypeLower = (policy_type || '').toLowerCase();
            if (policyTypeLower.includes('life') || policyTypeLower.includes('life_insurance')) {
              saleBonus += 10;
            }

            totalBonuses += saleBonus;
          }
        });

        // Add admin bonuses for high-value policies (period-level)
        const adminBonuses = Array.from(highValueByEmployee.values())
          .flat()
          .reduce((sum, notification) => sum + (notification.admin_bonus || 0), 0);
        totalBonuses += adminBonuses;

        // Add review bonuses
        const fiveStarReviews = (clientReviews || []).filter(review => review.rating === 5);
        totalBonuses += fiveStarReviews.length * 10;

        return Math.round(totalBonuses * 100) / 100;
      } catch (error) {
        console.error('Error calculating total bonuses:', error);
        return 0;
      }
    };

    const calculateHoursBreakdown = (totalHours: number, employeeCount: number) => {
      const maxRegularHours = employeeCount * HOURS_PER_EMPLOYEE_BIWEEKLY;
      return {
        regularHours: Math.round(Math.min(totalHours, maxRegularHours) * 10) / 10,
        overtimeHours: Math.round(Math.max(0, totalHours - maxRegularHours) * 10) / 10
      };
    };

    // Calculate current period offset based on the working dialog logic
    const referenceDate = new Date('2025-01-06');
    const daysSinceReference = Math.floor((now.getTime() - referenceDate.getTime()) / (24 * 60 * 60 * 1000));
    const currentPeriodOffset = Math.floor(daysSinceReference / 14);

    // Get date range for current + previous periods only
    const { startDate: allPeriodsStart } = calculatePeriodDates(-MAX_PREVIOUS_PERIODS);
    const { endDate: allPeriodsEnd } = calculatePeriodDates(0);

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
        if (log.clock_in && log.clock_out && !log.break_start && !log.break_end) {
          const clockInTime = new Date(log.clock_in);
          const clockOutTime = new Date(log.clock_out);
          totalHours += calculateWorkHoursWithLunchDeduction(clockInTime, clockOutTime);
        } else if (log.clock_in && !log.clock_out && log.date === today && !log.break_start && !log.break_end) {
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

    // Helper function to create a period object (now async)
    const createPeriodObject = async (
      periodOffset: number, 
      status: 'completed' | 'current'
    ): Promise<PayrollPeriod> => {
      const { startDate, endDate } = calculatePeriodDates(periodOffset);
      const periodSales = filterSalesForPeriod(startDate, endDate);
      const totalBonuses = await calculateTotalBonuses(periodSales, startDate, endDate);
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
          departmentBreakdown: []
        }
      };
    };

    // Create lightweight upcoming period
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

    // Generate periods
    // 1. Add previous periods that have meaningful data
    for (let i = -MAX_PREVIOUS_PERIODS; i < 0; i++) {
      const { startDate, endDate } = calculatePeriodDates(i);
      
      // Quick check: Do we have any time logs or sales for this period?
      const periodSales = filterSalesForPeriod(startDate, endDate);
      const startDateStr = getLocalDateString(startDate);
      const endDateStr = getLocalDateString(endDate);
      const hasTimeLogs = (allTimeLogs || []).some(log => 
        log.date >= startDateStr && log.date <= endDateStr
      );
      
      // Only calculate full period data if there's any activity
      if (hasTimeLogs || periodSales.length > 0) {
        periods.push(await createPeriodObject(i, 'completed'));
      }
    }

    // 2. Add current period (always included)
    periods.push(await createPeriodObject(0, 'current'));

    // 3. Add next upcoming period
    periods.push(createUpcomingPeriod(1));

    return periods;
  } 
  catch (error) {
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
    
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Constants - shared with getPayrollPeriods
    const BIWEEKLY_REGULAR_HOURS = 80;
    const OVERTIME_MULTIPLIER = 1.0;

    // Helper functions - extracted and reusable
    const isAdmin = (emp: any): boolean => 
      emp.position === 'Administrator';

    const calculateHoursBreakdown = (totalHours: number) => {
      const regularHours = Math.min(totalHours, BIWEEKLY_REGULAR_HOURS);
      const overtimeHours = Math.max(0, totalHours - BIWEEKLY_REGULAR_HOURS);
      return {
        regularHours: Math.round(regularHours * 10) / 10,
        overtimeHours: Math.round(overtimeHours * 10) / 10
      };
    };

    // Get employees first, then fetch all data in parallel
    const employees = await getEmployees();
    const activeEmployees = employees.filter(emp => emp.status === 'active');
    const activeEmployeeIds = activeEmployees.map(emp => emp.clerk_user_id);
    
    const [
      policySales, 
      highValueNotificationsResult, 
      clientReviewsResult,
      timeLogsResult
    ] = await Promise.all([
      getPolicySales(),
      supabase
        .from('high_value_policy_notifications')
        .select('id, employee_id, admin_bonus')
        .in('employee_id', activeEmployeeIds)
        .gte('reviewed_at', getLocalDateString(start))
        .lte('reviewed_at', getLocalDateString(end)),
      supabase
        .from('client_reviews')
        .select('employee_id, rating, review_date')
        .in('employee_id', activeEmployeeIds)
        .gte('review_date', getLocalDateString(start))
        .lte('review_date', getLocalDateString(end)),
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
    
    if (timeLogsResult?.error) {
      console.error('❌ Error fetching time logs:', timeLogsResult.error);
    }
    if (highValueNotificationsResult?.error) {
      console.error('❌ Error fetching high value notifications:', highValueNotificationsResult.error);
    }
    if (clientReviewsResult?.error) {
      console.error('❌ Error fetching client reviews:', clientReviewsResult.error);
    }

    // Filter sales once and create lookup maps
    const periodSales = policySales.filter((sale: any) => {
      const saleDate = new Date(sale.sale_date);
      return saleDate >= start && saleDate <= end;
    });

    // Create lookup maps for O(1) access
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

    // Calculate hours for a specific employee using pre-grouped data
    const calculateEmployeeHours = (employeeId: string): number => {
      const employeeLogs = timeLogsByEmployee.get(employeeId) || [];
      const today = getLocalDateString();
      let totalHours = 0;

      employeeLogs.forEach(log => {
        if (log.clock_in && log.clock_out && !log.break_start && !log.break_end) {
          const clockInTime = new Date(log.clock_in);
          const clockOutTime = new Date(log.clock_out);
          totalHours += calculateWorkHoursWithLunchDeduction(clockInTime, clockOutTime);
        } else if (log.clock_in && !log.clock_out && log.date === today && !log.break_start && !log.break_end) {
          const clockInTime = new Date(log.clock_in);
          const now = new Date();
          totalHours += calculateWorkHoursWithLunchDeduction(clockInTime, now);
        }
      });

      return Math.round(totalHours * 100) / 100;
    };

    // Process all employees at once
    const employeeDetails: EmployeeDetail[] = [];
    let summaryBonusBreakdown = {
      brokerFeeBonuses: { count: 0, amount: 0 },
      crossSellingBonuses: { count: 0, amount: 0 },
      lifeInsuranceBonuses: { count: 0, amount: 0 },
      reviewBonuses: { count: 0, amount: 0 },
      highValuePolicyBonuses: { count: 0, amount: 0 }
    };

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

      // FIXED: Updated bonus calculation with correct logic
      empSales.forEach((sale: any) => {
        const {
          broker_fee = 0,
          is_cross_sold_policy = false,
          policy_type = '',
          amount = 0
        } = sale;

        // Only calculate individual bonuses for policies < threshold
        if (amount < appSettings.highValueThreshold) {
          // Broker fee bonus: 10% of (broker fee - 100)
          if (broker_fee > 100) {
            const baseBonus = (broker_fee - 100) * 0.1;
            empBonusBreakdown.brokerFeeBonuses.count++;
            empBonusBreakdown.brokerFeeBonuses.amount += baseBonus;
            
            // Cross-selling bonus: additional 1x of base broker bonus
            if (is_cross_sold_policy) {
              empBonusBreakdown.crossSellingBonuses.count++;
              empBonusBreakdown.crossSellingBonuses.amount += baseBonus;
            }
          }
          
          // Life insurance bonus
          const policyTypeLower = (policy_type || '').toLowerCase();
          if (policyTypeLower.includes('life') || policyTypeLower.includes('life_insurance')) {
            empBonusBreakdown.lifeInsuranceBonuses.count++;
            empBonusBreakdown.lifeInsuranceBonuses.amount += 10.00;
          }
        }
      });

      // For high-value policies, only admin bonuses (period-level, not per-sale)
      const totalAdminBonus = empHVNotifications.reduce((sum, notification) => {
        return sum + (notification.admin_bonus || 0);
      }, 0);
      
      if (totalAdminBonus > 0) {
        empBonusBreakdown.highValuePolicyBonuses.count = empHVNotifications.length;
        empBonusBreakdown.highValuePolicyBonuses.amount = totalAdminBonus;
      }

      // Review bonuses
      const fiveStarReviews = empReviews.filter((review: any) => review.rating === 5);
      empBonusBreakdown.reviewBonuses.count = fiveStarReviews.length;
      empBonusBreakdown.reviewBonuses.amount = fiveStarReviews.length * 10;

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
      (Object.keys(summaryBonusBreakdown) as Array<keyof typeof summaryBonusBreakdown>).forEach(key => {
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

    // Calculate summary using reduce for better performance
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

    // Bulk fetch all data needed for bonus calculations
    const allStartDateStr = getLocalDateString(oldestStartDate);
    const allEndDateStr = getLocalDateString(newestEndDate);

    const [timeLogsResult, highValueNotificationsResult, clientReviewsResult] = await Promise.all([
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
        .select('id, employee_id, admin_bonus, reviewed_at, created_at')
        .eq('employee_id', employeeId)
        .gte('reviewed_at', allStartDateStr)
        .lte('reviewed_at', allEndDateStr),
      
      supabase
        .from('client_reviews')
        .select('employee_id, rating, review_date')
        .eq('employee_id', employeeId)
        .gte('review_date', allStartDateStr)
        .lte('review_date', allEndDateStr)
    ]);

    const allTimeLogs = timeLogsResult.data || [];
    const allHighValueNotifications = highValueNotificationsResult.data || [];
    const allClientReviews = clientReviewsResult.data || [];

    if (timeLogsResult.error) {
      console.error('Error fetching time logs for payroll history:', timeLogsResult.error);
    }
    if (highValueNotificationsResult.error) {
      console.error('Error fetching high value notifications for payroll history:', highValueNotificationsResult.error);
    }
    if (clientReviewsResult.error) {
      console.error('Error fetching client reviews for payroll history:', clientReviewsResult.error);
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
        if (log.clock_in && log.clock_out && !log.break_start && !log.break_end) {
          const clockInTime = new Date(log.clock_in);
          const clockOutTime = new Date(log.clock_out);
          totalHours += calculateWorkHoursWithLunchDeduction(clockInTime, clockOutTime);
        } else if (log.clock_in && !log.clock_out && log.date === today && !log.break_start && !log.break_end) {
          const clockInTime = new Date(log.clock_in);
          const now = new Date();
          totalHours += calculateWorkHoursWithLunchDeduction(clockInTime, now);
        }
      });

      return Math.round(totalHours * 100) / 100;
    };

    // FIXED: Bonus calculation function with correct high-value policy logic
    const calculateBonusesForPeriod = async (periodSales: any[], startDate: Date, endDate: Date): Promise<number> => {
      try {
        if (!periodSales || periodSales.length === 0) return 0;

        const startDateStr = getLocalDateString(startDate);
        const endDateStr = getLocalDateString(endDate);
        const saleIds = periodSales.map(sale => sale.id);

        // Fetch policy sales data for bonus calculations
        const { data: policySalesData, error: policySalesError } = await supabase
          .from('policy_sales')
          .select('id, broker_fee, is_cross_sold_policy, policy_type, amount')
          .in('id', saleIds)
          .gte('sale_date', startDateStr)
          .lte('sale_date', endDateStr);

        if (policySalesError) {
          console.error('Error fetching policy sales data for bonus calculation:', policySalesError);
          return 0;
        }

        // Create lookup map for policy data
        const policySalesMap = new Map(
          (policySalesData || []).map(policy => [policy.id, policy])
        );

        // Calculate sale-based bonuses (ONLY for policies < $5000)
        let totalBonuses = 0;

        periodSales.forEach(sale => {
          const policyData = policySalesMap.get(sale.id);
          if (!policyData) return;

          const {
            broker_fee = 0,
            is_cross_sold_policy = false,
            policy_type = '',
            amount = 0
          } = policyData;

                  // ONLY calculate bonuses for regular policies (< threshold)
        if (amount < appSettings.highValueThreshold) {
            let saleBonus = 0;
            
            // 1. Broker fee bonus: 10% of (broker fee - 100)
            if (broker_fee > 100) {
              const baseBrokerBonus = (broker_fee - 100) * 0.1;
              saleBonus += baseBrokerBonus;

              // 2. Cross-selling bonus: additional 1x of base broker bonus
              if (is_cross_sold_policy) {
                saleBonus += baseBrokerBonus;
              }
            }
            
            // 3. Life insurance bonus: $10
            const policyTypeLower = (policy_type || '').toLowerCase();
            if (policyTypeLower.includes('life') || policyTypeLower.includes('life_insurance')) {
              saleBonus += 10;
            }

            totalBonuses += saleBonus;
          }
          // For high-value policies (≥ $5000), no individual bonuses are calculated
        });

        // 4. Add admin bonuses for high-value policies (period-level, not per-sale)
        const periodHighValueNotifications = allHighValueNotifications.filter(hvn => {
          const notificationDate = getLocalDateString(new Date(hvn.reviewed_at || hvn.created_at));
          return notificationDate >= startDateStr && notificationDate <= endDateStr;
        });
        
        const adminBonuses = periodHighValueNotifications.reduce((sum, notification) => {
          return sum + (notification.admin_bonus || 0);
        }, 0);
        totalBonuses += adminBonuses;

        // 5. Add review bonuses for the period
        const periodReviews = allClientReviews.filter(review => {
          const reviewDate = getLocalDateString(new Date(review.review_date));
          return reviewDate >= startDateStr && reviewDate <= endDateStr;
        });
        
        const fiveStarReviews = periodReviews.filter(review => review.rating === 5);
        const reviewBonuses = fiveStarReviews.length * 10;
        totalBonuses += reviewBonuses;

        return Math.round(totalBonuses * 100) / 100;
      } catch (error) {
        console.error('Error calculating bonuses for period:', error);
        return 0;
      }
    };

    // Generate periods in chronological order (oldest to newest)
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
      
      // Calculate actual hours worked using pre-fetched time logs
      const totalHours = calculateHoursForPeriod(startDate, endDate);
      
      // Use new bonus calculation system
      const totalBonuses = await calculateBonusesForPeriod(periodSales, startDate, endDate);
      
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
    
    return history.reverse(); // Show newest periods first
  } catch (error) {
    console.error('Error getting employee payroll history:', error);
    return [];
  }
};

export const calculateIndividualPolicyBonus = async (policyId: string, employeeId: string): Promise<{
  totalBonus: number;
  breakdown: {
    brokerFeeBonus: number;
    crossSellingBonus: number;
    lifeInsuranceBonus: number;
    adminBonus: number;
  };
  isHighValue: boolean;
}> => {
  try {
    // Fetch the policy details
    const { data: policyData, error: policyError } = await supabase
      .from('policy_sales')
      .select('id, broker_fee, is_cross_sold_policy, policy_type, amount, sale_date, policy_number')
      .eq('id', policyId)
      .single();

    if (policyError || !policyData) {
      console.error('Error fetching policy data:', policyError);
      return {
        totalBonus: 0,
        breakdown: {
          brokerFeeBonus: 0,
          crossSellingBonus: 0,
          lifeInsuranceBonus: 0,
          adminBonus: 0
        },
        isHighValue: false
      };
    }

    const {
      broker_fee = 0,
      is_cross_sold_policy = false,
      policy_type = '',
      amount = 0,
      policy_number
    } = policyData;

    let totalBonus = 0;
    const breakdown = {
      brokerFeeBonus: 0,
      crossSellingBonus: 0,
      lifeInsuranceBonus: 0,
      adminBonus: 0
    };

    const isHighValue = amount >= appSettings.highValueThreshold;

    if (isHighValue) {
    // For high-value policies (≥ $5000), ONLY use admin bonus
    const { data: highValueNotifications, error: hvError } = await supabase
      .from('high_value_policy_notifications')
      .select('admin_bonus, status, policy_number')
      .eq('employee_id', employeeId)
      .eq('policy_number', policyData.policy_number)
      .eq('status', 'reviewed'); // Only reviewed notifications have valid admin bonuses

    if (!hvError && highValueNotifications && highValueNotifications.length > 0) {
      const adminBonus = highValueNotifications.reduce((sum, notification) => {
        return sum + (notification.admin_bonus || 0);
      }, 0);
      breakdown.adminBonus = adminBonus;
      totalBonus = adminBonus;
    }
    } else {
    // For regular policies (< $5000), calculate standard bonuses
    // 1. Broker fee bonus: 10% of (broker fee - 100) - only if broker_fee > 100
    if (broker_fee > 100) {
      const baseBrokerBonus = (broker_fee - 100) * 0.1;
      breakdown.brokerFeeBonus = baseBrokerBonus;
      totalBonus += baseBrokerBonus;
      // 2. Cross-selling bonus: additional broker fee bonus if cross-sold
      if (is_cross_sold_policy) {
        const crossSellingBonus = baseBrokerBonus;
        breakdown.crossSellingBonus = crossSellingBonus;
        totalBonus += crossSellingBonus;
      }
    }
    }

    // 3. Life insurance bonus: $10 if policy type contains 'life' (applies to ALL policies)
    const policyTypeLower = policy_type.toLowerCase();
    if (policyTypeLower.includes('life') || policyTypeLower.includes('life_insurance')) {
    breakdown.lifeInsuranceBonus = 10;
    totalBonus += 10;
    }

    return {
      totalBonus: Math.round(totalBonus * 100) / 100,
      breakdown: {
        brokerFeeBonus: Math.round(breakdown.brokerFeeBonus * 100) / 100,
        crossSellingBonus: Math.round(breakdown.crossSellingBonus * 100) / 100,
        lifeInsuranceBonus: Math.round(breakdown.lifeInsuranceBonus * 100) / 100,
        adminBonus: Math.round(breakdown.adminBonus * 100) / 100
      },
      isHighValue
    };
  } catch (error) {
    console.error('Error calculating individual policy bonus:', error);
    return {
      totalBonus: 0,
      breakdown: {
        brokerFeeBonus: 0,
        crossSellingBonus: 0,
        lifeInsuranceBonus: 0,
        adminBonus: 0
      },
      isHighValue: false
    };
  }
};