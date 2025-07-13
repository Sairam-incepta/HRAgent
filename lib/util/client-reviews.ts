import { supabase } from "../supabase";
import { ClientReview } from "../supabase";
import { calculateReviewBonus } from "./calculate-bonus";
import { updateEmployeeBonus } from "./employee-bonus";
import { notifyClientReview } from "../events";

// Client Review Functions - Updated to include 5-star review bonus
export const addClientReview = async (review: {
  clientName: string;
  policyNumber: string;
  rating: number;
  review: string;
  reviewDate: Date;
  employeeId: string;
}): Promise<ClientReview | null> => {
  try {
    console.log('📝 Adding client review:', review);
    
    const bonus = calculateReviewBonus(review.rating);
    
    const { data, error } = await supabase
      .from('client_reviews')
      .insert({
        client_name: review.clientName,
        policy_number: review.policyNumber,
        rating: review.rating,
        review: review.review,
        review_date: review.reviewDate.toISOString(),
        employee_id: review.employeeId,
        bonus: bonus,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding client review:', error);
      throw new Error('Failed to add client review');
    }
    
    // Update employee bonus
    await updateEmployeeBonus(review.employeeId, bonus);
    
    // Notify dashboard to refresh
    notifyClientReview();
    
    return data;
  } 
  catch (error) {
    console.error('Exception in addClientReview:', error);
    throw error;
  }
};

export const getClientReviews = async (employeeId?: string): Promise<ClientReview[]> => {
  let query = supabase.from('client_reviews').select('*');
  
  if (employeeId) {
    query = query.eq('employee_id', employeeId);
  }
  
  const { data, error } = await query.order('review_date', { ascending: false });

  if (error) {
    console.error('Error fetching client reviews:', error);
    return [];
  }

  return data || [];
};