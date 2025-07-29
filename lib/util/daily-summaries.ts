import { supabase } from "../supabase";
import { DailySummary } from "../supabase";
import { getLocalDateString } from "./timezone";
import { notifyDailySummary } from "../events";

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
      console.error('Error adding daily summary:', error);
      throw new Error('Failed to add daily summary');
    }
        
    // Notify dashboard to refresh
    notifyDailySummary();
    
    return data;
  } 
  catch (error) {
    console.error('Exception in addDailySummary:', error);
    throw error;
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