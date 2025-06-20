import { supabase } from './supabase';
import { getAuthenticatedSupabaseClient } from './supabase-client';
import type { 
  PolicySale, 
  EmployeeBonus, 
  ClientReview, 
  DailySummary, 
  ConversationState,
  Employee,
  OvertimeRequest,
  HighValuePolicyNotification
} from './supabase';

// Timezone-aware date utilities
const getLocalDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalStartOfDay = (date: Date = new Date()): Date => {
  const localDate = new Date(date);
  localDate.setHours(0, 0, 0, 0);
  return localDate;
};

const getLocalEndOfDay = (date: Date = new Date()): Date => {
  const localDate = new Date(date);
  localDate.setHours(23, 59, 59, 999);
  return localDate;
};

const getLocalStartOfWeek = (date: Date = new Date()): Date => {
  const localDate = new Date(date);
  const day = localDate.getDay();
  const diff = localDate.getDate() - day; // Sunday is 0
  localDate.setDate(diff);
  localDate.setHours(0, 0, 0, 0);
  return localDate;
};

const getLocalEndOfWeek = (date: Date = new Date()): Date => {
  const localDate = new Date(date);
  const day = localDate.getDay();
  const diff = localDate.getDate() - day + 6; // Saturday is 6
  localDate.setDate(diff);
  localDate.setHours(23, 59, 59, 999);
  return localDate;
};

