import { supabase } from "../supabase";
import { ConversationState } from "../supabase";

// Conversation State Functions
export const getConversationState = async (employeeId: string): Promise<ConversationState | null> => {
  try {
    const { data, error } = await supabase
      .from('conversation_states')
      .select('*')
      .eq('employee_id', employeeId)
      .single();

    if (error) {
      // Only ignore "no rows found" - throw real errors
      if (error.code !== 'PGRST116') {
        console.error('Error fetching conversation state:', error);
        throw error;
      }
      // No conversation state found is expected
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception in getConversationState:', error);
    throw error;
  }
};

export const updateConversationState = async (state: {
  id?: string;
  employeeId: string;
  currentFlow: 'policy_entry' | 'review_entry' | 'cross_sell_entry' | 'daily_summary' | 'hours_entry' | 'policy_entry_batch' | 'review_entry_batch' | 'policy_entry_natural' | 'review_entry_natural' | 'none';
  collectedData: Record<string, any>;
  nextQuestion?: string;
  step?: number;
  lastUpdated: Date;
}): Promise<void> => {
  try {
    const updateData: any = {
      employee_id: state.employeeId,
      current_flow: state.currentFlow,
      collected_data: state.collectedData,
      last_updated: state.lastUpdated.toISOString()
    };

    // Include nextQuestion for backward compatibility with old flows
    if (state.nextQuestion) {
      updateData.next_question = state.nextQuestion;
    }

    // Include step for new streamlined flows
    if (state.step !== undefined) {
      updateData.step = state.step;
    }

    const { error } = await supabase
      .from('conversation_states')
      .upsert(updateData, {
        onConflict: 'employee_id' // Specify the unique column for conflict resolution
      });

    if (error) {
      console.error('Error updating conversation state:', error);
      throw new Error('Failed to update conversation state');
    }
  } catch (error) {
    console.error('Exception in updateConversationState:', error);
    throw error;
  }
};

export const clearConversationState = async (employeeId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('conversation_states')
      .delete()
      .eq('employee_id', employeeId);

    if (error) {
      console.error('Error clearing conversation state:', error);
      throw new Error('Failed to clear conversation state');
    }
  } catch (error) {
    console.error('Exception in clearConversationState:', error);
    throw error;
  }
};