import { NextResponse } from 'next/server';
import openai from '@/lib/openai';
import { 
  getPolicySales, 
  getClientReviews, 
  getEmployeeHours,
  getCrossSoldPolicies,
  getDailySummaries,
  getEmployee,
  getConversationState,
  updateConversationState
} from '@/lib/database';
import { buildEmployeeSystemPrompt } from './system-prompts';
import { handleConversationFlow } from './conversation-flows';

export async function handleEmployeeChat(message: string, userId: string) {
  // Try to get employee record - if it doesn't exist, provide helpful message
  const employee = await getEmployee(userId);
  if (!employee) {
    return NextResponse.json({ 
      response: "I notice you don't have an employee record set up yet. Please contact your administrator to have your account properly configured in the system. Once that's done, I'll be able to help you track your sales and work hours!" 
    });
  }

  // Get current conversation state
  const conversationState = await getConversationState(userId);

  // Get employee data for context - ENSURE we get fresh data every time
  const [policySales, clientReviews, employeeHours, crossSoldPolicies, dailySummaries] = await Promise.all([
    getPolicySales(userId),
    getClientReviews(userId),
    getEmployeeHours(userId),
    getCrossSoldPolicies(userId),
    getDailySummaries(userId)
  ]);

  // Handle conversation flows for data collection
  if (conversationState && conversationState.current_flow !== 'none') {
    console.log('Found active conversation state:', conversationState);
    return await handleConversationFlow(conversationState, message, userId);
  }

  // Calculate totals (but don't include bonus information)
  const totalPolicies = policySales.length;
  const totalSalesAmount = policySales.reduce((sum, sale) => sum + sale.amount, 0);
  const totalBrokerFees = policySales.reduce((sum, sale) => sum + sale.broker_fee, 0);

  // Create context for the AI with CURRENT data (NO BONUS INFORMATION)
  const systemPrompt = buildEmployeeSystemPrompt(
    employee,
    totalPolicies,
    totalSalesAmount,
    totalBrokerFees,
    employeeHours,
    crossSoldPolicies,
    policySales,
    clientReviews,
    dailySummaries
  );

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1",
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
      nextQuestion: 'description',
      lastUpdated: new Date()
    });
    response += "\n\n🌟 Hey there! How was your day? I'd love to hear about your accomplishments, any challenges you faced, or just how things went overall. Don't worry about the technical details - I'll automatically calculate your hours and policies from the system!";
  }

  return NextResponse.json({ response });
} 