// Debug utility to log timezone information
export const logTimezoneInfo = () => {
  const now = new Date();
  console.log('🌍 Timezone Debug Info:');
  console.log('  Local time:', now.toString());
  console.log('  UTC time:', now.toISOString());
  console.log('  Local date string:', getLocalDateString(now));
  console.log('  UTC date string:', now.toISOString().split('T')[0]);
  console.log('  Timezone offset:', now.getTimezoneOffset(), 'minutes');
  console.log('  Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
};

// Helper function to calculate bonus based on broker fees (not policy amount)
export const calculateBonus = (brokerFee: number, isCrossSold: boolean = false): number => {
  if (brokerFee <= 100) return 0;
  const baseBonus = Math.round((brokerFee - 100) * 0.1 * 100) / 100;
  
  // Double commission for cross-sold policies
  return isCrossSold ? baseBonus * 2 : baseBonus;
};

// Helper function to calculate life insurance referral bonus
export const calculateLifeInsuranceReferralBonus = (policyType: string, crossSoldType?: string): number => {
  // $10 for life insurance referrals (separate from cross-sell)
  if (policyType.toLowerCase().includes('life') || 
      (crossSoldType && crossSoldType.toLowerCase().includes('life'))) {
    return 10.00;
  }
  return 0;
};

// Helper function to calculate 5-star review bonus
export const calculateReviewBonus = (rating: number): number => {
  return rating === 5 ? 10.00 : 0;
};

// Policy Sales Functions
export const addPolicySale = async (sale: {
  policyNumber: string;
  clientName: string;
  policyType: string;
  amount: number;
  brokerFee: number;
  employeeId: string;
  saleDate: Date;
  crossSold?: boolean;
  crossSoldType?: string;
  crossSoldTo?: string;
  clientDescription?: string;
  isCrossSoldPolicy?: boolean;
}): Promise<PolicySale | null> => {
  // Calculate bonuses based on new rules
  const brokerFeeBonus = calculateBonus(sale.brokerFee, sale.crossSold);
  const lifeInsuranceBonus = calculateLifeInsuranceReferralBonus(sale.policyType, sale.crossSoldType);
  const totalBonus = brokerFeeBonus + lifeInsuranceBonus;
  
  const { data, error } = await supabase
    .from('policy_sales')
    .insert({
      policy_number: sale.policyNumber,
      client_name: sale.clientName,
      policy_type: sale.policyType,
      amount: sale.amount,
      broker_fee: sale.brokerFee,
      bonus: totalBonus,
      employee_id: sale.employeeId,
      sale_date: sale.saleDate.toISOString(),
      cross_sold: sale.crossSold || false,
      cross_sold_type: sale.crossSoldType,
      cross_sold_to: sale.crossSoldTo,
      client_description: sale.clientDescription,
      is_cross_sold_policy: sale.isCrossSoldPolicy || false
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding policy sale:', error);
    return null;
  }

  // Update employee bonus
  await updateEmployeeBonus(sale.employeeId, totalBonus);
  
  // Create high-value policy notification if amount > $5000
  if (sale.amount > 5000) {
    await createHighValuePolicyNotification({
      employeeId: sale.employeeId,
      policyNumber: sale.policyNumber,
      policyAmount: sale.amount,
      brokerFee: sale.brokerFee,
      currentBonus: totalBonus,
      isCrossSoldPolicy: sale.isCrossSoldPolicy || false
    });
  }
  
  return data;
};

export const getPolicySales = async (employeeId?: string): Promise<PolicySale[]> => {
  let query = supabase.from('policy_sales').select('*');
  
  if (employeeId) {
    query = query.eq('employee_id', employeeId);
  }
  
  const { data, error } = await query.order('sale_date', { ascending: false });

  if (error) {
    console.error('Error fetching policy sales:', error);
    return [];
  }

  return data || [];
};

export const getCrossSoldPolicies = async (employeeId: string): Promise<PolicySale[]> => {
  const { data, error } = await supabase
    .from('policy_sales')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('cross_sold', true)
    .order('sale_date', { ascending: false });

  if (error) {
    console.error('Error fetching cross-sold policies:', error);
    return [];
  }

  return data || [];
};

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
    .lt('sale_date', endOfDay.toISOString())
    .order('sale_date', { ascending: false });

  if (error) {
    console.error('Error fetching today\'s policy sales:', error);
    return [];
  }

  return data || [];
};

// New function to get today's time tracking data for an employee
export const getTodayTimeTracking = async (employeeId: string): Promise<{ totalHours: number; clockedIn: boolean }> => {
  // For now, we'll simulate this data since we don't have a time_logs table yet
  // In a real implementation, you would query actual time tracking data
  
  // This would typically come from a time_logs table or similar
  // For now, we'll return a reasonable default based on current time
  const currentHour = new Date().getHours();
  let estimatedHours = 0;
  
  // Simple estimation: if it's after 9 AM, assume they've been working
  if (currentHour >= 9) {
    estimatedHours = Math.min(currentHour - 9, 8); // Max 8 hours
  }
  
  return {
    totalHours: estimatedHours,
    clockedIn: currentHour >= 9 && currentHour <= 17 // Assume working hours 9-5
  };
};

// Employee Bonus Functions
const updateEmployeeBonus = async (employeeId: string, bonusToAdd: number): Promise<void> => {
  // First, try to get existing bonus
  const { data: existingBonus } = await supabase
    .from('employee_bonuses')
    .select('*')
    .eq('employee_id', employeeId)
    .single();

  if (existingBonus) {
    // Update existing bonus
    await supabase
      .from('employee_bonuses')
      .update({
        total_bonus: existingBonus.total_bonus + bonusToAdd,
        last_updated: new Date().toISOString()
      })
      .eq('employee_id', employeeId);
  } else {
    // Create new bonus record
    await supabase
      .from('employee_bonuses')
      .insert({
        employee_id: employeeId,
        total_bonus: bonusToAdd
      });
  }
};

export const getEmployeeBonus = async (employeeId: string): Promise<EmployeeBonus | null> => {
  const { data, error } = await supabase
    .from('employee_bonuses')
    .select('*')
    .eq('employee_id', employeeId)
    .single();

  if (error) {
    console.error('Error fetching employee bonus:', error);
    return null;
  }

  return data;
};

// Client Review Functions - Updated to include 5-star review bonus
export const addClientReview = async (review: {
  clientName: string;
  policyNumber: string;
  rating: number;
  review: string;
  reviewDate: Date;
  employeeId: string;
}): Promise<ClientReview | null> => {
  const { data, error } = await supabase
    .from('client_reviews')
    .insert({
      client_name: review.clientName,
      policy_number: review.policyNumber,
      rating: review.rating,
      review: review.review,
      review_date: review.reviewDate.toISOString(),
      employee_id: review.employeeId
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding client review:', error);
    return null;
  }

  // Add 5-star review bonus
  const reviewBonus = calculateReviewBonus(review.rating);
  if (reviewBonus > 0) {
    await updateEmployeeBonus(review.employeeId, reviewBonus);
  }

  return data;
};

export const getClientReviews = async (employeeId?: string): Promise<ClientReview[]> => {
  let query = supabase.from('client_reviews').select('*');
  
  if (employeeId) {
    query = query.eq('employee_id', employeeId);
  }
  
  const { data, error } = await query.order('review_date', { ascending: false });

  if (error) {
    console.error('Error fetching client reviews:', error);
    return [];
  }

  return data || [];
};

// Daily Summary Functions
export const addDailySummary = async (summary: {
  employeeId: string;
  date: Date;
  hoursWorked: number;
  policiesSold: number;
  totalSalesAmount: number;
  totalBrokerFees: number;
  description: string;
  keyActivities: string[];
}): Promise<DailySummary | null> => {
  const { data, error } = await supabase
    .from('daily_summaries')
    .insert({
      employee_id: summary.employeeId,
      date: summary.date.toISOString().split('T')[0], // Date only
      hours_worked: summary.hoursWorked,
      policies_sold: summary.policiesSold,
      total_sales_amount: summary.totalSalesAmount,
      total_broker_fees: summary.totalBrokerFees,
      description: summary.description,
      key_activities: summary.keyActivities
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding daily summary:', error);
    return null;
  }

  return data;
};

export const getDailySummaries = async (employeeId: string): Promise<DailySummary[]> => {
  const { data, error } = await supabase
    .from('daily_summaries')
    .select('*')
    .eq('employee_id', employeeId)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching daily summaries:', error);
    return [];
  }

  return data || [];
};

// Employee Hours (calculated from daily summaries)
export const getEmployeeHours = async (employeeId: string): Promise<{ totalHours: number; thisWeek: number; thisMonth: number }> => {
  const summaries = await getDailySummaries(employeeId);
  
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());

  let thisMonth = 0;
  let thisWeek = 0;

  summaries.forEach(summary => {
    const summaryDate = new Date(summary.date);
    
    if (summaryDate >= startOfMonth) {
      thisMonth += summary.hours_worked;
    }
    
    if (summaryDate >= startOfWeek) {
      thisWeek += summary.hours_worked;
    }
  });

  return {
    totalHours: thisMonth,
    thisWeek,
    thisMonth
  };
};

// Conversation State Functions
export const getConversationState = async (employeeId: string): Promise<ConversationState | null> => {
  const { data, error } = await supabase
    .from('conversation_states')
    .select('*')
    .eq('employee_id', employeeId)
    .single();

  if (error) {
    // No conversation state found is not an error
    return null;
  }

  return data;
};

export const updateConversationState = async (state: {
  id?: string;
  employeeId: string;
  currentFlow: 'policy_entry' | 'review_entry' | 'cross_sell_entry' | 'daily_summary' | 'hours_entry' | 'none';
  collectedData: Record<string, any>;
  nextQuestion: string;
  lastUpdated: Date;
}): Promise<void> => {
  const { error } = await supabase
    .from('conversation_states')
    .upsert({
      employee_id: state.employeeId,
      current_flow: state.currentFlow,
      collected_data: state.collectedData,
      next_question: state.nextQuestion,
      last_updated: state.lastUpdated.toISOString()
    }, {
      onConflict: 'employee_id'  // Specify the unique column for conflict resolution
    });

  if (error) {
    console.error('Error updating conversation state:', error);
  }
};

export const clearConversationState = async (employeeId: string): Promise<void> => {
  const { error } = await supabase
    .from('conversation_states')
    .delete()
    .eq('employee_id', employeeId);

  if (error) {
    console.error('Error clearing conversation state:', error);
  }
};

// Employee Functions - Updated to handle admin access
export const getEmployees = async (): Promise<Employee[]> => {
  // Use service role for admin operations to bypass RLS
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching employees:', error);
    return [];
  }

  return data || [];
};

