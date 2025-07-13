import { supabase } from "../supabase";
import { getLocalDateString } from "./timezone";
import { notifyTimeLogged } from "../events";

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

export const updateTimeLog = async ({ logId, clockOut }: { logId: string, clockOut: Date }): Promise<{ data: any; error: any }> => {
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
      return { data: null, error };
    }

    // Notify dashboard to refresh
    notifyTimeLogged();

    return { data, error: null };
  } catch (error) {
    console.error('Exception in updateTimeLog:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Unknown error occurred')
    };
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
  try {
    const { data, error } = await supabase
      .from('time_logs')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('clock_in', { ascending: true });

    if (error) {
      console.error('Error fetching time logs for week:', error);
      console.error('Query params:', { employeeId, startDate, endDate });
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getTimeLogsForWeek:', error);
    console.error('Query params:', { employeeId, startDate, endDate });
    return [];
  }
};