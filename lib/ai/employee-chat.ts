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

// Clean up markdown formatting - selective bold formatting
function cleanMarkdownResponse(response: string): string {
  return response
    // Convert markdown to HTML
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // **bold** -> <strong>
    .replace(/\*(.*?)\*/g, '<em>$1</em>')              // *italic* -> <em>
    .replace(/__(.*?)__/g, '<strong>$1</strong>')      // __bold__ -> <strong>
    .replace(/_(.*?)_/g, '<em>$1</em>')                // _italic_ -> <em>
    // Clean up bullet points
    .replace(/^\s*-\s*/gm, '• ')
    // Clean up excessive line breaks
    .replace(/\n\n\n+/g, '\n\n')
    // Add selective bold formatting for important data only
    .replace(/(\$[\d,]+)/g, '<strong>$1</strong>')                    // Dollar amounts
    .replace(/(\d+)\s+(policies?|sales?|employees?)/gi, '<strong>$1</strong> $2') // Counts
    .replace(/^([A-Z][^:•\n]*):$/gm, '<strong>$1:</strong>')         // Section headers only
    .trim();
}

// Generate AI-powered initial greeting
async function generateInitialGreeting(employee: any): Promise<string> {
  const currentHour = new Date().getHours();
  let greeting = "Hello";
  
  if (currentHour < 12) {
    greeting = "Good morning";
  } else if (currentHour < 17) {
    greeting = "Good afternoon";
  } else {
    greeting = "Good evening";
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `Generate a warm, encouraging welcome message for ${employee.name}, an employee at Let's Insure. Use "${greeting}" as the greeting. Keep it professional but friendly, mention you're their HR Assistant, and briefly explain how you can help with tracking sales, reviews, and daily summaries. Be motivating and supportive. Don't use excessive formatting.`
      },
      {
        role: "user",
        content: "Generate the welcome message"
      }
    ],
    max_tokens: 200,
    temperature: 0.7,
  });

  return completion.choices[0]?.message?.content || `${greeting}, ${employee.name}! I'm your HR Assistant, ready to help you track your achievements and support your success. How can I help you today?`;
}

// Generate AI-powered clock out message
async function generateClockOutMessage(employeeName: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `Generate an encouraging, conversational message for ${employeeName} who just clocked out. Ask about their day in a warm, supportive way. Be genuinely interested in hearing about their experiences - both wins and challenges. Keep it natural and motivating. Don't use excessive formatting.`
      },
      {
        role: "user",
        content: "Generate the clock out message"
      }
    ],
    max_tokens: 150,
    temperature: 0.8,
  });

  return completion.choices[0]?.message?.content || `Hey ${employeeName}! How did your day go? I'd love to hear about it!`;
}

export async function handleEmployeeChat(message: string, userId: string, userName: string = 'there') {
  // Handle special system messages
  if (message === 'INITIAL_GREETING') {
    const employee = await getEmployee(userId);
    if (!employee) {
      return NextResponse.json({ 
        response: "Welcome! I notice you don't have an employee record set up yet. Please contact your administrator to have your account properly configured in the system." 
      });
    }
    const greeting = await generateInitialGreeting(employee);
    return NextResponse.json({ response: greeting });
  }

  if (message === 'CLOCK_OUT_PROMPT') {
    const employee = await getEmployee(userId);
    const employeeName = employee?.name || userName;
    const clockOutMessage = await generateClockOutMessage(employeeName);
    return NextResponse.json({ response: clockOutMessage });
  }

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
    model: "gpt-4",
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

  let rawResponse = completion.choices[0]?.message?.content || "I'm sorry, I couldn't process your request.";
  let response = cleanMarkdownResponse(rawResponse);

  // Check if we should start a conversation flow - UPDATED to ask for multiple items together
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('sold a policy') || lowerMessage.includes('new policy') || lowerMessage.includes('add policy') || lowerMessage.includes('policy sale')) {
    await updateConversationState({
      employeeId: userId,
      currentFlow: 'policy_entry_batch',  // Changed to batch mode
      collectedData: {},
      nextQuestion: 'all_policy_details',
      lastUpdated: new Date()
    });
    response += "\n\n🎉 Fantastic! Let's record this policy sale. To speed things up, can you share:\n\n• **Policy number** (e.g., POL-2025-001)\n• **Client name**\n• **Policy type** (auto, home, life, etc.)\n• **Sale amount** ($)\n\nJust give me all the details in one message and I'll get it recorded for you!";
  } else if (lowerMessage.includes('client review') || lowerMessage.includes('customer feedback') || lowerMessage.includes('review')) {
    await updateConversationState({
      employeeId: userId,
      currentFlow: 'review_entry_batch',  // Changed to batch mode
      collectedData: {},
      nextQuestion: 'all_review_details',
      lastUpdated: new Date()
    });
    response += "\n\n⭐ Great! I'll help you record this client review. Please share:\n\n• **Client name**\n• **Rating** (1-5 stars)\n• **Review text** (what they said)\n\nJust include all the details in your next message!";
  } else if (lowerMessage.includes('daily summary') || lowerMessage.includes('end of day') || lowerMessage.includes('today\'s summary')) {
    await updateConversationState({
      employeeId: userId,
      currentFlow: 'daily_summary',
      collectedData: {},
      nextQuestion: 'description',
      lastUpdated: new Date()
    });
    response += "\n\n🌟 How was your day? I'd love to hear about your accomplishments, any challenges you faced, or just how things went overall. I'll automatically calculate your hours and policies from the system!";
  }

  return NextResponse.json({ response });
}