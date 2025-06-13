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
  getEmployee
} from '@/lib/database';

// Helper function to extract structured data from user responses
const extractDataFromResponse = (message: string, dataType: string) => {
  const lowerMessage = message.toLowerCase();
  
  switch (dataType) {
    case 'policy_amount':
      const amountMatch = message.match(/\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/);
      return amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null;
    
    case 'broker_fee':
      const feeMatch = message.match(/\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/);
      return feeMatch ? parseFloat(feeMatch[1].replace(/,/g, '')) : null;
    
    case 'hours':
      const hoursMatch = message.match(/(\d+(?:\.\d+)?)/);
      return hoursMatch ? parseFloat(hoursMatch[1]) : null;
    
    case 'rating':
      const ratingMatch = message.match(/(\d+)/);
      const rating = ratingMatch ? parseInt(ratingMatch[1]) : null;
      return rating && rating >= 1 && rating <= 5 ? rating : null;
    
    case 'policy_number':
      const policyMatch = message.match(/([A-Z]{2,4}-\d{4}-\d{3}|POL-\d{4}-\d{3}|\w+\d+)/i);
      return policyMatch ? policyMatch[1].toUpperCase() : null;
    
    default:
      return message.trim();
  }
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

    const { message } = await request.json();

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
    const [policySales, employeeBonus, clientReviews, employeeHours, crossSoldPolicies, dailySummaries] = await Promise.all([
      getPolicySales(userId),
      getEmployeeBonus(userId),
      getClientReviews(userId),
      getEmployeeHours(userId),
      getCrossSoldPolicies(userId),
      getDailySummaries(userId)
    ]);

    // Handle conversation flows for data collection
    if (conversationState && conversationState.current_flow !== 'none') {
      return await handleConversationFlow(conversationState, message, userId);
    }

    // Calculate totals
    const totalPolicies = policySales.length;
    const totalSalesAmount = policySales.reduce((sum, sale) => sum + sale.amount, 0);
    const totalBrokerFees = policySales.reduce((sum, sale) => sum + sale.broker_fee, 0);
    const totalBonus = employeeBonus?.total_bonus || 0;

    // Create context for the AI
    const systemPrompt = `You are "Let's Insure Assistant", an AI assistant for LetsInsure HR system. You help insurance sales employees track their performance, bonuses, and answer questions about their sales data.

EMPLOYEE DATA CONTEXT:
- Employee: ${employee.name} (${employee.position} in ${employee.department})
- Total Policies Sold: ${totalPolicies}
- Total Sales Amount: $${totalSalesAmount.toLocaleString()}
- Total Broker Fees: $${totalBrokerFees.toLocaleString()}
- Total Bonus Earned: $${totalBonus.toLocaleString()}
- Hours This Week: ${employeeHours.thisWeek}
- Hours This Month: ${employeeHours.thisMonth}
- Cross-sold Policies: ${crossSoldPolicies.length}

RECENT POLICIES SOLD:
${policySales.slice(-5).map(sale => `- Policy ${sale.policy_number}: ${sale.client_name}, ${sale.policy_type}, $${sale.amount}, Bonus: $${sale.bonus}${sale.cross_sold ? ` (Cross-sold: ${sale.cross_sold_type})` : ''}${sale.client_description ? `\n  Client: ${sale.client_description}` : ''}`).join('\n')}

CLIENT REVIEWS:
${clientReviews.map(review => `- ${review.client_name} (${review.policy_number}): ${review.rating}/5 stars - "${review.review}"`).join('\n')}

DAILY SUMMARIES:
${dailySummaries.slice(-3).map(summary => `- ${new Date(summary.date).toDateString()}: ${summary.hours_worked}h, ${summary.policies_sold} policies, $${summary.total_sales_amount} sales\n  Summary: ${summary.description}`).join('\n')}

BONUS CALCULATION RULES:
- 10% bonus on policy amount after the first $100
- Example: $1,200 policy = 10% of ($1,200 - $100) = $110 bonus

INTERACTIVE CAPABILITIES:
When users want to add new data, you should initiate conversation flows by responding with specific questions. Look for these triggers:
- "sold a policy" / "new policy" / "add policy" → Start policy entry flow
- "client review" / "customer feedback" / "review" → Start review entry flow  
- "daily summary" / "end of day" / "today's summary" → Start daily summary flow
- "worked hours" / "log hours" / "time worked" → Start hours entry flow

For data entry flows, ask ONE specific question at a time:
1. Policy Entry: Ask for policy number, client name, policy type, amount, broker fee, cross-sell info, client description
2. Review Entry: Ask for client name, policy number, rating (1-5), review text
3. Daily Summary: Ask for hours worked, number of policies sold, total sales amount, description of the day
4. Hours Entry: Ask for hours worked and brief description of activities

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
      response += "\n\nGreat! Let's record this new policy sale. What's the policy number?";
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

  } catch (error) {
    console.error('OpenAI API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}

async function handleConversationFlow(conversationState: any, message: string, employeeId: string) {
  const { current_flow: currentFlow, collected_data: collectedData, next_question: nextQuestion } = conversationState;
  
  // Extract data based on the current question
  let extractedValue = extractDataFromResponse(message, nextQuestion);
  
  // Store the extracted data
  collectedData[nextQuestion] = extractedValue || message.trim();
  
  let response = "";
  let nextQuestionKey = "";
  let isComplete = false;

  switch (currentFlow) {
    case 'policy_entry':
      response = await handlePolicyEntryFlow(collectedData, nextQuestion, extractedValue, message);
      [nextQuestionKey, isComplete] = getPolicyEntryNextQuestion(collectedData);
      break;
      
    case 'review_entry':
      response = await handleReviewEntryFlow(collectedData, nextQuestion, extractedValue, message);
      [nextQuestionKey, isComplete] = getReviewEntryNextQuestion(collectedData);
      break;
      
    case 'daily_summary':
      response = await handleDailySummaryFlow(collectedData, nextQuestion, extractedValue, message);
      [nextQuestionKey, isComplete] = getDailySummaryNextQuestion(collectedData);
      break;
  }

  if (isComplete) {
    // Save the collected data
    await saveCollectedData(currentFlow, collectedData, employeeId);
    await clearConversationState(employeeId);
    response += "\n\n✅ Data saved successfully! Is there anything else I can help you with?";
  } else {
    // Update conversation state with next question
    await updateConversationState({
      employeeId,
      currentFlow,
      collectedData,
      nextQuestion: nextQuestionKey,
      lastUpdated: new Date()
    });
  }

  return NextResponse.json({ response });
}

function getPolicyEntryNextQuestion(data: any): [string, boolean] {
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
  if (!data.policies_sold) return ['policies_sold', false];
  if (!data.total_sales) return ['total_sales', false];
  if (!data.description) return ['description', false];
  return ['', true];
}

async function handlePolicyEntryFlow(data: any, currentQuestion: string, extractedValue: any, originalMessage: string): Promise<string> {
  switch (currentQuestion) {
    case 'policy_number':
      return extractedValue ? `Got it! Policy number: ${extractedValue}. What's the client's name?` : "I need a valid policy number. Please provide the policy number:";
    case 'client_name':
      return `Client name: ${data.client_name}. What type of policy is this? (e.g., Auto, Home, Life, etc.)`;
    case 'policy_type':
      return `Policy type: ${data.policy_type}. What's the policy amount in dollars?`;
    case 'policy_amount':
      if (!extractedValue) return "Please provide a valid dollar amount for the policy:";
      const bonus = calculateBonus(extractedValue);
      return `Policy amount: $${extractedValue.toLocaleString()}. Your bonus will be $${bonus.toLocaleString()}! What's the broker fee?`;
    case 'broker_fee':
      return extractedValue ? `Broker fee: $${extractedValue.toLocaleString()}. Did you cross-sell any additional policies? (yes/no)` : "Please provide a valid broker fee amount:";
    case 'cross_sold':
      const crossSold = originalMessage.toLowerCase().includes('yes');
      data.cross_sold = crossSold ? 'yes' : 'no';
      return crossSold ? "Great! What type of policy did you cross-sell?" : "No problem! Finally, can you provide a brief description of the client or policy details?";
    case 'cross_sold_type':
      return `Cross-sold policy type: ${data.cross_sold_type}. Finally, can you provide a brief description of the client or policy details?`;
    case 'client_description':
      return `Perfect! I have all the information needed to record this policy sale.`;
    default:
      return "I'm not sure what information I need next. Let me start over.";
  }
}

