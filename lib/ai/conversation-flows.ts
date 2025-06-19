import { NextResponse } from 'next/server';
import { 
  updateConversationState,
  clearConversationState,
  addPolicySale,
  addClientReview,
  addDailySummary,
  getTodayTimeTracking,
  getTodayPolicySales
} from '@/lib/database';

// Helper function to extract structured data from user responses
export const extractDataFromResponse = (message: string, dataType: string) => {
  const lowerMessage = message.toLowerCase();
  
  console.log('extractDataFromResponse called with:', { message, dataType });
  
  switch (dataType) {
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

export async function handleConversationFlow(conversationState: any, message: string, employeeId: string) {
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
      response = await handleDailySummaryFlow(safeCollectedData, nextQuestionKey, extractedValue, message, employeeId);
      break;
  }

  if (isComplete) {
    // Save the collected data
    await saveCollectedData(currentFlow, safeCollectedData, employeeId);
    await clearConversationState(employeeId);
    
    if (currentFlow === 'daily_summary') {
      response += "\n\n🎉 Thanks for sharing! Your daily summary has been recorded. You're doing great work, and I appreciate you taking the time to reflect on your day. Keep up the amazing effort! 💪";
    } else {
      response += "\n\n✅ Data saved successfully! Your performance metrics have been updated. Is there anything else I can help you with?";
    }
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
  // Only ask for description - everything else is calculated automatically
  if (!data.description) return ['description', false];
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
        return `Policy amount: $${amount.toLocaleString()}. What's the broker fee?`;
      }
      return "Please provide a valid dollar amount for the policy:";
    
    case 'cross_sold':
      const fee = parseFloat(data.broker_fee);
      if (!isNaN(fee)) {
        return `Broker fee: $${fee.toLocaleString()}. Did you cross-sell any additional policies? (yes/no)`;
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

async function handleDailySummaryFlow(data: any, nextQuestion: string, extractedValue: any, originalMessage: string, employeeId: string): Promise<string> {
  console.log('handleDailySummaryFlow - nextQuestion:', nextQuestion, 'data:', data);
  
  if (nextQuestion === 'description') {
    return `Perfect! I have your daily summary. I'll automatically calculate your hours worked and policies sold from the system data.`;
  }
  
  return 'All information collected!';
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
      // Get today's data automatically from the database
      const [todayTimeTracking, todayPolicies] = await Promise.all([
        getTodayTimeTracking(employeeId),
        getTodayPolicySales(employeeId)
      ]);
      
      // Calculate values from actual data
      const hoursWorked = todayTimeTracking.totalHours || 0;
      const policiesSold = todayPolicies.length;
      const totalSalesAmount = todayPolicies.reduce((sum, policy) => sum + policy.amount, 0);
      const totalBrokerFees = todayPolicies.reduce((sum, policy) => sum + policy.broker_fee, 0);
      
      await addDailySummary({
        employeeId,
        date: new Date(),
        hoursWorked,
        policiesSold,
        totalSalesAmount,
        totalBrokerFees,
        description: data.description,
        keyActivities: ['Sales activities', 'Client interactions', 'Administrative tasks']
      });
      break;
  }
} 