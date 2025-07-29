import { supabase } from "../supabase";
import { PolicySale } from "../supabase";
import { calculateBonus } from "./calculate-bonus";
import { updateEmployeeBonus } from "./employee-bonus";
import { notifyPolicySale } from "../events";

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
  isCrossSoldPolicy?: boolean;
}): Promise<PolicySale | null> => {
  try {    
    const { data, error } = await supabase
      .from('policy_sales')
      .insert({
        policy_number: sale.policyNumber,
        client_name: sale.clientName,
        policy_type: sale.policyType,
        amount: sale.amount,
        broker_fee: sale.brokerFee,
        employee_id: sale.employeeId,
        sale_date: sale.saleDate.toISOString(),
        cross_sold_type: sale.crossSoldType,
        cross_sold_to: sale.crossSoldTo,
        client_description: sale.clientDescription,
        is_cross_sold_policy: sale.isCrossSoldPolicy || sale.crossSold || false,
        bonus: calculateBonus(sale.brokerFee, sale.isCrossSoldPolicy || false)
      })
      .select()
      .single();

    if (error) {
      // Handle duplicate policy number specifically
      if (error.code === '23505' && error.message.includes('policy_number')) {
        throw new Error(`Policy number ${sale.policyNumber} already exists. Please use a different policy number.`);
      }
      
      console.error('Error adding policy sale:', error);
      throw new Error('Failed to add policy sale');
    }

    // Update employee bonus
    await updateEmployeeBonus(sale.employeeId, data.bonus);

    // Notify dashboard to refresh
    notifyPolicySale(sale.employeeId);

    return data;
  } 
  catch (error) {
    console.error('Exception in addPolicySale:', error);
    throw error; // Always throw, don't return null
  }
};

export const editPolicySale = async (policyId: string, updates: {
  policyNumber: string;
  clientName: string;
  policyType: string;
  amount: number;
  brokerFee: number;
  saleDate: Date;
  crossSoldType?: string;
  crossSoldTo?: string;
  clientDescription?: string;
  isCrossSoldPolicy: boolean;
}): Promise<PolicySale | null> => {
  try {
    // First, get the current policy to get the employee_id and old bonus
    const { data: currentPolicy, error: fetchError } = await supabase
      .from('policy_sales')
      .select('employee_id, bonus')
      .eq('id', policyId)
      .single();

    if (fetchError || !currentPolicy) {
      console.error('Error fetching current policy:', fetchError);
      throw new Error('Policy not found');
    }

    // Calculate new bonus
    const newBonus = calculateBonus(updates.brokerFee, updates.isCrossSoldPolicy);
    const bonusDifference = newBonus - (currentPolicy.bonus || 0);

    // Update the policy
    const { data, error } = await supabase
      .from('policy_sales')
      .update({
        policy_number: updates.policyNumber,
        client_name: updates.clientName,
        policy_type: updates.policyType,
        amount: updates.amount,
        broker_fee: updates.brokerFee,
        sale_date: updates.saleDate.toISOString(),
        cross_sold_type: updates.crossSoldType,
        cross_sold_to: updates.crossSoldTo,
        client_description: updates.clientDescription,
        is_cross_sold_policy: updates.isCrossSoldPolicy,
        bonus: newBonus,
        created_at: new Date().toISOString()
      })
      .eq('id', policyId)
      .select()
      .single();

    if (error) {
      // Handle duplicate policy number specifically
      if (error.code === '23505' && error.message.includes('policy_number')) {
        throw new Error(`Policy number ${updates.policyNumber} already exists. Please use a different policy number.`);
      }
      
      console.error('Error updating policy sale:', error);
      throw new Error('Failed to update policy sale');
    }

    // Update employee bonus if there's a difference
    if (bonusDifference !== 0) {
      await updateEmployeeBonus(currentPolicy.employee_id, bonusDifference);
    }

    // Notify dashboard to refresh
    notifyPolicySale(currentPolicy.employee_id);

    return data;
  } catch (error) {
    console.error('Exception in editPolicySale:', error);
    throw error;
  }
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
    .eq('is_cross_sold_policy', true)
    .order('sale_date', { ascending: false });

  if (error) {
    console.error('Error fetching cross-sold policies:', error);
    return [];
  }

  return data || [];
};

// Get urgent policies that need review (period ending soon)
export const getUrgentReviewPolicies = async () => {
  try {
    const { data, error } = await supabase
      .rpc('get_urgent_review_policies');

    if (error) {
      console.error('Error fetching urgent review policies:', error);
      return null;
    }

    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Exception in getUrgentReviewPolicies:', error);
    return null;
  }
};