export const getEmployee = async (clerkUserId: string): Promise<Employee | null> => {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .single();

  if (error) {
    // Don't log error for missing employee - this is expected for new users
    return null;
  }

  return data;
};

export const createEmployee = async (employee: {
  clerkUserId: string;
  name: string;
  email: string;
  department: string;
  position: string;
  status?: 'active' | 'inactive' | 'on_leave';
  maxHoursBeforeOvertime?: number;
  hourlyRate?: number;
}): Promise<Employee | null> => {
  const { data, error } = await supabase
    .from('employees')
    .insert({
      clerk_user_id: employee.clerkUserId,
      name: employee.name,
      email: employee.email,
      department: employee.department,
      position: employee.position,
      status: employee.status || 'active',
      max_hours_before_overtime: employee.maxHoursBeforeOvertime || 8,
      hourly_rate: employee.hourlyRate || 25.00
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating employee:', error);
    return null;
  }

  return data;
};

export const updateEmployee = async (
  employeeId: string, 
  updates: Partial<{
    name: string;
    email: string;
    department: string;
    position: string;
    status: 'active' | 'inactive' | 'on_leave';
    maxHoursBeforeOvertime: number;
    hourlyRate: number;
  }>
): Promise<Employee | null> => {
  const updateData: any = {};
  
  if (updates.name) updateData.name = updates.name;
  if (updates.email) updateData.email = updates.email;
  if (updates.department) updateData.department = updates.department;
  if (updates.position) updateData.position = updates.position;
  if (updates.status) updateData.status = updates.status;
  if (updates.maxHoursBeforeOvertime) updateData.max_hours_before_overtime = updates.maxHoursBeforeOvertime;
  if (updates.hourlyRate) updateData.hourly_rate = updates.hourlyRate;

  const { data, error } = await supabase
    .from('employees')
    .update(updateData)
    .eq('id', employeeId)
    .select()
    .single();

  if (error) {
    console.error('Error updating employee:', error);
    return null;
  }

  return data;
};

// Overtime Request Functions
export const addOvertimeRequest = async (request: {
  employeeId: string;
  hoursRequested: number;
  reason: string;
  currentOvertimeHours: number;
}): Promise<OvertimeRequest | null> => {
  const { data, error } = await supabase
    .from('overtime_requests')
    .insert({
      employee_id: request.employeeId,
      request_date: new Date().toISOString(),
      hours_requested: request.hoursRequested,
      reason: request.reason,
      current_overtime_hours: request.currentOvertimeHours
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding overtime request:', error);
    return null;
  }

  return data;
};

export const getOvertimeRequests = async (employeeId?: string): Promise<OvertimeRequest[]> => {
  let query = supabase.from('overtime_requests').select('*');
  
  if (employeeId) {
    query = query.eq('employee_id', employeeId);
  }
  
  const { data, error } = await query.order('request_date', { ascending: false });

  if (error) {
    console.error('Error fetching overtime requests:', error);
    return [];
  }

  return data || [];
};

export const updateOvertimeRequestStatus = async (
  requestId: string, 
  status: 'approved' | 'rejected'
): Promise<boolean> => {
  const { error } = await supabase
    .from('overtime_requests')
    .update({ status })
    .eq('id', requestId);

  if (error) {
    console.error('Error updating overtime request status:', error);
    return false;
  }

  return true;
};

// Request Functions (for employee dashboard)
export interface Request {
  id: string;
  employee_id: string;
  type: 'overtime' | 'vacation' | 'sick' | 'other';
  title: string;
  description: string;
  request_date: string;
  status: 'pending' | 'approved' | 'rejected';
  hours_requested?: number;
  reason?: string;
  current_overtime_hours?: number;
}

export const getEmployeeRequests = async (employeeId: string): Promise<Request[]> => {
  // Get overtime requests and transform them
  const overtimeRequests = await getOvertimeRequests(employeeId);
  
  const requests: Request[] = overtimeRequests.map(req => ({
    id: req.id,
    employee_id: req.employee_id,
    type: 'overtime' as const,
    title: `Overtime Request - ${req.hours_requested} hours`,
    description: req.reason,
    request_date: req.request_date,
    status: req.status,
    hours_requested: req.hours_requested,
    reason: req.reason,
    current_overtime_hours: req.current_overtime_hours
  }));

  return requests;
};

// Enhanced Payroll Functions with Real Database Data
export interface PayrollPeriod {
  period: string;
  employees: number;
  total: number;
  status: 'current' | 'completed';
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
    const [employees, policySales, dailySummaries, overtimeRequests] = await Promise.all([
      getEmployees(),
      getPolicySales(),
      getAllDailySummaries(),
      getOvertimeRequests()
    ]);

    const activeEmployees = employees.filter(emp => emp.status === 'active');
    
    // Generate bi-weekly periods for the last 6 periods
    const periods: PayrollPeriod[] = [];
    const now = new Date();
    
    for (let i = 0; i < 6; i++) {
      const endDate = new Date(now);
      endDate.setDate(now.getDate() - (i * 14));
      
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 13);
      
      // Filter data for this period
      const periodSales = policySales.filter(sale => {
        const saleDate = new Date(sale.sale_date);
        return saleDate >= startDate && saleDate <= endDate;
      });
      
      const periodSummaries = dailySummaries.filter(summary => {
        const summaryDate = new Date(summary.date);
        return summaryDate >= startDate && summaryDate <= endDate;
      });
      
      const periodOvertime = overtimeRequests.filter(req => {
        const reqDate = new Date(req.request_date);
        return reqDate >= startDate && reqDate <= endDate && req.status === 'approved';
      });
      
      // Calculate hours and pay
      const regularHours = periodSummaries.reduce((sum, summary) => {
        const regularHoursWorked = Math.min(summary.hours_worked, 8);
        return sum + regularHoursWorked;
      }, 0);
      
      const overtimeHours = periodSummaries.reduce((sum, summary) => {
        const overtimeHoursWorked = Math.max(0, summary.hours_worked - 8);
        return sum + overtimeHoursWorked;
      }, 0) + periodOvertime.reduce((sum, req) => sum + req.current_overtime_hours, 0);
      
      // Calculate total pay
      const regularPay = activeEmployees.reduce((sum, emp) => {
        const empHours = periodSummaries
          .filter(s => s.employee_id === emp.clerk_user_id)
          .reduce((total, s) => total + Math.min(s.hours_worked, 8), 0);
        return sum + (empHours * emp.hourly_rate);
      }, 0);
      
      const overtimePay = activeEmployees.reduce((sum, emp) => {
        const empOvertimeHours = periodSummaries
          .filter(s => s.employee_id === emp.clerk_user_id)
          .reduce((total, s) => total + Math.max(0, s.hours_worked - 8), 0);
        return sum + (empOvertimeHours * emp.hourly_rate * 1.0);
      }, 0);
      
      const totalSales = periodSales.reduce((sum, sale) => sum + sale.amount, 0);
      const totalBonuses = periodSales.reduce((sum, sale) => sum + sale.bonus, 0);
      const totalPay = regularPay + overtimePay + totalBonuses;
      
      // Department breakdown
      const departmentMap = new Map();
      activeEmployees.forEach(emp => {
        if (!departmentMap.has(emp.department)) {
          departmentMap.set(emp.department, {
            employees: 0,
            totalPay: 0,
            totalHourlyRate: 0
          });
        }
        const dept = departmentMap.get(emp.department);
        dept.employees += 1;
        dept.totalHourlyRate += emp.hourly_rate;
        
        // Calculate this employee's pay for the period
        const empHours = periodSummaries
          .filter(s => s.employee_id === emp.clerk_user_id)
          .reduce((total, s) => total + s.hours_worked, 0);
        const empRegularHours = Math.min(empHours, emp.max_hours_before_overtime * 10); // 10 working days
        const empOvertimeHours = Math.max(0, empHours - empRegularHours);
        const empBonuses = periodSales
          .filter(s => s.employee_id === emp.clerk_user_id)
          .reduce((total, s) => total + s.bonus, 0);
        
        dept.totalPay += (empRegularHours * emp.hourly_rate) + 
                        (empOvertimeHours * emp.hourly_rate * 1.0) + 
                        empBonuses;
      });
      
      const departmentBreakdown = Array.from(departmentMap.entries()).map(([dept, data]) => ({
        department: dept,
        employees: data.employees,
        totalPay: Math.round(data.totalPay),
        avgHourlyRate: Math.round((data.totalHourlyRate / data.employees) * 100) / 100
      }));
      
      periods.push({
        period: `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        employees: activeEmployees.length,
        total: Math.round(totalPay),
        status: i === 0 ? 'current' : 'completed',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        details: {
          regularHours: Math.round(regularHours * 10) / 10,
          overtimeHours: Math.round(overtimeHours * 10) / 10,
          totalSales: Math.round(totalSales),
          totalBonuses: Math.round(totalBonuses),
          departmentBreakdown
        }
      });
    }
    
    return periods;
  } catch (error) {
    console.error('Error generating payroll periods:', error);
    return [];
  }
};

// Helper function to get all daily summaries (for admin)
const getAllDailySummaries = async (): Promise<DailySummary[]> => {
  const { data, error } = await supabase
    .from('daily_summaries')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching all daily summaries:', error);
    return [];
  }

  return data || [];
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
  };
}> => {
  try {
    const [employees, policySales, dailySummaries] = await Promise.all([
      getEmployees(),
      getPolicySales(),
      getAllDailySummaries()
    ]);

    const start = new Date(startDate);
    const end = new Date(endDate);

    const periodSales = policySales.filter(sale => {
      const saleDate = new Date(sale.sale_date);
      return saleDate >= start && saleDate <= end;
    });

    const periodSummaries = dailySummaries.filter(summary => {
      const summaryDate = new Date(summary.date);
      return summaryDate >= start && summaryDate <= end;
    });

    const employeeDetails = employees.map(emp => {
      const empSummaries = periodSummaries.filter(s => s.employee_id === emp.clerk_user_id);
      const empSales = periodSales.filter(s => s.employee_id === emp.clerk_user_id);
      
      const totalHours = empSummaries.reduce((sum, s) => sum + s.hours_worked, 0);
      const regularHours = Math.min(totalHours, emp.max_hours_before_overtime * 10); // 10 working days
      const overtimeHours = Math.max(0, totalHours - regularHours);
      
      const regularPay = regularHours * emp.hourly_rate;
      const overtimePay = overtimeHours * emp.hourly_rate * 1.0;
      const bonuses = empSales.reduce((sum, s) => sum + s.bonus, 0);
      const totalPay = regularPay + overtimePay + bonuses;
      
      const salesAmount = empSales.reduce((sum, s) => sum + s.amount, 0);

      return {
        id: emp.id,
        name: emp.name,
        department: emp.department,
        position: emp.position,
        hourlyRate: emp.hourly_rate,
        regularHours: Math.round(regularHours * 10) / 10,
        overtimeHours: Math.round(overtimeHours * 10) / 10,
        regularPay: Math.round(regularPay * 100) / 100,
        overtimePay: Math.round(overtimePay * 100) / 100,
        bonuses: Math.round(bonuses * 100) / 100,
        totalPay: Math.round(totalPay * 100) / 100,
        salesCount: empSales.length,
        salesAmount: Math.round(salesAmount)
      };
    });

    const summary = {
      totalEmployees: employees.length,
      totalRegularHours: employeeDetails.reduce((sum, emp) => sum + emp.regularHours, 0),
      totalOvertimeHours: employeeDetails.reduce((sum, emp) => sum + emp.overtimeHours, 0),
      totalRegularPay: employeeDetails.reduce((sum, emp) => sum + emp.regularPay, 0),
      totalOvertimePay: employeeDetails.reduce((sum, emp) => sum + emp.overtimePay, 0),
      totalBonuses: employeeDetails.reduce((sum, emp) => sum + emp.bonuses, 0),
      totalPay: employeeDetails.reduce((sum, emp) => sum + emp.totalPay, 0),
      totalSales: periodSales.length,
      totalSalesAmount: periodSales.reduce((sum, sale) => sum + sale.amount, 0)
    };

    return { employees: employeeDetails, summary };
  } catch (error) {
    console.error('Error getting payroll period details:', error);
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
        totalSalesAmount: 0
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
    const [employee, policySales, dailySummaries] = await Promise.all([
      getEmployee(employeeId),
      getPolicySales(employeeId),
      getDailySummaries(employeeId)
    ]);

    if (!employee) return [];

    const payrollHistory = [];
    const now = new Date();
    
    // Generate last 6 biweekly periods
    for (let i = 0; i < 6; i++) {
      const endDate = new Date(now);
      endDate.setDate(now.getDate() - (i * 14));
      
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 13);
      
      // Filter data for this period
      const periodSales = policySales.filter(sale => {
        const saleDate = new Date(sale.sale_date);
        return saleDate >= startDate && saleDate <= endDate;
      });
      
      const periodSummaries = dailySummaries.filter(summary => {
        const summaryDate = new Date(summary.date);
        return summaryDate >= startDate && summaryDate <= endDate;
      });
      
      // Calculate hours and pay
      const totalHours = periodSummaries.reduce((sum, s) => sum + s.hours_worked, 0);
      const regularHours = Math.min(totalHours, employee.max_hours_before_overtime * 10); // 10 working days
      const overtimeHours = Math.max(0, totalHours - regularHours);
      
      const regularPay = regularHours * employee.hourly_rate;
      const overtimePay = overtimeHours * employee.hourly_rate * 1.0;
      const bonuses = periodSales.reduce((sum, s) => sum + s.bonus, 0);
      const totalPay = regularPay + overtimePay + bonuses;
      
      const salesAmount = periodSales.reduce((sum, s) => sum + s.amount, 0);

      payrollHistory.push({
        period: `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        regularHours: Math.round(regularHours * 10) / 10,
        overtimeHours: Math.round(overtimeHours * 10) / 10,
        regularPay: Math.round(regularPay * 100) / 100,
        overtimePay: Math.round(overtimePay * 100) / 100,
        bonuses: Math.round(bonuses * 100) / 100,
        totalPay: Math.round(totalPay * 100) / 100,
        salesCount: periodSales.length,
        salesAmount: Math.round(salesAmount)
      });
    }
    
    return payrollHistory;
  } catch (error) {
    console.error('Error getting employee payroll history:', error);
    return [];
  }
};

