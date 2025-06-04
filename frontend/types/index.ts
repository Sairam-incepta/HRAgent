export interface Employee {
  id: string
  clerk_id: string
  email: string
  name: string
  employee_id?: string
  hourly_rate?: number
  role: 'employee' | 'admin'
  first_login: boolean
  created_at: string
  updated_at?: string
}

export interface TimeLog {
  id: string
  employee_id: string
  clock_in: string
  clock_out?: string
  lunch_start?: string
  lunch_end?: string
  total_hours?: number
  overtime_hours?: number
  date: string
  created_at: string
}

export interface Request {
  id: string
  employee_id: string
  type: 'overtime' | 'vacation'
  reason?: string
  status: 'pending' | 'approved' | 'rejected'
  requested_date?: string
  approved_by?: string
  approved_at?: string
  created_at: string
}

export interface PolicySale {
  id: string
  employee_id: string
  policy_id: string
  policy_type?: string
  sale_amount?: number
  commission_amount?: number
  bonus_triggered: boolean
  cancelled: boolean
  conversation_log?: any
  created_at: string
}