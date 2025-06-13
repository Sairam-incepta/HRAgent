import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import openai from '@/lib/openai';
import { 
  getPolicySales, 
  getEmployeeBonus, 
  getClientReviews, 
  getEmployeeHours,
  getCrossSoldPolicies,
  addPolicySale,
  addClientReview,
  addDailySummary,
  calculateBonus,
  getConversationState,
  updateConversationState,
  clearConversationState,
  getDailySummaries,
  getEmployee,
  getEmployees,
  getOvertimeRequests
} from '@/lib/database';

// Helper function to extract structured data from user responses
const extractDataFromResponse = (message: string, dataType: string) => {
  const lowerMessage = message.toLowerCase();
  
  console.log('extractDataFromResponse called with:', { message, dataType });
  
  switch (dataType) {
    case 'total_sales':
    case 'policy_amount':
      const amountMatch = message.match(/\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/);
      return amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null;
    
    case 'broker_fee':
      const feeMatch = message.match(/\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/);
      return feeMatch ? parseFloat(feeMatch[1].replace(/,/g, '')) : null;
    
    case 'hours_worked':
    case 'hours':
      const hoursMatch = message.match(/(\d+(?:\.\d+)?)/);
      return hoursMatch ? parseFloat(hoursMatch[1]) : null;
    
    case 'rating':
      const ratingMatch = message.match(/(\d+)/);
      const rating = ratingMatch ? parseInt(ratingMatch[1]) : null;
      return rating && rating >= 1 && rating <= 5 ? rating : null;
    
    case 'policies_sold':
      const policiesMatch = message.match(/(\d+)/);
      return policiesMatch ? parseInt(policiesMatch[1]) : null;
    
    case 'client_name':
      // For client names, just return the trimmed message
      return message.trim();
    
    case 'policy_number':
      const trimmed = message.trim();
      
      // Don't extract from conversational phrases
      const conversationalPhrases = [
        'i sold', 'sold a', 'new policy', 'policy today', 'yesterday',
        'client review', 'customer feedback', 'daily summary', 'hours worked',
        'client name', 'client\'s name', 'name is', 'insur'
      ];
      
      if (conversationalPhrases.some(phrase => lowerMessage.includes(phrase))) {
        return null;
      }
      
      // Accept various policy number formats
      const policyPatterns = [
        /^([A-Z]{2,4}[-_]?\d{4}[-_]?\d{3})$/i,     // POL-2025-001
        /^([A-Z]{2,4}[-_]?\d{3,})$/i,              // POL-001, ABC-123
        /^([A-Z]+\d+[A-Z]*)$/i,                    // ABC123, POL001A
        /^(\d+[A-Z]+\d*)$/i,                       // 123ABC, 123ABC456
      ];
      
      for (const pattern of policyPatterns) {
        const match = trimmed.match(pattern);
        if (match) {
          return match[1].toUpperCase().replace(/[-_]/g, '-');
        }
      }
      
      // If it looks like a policy number (has both letters and numbers), accept it
      if (trimmed.length >= 3 && /[A-Za-z]/.test(trimmed) && /\d/.test(trimmed) && /^[A-Z0-9\-_]+$/i.test(trimmed)) {
        return trimmed.toUpperCase();
      }
      
      return null;
    
    case 'cross_sold':
      // Handle yes/no responses for cross-sell question
      const yesResponses = ['yes', 'y', 'yeah', 'yep', 'sure', 'true'];
      const noResponses = ['no', 'n', 'nope', 'false', 'none'];
      
      if (yesResponses.includes(lowerMessage)) {
        return 'yes';
      } else if (noResponses.includes(lowerMessage)) {
        return 'no';
      }
      return null;
  }
};

