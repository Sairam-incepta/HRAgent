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
    const periods: PayrollPeriod[] = [];
    const now = new Date();
    
    // Reference date for biweekly periods (Monday, January 6, 2025)
    const referenceDate = new Date('2025-01-06');
    const daysSinceReference = Math.floor((now.getTime() - referenceDate.getTime()) / (24 * 60 * 60 * 1000));
    const biweeklyPeriodsSinceReference = Math.floor(daysSinceReference / 14);
    
    console.log(`📅 Reference date: ${referenceDate.toISOString()}, periods since: ${biweeklyPeriodsSinceReference}`);
    
    // Get current period
    const currentPeriodStart = biweeklyPeriodsSinceReference;
    const currentStartDate = new Date(referenceDate);
    currentStartDate.setDate(referenceDate.getDate() + (currentPeriodStart * 14));
    const currentEndDate = new Date(currentStartDate);
    currentEndDate.setDate(currentStartDate.getDate() + 13);
    
    console.log(`📅 Current period: ${currentStartDate.toISOString().split('T')[0]} to ${currentEndDate.toISOString().split('T')[0]}`);
    
    // Simple calculation for current period
    const currentPeriodSales = policySales.filter(sale => {
        const saleDate = new Date(sale.sale_date);
      return saleDate >= currentStartDate && saleDate <= currentEndDate;
    });
    
    console.log(`💰 Current period sales: ${currentPeriodSales.length}`);
    
    const currentTotalBonuses = currentPeriodSales.reduce((sum, sale) => sum + (sale.bonus || 0), 0);
    
    // Calculate actual hours worked for current period across all employees
    let currentTotalActualHours = 0;
    for (const emp of activeEmployees) {
      const empHours = await calculateActualHoursForPeriod(emp.id, currentStartDate, currentEndDate);
      currentTotalActualHours += empHours;
    }
    
    const currentActualBasePay = currentTotalActualHours * 25; // $25/hour
    const currentActualPay = currentActualBasePay + currentTotalBonuses;
    
    console.log(`💵 Current period calculation:`, {
      employees: activeEmployees.length,
      actualHours: currentTotalActualHours,
      basePay: currentActualBasePay,
      bonuses: currentTotalBonuses,
      totalPay: currentActualPay
    });
    
    // Add current period
    periods.push({
      period: `${currentStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${currentEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      employees: activeEmployees.length,
      total: Math.round(currentActualPay),
      status: 'current',
      startDate: currentStartDate.toISOString().split('T')[0],
      endDate: currentEndDate.toISOString().split('T')[0],
      details: {
        regularHours: Math.round(Math.min(currentTotalActualHours, activeEmployees.length * 80) * 10) / 10, // 80 hours per employee for biweekly
        overtimeHours: Math.round(Math.max(0, currentTotalActualHours - (activeEmployees.length * 80)) * 10) / 10,
        totalSales: currentPeriodSales.length,
        totalBonuses: Math.round(currentTotalBonuses),
        departmentBreakdown: []
      }
    });
    
    // Add previous periods that have actual data (max 2 for speed)
    for (let i = 1; i <= 2; i++) {
      const periodStart = currentPeriodStart - i;
      const startDate = new Date(referenceDate);
      startDate.setDate(referenceDate.getDate() + (periodStart * 14));
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 13);
      
      const periodSales = policySales.filter(sale => {
        const saleDate = new Date(sale.sale_date);
        return saleDate >= startDate && saleDate <= endDate;
      });
      
      // Calculate actual hours worked for this period across all employees
      let totalActualHours = 0;
      for (const emp of activeEmployees) {
        const empHours = await calculateActualHoursForPeriod(emp.id, startDate, endDate);
        totalActualHours += empHours;
      }
      
      // Only add period if there's actual data (hours worked OR sales)
      if (totalActualHours > 0 || periodSales.length > 0) {
        const totalBonuses = periodSales.reduce((sum, sale) => sum + (sale.bonus || 0), 0);
        const totalBasePay = totalActualHours * 25; // Use actual hours, not estimated
        const totalPay = totalBasePay + totalBonuses;
        
        periods.unshift({
          period: `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
          employees: activeEmployees.length,
          total: Math.round(totalPay),
          status: 'completed',
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          details: {
            regularHours: Math.round(Math.min(totalActualHours, activeEmployees.length * 80) * 10) / 10, // 80 hours per employee for biweekly
            overtimeHours: Math.round(Math.max(0, totalActualHours - (activeEmployees.length * 80)) * 10) / 10,
            totalSales: periodSales.length,
            totalBonuses: Math.round(totalBonuses),
            departmentBreakdown: []
          }
        });
      }
    }
    
    // Add next 2 upcoming periods
    for (let i = 1; i <= 2; i++) {
      const periodStart = currentPeriodStart + i;
      const startDate = new Date(referenceDate);
      startDate.setDate(referenceDate.getDate() + (periodStart * 14));
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 13);
      
      periods.push({
        period: `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
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
      });
    }
    
    console.log(`📊 Generated ${periods.length} payroll periods`);
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
    
    const [employees, policySales] = await Promise.all([
      getEmployees(),
      getPolicySales()
    ]);

    console.log(`📊 Found ${employees.length} employees and ${policySales.length} total policy sales`);

    const start = new Date(startDate);
    const end = new Date(endDate);

    const periodSales = policySales.filter((sale: any) => {
      const saleDate = new Date(sale.sale_date);
      return saleDate >= start && saleDate <= end;
    });

    console.log(`📈 Found ${periodSales.length} sales in period ${startDate} to ${endDate}`);
    
    if (periodSales.length > 0) {
      console.log('📋 Period sales:', periodSales.map(s => ({
        employee_id: s.employee_id,
        amount: s.amount,
        bonus: s.bonus,
        sale_date: s.sale_date
      })));
    }

    // Get high value policy notifications for this period
    // Use overlapping date ranges to catch notifications that span across period boundaries
    const { data: highValueNotifications } = await supabase
      .from('high_value_policy_notifications')
      .select('*')
      .lte('biweekly_period_start', endDate)
      .gte('biweekly_period_end', startDate);

    // Get client reviews for this period
    const { data: clientReviews } = await supabase
      .from('client_reviews')
      .select('*')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    const employeeDetails = [];
    let summaryBonusBreakdown = {
      brokerFeeBonuses: { count: 0, amount: 0 },
      crossSellingBonuses: { count: 0, amount: 0 },
      lifeInsuranceBonuses: { count: 0, amount: 0 },
      reviewBonuses: { count: 0, amount: 0 },
      highValuePolicyBonuses: { count: 0, amount: 0 }
    };

    for (const emp of employees) {
      console.log(`👤 Processing employee: ${emp.name} (${emp.clerk_user_id})`);
      
      // Skip admin users for hour calculations (they don't clock in/out)
      const isAdmin = emp.position === 'HR Manager' || emp.email === 'admin@letsinsure.hr';
      
      const empSales = periodSales.filter((s: any) => s.employee_id === emp.clerk_user_id);
      console.log(`💰 Employee ${emp.name} has ${empSales.length} sales in this period`);
      
      // Calculate actual hours worked from time logs (skip for admin users)
      let actualHours = 0;
      if (!isAdmin) {
        actualHours = await calculateActualHoursForPeriod(emp.clerk_user_id, start, end);
        console.log(`⏰ Employee ${emp.name} worked ${actualHours} actual hours in this period`);
      } else {
        console.log(`🔧 Skipping hour calculation for admin user ${emp.name}`);
      }
      
      // Use actual hours only - no estimates for completed periods
      const totalHours = actualHours;
      console.log(`📊 Employee ${emp.name} using ${totalHours} actual hours`);
      
      // Calculate detailed bonus breakdown
      let empBonusBreakdown = {
        brokerFeeBonuses: { count: 0, amount: 0 },
        crossSellingBonuses: { count: 0, amount: 0 },
        lifeInsuranceBonuses: { count: 0, amount: 0 },
        reviewBonuses: { count: 0, amount: 0 },
        highValuePolicyBonuses: { count: 0, amount: 0 }
      };

      // Process policy sales for detailed bonuses
      empSales.forEach((sale: any) => {
        // Broker fee bonus: 10% of (broker fee - 100)
        if (sale.broker_fee > 100) {
          const baseBrokerBonus = (sale.broker_fee - 100) * 0.1;
          empBonusBreakdown.brokerFeeBonuses.count++;
          empBonusBreakdown.brokerFeeBonuses.amount += baseBrokerBonus;
          
          // Cross-selling bonus: double the broker fee bonus (additional amount)
          if (sale.cross_sold) {
            empBonusBreakdown.crossSellingBonuses.count++;
            empBonusBreakdown.crossSellingBonuses.amount += baseBrokerBonus; // Additional amount for cross-selling
          }
        }
        
        // Life insurance bonus: $10 for life insurance policies
        if (sale.policy_type?.toLowerCase().includes('life') || 
            (sale.cross_sold_type && sale.cross_sold_type.toLowerCase().includes('life'))) {
          empBonusBreakdown.lifeInsuranceBonuses.count++;
          empBonusBreakdown.lifeInsuranceBonuses.amount += 10.00;
        }
      });

      // Review bonuses: $10 for each 5-star review by this employee
      const empReviews = (clientReviews || []).filter((review: any) => review.employee_id === emp.clerk_user_id);
      const fiveStarReviews = empReviews.filter((review: any) => review.rating === 5);
      empBonusBreakdown.reviewBonuses.count = fiveStarReviews.length;
      empBonusBreakdown.reviewBonuses.amount = fiveStarReviews.length * 10;

      // Calculate high value policy bonuses for this employee in this period (only reviewed/resolved)
      const empHighValueNotifications = (highValueNotifications || [])
        .filter((hvn: any) => hvn.employee_id === emp.clerk_user_id && (hvn.status === 'reviewed' || hvn.status === 'resolved'));
      
      let empHighValueBonusAmount = 0;
      let empHighValueBonusCount = 0;
      
      empHighValueNotifications.forEach((hvn: any) => {
        let bonusAmount = 0;
        // Include admin bonus if set
        if (hvn.admin_bonus && hvn.admin_bonus > 0) {
          bonusAmount += hvn.admin_bonus;
        }
        // Include current bonus (auto-calculated) if no admin bonus is set
        if ((!hvn.admin_bonus || hvn.admin_bonus <= 0) && hvn.current_bonus && hvn.current_bonus > 0) {
          bonusAmount += hvn.current_bonus;
        }
        
        if (bonusAmount > 0) {
          empHighValueBonusAmount += bonusAmount;
          empHighValueBonusCount++;
        }
      });
      
      empBonusBreakdown.highValuePolicyBonuses.count = empHighValueBonusCount;
      empBonusBreakdown.highValuePolicyBonuses.amount = empHighValueBonusAmount;

      // Calculate total bonuses
      const totalBonuses = 
        empBonusBreakdown.brokerFeeBonuses.amount +
        empBonusBreakdown.crossSellingBonuses.amount +
        empBonusBreakdown.lifeInsuranceBonuses.amount +
        empBonusBreakdown.reviewBonuses.amount +
        empBonusBreakdown.highValuePolicyBonuses.amount;

      const totalPay = (totalHours * emp.hourly_rate) + totalBonuses;
      const salesAmount = empSales.reduce((sum: number, s: any) => sum + s.amount, 0);

      // Add to summary breakdown
      summaryBonusBreakdown.brokerFeeBonuses.count += empBonusBreakdown.brokerFeeBonuses.count;
      summaryBonusBreakdown.brokerFeeBonuses.amount += empBonusBreakdown.brokerFeeBonuses.amount;
      summaryBonusBreakdown.crossSellingBonuses.count += empBonusBreakdown.crossSellingBonuses.count;
      summaryBonusBreakdown.crossSellingBonuses.amount += empBonusBreakdown.crossSellingBonuses.amount;
      summaryBonusBreakdown.lifeInsuranceBonuses.count += empBonusBreakdown.lifeInsuranceBonuses.count;
      summaryBonusBreakdown.lifeInsuranceBonuses.amount += empBonusBreakdown.lifeInsuranceBonuses.amount;
      summaryBonusBreakdown.reviewBonuses.count += empBonusBreakdown.reviewBonuses.count;
      summaryBonusBreakdown.reviewBonuses.amount += empBonusBreakdown.reviewBonuses.amount;
      summaryBonusBreakdown.highValuePolicyBonuses.count += empBonusBreakdown.highValuePolicyBonuses.count;
      summaryBonusBreakdown.highValuePolicyBonuses.amount += empBonusBreakdown.highValuePolicyBonuses.amount;

      console.log(`💵 Employee ${emp.name} summary:`, {
        actualHours,
        totalHours,
        hourlyRate: emp.hourly_rate,
        bonusBreakdown: empBonusBreakdown,
        totalBonuses,
        totalPay,
        salesCount: empSales.length,
        salesAmount
      });

      // Calculate overtime for biweekly period (80 regular hours)
      const biweeklyRegularLimit = 80; // 40 hours per week × 2 weeks
      const regularHours = Math.min(totalHours, biweeklyRegularLimit);
      const overtimeHours = Math.max(0, totalHours - biweeklyRegularLimit);
      const regularPay = regularHours * emp.hourly_rate;
      const overtimePay = overtimeHours * emp.hourly_rate * 1.0; // 1x rate for overtime
      const basePay = regularPay + overtimePay;

      employeeDetails.push({
        id: emp.id,
        name: emp.name,
        department: emp.department,
        position: emp.position,
        hourlyRate: emp.hourly_rate,
        regularHours: Math.round(regularHours * 10) / 10,
        overtimeHours: Math.round(overtimeHours * 10) / 10,
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
    }

    const totalBrokerFees = periodSales.reduce((sum: number, sale: any) => sum + (sale.broker_fee || 0), 0);

    const summary = {
      totalEmployees: employees.length,
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

    console.log('📊 Final payroll summary:', summary);
    console.log('📊 High Value Policy Bonuses Detail:', summary.bonusBreakdown.highValuePolicyBonuses);

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

    // Generate last 12 biweekly periods for history
    for (let i = 0; i < 12; i++) {
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
      
      // Calculate actual hours worked from time logs
      const totalHours = await calculateActualHoursForPeriod(employeeId, startDate, endDate);
      const baseBonuses = periodSales.reduce((sum, sale) => sum + sale.bonus, 0);
      
      // Get high value policy admin bonuses for this period (only reviewed/resolved)
      // Use overlapping date ranges to catch notifications that span across period boundaries
      const { data: highValueNotifications } = await supabase
        .from('high_value_policy_notifications')
        .select('admin_bonus, current_bonus, status')
        .eq('employee_id', employeeId)
        .lte('biweekly_period_start', endDate.toISOString().split('T')[0])
        .gte('biweekly_period_end', startDate.toISOString().split('T')[0])
        .in('status', ['reviewed', 'resolved']);
      
      const highValueBonuses = (highValueNotifications || [])
        .reduce((sum, hvn) => {
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
      
      const totalBonuses = baseBonuses + highValueBonuses;
      
      // Calculate overtime for biweekly period (80 regular hours)
      const biweeklyRegularLimit = 80; // 40 hours per week × 2 weeks
      const regularHours = Math.min(totalHours, biweeklyRegularLimit);
      const overtimeHours = Math.max(0, totalHours - biweeklyRegularLimit);
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