async function handleReviewEntryFlow(data: any, currentQuestion: string, extractedValue: any, originalMessage: string): Promise<string> {
  switch (currentQuestion) {
    case 'client_name':
      return `Client name: ${data.client_name}. What's the policy number for this review?`;
    case 'policy_number':
      return extractedValue ? `Policy number: ${extractedValue}. What rating did the client give? (1-5 stars)` : "Please provide a valid policy number:";
    case 'rating':
      return extractedValue ? `Rating: ${extractedValue}/5 stars. What did the client say in their review?` : "Please provide a rating from 1 to 5:";
    case 'review_text':
      return `Perfect! I have all the review information.`;
    default:
      return "I'm not sure what information I need next. Let me start over.";
  }
}

async function handleDailySummaryFlow(data: any, currentQuestion: string, extractedValue: any, originalMessage: string): Promise<string> {
  switch (currentQuestion) {
    case 'hours_worked':
      return extractedValue ? `Hours worked: ${extractedValue}. How many policies did you sell today?` : "Please provide the number of hours you worked:";
    case 'policies_sold':
      return extractedValue ? `Policies sold: ${extractedValue}. What was the total sales amount for today?` : "Please provide the number of policies sold:";
    case 'total_sales':
      return extractedValue ? `Total sales: $${extractedValue.toLocaleString()}. Finally, can you provide a brief summary of your day?` : "Please provide the total sales amount:";
    case 'description':
      return `Perfect! I have all the information for your daily summary.`;
    default:
      return "I'm not sure what information I need next. Let me start over.";
  }
}

async function saveCollectedData(flowType: string, data: any, employeeId: string) {
  switch (flowType) {
    case 'policy_entry':
      await addPolicySale({
        policyNumber: data.policy_number,
        clientName: data.client_name,
        policyType: data.policy_type,
        amount: data.policy_amount,
        brokerFee: data.broker_fee,
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
        rating: data.rating,
        review: data.review_text,
        reviewDate: new Date(),
        employeeId
      });
      break;
      
    case 'daily_summary':
      await addDailySummary({
        employeeId,
        date: new Date(),
        hoursWorked: data.hours_worked,
        policiesSold: data.policies_sold,
        totalSalesAmount: data.total_sales,
        totalBrokerFees: data.total_sales * 0.1, // Assuming 10% broker fee
        description: data.description,
        keyActivities: ['Sales calls', 'Client meetings', 'Policy processing']
      });
      break;
  }
}