// Helper function to determine user role
const getUserRole = (userId: string, userEmail?: string) => {
  const isAdmin = userEmail === 'admin@letsinsure.hr' || 
                  userId === 'user_2y2ylH58JkmHljhJT0BXIfjHQui';
  return isAdmin ? 'admin' : 'employee';
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { message, userRole } = await request.json();

    // Determine actual user role if not provided
    const actualUserRole = userRole || getUserRole(userId);

    // Handle admin vs employee differently
    if (actualUserRole === 'admin') {
      return await handleAdminChat(message, userId);
    } else {
      return await handleEmployeeChat(message, userId);
    }

  } catch (error) {
    console.error('OpenAI API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}

async function handleAdminChat(message: string, userId: string) {
  try {
    // Get admin data for context
    const [employees, allOvertimeRequests, allPolicySales] = await Promise.all([
      getEmployees(),
      getOvertimeRequests(),
      getPolicySales()
    ]);

    const activeEmployees = employees.filter(emp => emp.status === 'active');
    const pendingRequests = allOvertimeRequests.filter(req => req.status === 'pending');
    const totalSales = allPolicySales.reduce((sum, sale) => sum + sale.amount, 0);
    const totalBonuses = allPolicySales.reduce((sum, sale) => sum + sale.bonus, 0);

    // Department breakdown
    const departmentMap = new Map();
    activeEmployees.forEach(emp => {
      if (!departmentMap.has(emp.department)) {
        departmentMap.set(emp.department, { count: 0, avgRate: 0, totalRate: 0 });
      }
      const dept = departmentMap.get(emp.department);
      dept.count += 1;
      dept.totalRate += emp.hourly_rate;
      dept.avgRate = dept.totalRate / dept.count;
    });

    const systemPrompt = `You are "Let's Insure Admin Assistant", an AI assistant for LetsInsure HR system administrators. You help HR managers and administrators manage employees, review performance, and analyze company metrics.

COMPANY OVERVIEW:
- Total Employees: ${employees.length}
- Active Employees: ${activeEmployees.length}
- Pending Requests: ${pendingRequests.length}
- Total Company Sales: $${totalSales.toLocaleString()}
- Total Bonuses Paid: $${totalBonuses.toLocaleString()}

DEPARTMENT BREAKDOWN:
${Array.from(departmentMap.entries()).map(([dept, data]) => 
  `- ${dept}: ${data.count} employees, avg rate $${data.avgRate.toFixed(2)}/hr`
).join('\n')}

RECENT OVERTIME REQUESTS:
${pendingRequests.slice(0, 5).map(req => {
  const employee = employees.find(emp => emp.clerk_user_id === req.employee_id);
  return `- ${employee?.name || 'Unknown'}: ${req.hours_requested}h requested, reason: ${req.reason}`;
}).join('\n')}

TOP PERFORMING EMPLOYEES (by sales):
${employees.map(emp => {
  const empSales = allPolicySales.filter(sale => sale.employee_id === emp.clerk_user_id);
  const totalSales = empSales.reduce((sum, sale) => sum + sale.amount, 0);
  return { name: emp.name, department: emp.department, sales: totalSales, count: empSales.length };
}).filter(emp => emp.sales > 0).sort((a, b) => b.sales - a.sales).slice(0, 5).map(emp => 
  `- ${emp.name} (${emp.department}): ${emp.count} policies, $${emp.sales.toLocaleString()}`
).join('\n')}

ADMIN CAPABILITIES:
As an admin assistant, you can help with:
- Employee performance analysis and insights
- Company metrics and KPI tracking
- Overtime request management guidance
- Payroll and compensation analysis
- Department performance comparisons
- Sales performance tracking
- HR policy questions and guidance
- Workforce planning and optimization

Provide strategic insights, data analysis, and administrative guidance. Focus on company-wide metrics, employee management, and operational efficiency.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: message
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content || "I'm sorry, I couldn't process your request.";

    return NextResponse.json({ response });

  } catch (error) {
    console.error('Admin chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process admin chat request' },
      { status: 500 }
    );
  }
}

async function handleEmployeeChat(message: string, userId: string) {
  // Try to get employee record - if it doesn't exist, provide helpful message
  const employee = await getEmployee(userId);
  if (!employee) {
    return NextResponse.json({ 
      response: "I notice you don't have an employee record set up yet. Please contact your administrator to have your account properly configured in the system. Once that's done, I'll be able to help you track your sales, bonuses, and work hours!" 
    });
  }

  // Get current conversation state
  const conversationState = await getConversationState(userId);

  // Get employee data for context
  const [policySales, clientReviews, employeeHours, crossSoldPolicies, dailySummaries] = await Promise.all([
    getPolicySales(userId),
    getClientReviews(userId),
    getEmployeeHours(userId),
    getCrossSoldPolicies(userId),
    getDailySummaries(userId)
  ]);

  // Calculate total bonus from all sources
  const employeeBonus = await getEmployeeBonus(userId);
  const baseBonus = employeeBonus?.total_bonus || 0;
  const fiveStarReviews = clientReviews.filter(r => r.rating === 5).length;
  const reviewBonus = fiveStarReviews * 10;
  const totalBonus = baseBonus + reviewBonus;

  // Handle conversation flows for data collection
  if (conversationState && conversationState.current_flow !== 'none') {
    console.log('Found active conversation state:', conversationState);
    return await handleConversationFlow(conversationState, message, userId);
  }

  // Calculate totals
  const totalPolicies = policySales.length;
  const totalSalesAmount = policySales.reduce((sum, sale) => sum + sale.amount, 0);
  const totalBrokerFees = policySales.reduce((sum, sale) => sum + sale.broker_fee, 0);

  // Create context for the AI
  const systemPrompt = `You are "Let's Insure Employee Assistant", an AI assistant for LetsInsure HR system. You help insurance sales employees track their performance, bonuses, and answer questions about their sales data.

EMPLOYEE DATA CONTEXT:
- Employee: ${employee.name} (${employee.position} in ${employee.department})
- Total Policies Sold: ${totalPolicies}
- Total Sales Amount: ${totalSalesAmount.toLocaleString()}
- Total Broker Fees: ${totalBrokerFees.toLocaleString()}
- Total Bonus Earned: ${totalBonus.toLocaleString()} (Sales: ${baseBonus.toLocaleString()}, 5-Star Reviews: ${reviewBonus.toLocaleString()})
- Hours This Week: ${employeeHours.thisWeek}
- Hours This Month: ${employeeHours.thisMonth}
- Cross-sold Policies: ${crossSoldPolicies.length}
- 5-Star Reviews: ${fiveStarReviews}

RECENT POLICIES SOLD:
${policySales.slice(-5).map(sale => `- Policy ${sale.policy_number}: ${sale.client_name}, ${sale.policy_type}, Amount: ${sale.amount}, Broker Fee: ${sale.broker_fee}, Bonus: ${sale.bonus}${sale.cross_sold ? ` (Cross-sold: ${sale.cross_sold_type})` : ''}${sale.client_description ? `\n  Client: ${sale.client_description}` : ''}`).join('\n')}

CLIENT REVIEWS:
${clientReviews.map(review => `- ${review.client_name} (${review.policy_number}): ${review.rating}/5 stars - "${review.review}"${review.rating === 5 ? ' (+$10 bonus)' : ''}`).join('\n')}

DAILY SUMMARIES:
${dailySummaries.slice(-3).map(summary => `- ${new Date(summary.date).toDateString()}: ${summary.hours_worked}h, ${summary.policies_sold} policies, ${summary.total_sales_amount} sales\n  Summary: ${summary.description}`).join('\n')}

BONUS CALCULATION RULES:
- Broker Fee Bonus: 10% of broker fee amount over $100
- Cross-Sell Bonus: Commission doubles on cross-sold policies
- Life Insurance Referral: Additional $10 per referral
- 5-Star Review Bonus: $10 per 5-star review

INTERACTIVE CAPABILITIES:
When users want to add new data, you should initiate conversation flows by responding with specific questions. Look for these triggers:
- "sold a policy" / "new policy" / "add policy" → Start policy entry flow
- "client review" / "customer feedback" / "review" → Start review entry flow  
- "daily summary" / "end of day" / "today's summary" → Start daily summary flow

For data entry flows, ask ONE specific question at a time:
1. Policy Entry: Ask for policy number, client name, policy type, amount, broker fee, cross-sell info, client description
2. Review Entry: Ask for client name, policy number, rating (1-5), review text
3. Daily Summary: Ask for hours worked, main activities, policies sold, total sales, challenges/highlights

Be conversational and helpful. Extract specific data points (numbers, names, amounts) from responses and confirm before saving.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: message
      }
    ],
    max_tokens: 1000,
    temperature: 0.7,
  });

  let response = completion.choices[0]?.message?.content || "I'm sorry, I couldn't process your request.";

  // Check if we should start a conversation flow
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('sold a policy') || lowerMessage.includes('new policy') || lowerMessage.includes('add policy')) {
    await updateConversationState({
      employeeId: userId,
      currentFlow: 'policy_entry',
      collectedData: {},
      nextQuestion: 'policy_number',
      lastUpdated: new Date()
    });
    response += "\n\nGreat! Let's record this new policy sale. What's the policy number? (e.g., POL-2025-001, ABC123, etc.)";
  } else if (lowerMessage.includes('client review') || lowerMessage.includes('customer feedback') || lowerMessage.includes('review')) {
    await updateConversationState({
      employeeId: userId,
      currentFlow: 'review_entry',
      collectedData: {},
      nextQuestion: 'client_name',
      lastUpdated: new Date()
    });
    response += "\n\nI'll help you record a client review. What's the client's name?";
  } else if (lowerMessage.includes('daily summary') || lowerMessage.includes('end of day') || lowerMessage.includes('today\'s summary')) {
    await updateConversationState({
      employeeId: userId,
      currentFlow: 'daily_summary',
      collectedData: {},
      nextQuestion: 'hours_worked',
      lastUpdated: new Date()
    });
    response += "\n\nLet's create your daily summary. How many hours did you work today?";
  }

  return NextResponse.json({ response });
}

