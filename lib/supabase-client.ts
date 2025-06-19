import { createClient } from '@supabase/supabase-js';
import { useAuth } from '@clerk/nextjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Hook to get authenticated Supabase client
export const useSupabaseClient = () => {
  const { getToken } = useAuth();
  
  const getAuthenticatedClient = async () => {
    const token = await getToken({ template: 'supabase' });
    
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });
  };
  
  return { getAuthenticatedClient };
};

// Function to get authenticated client (for non-hook contexts)
export const getAuthenticatedSupabaseClient = async (getToken: () => Promise<string | null>) => {
  const token = await getToken();
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
}; 