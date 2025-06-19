import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side Supabase client (for browser)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side Supabase client (for server-side operations)
export const createServerSupabaseClient = () => {
  return createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
};

// Database types
export interface PolicySale {
  id: string;
  policy_number: string;
  client_name: string;
  policy_type: string;
  amount: number;
  broker_fee: number;
  bonus: number;
  employee_id: string;
  sale_date: string;
  cross_sold: boolean;
  cross_sold_type?: string;
  cross_sold_to?: string;
  client_description?: string;
  is_cross_sold_policy?: boolean;
  created_at: string;
}

export interface HighValuePolicyNotification {
  id: string;
  employee_id: string;
  policy_number: string;
  policy_amount: number;
  broker_fee: number;
  current_bonus: number;
  is_cross_sold_policy: boolean;
  status: 'pending' | 'reviewed';
  admin_bonus?: number;
  admin_notes?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface EmployeeBonus {
  id: string;
  employee_id: string;
  total_bonus: number;
  last_updated: string;
  created_at: string;
}

export interface ClientReview {
  id: string;
  client_name: string;
  policy_number: string;
  rating: number;
  review: string;
  review_date: string;
  employee_id: string;
  created_at: string;
}

export interface DailySummary {
  id: string;
  employee_id: string;
  date: string;
  hours_worked: number;
  policies_sold: number;
  total_sales_amount: number;
  total_broker_fees: number;
  description: string;
  key_activities: string[];
  created_at: string;
}

export interface ConversationState {
  id: string;
  employee_id: string;
  current_flow: 'policy_entry' | 'review_entry' | 'cross_sell_entry' | 'daily_summary' | 'hours_entry' | 'none';
  collected_data: Record<string, any>;
  next_question: string;
  last_updated: string;
  created_at: string;
}

export interface Employee {
  id: string;
  clerk_user_id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  status: 'active' | 'inactive' | 'on_leave'; // Changed to match database
  max_hours_before_overtime: number;
  hourly_rate: number;
  created_at: string;
}

export interface OvertimeRequest {
  id: string;
  employee_id: string;
  request_date: string;
  hours_requested: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  current_overtime_hours: number;
  created_at: string;
}