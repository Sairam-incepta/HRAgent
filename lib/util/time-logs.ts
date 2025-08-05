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

export const updateTimeLog = async ({ 
  logId, 
  clockOut, 
  clockIn,
  breakStart, 
  breakEnd 
}: { 
  logId: string;
  clockOut?: Date;
  clockIn?: Date;
  breakStart?: Date;
  breakEnd?: Date;
}): Promise<{ data: any; error: any }> => {
  try {
    // Build the update object dynamically
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (clockOut) {
      updateData.clock_out = clockOut.toISOString();
    }

    // Add optional fields if provided
    if (clockIn) {
      updateData.clock_in = clockIn.toISOString();
    }
    
    if (breakStart) {
      updateData.break_start = breakStart.toISOString();
    }
    
    if (breakEnd) {
      updateData.break_end = breakEnd.toISOString();
    }

    const { data, error } = await supabase
      .from('time_logs')
      .update(updateData)
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

// ===== NEW BREAK TRACKING FUNCTIONS =====

export const startBreak = async (logId: string): Promise<{ data: any; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('time_logs')
      .update({
        break_start: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', logId)
      .select()
      .single();

    if (error) {
      console.error('Error starting break:', error);
      return { data: null, error };
    }

    // Notify dashboard to refresh
    notifyTimeLogged();

    return { data, error: null };
  } catch (error) {
    console.error('Exception in startBreak:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Unknown error occurred')
    };
  }
};

export const endBreak = async (logId: string): Promise<{ data: any; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('time_logs')
      .update({
        break_end: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', logId)
      .select()
      .single();

    if (error) {
      console.error('Error ending break:', error);
      return { data: null, error };
    }

    // Notify dashboard to refresh
    notifyTimeLogged();

    return { data, error: null };
  } catch (error) {
    console.error('Exception in endBreak:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Unknown error occurred')
    };
  }
};

export const getTotalBreakTimeToday = async (employeeId: string, date: string): Promise<number> => {
  try {
    const logs = await getTimeLogsForDay(employeeId, date);
    
    let totalSeconds = 0;
    logs.forEach(log => {
      if (log.break_start && log.break_end) {
        // Completed break: calculate duration
        const duration = (new Date(log.break_end).getTime() - new Date(log.break_start).getTime()) / 1000;
        totalSeconds += duration;
      } else if (log.break_start && !log.break_end) {
        // Currently on break: calculate current duration
        const currentDuration = (Date.now() - new Date(log.break_start).getTime()) / 1000;
        totalSeconds += currentDuration;
      }
    });
    
    return Math.floor(totalSeconds);
  } catch (error) {
    console.error('Error calculating total break time:', error);
    return 0;
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