export const getHighValuePolicyNotifications = async (): Promise<PolicySale[]> => {
  const { data, error } = await supabase
    .from('policy_sales')
    .select('*')
    .gt('amount', 5000)
    .order('amount', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching high-value policy notifications:', error);
    return [];
  }

  return data || [];
};

// High-Value Policy Notification Functions
export const createHighValuePolicyNotification = async (notification: {
  employeeId: string;
  policyNumber: string;
  policyAmount: number;
  brokerFee: number;
  currentBonus: number;
  isCrossSoldPolicy: boolean;
}): Promise<HighValuePolicyNotification | null> => {
  const { data, error } = await supabase
    .from('high_value_policy_notifications')
    .insert({
      employee_id: notification.employeeId,
      policy_number: notification.policyNumber,
      policy_amount: notification.policyAmount,
      broker_fee: notification.brokerFee,
      current_bonus: notification.currentBonus,
      is_cross_sold_policy: notification.isCrossSoldPolicy,
      status: 'pending'
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating high-value policy notification:', error);
    return null;
  }

  return data;
};

export const getHighValuePolicyNotificationsList = async (): Promise<HighValuePolicyNotification[]> => {
  const { data, error } = await supabase
    .from('high_value_policy_notifications')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching high-value policy notifications:', error);
    return [];
  }

  return data || [];
};

