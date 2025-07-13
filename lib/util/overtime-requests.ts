import { supabase } from "../supabase";
import { OvertimeRequest } from "../supabase";

// Overtime Request Functions
export const addOvertimeRequest = async (request: {
  employeeId: string;
  hoursRequested: number;
  reason: string;
  currentOvertimeHours: number;
}): Promise<OvertimeRequest | null> => {
  try {
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
      throw new Error('Failed to add overtime request');
    }

    return data;
  } catch (error) {
    console.error('Exception in addOvertimeRequest:', error);
    throw error;
  }
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
  try {
    const { error } = await supabase
      .from('overtime_requests')
      .update({ status })
      .eq('id', requestId);

    if (error) {
      console.error('Error updating overtime request status:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception in updateOvertimeRequestStatus:', error);
    return false;
  }
};