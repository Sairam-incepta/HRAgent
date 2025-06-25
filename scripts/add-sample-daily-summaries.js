const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  'https://tmlwqhbvwcgqcnhxjfqe.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtbHdxaGJ2d2NncWNuaHhqZnFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQyNzc2NDEsImV4cCI6MjA0OTg1MzY0MX0.4_j4vECmkb5kJPHjRa6Zz8rjHs2uLHgkpBpCh4-pMbQ'
);

async function addSampleDailySummaries() {
  try {
    // Get all employees first
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('*');

    if (employeesError) {
      console.error('Error fetching employees:', employeesError);
      return;
    }

    console.log('Found employees:', employees.length);

    // Sample daily summaries for the past week
    const today = new Date();
    const sampleSummaries = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD format

      // Skip weekends for more realistic data
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      for (const employee of employees) {
        // Skip admin users (they don't have daily summaries)
        if (employee.position === 'HR Manager' || employee.email === 'admin@letsinsure.hr') continue;

        const hoursWorked = 7.5 + Math.random() * 2; // 7.5 to 9.5 hours
        const policiesSold = Math.floor(Math.random() * 4); // 0 to 3 policies
        const avgPolicyAmount = 1500 + Math.random() * 2000; // $1500 to $3500
        const totalSalesAmount = policiesSold * avgPolicyAmount;
        const totalBrokerFees = totalSalesAmount * 0.1; // 10% broker fee

        const descriptions = [
          "Had a productive day with several client calls. Focused on explaining policy benefits and answering questions about coverage options.",
          "Busy day processing applications and following up with potential clients. Made good progress on my monthly targets.",
          "Spent time reviewing client portfolios and identifying cross-selling opportunities. Had some challenging conversations but overall positive outcomes.",
          "Focused on customer service today, handling several policy renewals and addressing client concerns. Built good rapport with new prospects.",
          "Good day for sales activities. Had productive meetings with two families looking for comprehensive coverage. Follow-up scheduled for next week."
        ];

        sampleSummaries.push({
          employee_id: employee.clerk_user_id,
          date: dateString,
          hours_worked: Math.round(hoursWorked * 100) / 100,
          policies_sold: policiesSold,
          total_sales_amount: Math.round(totalSalesAmount * 100) / 100,
          total_broker_fees: Math.round(totalBrokerFees * 100) / 100,
          description: descriptions[Math.floor(Math.random() * descriptions.length)],
          key_activities: ['Client consultations', 'Policy reviews', 'Administrative tasks'],
          created_at: new Date().toISOString()
        });
      }
    }

    console.log('Adding', sampleSummaries.length, 'sample daily summaries...');

    // Insert sample summaries
    const { data, error } = await supabase
      .from('daily_summaries')
      .upsert(sampleSummaries, { 
        onConflict: 'employee_id,date',
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      console.error('Error adding daily summaries:', error);
      return;
    }

    console.log('✅ Successfully added', data?.length || 0, 'daily summaries');
    console.log('Sample summaries added for employees:', employees.map(e => e.name).filter(name => name !== 'Admin User'));

  } catch (error) {
    console.error('Exception:', error);
  }
}

// Run the script
addSampleDailySummaries(); 