export const updateHighValuePolicyNotification = async (
  notificationId: string,
  updates: {
    adminBonus?: number;
    adminNotes?: string;
    status?: 'pending' | 'reviewed';
  }
): Promise<HighValuePolicyNotification | null> => {
  const updateData: any = { ...updates };
  
  if (updates.status === 'reviewed') {
    updateData.reviewed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('high_value_policy_notifications')
    .update(updateData)
    .eq('id', notificationId)
    .select()
    .single();

  if (error) {
    console.error('Error updating high-value policy notification:', error);
    return null;
  }

  return data;
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
    
    // Calculate start of week (Sunday) in local time
    const startOfWeek = getLocalStartOfWeek(now);
    
    // Generate array for the current week
    const weekData = [];
    
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      
      // Format date as YYYY-MM-DD in local timezone
      const dateString = getLocalDateString(currentDate);
      
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
      const isToday = currentDate.getTime() === today.getTime();
      
      // Get time logs for this specific date
      const timeLogs = await getTimeLogsForDay(employeeId, dateString);
      
      // Calculate total hours worked for this day
      let hoursWorked = 0;
      timeLogs.forEach(log => {
        if (log.clock_in && log.clock_out) {
          const startTime = new Date(log.clock_in).getTime();
          const endTime = new Date(log.clock_out).getTime();
          hoursWorked += (endTime - startTime) / (1000 * 60 * 60); // Convert to hours
        } else if (log.clock_in && !log.clock_out) {
          // If currently clocked in, calculate up to now
          const startTime = new Date(log.clock_in).getTime();
          const now = Date.now();
          hoursWorked += (now - startTime) / (1000 * 60 * 60);
        }
      });
      
      // Get policy sales for this date (from existing function)
      const policySales = await getPolicySales(employeeId);
      const dayPolicies = policySales.filter(sale => {
        const saleDate = getLocalDateString(new Date(sale.sale_date));
        return saleDate === dateString;
      });
      
      const policiesSold = dayPolicies.length;
      const totalSales = dayPolicies.reduce((sum, sale) => sum + sale.amount, 0);
      
      weekData.push({
        date: dateString,
        dayName,
        hoursWorked: Math.round(hoursWorked * 100) / 100, // Round to 2 decimal places
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

// Get today's total hours worked
export const getTodayHours = async (employeeId: string): Promise<number> => {
  try {
    // Use local date string for today
    const today = getLocalDateString();
    const timeLogs = await getTimeLogsForDay(employeeId, today);
    
    let totalHours = 0;
    timeLogs.forEach(log => {
      if (log.clock_in && log.clock_out) {
        const startTime = new Date(log.clock_in).getTime();
        const endTime = new Date(log.clock_out).getTime();
        totalHours += (endTime - startTime) / (1000 * 60 * 60);
      } else if (log.clock_in && !log.clock_out) {
        // If currently clocked in, calculate up to now
        const startTime = new Date(log.clock_in).getTime();
        const now = Date.now();
        totalHours += (now - startTime) / (1000 * 60 * 60);
      }
    });
    
    return Math.round(totalHours * 100) / 100; // Round to 2 decimal places
  } catch (error) {
    console.error('Error getting today hours:', error);
    return 0;
  }
};

// Get this week's total hours worked
export const getThisWeekHours = async (employeeId: string): Promise<number> => {
  try {
    const weeklyData = await getWeeklySummary(employeeId);
    const totalHours = weeklyData.reduce((sum, day) => sum + day.hoursWorked, 0);
    return Math.round(totalHours * 100) / 100; // Round to 2 decimal places
  } catch (error) {
    console.error('Error getting this week hours:', error);
    return 0;
  }
};

// Add a generic request to the database
export const addRequest = async (request: {
  employeeId: string;
  type: 'overtime' | 'vacation' | 'sick' | 'other';
  title: string;
  description: string;
  requestDate: string;
  status?: 'pending' | 'approved' | 'rejected';
  hoursRequested?: number;
  reason?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Request | null> => {
  const { data, error } = await supabase
    .from('requests')
    .insert({
      employee_id: request.employeeId,
      type: request.type,
      title: request.title,
      description: request.description,
      request_date: request.requestDate,
      status: request.status || 'pending',
      hours_requested: request.hoursRequested,
      reason: request.reason,
      start_date: request.startDate,
      end_date: request.endDate,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding request:', error);
    return null;
  }
  return data;
};

// Get all requests (for admin)
export const getAllRequests = async (): Promise<Request[]> => {
  const { data, error } = await supabase
    .from('requests')
    .select('*')
    .order('request_date', { ascending: false });

  if (error) {
    console.error('Error fetching all requests:', error);
    return [];
  }
  return data || [];
};

// Time Logs (Clock In/Out) - Simplified for RLS disabled
export const createTimeLog = async ({ employeeId, clockIn }: { employeeId: string, clockIn: Date }): Promise<{ data: any; error: any }> => {
  try {
    // Use local date string for the date field
    const date = getLocalDateString(clockIn);
    const { data, error } = await supabase
      .from('time_logs')
      .insert({ 
        employee_id: employeeId, 
        date, 
        clock_in: clockIn.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    return { data, error };
  } catch (error) {
    console.error('Error in createTimeLog:', error);
    return { data: null, error };
  }
};

export const updateTimeLog = async ({ logId, clockOut }: { logId: string, clockOut: Date }) => {
  try {
    const { data, error } = await supabase
      .from('time_logs')
      .update({ 
        clock_out: clockOut.toISOString(), 
        updated_at: new Date().toISOString() 
      })
      .eq('id', logId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating time log:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error in updateTimeLog:', error);
    return null;
  }
};

export const getTimeLogsForDay = async (employeeId: string, date: string) => {
  try {
    const { data, error } = await supabase
      .from('time_logs')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', date)
      .order('clock_in', { ascending: true });
    
    if (error) {
      console.error('Error fetching time logs:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getTimeLogsForDay:', error);
    return [];
  }
};

export const getTimeLogsForWeek = async (employeeId: string, startDate: string, endDate: string) => {
  const { data, error } = await supabase
    .from('time_logs')
    .select('*')
    .eq('employee_id', employeeId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })
    .order('clock_in', { ascending: true });
  if (error) throw error;
  return data || [];
};

// Chat Messages
export const addChatMessage = async ({ userId, role, content }: { userId: string, role: string, content: string }) => {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ user_id: userId, role, content })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getChatMessages = async ({ userId, role, limit = 35 }: { userId: string, role: string, limit?: number }) => {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', userId)
    .eq('role', role)
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (error) throw error;
  // Return in chronological order
  return (data || []).reverse();
};