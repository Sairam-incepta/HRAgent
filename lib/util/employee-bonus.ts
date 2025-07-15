import { supabase } from "../supabase";
import { EmployeeBonus } from "../supabase";
import { getEmployee } from "./employee";
import { appSettings } from "../config/app-settings";

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
    console.log(`🔍 Calculating total lifetime bonus for employee: ${employeeId}`);

    // Get employee and query policy_sales directly with employee_id filter
    const [employee, policySalesResult, highValueNotificationsResult, clientReviewsResult] = await Promise.all([
      getEmployee(employeeId),
      // Query policy_sales directly with employee_id - much simpler!
      supabase
        .from('policy_sales')
        .select('id, broker_fee, is_cross_sold_policy, policy_type, amount, employee_id')
        .eq('employee_id', employeeId),
      // Get ALL admin bonuses for this employee
      supabase
        .from('high_value_policy_notifications')
        .select('id, employee_id, admin_bonus')
        .eq('employee_id', employeeId),
      // Get ALL client reviews for this employee
      supabase
        .from('client_reviews')
        .select('employee_id, rating, review_date')
        .eq('employee_id', employeeId)
    ]);

    if (!employee) {
      console.log('❌ Employee not found');
      return null;
    }

    // Handle errors
    if (policySalesResult.error) {
      console.error('Error fetching policy sales:', policySalesResult.error);
      throw policySalesResult.error;
    }
    if (highValueNotificationsResult.error) {
      console.error('Error fetching high value notifications:', highValueNotificationsResult.error);
    }
    if (clientReviewsResult.error) {
      console.error('Error fetching client reviews:', clientReviewsResult.error);
    }

    const allPolicySales = policySalesResult.data || [];
    const highValueNotifications = highValueNotificationsResult.data || [];
    const clientReviews = clientReviewsResult.data || [];

    console.log(`📈 Found ${allPolicySales.length} total sales for employee`);

    if (allPolicySales.length === 0) {
      // Return zero bonus if no sales ever
      return {
        id: crypto.randomUUID(),
        employee_id: employeeId,
        total_bonus: 0,
        last_updated: new Date().toISOString(),
        created_at: new Date().toISOString()
      };
    }

    // Calculate total bonuses across ALL time using the EXACT same logic
    let totalBonuses = 0;

    allPolicySales.forEach(sale => {
      let saleBonus = 0;
      const {
        broker_fee = 0,
        is_cross_sold_policy = false,
        policy_type = '',
        amount = 0
      } = sale;

      // EXACT SAME LOGIC: If amount >= threshold, ONLY use admin bonus
      if (amount >= appSettings.highValueThreshold) {
        const totalAdminBonus = highValueNotifications.reduce((sum, notification) => {
          return sum + (notification.admin_bonus || 0);
        }, 0);
        saleBonus = totalAdminBonus;
      } else {
        // For sales < 5000, calculate regular bonuses
        
        // 1. 10% of (broker fee - 100)
        if (broker_fee > 100) {
          const baseBrokerBonus = (broker_fee - 100) * 0.1;
          saleBonus += baseBrokerBonus;

          // 2. If cross-sold, add an additional base broker bonus
          if (is_cross_sold_policy) {
            saleBonus += baseBrokerBonus;
          }
        }

        // 3. If policy_type contains 'life' or 'life_insurance', add 10
        const policyTypeLower = policy_type.toLowerCase();
        if (policyTypeLower.includes('life') || policyTypeLower.includes('life_insurance')) {
          saleBonus += 10;
        }
      }

      totalBonuses += saleBonus;
    });

    // 4. Add review bonuses: $10 per 5-star review across ALL time
    const allFiveStarReviews = (clientReviews || []).filter(review => review.rating === 5);
    const reviewBonuses = allFiveStarReviews.length * 10;
    totalBonuses += reviewBonuses;

    console.log(`💰 Total lifetime bonus: ${totalBonuses.toFixed(2)} from ${allPolicySales.length} sales and ${allFiveStarReviews.length} 5-star reviews`);

    return {
      id: crypto.randomUUID(),
      employee_id: employeeId,
      total_bonus: Math.round(totalBonuses * 100) / 100,
      last_updated: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

  } catch (error) {
    console.error('Exception in getEmployeeBonus:', error);
    throw error;
  }
};