import { supabase } from "../supabase";
import { notifyRequestSubmitted } from "../events";

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
      throw new Error('Failed to add request');
    }

    // Notify dashboard to refresh
    notifyRequestSubmitted();

    return data;
  } catch (error) {
    console.error('Exception in addRequest:', error);
    throw error;
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