async function handleConversationFlow(conversationState: any, message: string, employeeId: string) {
  const { current_flow: currentFlow, collected_data: collectedData = {}, next_question: nextQuestion } = conversationState;
  
  // For debugging
  console.log('Current flow:', currentFlow);
  console.log('Next question:', nextQuestion);
  console.log('Collected data:', collectedData);
  console.log('User message:', message);
  
  // Ensure collectedData is an object
  const safeCollectedData = typeof collectedData === 'object' && collectedData !== null ? collectedData : {};
  
  // Extract data based on the current question
  let extractedValue: any;
  
  // Handle client_name separately to avoid policy_number validation
  if (nextQuestion === 'client_name') {
    extractedValue = message.trim();
    if (!extractedValue) {
      return NextResponse.json({ 
        response: "Please provide the client's name:" 
      });
    }
  } else {
    extractedValue = extractDataFromResponse(message, nextQuestion);
    
    // Special handling for policy_number validation
    if (nextQuestion === 'policy_number' && !extractedValue) {
      const trimmed = message.trim();
      
      // If it's a reasonable length and doesn't look like a typical name/phrase, accept it
      if (trimmed.length >= 3 && trimmed.length <= 20 && /^[A-Z0-9\-_]+$/i.test(trimmed)) {
        // Additional check: should not be a common name or word
        const commonWords = ['deltagroup', 'group', 'company', 'client', 'customer', 'insurance'];
        if (!commonWords.includes(trimmed.toLowerCase())) {
          extractedValue = trimmed.toUpperCase();
        }
      }
      
      if (!extractedValue) {
        return NextResponse.json({ 
          response: "Please provide a valid policy number (e.g., POL-2025-001):" 
        });
      }
    }
  }
  
  // Store the extracted data with the correct key
  safeCollectedData[nextQuestion] = extractedValue || message.trim();
  
  // Debug logging
  console.log('Storing data:', {
    key: nextQuestion,
    value: safeCollectedData[nextQuestion],
    allData: safeCollectedData
  });
  
  let response = "";
  let nextQuestionKey = "";
  let isComplete = false;

  switch (currentFlow) {
    case 'policy_entry':
      [nextQuestionKey, isComplete] = getPolicyEntryNextQuestion(safeCollectedData);
      response = await handlePolicyEntryFlow(safeCollectedData, nextQuestionKey, extractedValue, message);
      break;
      
    case 'review_entry':
      [nextQuestionKey, isComplete] = getReviewEntryNextQuestion(safeCollectedData);
      response = await handleReviewEntryFlow(safeCollectedData, nextQuestionKey, extractedValue, message);
      break;
      
    case 'daily_summary':
      [nextQuestionKey, isComplete] = getDailySummaryNextQuestion(safeCollectedData);
      response = await handleDailySummaryFlow(safeCollectedData, nextQuestionKey, extractedValue, message);
      break;
  }

  if (isComplete) {
    // Save the collected data
    await saveCollectedData(currentFlow, safeCollectedData, employeeId);
    await clearConversationState(employeeId);
    response += "\n\n✅ Data saved successfully! Is there anything else I can help you with?";
  } else {
    // Update conversation state with next question
    console.log('Updating conversation state with:', {
      nextQuestion: nextQuestionKey,
      collectedData: safeCollectedData
    });
    
    await updateConversationState({
      employeeId,
      currentFlow,
      collectedData: safeCollectedData,
      nextQuestion: nextQuestionKey,
      lastUpdated: new Date()
    });
  }

  return NextResponse.json({ response });
}

