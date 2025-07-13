import { supabase } from "../supabase";
import { PolicySale, HighValuePolicyNotification } from "../supabase";

export const getHighValuePolicyNotifications = async (): Promise<PolicySale[]> => {
  const { data, error } = await supabase
    .from('policy_sales')
    .select('*')
    .gt('amount', 5000)
    .order('amount', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching high-value policy notifications:', error);
    return [];
  }

  return data || [];
};

// High-Value Policy Notification Functions
export const createHighValuePolicyNotification = async (notification: {
  employeeId: string;
  policyNumber: string;
  policyAmount: number;
  brokerFee: number;
  currentBonus: number;
  isCrossSoldPolicy: boolean;
}): Promise<HighValuePolicyNotification | null> => {
  try {
    const { data, error } = await supabase
      .from('high_value_policy_notifications')
      .insert({
        employee_id: notification.employeeId,
        policy_number: notification.policyNumber,
        policy_amount: notification.policyAmount,
        broker_fee: notification.brokerFee,
        current_bonus: notification.currentBonus,
        is_cross_sold_policy: notification.isCrossSoldPolicy,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      // Handle duplicate policy number specifically
      if (error.code === '23505' && error.message.includes('policy_number')) {
        throw new Error(`High-value policy notification for ${notification.policyNumber} already exists`);
      }
      
      console.error('Error creating high-value policy notification:', error);
      throw new Error('Failed to create high-value policy notification');
    }

    return data;
  } catch (error) {
    console.error('Exception in createHighValuePolicyNotification:', error);
    throw error;
  }
};

export const getHighValuePolicyNotificationsList = async (): Promise<HighValuePolicyNotification[]> => {
  try {
    const { data, error } = await supabase
      .from('high_value_policy_notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching high-value policy notifications:', error);
      throw new Error('Failed to fetch high-value policy notifications');
    }

    if (!data) {
      return [];
    }

    // Enhanced deduplication by policy_number, keeping the most recent entry for each policy
    const policyMap = new Map<string, HighValuePolicyNotification>();
    let duplicateCount = 0;

    data.forEach(notification => {
      const existingEntry = policyMap.get(notification.policy_number);
      if (!existingEntry || new Date(notification.created_at) > new Date(existingEntry.created_at)) {
        if (existingEntry) {
          duplicateCount++;
        }
        policyMap.set(notification.policy_number, notification);
      } else {
        duplicateCount++;
      }
    });

    // Only log if duplicates found (simplified logging)
    if (duplicateCount > 0) {
      console.warn(`Found ${duplicateCount} duplicate high-value policy notifications`);
    }

    const result = Array.from(policyMap.values()).sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return result;
  } catch (error) {
    console.error('Exception in getHighValuePolicyNotificationsList:', error);
    throw error;
  }
};

export const updateHighValuePolicyNotification = async (
  notificationId: string,
  updates: {
    adminBonus?: number;
    adminNotes?: string;
    status?: 'pending' | 'reviewed' | 'resolved';
  }
): Promise<HighValuePolicyNotification | null> => {
  try {
    // Convert camelCase to snake_case for database columns
    const updateData: any = {};

    if (updates.adminBonus !== undefined) {
      updateData.admin_bonus = updates.adminBonus;
    }

    if (updates.adminNotes !== undefined) {
      updateData.admin_notes = updates.adminNotes;
    }

    if (updates.status !== undefined) {
      updateData.status = updates.status;
    }

    if (updates.status === 'reviewed') {
      updateData.reviewed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('high_value_policy_notifications')
      .update(updateData)
      .eq('id', notificationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating high-value policy notification:', error);
      throw new Error('Failed to update high-value policy notification');
    }

    return data;
  } catch (error) {
    console.error('Exception in updateHighValuePolicyNotification:', error);
    throw error;
  }
};