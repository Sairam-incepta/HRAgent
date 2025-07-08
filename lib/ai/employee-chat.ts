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
  updateConversationState,
  clearConversationState
} from '@/lib/database';
import { buildEmployeeSystemPrompt, buildClockOutPrompt } from './system-prompts';
import { handleConversationFlow, getTriggerPhrase } from './conversation-flows';

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
    model: "gpt-4.1",
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
    model: "gpt-4.1",
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
  const lowerCaseMessage = message.toLowerCase();

  // Handle "nevermind" or "cancel"
  const cancelPhrases = ['nevermind', 'cancel', 'stop', 'forget it', 'wrong one'];
  const containsCancelPhrase = cancelPhrases.some(phrase => lowerCaseMessage.includes(phrase));

  if (containsCancelPhrase) {
    await clearConversationState(userId);

    // Check if the user wants to start a *new* flow right away
    const newTrigger = getTriggerPhrase(message);
    if (newTrigger) {
      // A new flow is being started, so we let the main logic handle it
      // after we've cleared the state.
      console.log('User cancelled previous action and started a new flow.');
    } else {
      // If it's just a cancellation, confirm and stop.
      return NextResponse.json({ 
        response: cleanMarkdownResponse("Okay, I've cancelled that for you. What would you like to do now?") 
      });
    }
  }

  // Handle reset conversation command
  if (message.toLowerCase().includes('reset conversation') || message.toLowerCase().includes('start over') || message.toLowerCase().includes('clear conversation')) {
    await clearConversationState(userId);
    return NextResponse.json({ 
      response: "✅ Conversation reset! You can now start fresh with a new policy entry, client review, or daily summary. What would you like to do?" 
    });
  }

  // Handle employee welcome message with simple placeholder (no AI generation needed)
  if (message === "WELCOME_MESSAGE") {
    return NextResponse.json({ 
      response: "Hey there! I'm your HR Assistant, ready to help you track your sales, reviews, and daily progress. What can I help you with today?" 
    });
  }

  // Handle special clock out prompt generation
  if (message === "CLOCK_OUT_PROMPT") {
    try {
            const completion = await openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          {
            role: "system",
            content: buildClockOutPrompt()
          },
          {
            role: "user",
            content: "Generate a warm check-in question for the employee who just finished their workday."
          }
        ],
        max_tokens: 80,
        temperature: 0.9,
      });

      let response = completion.choices[0]?.message?.content || "How was your day? I'd love to hear about it!";
      
      // Remove any surrounding quotes that might be added by the AI
      response = response.replace(/^["']|["']$/g, '');
      
      return NextResponse.json({ response });
    } catch (error) {
      console.error('Error generating clock out prompt:', error);
      return NextResponse.json({ response: "How was your day? I'd love to hear about it!" });
    }
  }

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

  // Try to get employee record - if it doesn't exist, provide helpful message
  const employee = await getEmployee(userId);
  if (!employee) {
    return NextResponse.json({ 
      response: "I notice you don't have an employee record set up yet. Please contact your administrator to have your account properly configured in the system. Once that's done, I'll be able to help you track your sales and work hours!" 
    });
  }

  // Check if user is starting a new conversation with trigger phrases
  const isTriggerPhrase = (
    lowerCaseMessage.includes('sold a policy') || lowerCaseMessage.includes('new policy') || 
    lowerCaseMessage.includes('add policy') || lowerCaseMessage.includes('policy sale') ||
    lowerCaseMessage.includes('client review') || lowerCaseMessage.includes('customer feedback') || 
    lowerCaseMessage.includes('review') ||
    lowerCaseMessage.includes('daily summary') || lowerCaseMessage.includes('end of day') || 
    lowerCaseMessage.includes('today\'s summary')
  );

  // Get current conversation state
  const conversationState = await getConversationState(userId);

  // If user is using a trigger phrase but there's an existing conversation state, 
  // clear it to start fresh (they might be starting a new entry)
  if (isTriggerPhrase && conversationState && conversationState.current_flow !== 'none') {
    console.log('User used trigger phrase with existing conversation state - clearing to start fresh');
    await clearConversationState(userId);
    // Continue with normal AI response flow
  } else if (conversationState && conversationState.current_flow !== 'none') {
    console.log('Found active conversation state:', conversationState);
    
    // Get employee data for context - ENSURE we get fresh data every time
    const [policySales, clientReviews, employeeHours, crossSoldPolicies, dailySummaries] = await Promise.all([
      getPolicySales(userId),
      getClientReviews(userId),
      getEmployeeHours(userId),
      getCrossSoldPolicies(userId),
      getDailySummaries(userId)
    ]);
    
    // Calculate totals for system prompt
    const totalPolicies = policySales.length;
    const totalSalesAmount = policySales.reduce((sum, sale) => sum + sale.amount, 0);
    const totalBrokerFees = policySales.reduce((sum, sale) => sum + sale.broker_fee, 0);
    
    // Prepare employee data for conversation flow
    const employeeFlowData = {
      employee,
      totalPolicies,
      totalSalesAmount,
      totalBrokerFees,
      employeeHours,
      crossSoldPolicies,
      policySales,
      clientReviews,
      dailySummaries
    };
    
    return await handleConversationFlow(conversationState, message, userId, employeeFlowData);
  }

  // Get employee data for context - ENSURE we get fresh data every time
  const [policySales, clientReviews, employeeHours, crossSoldPolicies, dailySummaries] = await Promise.all([
    getPolicySales(userId),
    getClientReviews(userId),
    getEmployeeHours(userId),
    getCrossSoldPolicies(userId),
    getDailySummaries(userId)
  ]);

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

  let rawResponse = completion.choices[0]?.message?.content || "I'm sorry, I couldn't process your request.";
  let response = cleanMarkdownResponse(rawResponse);

  // Check if AI response indicates a conversation flow should be started
  const lowerResponse = response.toLowerCase();
  
  // Start streamlined conversation flows based on trigger phrases
  if ((lowerCaseMessage.includes('sold a policy') || lowerCaseMessage.includes('new policy') || lowerCaseMessage.includes('add policy') || lowerCaseMessage.includes('policy sale'))
      && (lowerResponse.includes('policy') || lowerResponse.includes('details') || lowerResponse.includes('record'))) {
    // Set conversation state for streamlined policy entry
    await updateConversationState({
      employeeId: userId,
      currentFlow: 'policy_entry',
      collectedData: {},
      step: 1,
      lastUpdated: new Date()
    });
  } else if ((lowerCaseMessage.includes('client review') || lowerCaseMessage.includes('customer feedback') || lowerCaseMessage.includes('review'))
             && (lowerResponse.includes('client') || lowerResponse.includes('review') || lowerResponse.includes('feedback'))) {
    // Set conversation state for streamlined review entry
    await updateConversationState({
      employeeId: userId,
      currentFlow: 'review_entry',
      collectedData: {},
      step: 1,
      lastUpdated: new Date()
    });
  } else if ((lowerCaseMessage.includes('daily summary') || lowerCaseMessage.includes('end of day') || lowerCaseMessage.includes('today\'s summary'))
             && (lowerResponse.includes('day') || lowerResponse.includes('summary') || lowerResponse.includes('accomplishments'))) {
    // Set conversation state for AI-generated daily summary
    await updateConversationState({
      employeeId: userId,
      currentFlow: 'daily_summary',
      collectedData: {},
      step: 1,
      lastUpdated: new Date()
    });
  }

  return NextResponse.json({ response });
}