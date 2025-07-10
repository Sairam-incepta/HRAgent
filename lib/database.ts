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
import { notifyPolicySale, notifyClientReview, notifyRequestSubmitted, notifyTimeLogged, notifyDailySummary } from './events';
import { createClient } from '@supabase/supabase-js';

// Auto-detect timezone utilities
const getUserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.warn('Could not detect timezone, falling back to America/Los_Angeles');
    return 'America/Los_Angeles';
  }
};

const getLocalTimezoneDate = (date: Date = new Date()): Date => {
  // Create a date in user's detected timezone
  const timezone = getUserTimezone();
  return new Date(date.toLocaleString("en-US", { timeZone: timezone }));
};

export const getLocalDateString = (date: Date = new Date()): string => {
  // Get date string in user's timezone
  const localDate = getLocalTimezoneDate(date);
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getLocalStartOfDay = (date: Date = new Date()): Date => {
  const localDate = getLocalTimezoneDate(date);
  localDate.setHours(0, 0, 0, 0);
  return localDate;
};

export const getLocalEndOfDay = (date: Date = new Date()): Date => {
  const localDate = getLocalTimezoneDate(date);
  localDate.setHours(23, 59, 59, 999);
  return localDate;
};

export const getLocalStartOfWeek = (date: Date = new Date()): Date => {
  const localDate = getLocalTimezoneDate(date);
  const day = localDate.getDay();
  const diff = localDate.getDate() - day; // Sunday is 0
  localDate.setDate(diff);
  localDate.setHours(0, 0, 0, 0);
  return localDate;
};

export const getLocalEndOfWeek = (date: Date = new Date()): Date => {
  const localDate = getLocalTimezoneDate(date);
  const day = localDate.getDay();
  const diff = localDate.getDate() - day + 6; // Saturday is 6
  localDate.setDate(diff);
  localDate.setHours(23, 59, 59, 999);
  return localDate;
};

// Debug utility to log timezone information
export const logTimezoneInfo = () => {
  const now = new Date();
  const localDate = getLocalTimezoneDate(now);
  const userTimezone = getUserTimezone();
  console.log('🌍 Timezone Debug Info:');
  console.log('  Server time:', now.toString());
  console.log('  UTC time:', now.toISOString());
  console.log('  Local time:', localDate.toString());
  console.log('  Local date string:', getLocalDateString(now));
  console.log('  UTC date string:', now.toISOString().split('T')[0]);
  console.log('  Server timezone offset:', now.getTimezoneOffset(), 'minutes');
  console.log('  Detected user timezone:', userTimezone);
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
  try {
    console.log('📝 Adding policy sale:', sale);
    
    const { data, error } = await supabase
      .from('policy_sales')
      .insert({
        policy_number: sale.policyNumber,
        client_name: sale.clientName,
        policy_type: sale.policyType,
        amount: sale.amount,
        broker_fee: sale.brokerFee,
        employee_id: sale.employeeId,
        sale_date: sale.saleDate.toISOString(),
        cross_sold: sale.crossSold || false,
        cross_sold_type: sale.crossSoldType,
        cross_sold_to: sale.crossSoldTo,
        client_description: sale.clientDescription,
        is_cross_sold_policy: sale.isCrossSoldPolicy || false,
        bonus: calculateBonus(sale.brokerFee, sale.isCrossSoldPolicy || false)
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error adding policy sale:', error);
      console.error('📝 Sale data that failed:', sale);
      
      // If it's a duplicate policy number error, return null to let caller handle it
      if (error.code === '23505' && error.message.includes('policy_number')) {
        throw new Error(`Policy number ${sale.policyNumber} already exists. Please use a different policy number.`);
      }
      
      return null;
    }
    
    console.log('✅ Policy sale added successfully:', data);
    
    // Update employee bonus
    await updateEmployeeBonus(sale.employeeId, data.bonus);
    
    // Note: High-value policy notifications are now handled by database trigger
    // No need to create them manually here anymore
    
    // Notify dashboard to refresh
    notifyPolicySale(sale.employeeId);
    
    return data;
  } catch (error) {
    console.error('❌ Exception in addPolicySale:', error);
    throw error; // Re-throw to let caller handle it
  }
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

export const getTodayClientReviews = async (employeeId: string): Promise<ClientReview[]> => {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  const { data, error } = await supabase
    .from('client_reviews')
    .select('*')
    .eq('employee_id', employeeId)
    .gte('review_date', startOfDay.toISOString())
    .lt('review_date', endOfDay.toISOString())
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
  try {
    console.log('📝 Adding client review:', review);
    
    const bonus = calculateReviewBonus(review.rating);
    
    const { data, error } = await supabase
      .from('client_reviews')
      .insert({
        client_name: review.clientName,
        policy_number: review.policyNumber,
        rating: review.rating,
        review: review.review,
        review_date: review.reviewDate.toISOString(),
        employee_id: review.employeeId,
        bonus: bonus,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error adding client review:', error);
      console.error('📝 Review data that failed:', review);
      return null;
    }
    
    console.log('✅ Client review added successfully:', data);
    
    // Update employee bonus
    await updateEmployeeBonus(review.employeeId, bonus);
    
    // Notify dashboard to refresh
    notifyClientReview();
    
    return data;
  } catch (error) {
    console.error('❌ Exception in addClientReview:', error);
    console.error('📝 Review data that failed:', review);
    return null;
  }
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
  try {
    console.log('📝 Adding daily summary:', summary);
    
    const { data, error } = await supabase
      .from('daily_summaries')
      .insert({
        employee_id: summary.employeeId,
        date: getLocalDateString(summary.date),
        hours_worked: summary.hoursWorked,
        policies_sold: summary.policiesSold,
        total_sales_amount: summary.totalSalesAmount,
        total_broker_fees: summary.totalBrokerFees,
        description: summary.description,
        key_activities: summary.keyActivities,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error adding daily summary:', error);
      console.error('📝 Summary data that failed:', summary);
      return null;
    }
    
    console.log('✅ Daily summary added successfully:', data);
    
    // Notify dashboard to refresh
    notifyDailySummary();
    
    return data;
  } catch (error) {
    console.error('❌ Exception in addDailySummary:', error);
    console.error('📝 Summary data that failed:', summary);
    return null;
  }
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
  currentFlow: 'policy_entry' | 'review_entry' | 'cross_sell_entry' | 'daily_summary' | 'hours_entry' | 'policy_entry_batch' | 'review_entry_batch' | 'policy_entry_natural' | 'review_entry_natural' | 'none';
  collectedData: Record<string, any>;
  nextQuestion?: string;
  step?: number;
  lastUpdated: Date;
}): Promise<void> => {
  const updateData: any = {
      employee_id: state.employeeId,
      current_flow: state.currentFlow,
      collected_data: state.collectedData,
      last_updated: state.lastUpdated.toISOString()
  };

  // Include nextQuestion for backward compatibility with old flows
  if (state.nextQuestion) {
    updateData.next_question = state.nextQuestion;
  }

  // Include step for new streamlined flows
  if (state.step !== undefined) {
    updateData.step = state.step;
  }

  const { error } = await supabase
    .from('conversation_states')
    .upsert(updateData, {
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
  try {
    // Since RLS is disabled, we can use the regular supabase client
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
  } catch (error) {
    console.error('Exception in createEmployee:', error);
    return null;
  }
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
}

export const getEmployeeRequests = async (employeeId: string): Promise<Request[]> => {
  try {
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .eq('employee_id', employeeId)
      .order('request_date', { ascending: false });

    if (error) {
      console.error('Error fetching employee requests:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getEmployeeRequests:', error);
    return [];
  }
};

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
const calculateWorkHoursWithLunchDeduction = (clockInTime: Date, clockOutTime: Date): number => {
  // Return the exact time between clock-in and clock-out (in hours) without any heuristic deductions.
  // Any unpaid breaks should be recorded as separate sessions, so gaps are already excluded.
  const diffMs = clockOutTime.getTime() - clockInTime.getTime();
  return Math.max(0, diffMs) / (1000 * 60 * 60);
};

// Helper function to calculate actual hours worked from time_logs for a date range
export const calculateActualHoursForPeriod = async (employeeId: string, startDate: Date, endDate: Date): Promise<number> => {
  try {
    console.log(`⏰ Calculating hours for employee ${employeeId} from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    
    let totalHours = 0;
    let daysChecked = 0;
    let daysWithLogs = 0;
    
    // Iterate through each day in the period
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateString = getLocalDateString(currentDate);
      daysChecked++;
      
      const timeLogs = await getTimeLogsForDay(employeeId, dateString);
      
      if (timeLogs.length > 0) {
        daysWithLogs++;
        console.log(`📅 ${dateString}: Found ${timeLogs.length} time logs`);
        
        // Calculate hours for this day
        timeLogs.forEach(log => {
          if (log.clock_in && log.clock_out) {
            const clockInTime = new Date(log.clock_in);
            const clockOutTime = new Date(log.clock_out);
            const dayHours = calculateWorkHoursWithLunchDeduction(clockInTime, clockOutTime);
            totalHours += dayHours;
            console.log(`  ✅ Complete session: ${dayHours.toFixed(2)} work hours (${log.clock_in} to ${log.clock_out}, lunch deducted)`);
          } else if (log.clock_in && !log.clock_out) {
            // If currently clocked in, calculate up to now (only if it's today)
            const today = getLocalDateString();
            if (dateString === today) {
              const clockInTime = new Date(log.clock_in);
              const now = new Date();
              const dayHours = calculateWorkHoursWithLunchDeduction(clockInTime, now);
              totalHours += dayHours;
              console.log(`  ⏳ Active session: ${dayHours.toFixed(2)} work hours (${log.clock_in} to now, lunch deducted)`);
            } else {
              console.log(`  ⚠️ Incomplete session: clocked in at ${log.clock_in} but no clock out`);
            }
          }
        });
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log(`⏰ Period summary for employee ${employeeId}:`, {
      daysChecked,
      daysWithLogs,
      totalWorkHours: totalHours.toFixed(2)
    });
    
    return Math.round(totalHours * 100) / 100; // Round to 2 decimal places
  } catch (error) {
    console.error('❌ Error calculating actual hours for period:', error);
    return 0;
  }
};

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
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching high-value policy notifications:', error);
    return [];
  }

  if (!data) {
    return [];
  }

  // Enhanced deduplication by policy_number, keeping the most recent entry for each policy
  const policyMap = new Map<string, HighValuePolicyNotification>();
  const duplicatesFound = new Map<string, HighValuePolicyNotification[]>();
  
    data.forEach(notification => {
    if (!duplicatesFound.has(notification.policy_number)) {
      duplicatesFound.set(notification.policy_number, []);
    }
    duplicatesFound.get(notification.policy_number)!.push(notification);
    
      const existingEntry = policyMap.get(notification.policy_number);
      if (!existingEntry || new Date(notification.created_at) > new Date(existingEntry.created_at)) {
        policyMap.set(notification.policy_number, notification);
      }
    });

  // Log any duplicates found
  const duplicateGroups = Array.from(duplicatesFound.entries()).filter(([_, notifications]) => notifications.length > 1);
  if (duplicateGroups.length > 0) {
    console.log('🚨 DUPLICATES DETECTED in getHighValuePolicyNotificationsList:', duplicateGroups.map(([policyNumber, notifications]) => ({
      policy_number: policyNumber,
      duplicate_count: notifications.length,
      notifications: notifications.map(n => ({ id: n.id, status: n.status, created_at: n.created_at }))
    })));
  }

  const result = Array.from(policyMap.values()).sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  
  console.log('🔍 getHighValuePolicyNotificationsList returning:', {
    totalRecordsFromDB: data.length,
    afterDeduplication: result.length,
    duplicateGroupsFound: duplicateGroups.length,
    pendingCount: result.filter(n => n.status === 'pending').length
  });

  return result;
};

export const updateHighValuePolicyNotification = async (
  notificationId: string,
  updates: {
    adminBonus?: number;
    adminNotes?: string;
    status?: 'pending' | 'reviewed' | 'resolved';
  }
): Promise<HighValuePolicyNotification | null> => {
  console.log('🔄 updateHighValuePolicyNotification called with:', { notificationId, updates });
  
  try {
    // First, let's check what the current status is
    const { data: currentRecord, error: fetchError } = await supabase
      .from('high_value_policy_notifications')
      .select('*')
      .eq('id', notificationId)
      .single();
    
    if (fetchError) {
      console.error('❌ Error fetching current record:', fetchError);
      return null;
    }
    
    console.log('📋 Current record before update:', currentRecord);
    
    // Check for any duplicates with the same policy_number
    const { data: duplicates, error: dupError } = await supabase
      .from('high_value_policy_notifications')
      .select('id, policy_number, status, created_at')
      .eq('policy_number', currentRecord.policy_number)
      .order('created_at', { ascending: false });
    
    if (dupError) {
      console.error('❌ Error checking for duplicates:', dupError);
    } else {
      console.log('🔍 Found records with same policy_number:', duplicates);
      if (duplicates && duplicates.length > 1) {
        console.log('⚠️ DUPLICATE DETECTED! Multiple records for policy:', currentRecord.policy_number);
        console.log('🔍 All duplicates:', duplicates);
      }
    }
    
    // Convert camelCase to snake_case for database columns
    const updateData: any = {};
    
    if (updates.adminBonus !== undefined) {
      updateData.admin_bonus = updates.adminBonus;
    }
    
    if (updates.adminNotes !== undefined) {
      updateData.admin_notes = updates.adminNotes;
    }
    
    if (updates.status !== undefined) {
      updateData.status = updates.status;
    }
  
  if (updates.status === 'reviewed') {
    updateData.reviewed_at = new Date().toISOString();
  }

  console.log('📝 About to update with data:', updateData);

  const { data, error } = await supabase
    .from('high_value_policy_notifications')
    .update(updateData)
    .eq('id', notificationId)
    .select()
    .single();

  if (error) {
      console.error('❌ Error updating high-value policy notification:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        notificationId,
        updateData
      });
    return null;
  }

  console.log('✅ Update successful, returning data:', data);
    
    // Let's verify the update by fetching the record again
    const { data: verifyRecord, error: verifyError } = await supabase
      .from('high_value_policy_notifications')
      .select('*')
      .eq('id', notificationId)
      .single();
    
    if (verifyError) {
      console.error('❌ Error verifying update:', verifyError);
    } else {
      console.log('🔍 Verified record after update:', verifyRecord);
    }
    
    // Also check all notifications to see the current state and identify duplicates
    const { data: allNotifications, error: allError } = await supabase
      .from('high_value_policy_notifications')
      .select('id, policy_number, status, created_at')
      .order('created_at', { ascending: false });
    
    if (allError) {
      console.error('❌ Error fetching all notifications for debug:', allError);
    } else {
      console.log('🔍 All notifications after update:', allNotifications);
      const pendingCount = allNotifications.filter(n => n.status === 'pending').length;
      console.log('🔍 Current pending count:', pendingCount);
      
      // Check for duplicates by policy_number
      const policyGroups = new Map();
      allNotifications.forEach(notification => {
        if (!policyGroups.has(notification.policy_number)) {
          policyGroups.set(notification.policy_number, []);
        }
        policyGroups.get(notification.policy_number).push(notification);
      });
      
      const duplicateGroups = Array.from(policyGroups.entries()).filter(([_, notifications]) => notifications.length > 1);
      if (duplicateGroups.length > 0) {
        console.log('🚨 DUPLICATES FOUND:', duplicateGroups);
      }
    }
    
  return data;
  } catch (error) {
    console.error('❌ Unexpected error in updateHighValuePolicyNotification:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      notificationId,
      updates
    });
    return null;
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
      
      // Calculate net hours worked for this day (exclude gaps between sessions)
      let hoursWorked = 0;
      if (timeLogs && timeLogs.length > 0) {
        // Sort by clock-in
        const sorted = timeLogs.sort((a: any, b: any) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime());

        let grossSeconds = 0;
        let gapSeconds = 0;

        for (let j = 0; j < sorted.length; j++) {
          const session = sorted[j];
          const inTime = new Date(session.clock_in);
          const outTime = session.clock_out ? new Date(session.clock_out) : new Date();

          grossSeconds += (outTime.getTime() - inTime.getTime()) / 1000;

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
  try {
    console.log('📝 Adding request:', request);
    
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
      console.error('❌ Error adding request:', error);
      console.error('📝 Request data that failed:', request);
      return null;
    }
    
    console.log('✅ Request added successfully:', data);
    
    // Notify dashboard to refresh
    notifyRequestSubmitted();
    
    return data;
  } catch (error) {
    console.error('❌ Exception in addRequest:', error);
    console.error('📝 Request data that failed:', request);
    return null;
  }
};

// Get all requests (for admin)
export const getAllRequests = async (): Promise<Request[]> => {
  try {
  const { data, error } = await supabase
    .from('requests')
    .select('*')
    .order('request_date', { ascending: false });

  if (error) {
    console.error('Error fetching all requests:', error);
    return [];
  }
  return data || [];
  } catch (error) {
    console.error('Error in getAllRequests:', error);
    return [];
  }
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
    
    if (!error) {
      // Notify dashboard to refresh
      notifyTimeLogged();
    }
    
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
    
    // Notify dashboard to refresh
    notifyTimeLogged();
    
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
      console.error('Query params:', { employeeId, date });
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getTimeLogsForDay:', error);
    console.error('Query params:', { employeeId, date });
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

export const getChatMessages = async ({ userId, limit = 35 }: { userId: string, limit?: number }) => {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (error) throw error;
  // Return in chronological order
  return (data || []).reverse();
};

// Update request status (for new requests table)
export const updateRequestStatus = async (
  requestId: string, 
  status: 'pending' | 'approved' | 'rejected'
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('requests')
      .update({ status })
      .eq('id', requestId)
      .select()
      .single();

    if (error) {
      console.error('Error updating request status:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updateRequestStatus:', error);
    return false;
  }
};

// Get urgent policies that need review (period ending soon)
export const getUrgentReviewPolicies = async () => {
  const { data, error } = await supabase
    .rpc('get_urgent_review_policies');

  if (error) {
    console.error('Error fetching urgent review policies:', error);
    return null;
  }

  return data && data.length > 0 ? data[0] : null;
};

// Check if period end notification should be shown
export const shouldShowPeriodEndNotification = async (): Promise<boolean> => {
  const { data, error } = await supabase
    .rpc('should_send_period_end_notification');

  if (error) {
    console.error('Error checking period end notification:', error);
    return false;
  }

  return data || false;
};

// Close expired biweekly periods
export const closeExpiredBiweeklyPeriods = async (): Promise<void> => {
  const { error } = await supabase
    .rpc('close_expired_biweekly_periods');

  if (error) {
    console.error('Error closing expired biweekly periods:', error);
  }
};

// Debug function to check database contents
export const debugDatabaseContents = async () => {
  try {
    console.log('🔍 === DATABASE DEBUG REPORT ===');
    
    // Check employees
    const employees = await getEmployees();
    console.log(`👥 Total employees: ${employees.length}`);
    employees.forEach(emp => {
      console.log(`  - ${emp.name} (${emp.clerk_user_id}) - ${emp.department} - $${emp.hourly_rate}/hr - Status: ${emp.status}`);
    });
    
    // Check policy sales
    const sales = await getPolicySales();
    console.log(`📈 Total policy sales: ${sales.length}`);
    sales.slice(0, 5).forEach(sale => {
      console.log(`  - ${sale.policy_number}: $${sale.amount} (bonus: $${sale.bonus}) - ${sale.employee_id} - ${sale.sale_date}`);
    });
    
    // Check time logs for each employee
    const today = getLocalDateString();
    console.log(`⏰ Time logs for today (${today}):`);
    for (const emp of employees) {
      const timeLogs = await getTimeLogsForDay(emp.id, today);
      console.log(`  - ${emp.name}: ${timeLogs.length} time logs`);
      timeLogs.forEach(log => {
        console.log(`    * ${log.clock_in} ${log.clock_out ? 'to ' + log.clock_out : '(still clocked in)'}`);
      });
    }
    
    console.log('🔍 === END DEBUG REPORT ===');
  } catch (error) {
    console.error('❌ Error in debug function:', error);
  }
};

// Add this debug function at the end of the file, before the existing debugDatabaseContents function
export const debugTimeLogs = async () => {
  try {
    console.log('🔍 === TIME LOGS DEBUG START ===');
    
    // Get all time logs from the database
    const { data: timeLogs, error } = await supabase
      .from('time_logs')
      .select('*')
      .order('date', { ascending: false })
      .order('clock_in', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching time logs:', error);
      return;
    }
    
    console.log(`📊 Total time logs in database: ${timeLogs?.length || 0}`);
    
    if (timeLogs && timeLogs.length > 0) {
      console.log('📋 Recent time logs:');
      timeLogs.slice(0, 10).forEach((log, index) => {
        const clockIn = new Date(log.clock_in);
        const clockOut = log.clock_out ? new Date(log.clock_out) : null;
        const hours = clockOut ? ((clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)).toFixed(2) : 'Still clocked in';
        
        console.log(`  ${index + 1}. Employee: ${log.employee_id}`);
        console.log(`     Date: ${log.date}`);
        console.log(`     Clock In: ${clockIn.toLocaleString()}`);
        console.log(`     Clock Out: ${clockOut ? clockOut.toLocaleString() : 'Not clocked out'}`);
        console.log(`     Hours: ${hours}`);
        console.log('     ---');
      });
    } else {
      console.log('❌ No time logs found in database');
      
      // Check if the table exists and has the right structure
      let tableInfo = null;
      let tableError = null;
      try {
        const result = await supabase.rpc('get_table_info', { table_name: 'time_logs' });
        tableInfo = result.data;
        tableError = result.error;
      } catch (err) {
        tableError = err;
      }
        
      if (tableError) {
        console.log('🔍 Checking table structure manually...');
        // Try a simple count query to see if table is accessible
        const { count, error: countError } = await supabase
          .from('time_logs')
          .select('*', { count: 'exact', head: true });
          
        if (countError) {
          console.error('❌ Cannot access time_logs table:', countError);
        } else {
          console.log(`✅ time_logs table exists and is accessible (count: ${count})`);
        }
      }
    }
    
    // Also check what employees exist
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id, clerk_user_id, name, email');
      
    if (empError) {
      console.error('❌ Error fetching employees:', empError);
    } else {
      console.log('👥 Employees in database:');
      employees?.forEach(emp => {
        console.log(`  - ${emp.name} (${emp.email})`);
        console.log(`    Database ID: ${emp.id}`);
        console.log(`    Clerk ID: ${emp.clerk_user_id}`);
      });
    }
    
    console.log('🔍 === TIME LOGS DEBUG END ===');
  } catch (error) {
    console.error('❌ Error in debugTimeLogs:', error);
  }
};

// Test function to create sample time logs for testing
export const createTestTimeLogs = async () => {
  try {
    console.log('🧪 Creating test time logs...');
    
    // Get employees
    const employees = await getEmployees();
    if (employees.length === 0) {
      console.log('❌ No employees found to create test logs for');
      return;
    }
    
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    // Create test logs for each employee
    for (const employee of employees) {
      console.log(`Creating test logs for ${employee.name}...`);
      
      // Yesterday's work session: 9 AM to 5 PM (8 hours)
      const yesterdayStart = new Date(yesterday);
      yesterdayStart.setHours(9, 0, 0, 0);
      const yesterdayEnd = new Date(yesterday);
      yesterdayEnd.setHours(17, 0, 0, 0);
      
      await supabase.from('time_logs').insert({
        employee_id: employee.clerk_user_id,
        date: getLocalDateString(yesterday),
        clock_in: yesterdayStart.toISOString(),
        clock_out: yesterdayEnd.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      // Today's work session: 9 AM to 1 PM (4 hours so far)
      const todayStart = new Date(today);
      todayStart.setHours(9, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(13, 0, 0, 0);
      
      await supabase.from('time_logs').insert({
        employee_id: employee.clerk_user_id,
        date: getLocalDateString(today),
        clock_in: todayStart.toISOString(),
        clock_out: todayEnd.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      console.log(`✅ Created test logs for ${employee.name}`);
    }
    
    console.log('🎉 Test time logs created successfully!');
    
    // Run debug to show the created logs
    await debugTimeLogs();
    
  } catch (error) {
    console.error('❌ Error creating test time logs:', error);
  }
};

// Get number of employees currently clocked in
export const getClockedInEmployeesCount = async (): Promise<{ clockedIn: number; total: number }> => {
  try {
    const employees = await getEmployees();
    let clockedInCount = 0;
    let nonAdminTotal = 0;
    
    for (const employee of employees) {
      // Skip admin users for clock-in tracking (they don't clock in/out)
      const isAdmin = employee.position === 'HR Manager' || employee.email === 'admin@letsinsure.hr';
      
      if (!isAdmin) {
        nonAdminTotal++;
        const { clockedIn } = await getTodayTimeTracking(employee.clerk_user_id);
        if (clockedIn) {
          clockedInCount++;
        }
      }
    }
    
    return {
      clockedIn: clockedInCount,
      total: nonAdminTotal
    };
  } catch (error) {
    console.error('Error getting clocked in employees count:', error);
    return { clockedIn: 0, total: 0 };
  }
};

// Get total policy sales amount (not bonuses)
export const getTotalPolicySalesAmount = async (): Promise<number> => {
  try {
    const policySales = await getPolicySales();
    return policySales.reduce((total, sale) => total + (sale.amount || 0), 0);
  } catch (error) {
    console.error('Error getting total policy sales amount:', error);
    return 0;
  }
};

// Get overtime hours for current week for all employees
export const getOvertimeHoursThisWeek = async (): Promise<number> => {
  try {
    const employees = await getEmployees();
    let totalOvertimeHours = 0;
    
    // Get current week dates
    const now = new Date();
    const startOfWeek = getLocalStartOfWeek(now);
    const endOfWeek = getLocalEndOfWeek(now);
    
    for (const employee of employees) {
      // Skip admin users for hour calculations (they don't clock in/out)
      const isAdmin = employee.position === 'HR Manager' || employee.email === 'admin@letsinsure.hr';
      
      if (!isAdmin) {
        const weekHours = await calculateActualHoursForPeriod(employee.clerk_user_id, startOfWeek, endOfWeek);
        const weeklyOvertimeLimit = 40; // Standard 40-hour work week
        
        if (weekHours > weeklyOvertimeLimit) {
          totalOvertimeHours += (weekHours - weeklyOvertimeLimit);
        }
      }
    }
    
    return Math.round(totalOvertimeHours * 100) / 100;
  } catch (error) {
    console.error('Error getting overtime hours this week:', error);
    return 0;
  }
};