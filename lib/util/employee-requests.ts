import { supabase } from "../supabase";
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