function getPolicyEntryNextQuestion(data: any): [string, boolean] {
  console.log('getPolicyEntryNextQuestion - checking data:', data);
  
  if (!data.policy_number) return ['policy_number', false];
  if (!data.client_name) return ['client_name', false];
  if (!data.policy_type) return ['policy_type', false];
  if (!data.policy_amount) return ['policy_amount', false];
  if (!data.broker_fee) return ['broker_fee', false];
  if (!data.cross_sold) return ['cross_sold', false];
  if (data.cross_sold === 'yes' && !data.cross_sold_type) return ['cross_sold_type', false];
  if (!data.client_description) return ['client_description', false];
  return ['', true];
}

function getReviewEntryNextQuestion(data: any): [string, boolean] {
  if (!data.client_name) return ['client_name', false];
  if (!data.policy_number) return ['policy_number', false];
  if (!data.rating) return ['rating', false];
  if (!data.review_text) return ['review_text', false];
  return ['', true];
}

function getDailySummaryNextQuestion(data: any): [string, boolean] {
  if (!data.hours_worked) return ['hours_worked', false];
  if (!data.key_activities) return ['key_activities', false];
  if (!data.policies_sold) return ['policies_sold', false];
  if (!data.total_sales) return ['total_sales', false];
  if (!data.challenges) return ['challenges', false];
  return ['', true];
}

