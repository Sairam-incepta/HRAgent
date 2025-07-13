import { supabase } from "../supabase";
import { EmployeeBonus } from "../supabase";

// Employee Bonus Functions
export const updateEmployeeBonus = async (employeeId: string, bonusToAdd: number): Promise<void> => {
  try {
    // First, try to get existing bonus
    const { data: existingBonus, error: selectError } = await supabase
      .from('employee_bonuses')
      .select('*')
      .eq('employee_id', employeeId)
      .single();

    if (existingBonus) {
      // Update existing bonus
      const { error: updateError } = await supabase
        .from('employee_bonuses')
        .update({
          total_bonus: existingBonus.total_bonus + bonusToAdd,
          last_updated: new Date().toISOString()
        })
        .eq('employee_id', employeeId);

      if (updateError) throw updateError;
    } else {
      // Create new bonus record
      const { error: insertError } = await supabase
        .from('employee_bonuses')
        .insert({
          employee_id: employeeId,
          total_bonus: bonusToAdd
        });

      if (insertError) throw insertError;
    }
  } 
  catch (error) {
    console.error('Error updating employee bonus:', error);
    throw error;
  }
};

export const getEmployeeBonus = async (employeeId: string): Promise<EmployeeBonus | null> => {
  try {
    const { data, error } = await supabase
      .from('employee_bonuses')
      .select('*')
      .eq('employee_id', employeeId)
      .single();

    if (error) {
      // Only log/throw real errors, not "no rows found"
      if (error.code !== 'PGRST116') {
        console.error('Error fetching employee bonus:', error);
        throw error;
      }
      // No bonus record exists - this is expected for new employees
      return null;
    }

    return data;
  } 
  catch (error) {
    console.error('Exception in getEmployeeBonus:', error);
    throw error;
  }
};