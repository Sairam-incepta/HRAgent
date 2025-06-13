import { supabase } from './supabase';
import type { 
  PolicySale, 
  EmployeeBonus, 
  ClientReview, 
  DailySummary, 
  ConversationState,
  Employee,
  OvertimeRequest
} from './supabase';

// Helper function to calculate bonus
export const calculateBonus = (policyAmount: number): number => {
  if (policyAmount <= 100) return 0;
  return Math.round((policyAmount - 100) * 0.1 * 100) / 100;
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
}): Promise<PolicySale | null> => {
  const bonus = calculateBonus(sale.amount);
  
  const { data, error } = await supabase
    .from('policy_sales')
    .insert({
      policy_number: sale.policyNumber,
      client_name: sale.clientName,
      policy_type: sale.policyType,
      amount: sale.amount,
      broker_fee: sale.brokerFee,
      bonus,
      employee_id: sale.employeeId,
      sale_date: sale.saleDate.toISOString(),
      cross_sold: sale.crossSold || false,
      cross_sold_type: sale.crossSoldType,
      cross_sold_to: sale.crossSoldTo,
      client_description: sale.clientDescription
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding policy sale:', error);
    return null;
  }

  // Update employee bonus
  await updateEmployeeBonus(sale.employeeId, bonus);
  
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

// Client Review Functions
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
  // For now, we'll skip automatic employee creation to avoid RLS issues
  // Employees should be created manually in the database
  console.log('Employee creation skipped - please create employees manually in Supabase');
  return null;
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

// Payroll Functions
export interface PayrollPeriod {
  period: string;
  employees: number;
  total: number;
  status: 'current' | 'completed';
  startDate: string;
  endDate: string;
}

export const getPayrollPeriods = async (): Promise<PayrollPeriod[]> => {
  const employees = await getEmployees();
  const activeEmployees = employees.filter(emp => emp.status === 'active');
  
  // Generate bi-weekly periods for the last 6 periods
  const periods: PayrollPeriod[] = [];
  const now = new Date();
  
  for (let i = 0; i < 6; i++) {
    const endDate = new Date(now);
    endDate.setDate(now.getDate() - (i * 14));
    
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 13);
    
    // Calculate total based on average hours and employee rates
    const averageHours = 80; // 2 weeks * 40 hours
    const totalPay = activeEmployees.reduce((sum, emp) => sum + (emp.hourly_rate * averageHours), 0);
    
    periods.push({
      period: `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      employees: activeEmployees.length,
      total: Math.round(totalPay),
      status: i === 0 ? 'current' : 'completed',
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });
  }
  
  return periods;
};