async function handlePolicyEntryFlow(data: any, nextQuestion: string, extractedValue: any, originalMessage: string): Promise<string> {
  // Debug log
  console.log('handlePolicyEntryFlow - nextQuestion:', nextQuestion, 'data:', data);
  
  // Determine response based on what we're asking for next
  switch (nextQuestion) {
    case 'client_name':
      return `Perfect! Policy number: ${data.policy_number}. What's the client's name?`;
    
    case 'policy_type':
      return `Client name: ${data.client_name}. What type of policy is this? (e.g., Auto, Home, Life, etc.)`;
    
    case 'policy_amount':
      return `Policy type: ${data.policy_type}. What's the policy amount in dollars?`;
    
    case 'broker_fee':
      const amount = parseFloat(data.policy_amount);
      if (!isNaN(amount)) {
        const bonus = calculateBonus(amount);
        return `Policy amount: ${amount.toLocaleString()}. Your bonus will be ${bonus.toLocaleString()}! What's the broker fee?`;
      }
      return "Please provide a valid dollar amount for the policy:";
    
    case 'cross_sold':
      const fee = parseFloat(data.broker_fee);
      if (!isNaN(fee)) {
        return `Broker fee: ${fee.toLocaleString()}. Did you cross-sell any additional policies? (yes/no)`;
      }
      return "Please provide a valid broker fee amount:";
    
    case 'cross_sold_type':
      return "Great! What type of policy did you cross-sell?";
    
    case 'client_description':
      if (data.cross_sold === 'yes' && data.cross_sold_type) {
        return `Cross-sold policy type: ${data.cross_sold_type}. Finally, can you provide a brief description of the client or policy details?`;
      }
      return "No problem! Finally, can you provide a brief description of the client or policy details?";
    
    case '':
      return "Perfect! I have all the information needed to record this policy sale.";
    
    default:
      return "I'm processing your information...";
  }
}

