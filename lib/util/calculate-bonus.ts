// Helper function to calculate bonus based on broker fees (not policy amount)
export const calculateBonus = (brokerFee: number, isCrossSold: boolean = false): number => {
  if (brokerFee <= 100) return 0;
  const baseBonus = Math.round((brokerFee - 100) * 0.1 * 100) / 100;
  
  // Double commission for cross-sold policies
  return isCrossSold ? baseBonus * 2 : baseBonus;
};

// Helper function to calculate life insurance referral bonus
export const calculateLifeInsuranceReferralBonus = (policyType: string, crossSoldType?: string): number => {
  // $10 for life insurance referrals (separate from cross-sell)
  if (policyType.toLowerCase().includes('life') || 
      (crossSoldType && crossSoldType.toLowerCase().includes('life'))) {
    return 10.00;
  }
  return 0;
};

// Helper function to calculate 5-star review bonus
export const calculateReviewBonus = (rating: number): number => {
  return rating === 5 ? 10.00 : 0;
};