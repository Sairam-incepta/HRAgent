import { supabase } from "../supabase";

// Chat Messages
export const addChatMessage = async ({ userId, role, content }: { userId: string, role: string, content: string }) => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({ user_id: userId, role, content })
      .select()
      .single();

    if (error) {
      console.error('Error adding chat message:', error);
      throw new Error('Failed to add chat message');
    }

    return data;
  } catch (error) {
    console.error('Exception in addChatMessage:', error);
    throw error;
  }
};

export const getChatMessages = async ({ userId, limit = 35 }: { userId: string, limit?: number }) => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching chat messages:', error);
      console.error('Query params:', { userId, limit });
      return [];
    }

    // Return in chronological order
    return (data || []).reverse();
  } catch (error) {
    console.error('Error in getChatMessages:', error);
    console.error('Query params:', { userId, limit });
    return [];
  }
};