async function handleReviewEntryFlow(data: any, nextQuestion: string, extractedValue: any, originalMessage: string): Promise<string> {
  console.log('handleReviewEntryFlow - nextQuestion:', nextQuestion, 'data:', data);
  
  const responses: { [key: string]: string } = {
    'client_name': `Client name: ${data.client_name}. What's the policy number for this review?`,
    'policy_number': `Policy number: ${data.policy_number}. What rating did the client give? (1-5 stars)`,
    'rating': data.rating ? `Rating: ${data.rating}/5 stars. What did the client say in their review?` : "Please provide a rating from 1 to 5:",
    'review_text': `Perfect! I have all the review information.`,
    '': 'All information collected!'
  };

  const lastCollectedKey = Object.keys(data).pop() || '';
  return responses[lastCollectedKey] || responses[nextQuestion] || "I'm processing your information...";
}

async function handleDailySummaryFlow(data: any, nextQuestion: string, extractedValue: any, originalMessage: string): Promise<string> {
  console.log('handleDailySummaryFlow - nextQuestion:', nextQuestion, 'data:', data);
  
  const responses: { [key: string]: string } = {
    'hours_worked': data.hours_worked ? `Hours worked: ${data.hours_worked}. How many policies did you sell today?` : "Please provide the number of hours you worked:",
    'policies_sold': data.policies_sold !== undefined ? `Policies sold: ${data.policies_sold}. What was the total sales amount for today?` : "Please provide the number of policies sold:",
    'total_sales': (() => {
      const sales = parseFloat(data.total_sales);
      if (!isNaN(sales)) {
        return `Total sales: ${sales.toLocaleString()}. Finally, can you provide a brief summary of your day?`;
      }
      return "Please provide the total sales amount:";
    })(),
    'description': `Perfect! I have all the information for your daily summary.`,
    '': 'All information collected!'
  };

  const lastCollectedKey = Object.keys(data).pop() || '';
  return responses[lastCollectedKey] || responses[nextQuestion] || "I'm processing your information...";
}

async function saveCollectedData(flowType: string, data: any, employeeId: string) {
  switch (flowType) {
    case 'policy_entry':
      await addPolicySale({
        policyNumber: data.policy_number,
        clientName: data.client_name,
        policyType: data.policy_type,
        amount: parseFloat(data.policy_amount) || 0,
        brokerFee: parseFloat(data.broker_fee) || 0,
        employeeId,
        saleDate: new Date(),
        crossSold: data.cross_sold === 'yes',
        crossSoldType: data.cross_sold_type || undefined,
        crossSoldTo: data.cross_sold === 'yes' ? data.client_name : undefined,
        clientDescription: data.client_description
      });
      break;
      
    case 'review_entry':
      await addClientReview({
        clientName: data.client_name,
        policyNumber: data.policy_number,
        rating: parseInt(data.rating) || 5,
        review: data.review_text,
        reviewDate: new Date(),
        employeeId
      });
      break;
      
    case 'daily_summary':
      await addDailySummary({
        employeeId,
        date: new Date(),
        hoursWorked: parseFloat(data.hours_worked) || 0,
        policiesSold: parseInt(data.policies_sold) || 0,
        totalSalesAmount: parseFloat(data.total_sales) || 0,
        totalBrokerFees: 0, // We don't collect this in the flow
        description: `Activities: ${data.key_activities || 'Not specified'}. Challenges/Highlights: ${data.challenges || 'None mentioned'}`,
        keyActivities: data.key_activities ? data.key_activities.split(',').map((a: string) => a.trim()) : []
      });
      break;
  }
}