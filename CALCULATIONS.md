# Pay

- hourly_rate*(regular_hours + overtime_hours) + ✅
    num_policy_sold*policy_sold_bonus + ✅
    num_cross_sold*2*cross_sold_bonus + ✅
    life_insurance_bonus + ✅
    (ifHighValue ? admin_bonus : 0) + ✅
    max(0.1*broker_fee - 100, 0) +✅
    5-star-review ✅

- employee_bonus_table cols (row: policy sold) (for payroll calculations)
    - employee_id
    - policy_number 
    - broker_fee                [policy_sales: broker_fee]
    - isCrossSold (bool)        [policy_sales: is_cross_sold_policy]
    - isLifeInsurance (bool)    [policy_sales: policy_type.contains('life')]
    - isHighValue (bool)        [policy_sales: amount >= 5000]
    - adminBonus                [hvpn: admin_bonus]


    - is5StarReview (bool)      [client_review: rating == 5]



