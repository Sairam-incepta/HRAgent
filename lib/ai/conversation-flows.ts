import { NextResponse } from 'next/server';
import openai from '@/lib/openai';
import { buildEmployeeSystemPrompt } from './system-prompts';

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

import { 
  updateConversationState,
  clearConversationState,
  addPolicySale,
  addClientReview,
  addDailySummary,
  getTodayTimeTracking,
  getTodayPolicySales
} from '@/lib/database';

// AI-powered response generator for conversation flows
async function generateFlowResponse(flowType: string, nextField: string, collectedData: any, userMessage: string, employeeData?: any): Promise<string> {
  try {
    const contextMap: Record<string, Record<string, string>> = {
      policy_entry: {
        policy_number: "Ask for the policy number in a friendly way (e.g., POL-2025-001)",
        client_name: "Ask for the client's name naturally",
        policy_type: "Ask what type of policy this is (Auto, Home, Life, etc.)",
        policy_amount: "Ask for the total policy sale amount (the full value of the policy sold to the client)",
        broker_fee: "Ask for the broker fee amount (the commission/fee earned from this policy sale)",
        cross_sold: "Ask if they cross-sold any additional policies (yes/no)",
        cross_sold_type: "Ask what type of policy they cross-sold",
        cross_sold_policy_number: "Ask for the policy number of the cross-sold policy",
        cross_sold_policy_amount: "Ask for the total policy amount of the cross-sold policy",
        cross_sold_broker_fee: "Ask for the broker fee of the cross-sold policy",
        client_description: "Ask for a brief description of the client or policy details"
      },
      review_entry: {
        client_name: "Ask for the client's name who gave the review",
        policy_number: "Ask for the policy number associated with this review",
        rating: "Ask for the client's rating (1-5 stars)",
        review_text: "Ask what the client said in their review"
      },
      daily_summary: {
        description: "Have a casual, motivating chat about their day - no formal data collection needed"
      }
    };

    const fieldContext = contextMap[flowType]?.[nextField] || `Ask for ${nextField}`;
    
    // Check if this is a repeat of the trigger message
    const isRepeatTrigger = (
      (userMessage.toLowerCase().includes('sold a policy') || userMessage.toLowerCase().includes('new policy')) &&
      nextField === 'policy_number' &&
      Object.keys(collectedData).length <= 1
    );

    let contextPrompt = '';
    if (isRepeatTrigger) {
      contextPrompt = `The user just mentioned selling a policy. This is the start of data collection. Be enthusiastic and welcoming.`;
    } else {
      const collectedSummary = Object.keys(collectedData).length > 0 
        ? `Already collected: ${Object.entries(collectedData).map(([k, v]) => `${k}: ${v}`).join(', ')}`
        : "This is the first piece of information we're collecting";
      contextPrompt = `CONTEXT: ${collectedSummary}`;
    }

    let systemContent = '';
    
    if (employeeData) {
      // Use the full system prompt with employee context
      systemContent = buildEmployeeSystemPrompt(
        employeeData.employee,
        employeeData.totalPolicies,
        employeeData.totalSalesAmount,
        employeeData.totalBrokerFees,
        employeeData.employeeHours,
        employeeData.crossSoldPolicies,
        employeeData.policySales,
        employeeData.clientReviews,
        employeeData.dailySummaries
      );
      
      // Add conversation flow specific instructions
      systemContent += `\n\nCONVERSATION FLOW CONTEXT:
You're currently helping the employee record their ${flowType.replace('_', ' ')}.

${contextPrompt}
NEXT TASK: ${fieldContext}

FLOW GUIDELINES:
- Be conversational and supportive
- If this is the start, show excitement about their achievement
- Acknowledge what they've already provided if any
- Ask for the next piece of information naturally and clearly
- Use bold formatting for important fields: **field name**
- Keep responses brief but warm (1-2 sentences)
- Show genuine interest in their work
- Use encouraging phrases like "Great!", "Perfect!", "Excellent!"

CRITICAL POLICY ENTRY RULES:
- policy_amount = TOTAL POLICY VALUE (e.g., $50,000 life insurance policy)
- broker_fee = COMMISSION EARNED (e.g., $500 commission from that policy)
- cross_sold_policy_amount = TOTAL VALUE of the cross-sold policy
- cross_sold_broker_fee = COMMISSION EARNED from the cross-sold policy
- NEVER say a policy amount is a broker fee - they are completely different
- NEVER confuse or mix up these values in your response
- When user provides a policy amount, acknowledge it as "policy amount" not "broker fee"
- When asking for broker fee, clearly state you need the "broker fee" or "commission"

${isRepeatTrigger ? 'SPECIAL NOTE: They just told you about a policy sale - be enthusiastic!' : ''}`;
    } else {
      // Fallback to simple system prompt
      systemContent = `You're a supportive HR assistant helping an employee record their ${flowType.replace('_', ' ')}. Be friendly, encouraging, and natural.

${contextPrompt}
NEXT TASK: ${fieldContext}

GUIDELINES:
- Be conversational and supportive
- If this is the start, show excitement about their achievement
- Acknowledge what they've already provided if any
- Ask for the next piece of information naturally and clearly
- Use bold formatting for important fields: **field name**
- Keep responses brief but warm (1-2 sentences)
- Show genuine interest in their work
- Use encouraging phrases like "Great!", "Perfect!", "Excellent!"

CRITICAL POLICY ENTRY RULES:
- policy_amount = TOTAL POLICY VALUE (e.g., $50,000 life insurance policy)
- broker_fee = COMMISSION EARNED (e.g., $500 commission from that policy)
- cross_sold_policy_amount = TOTAL VALUE of the cross-sold policy
- cross_sold_broker_fee = COMMISSION EARNED from the cross-sold policy
- NEVER say a policy amount is a broker fee - they are completely different
- NEVER confuse or mix up these values in your response
- When user provides a policy amount, acknowledge it as "policy amount" not "broker fee"
- When asking for broker fee, clearly state you need the "broker fee" or "commission"

${isRepeatTrigger ? 'SPECIAL NOTE: They just told you about a policy sale - be enthusiastic!' : ''}`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [{
        role: "system",
        content: systemContent
      }, {
        role: "user",
        content: userMessage
      }],
      max_tokens: 150,
      temperature: 0.8,
    });

    return completion.choices[0]?.message?.content || `What's the ${nextField.replace('_', ' ')}?`;
  } catch (error) {
    console.error('Error generating flow response:', error);
    // Fallback to original static responses
    return `Please provide the ${nextField.replace('_', ' ')}:`;
  }
}

// Helper function to extract structured data from user responses
export const extractDataFromResponse = (message: string, dataType: string): string | number | null => {
  const lowerMessage = message.toLowerCase();
  
  console.log('extractDataFromResponse called with:', { message, dataType });
  
  switch (dataType) {
    case 'policy_amount':
    case 'cross_sold_policy_amount':
      const amountMatch = message.match(/\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/);
      return amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null;
    
    case 'broker_fee':
    case 'cross_sold_broker_fee':
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
    
    default:
      return null;
  }
};

// NEW: Parse batch policy data from a single message
export const parsePolicyBatchData = (message: string): any => {
  const data: any = {};
  
  // Extract policy number
  const policyNumberPatterns = [
    /(?:policy\s*(?:number|#)\s*:?\s*)([A-Z0-9\-_]+)/gi,
    /(?:pol\s*#?\s*:?\s*)([A-Z0-9\-_]+)/gi,
    /^([A-Z0-9\-_]{3,})/gmi
  ];
  
  for (const pattern of policyNumberPatterns) {
    const match = message.match(pattern);
    if (match) {
      data.policy_number = match[1].toUpperCase();
      break;
    }
  }
  
  // Extract client name - look for patterns like "client: John Doe" or just proper names
  const clientPatterns = [
    /(?:client\s*(?:name)?\s*:?\s*)([A-Za-z\s]{2,30})/gi,
    /(?:customer\s*:?\s*)([A-Za-z\s]{2,30})/gi,
    /(?:for\s+)([A-Z][a-z]+\s+[A-Z][a-z]+)/g  // "for John Smith"
  ];
  
  for (const pattern of clientPatterns) {
    const match = message.match(pattern);
    if (match) {
      data.client_name = match[1].trim();
      break;
    }
  }
  
  // Extract policy type
  const typePatterns = [
    /(?:type\s*:?\s*)([A-Za-z\s]{2,20})/gi,
    /(?:policy\s*type\s*:?\s*)([A-Za-z\s]{2,20})/gi,
    /\b(auto|home|life|health|dental|vision|commercial|business)\b/gi
  ];
  
  for (const pattern of typePatterns) {
    const match = message.match(pattern);
    if (match) {
      data.policy_type = match[1].trim();
      break;
    }
  }
  
  // Extract amounts - look for both policy amount and broker fee
  const policyAmountPatterns = [
    /(?:policy\s*(?:sale|amount|value)\s*:?\s*)\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
    /(?:sale\s*(?:amount|value)\s*:?\s*)\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
    /(?:total\s*(?:amount|value)\s*:?\s*)\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi
  ];
  
  const brokerFeePatterns = [
    /(?:broker\s*fee\s*:?\s*)\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
    /(?:commission\s*:?\s*)\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
    /(?:fee\s*:?\s*)\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi
  ];
  
  // Try to extract specific policy amount
  for (const pattern of policyAmountPatterns) {
    const match = message.match(pattern);
    if (match) {
      data.policy_amount = parseFloat(match[1].replace(/,/g, ''));
      break;
    }
  }
  
  // Try to extract specific broker fee
  for (const pattern of brokerFeePatterns) {
    const match = message.match(pattern);
    if (match) {
      data.broker_fee = parseFloat(match[1].replace(/,/g, ''));
      break;
    }
  }
  
  // If we didn't find specific amounts, try to extract all dollar amounts
  if (!data.policy_amount && !data.broker_fee) {
    const amounts = [];
    let match;
    const amountRegex = /\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;
    while ((match = amountRegex.exec(message)) !== null) {
      amounts.push(parseFloat(match[1].replace(/,/g, '')));
    }
    
    if (amounts.length > 0) {
      // Assume the larger amount is the policy amount, smaller is broker fee
      amounts.sort((a, b) => b - a);
      data.policy_amount = amounts[0];
      if (amounts.length > 1) {
        data.broker_fee = amounts[1];
      }
    }
  }
  
  return data;
};

// NEW: Parse batch review data from a single message
export const parseReviewBatchData = (message: string): any => {
  const data: any = {};
  
  // Extract client name
  const clientPatterns = [
    /(?:client\s*(?:name)?\s*:?\s*)([A-Za-z\s]{2,30})/gi,
    /(?:customer\s*:?\s*)([A-Za-z\s]{2,30})/gi,
    /^([A-Z][a-z]+\s+[A-Z][a-z]+)/g  // Names at start
  ];
  
  for (const pattern of clientPatterns) {
    const match = message.match(pattern);
    if (match) {
      data.client_name = match[1].trim();
      break;
    }
  }
  
  // Extract rating
  const ratingPatterns = [
    /(?:rating\s*:?\s*)(\d)/gi,
    /(\d)\s*(?:stars?|\/5)/gi,
    /(\d)\s*out\s*of\s*5/gi
  ];
  
  for (const pattern of ratingPatterns) {
    const match = message.match(pattern);
    if (match) {
      const rating = parseInt(match[1]);
      if (rating >= 1 && rating <= 5) {
        data.rating = rating;
        break;
      }
    }
  }
  
  // Extract review text - anything in quotes or after "said" or "review"
  const reviewPatterns = [
    /"([^"]+)"/g,
    /(?:said|review|feedback)\s*:?\s*["']?([^"'\n]+)["']?/gi,
    /(?:they said|client said|review was)\s*:?\s*["']?([^"'\n]+)["']?/gi
  ];
  
  for (const pattern of reviewPatterns) {
    const match = message.match(pattern);
    if (match) {
      data.review_text = match[1].trim();
      break;
    }
  }
  
  return data;
};

export async function handleConversationFlow(conversationState: any, message: string, employeeId: string, employeeData?: any) {
  const { current_flow: currentFlow, collected_data: collectedData = {}, next_question: nextQuestion } = conversationState;
  
  // For debugging
  console.log('Current flow:', currentFlow);
  console.log('Next question:', nextQuestion);
  console.log('Collected data:', collectedData);
  console.log('User message:', message);
  
  // Ensure collectedData is an object
  const safeCollectedData = typeof collectedData === 'object' && collectedData !== null ? collectedData : {};
  
  // Handle new natural flows (step-by-step approach)
  if (currentFlow === 'policy_entry_natural') {
    return await handlePolicyNaturalFlow(message, employeeId, nextQuestion, safeCollectedData);
  }
  
  if (currentFlow === 'review_entry_natural') {
    return await handleReviewNaturalFlow(message, employeeId, nextQuestion, safeCollectedData);
  }
  
  // Handle new batch flows
  if (currentFlow === 'policy_entry_batch') {
    return await handlePolicyBatchFlow(message, employeeId);
  }
  
  if (currentFlow === 'review_entry_batch') {
    return await handleReviewBatchFlow(message, employeeId);
  }
  
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
      response = await handlePolicyEntryFlow(safeCollectedData, nextQuestionKey, extractedValue, message, employeeData);
      break;
      
    case 'review_entry':
      [nextQuestionKey, isComplete] = getReviewEntryNextQuestion(safeCollectedData);
      response = await handleReviewEntryFlow(safeCollectedData, nextQuestionKey, extractedValue, message, employeeData);
      break;
      
    case 'daily_summary':
      [nextQuestionKey, isComplete] = getDailySummaryNextQuestion(safeCollectedData);
      response = await handleDailySummaryFlow(safeCollectedData, nextQuestionKey, extractedValue, message, employeeId, employeeData);
      break;
  }

  if (isComplete) {
    // Save the collected data
    await saveCollectedData(currentFlow, safeCollectedData, employeeId);
    await clearConversationState(employeeId);
    
    if (currentFlow === 'daily_summary') {
      // For daily summary, just save the casual conversation - no formal completion message needed
      // The data is automatically calculated from time logs and policy sales
      return NextResponse.json({ response: cleanMarkdownResponse(response) });
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

  return NextResponse.json({ response: cleanMarkdownResponse(response) });
}

// NEW: Handle natural policy flow (step-by-step)
async function handlePolicyNaturalFlow(message: string, employeeId: string, nextQuestion: string, collectedData: any) {
  try {
    if (nextQuestion === 'core_policy_info') {
      // Parse the core information from their response
      const parsedData = parsePolicyBatchData(message);
      
      // Check what we got
      const coreInfo = {
        policy_number: parsedData.policy_number,
        client_name: parsedData.client_name,
        policy_type: parsedData.policy_type,
        policy_amount: parsedData.policy_amount
      };
      
      const missing = [];
      if (!coreInfo.policy_number) missing.push('policy number');
      if (!coreInfo.client_name) missing.push('client name');
      if (!coreInfo.policy_type) missing.push('policy type');
      if (!coreInfo.policy_amount) missing.push('sale amount');
      
      if (missing.length > 0) {
        return NextResponse.json({
          response: `I need the missing details:\n\n${missing.map(item => `• **${item.charAt(0).toUpperCase() + item.slice(1)}**`).join('\n')}\n\nPlease provide these in your next message!`
        });
      }
      
      // Store core info and move to next step
      const updatedData = { ...collectedData, ...coreInfo };
      await updateConversationState({
        employeeId,
        currentFlow: 'policy_entry_natural',
        collectedData: updatedData,
        nextQuestion: 'broker_fee_info',
        lastUpdated: new Date()
      });
      
      return NextResponse.json({
        response: `Perfect! I have the core details:

**✅ Policy:** ${coreInfo.policy_number}
**✅ Client:** ${coreInfo.client_name}  
**✅ Type:** ${coreInfo.policy_type}
**✅ Amount:** $${coreInfo.policy_amount.toLocaleString()}

Now, what's the **broker fee** for this policy?`
      });
    }
    
    if (nextQuestion === 'broker_fee_info') {
      const brokerFee = extractDataFromResponse(message, 'broker_fee');
      if (!brokerFee) {
        return NextResponse.json({
          response: "Please provide the broker fee amount (e.g., $250, 500, etc.)"
        });
      }
      
      const updatedData = { ...collectedData, broker_fee: brokerFee };
      await updateConversationState({
        employeeId,
        currentFlow: 'policy_entry_natural',
        collectedData: updatedData,
        nextQuestion: 'cross_sell_info',
        lastUpdated: new Date()
      });
      
      return NextResponse.json({
        response: `Great! Broker fee: **$${brokerFee.toLocaleString()}**

Did you **cross-sell** any additional policies to this client? (yes/no)`
      });
    }
    
    if (nextQuestion === 'cross_sell_info') {
      const crossSold = extractDataFromResponse(message, 'cross_sold');
      const updatedData = { ...collectedData, cross_sold: crossSold };
      
      if (crossSold === 'yes') {
        await updateConversationState({
          employeeId,
          currentFlow: 'policy_entry_natural',
          collectedData: updatedData,
          nextQuestion: 'cross_sell_details',
          lastUpdated: new Date()
        });
        
        return NextResponse.json({
          response: "Excellent! What type of policy did you cross-sell? (e.g., auto, home, life, etc.)"
        });
      } else {
        // No cross-sell, move to final step
        await updateConversationState({
          employeeId,
          currentFlow: 'policy_entry_natural',
          collectedData: updatedData,
          nextQuestion: 'final_details',
          lastUpdated: new Date()
        });
        
        return NextResponse.json({
          response: "Got it! Finally, please provide a brief description of the client or any special notes about this policy:"
        });
      }
    }
    
    if (nextQuestion === 'cross_sell_details') {
      const crossSoldType = message.trim();
      const updatedData = { ...collectedData, cross_sold_type: crossSoldType };
      
      await updateConversationState({
        employeeId,
        currentFlow: 'policy_entry_natural',
        collectedData: updatedData,
        nextQuestion: 'cross_sell_policy_number',
        lastUpdated: new Date()
      });
      
      return NextResponse.json({
        response: `Perfect! Cross-sold: **${crossSoldType}**

What's the **policy number** for the cross-sold policy?`
      });
    }
    
    if (nextQuestion === 'cross_sell_policy_number') {
      const crossSoldPolicyNumber = extractDataFromResponse(message, 'policy_number') || message.trim();
      const updatedData = { ...collectedData, cross_sold_policy_number: crossSoldPolicyNumber };
      
      await updateConversationState({
        employeeId,
        currentFlow: 'policy_entry_natural',
        collectedData: updatedData,
        nextQuestion: 'cross_sell_policy_amount',
        lastUpdated: new Date()
      });
      
      return NextResponse.json({
        response: `Got it! Cross-sold policy: **${crossSoldPolicyNumber}**

What's the **policy amount** for the cross-sold policy?`
      });
    }
    
    if (nextQuestion === 'cross_sell_policy_amount') {
      const crossSoldPolicyAmount = extractDataFromResponse(message, 'cross_sold_policy_amount');
      if (!crossSoldPolicyAmount) {
        return NextResponse.json({
          response: "Please provide the cross-sold policy amount (e.g., $5000, 10000, etc.)"
        });
      }
      
      const updatedData = { ...collectedData, cross_sold_policy_amount: crossSoldPolicyAmount };
      
      await updateConversationState({
        employeeId,
        currentFlow: 'policy_entry_natural',
        collectedData: updatedData,
        nextQuestion: 'cross_sell_broker_fee',
        lastUpdated: new Date()
      });
      
      return NextResponse.json({
        response: `Excellent! Cross-sold policy amount: **$${crossSoldPolicyAmount.toLocaleString()}**

What's the **broker fee** for the cross-sold policy?`
      });
    }
    
    if (nextQuestion === 'cross_sell_broker_fee') {
      const crossSoldBrokerFee = extractDataFromResponse(message, 'cross_sold_broker_fee');
      if (!crossSoldBrokerFee) {
        return NextResponse.json({
          response: "Please provide the cross-sold broker fee amount (e.g., $250, 500, etc.)"
        });
      }
      
      const updatedData = { ...collectedData, cross_sold_broker_fee: crossSoldBrokerFee };
      
      await updateConversationState({
        employeeId,
        currentFlow: 'policy_entry_natural',
        collectedData: updatedData,
        nextQuestion: 'final_details',
        lastUpdated: new Date()
      });
      
      return NextResponse.json({
        response: `Perfect! Cross-sold broker fee: **$${crossSoldBrokerFee.toLocaleString()}**

Finally, please provide a brief description of the client or any special notes about this policy:`
      });
    }
    
    if (nextQuestion === 'final_details') {
      const clientDescription = message.trim();
      const finalData = { ...collectedData, client_description: clientDescription };
      
      // Save the main policy (NOT cross-sold)
      const result = await addPolicySale({
        policyNumber: finalData.policy_number,
        clientName: finalData.client_name,
        policyType: finalData.policy_type,
        amount: parseAmount(finalData.policy_amount),
        brokerFee: parseAmount(finalData.broker_fee),
        employeeId,
        saleDate: new Date(),
        crossSold: false, // Main policy is NOT cross-sold
        crossSoldType: finalData.cross_sold_type,
        crossSoldTo: finalData.cross_sold === 'yes' ? finalData.client_name : undefined,
        clientDescription: finalData.client_description
      });
      
      // If cross-sold, save the cross-sold policy as a separate entry (THIS gets the cross-sold bonus)
      if (finalData.cross_sold === 'yes' && finalData.cross_sold_policy_number && finalData.cross_sold_policy_amount && finalData.cross_sold_broker_fee) {
        await addPolicySale({
          policyNumber: finalData.cross_sold_policy_number,
          clientName: finalData.client_name,
          policyType: finalData.cross_sold_type,
          amount: parseAmount(finalData.cross_sold_policy_amount),
          brokerFee: parseAmount(finalData.cross_sold_broker_fee),
          employeeId,
          saleDate: new Date(),
          crossSold: true, // This IS the cross-sold policy that gets the bonus
          isCrossSoldPolicy: true, // Mark as cross-sold policy for 2x bonus
          clientDescription: `Cross-sold to ${finalData.client_name} - ${finalData.client_description}`
        });
      }
      
      if (result) {
        await clearConversationState(employeeId);
        let responseMessage = `🎉 **Outstanding work!** I've successfully recorded your policy sale${finalData.cross_sold === 'yes' ? 's' : ''}:

**📋 Main Policy Details:**
• **Policy:** ${finalData.policy_number}
• **Client:** ${finalData.client_name}
• **Type:** ${finalData.policy_type}
• **Amount:** **$${finalData.policy_amount.toLocaleString()}**
• **Broker Fee:** **$${finalData.broker_fee.toLocaleString()}**`;

        if (finalData.cross_sold === 'yes' && finalData.cross_sold_policy_number) {
          responseMessage += `

**📋 Cross-Sold Policy Details:**
• **Policy:** ${finalData.cross_sold_policy_number}
• **Client:** ${finalData.client_name}
• **Type:** ${finalData.cross_sold_type}
• **Amount:** **$${finalData.cross_sold_policy_amount.toLocaleString()}**
• **Broker Fee:** **$${finalData.cross_sold_broker_fee.toLocaleString()}** *(2x bonus applied!)*`;
        }

        responseMessage += `
• **Notes:** ${finalData.client_description}

Your performance metrics have been updated! Keep up the fantastic work! 💪✨`;

        return NextResponse.json({
          response: responseMessage
        });
      } else {
        return NextResponse.json({
          response: "I had trouble saving that policy sale. Could you please try again?"
        });
      }
    }
    
  } catch (error) {
    console.error('Error in handlePolicyNaturalFlow:', error);
    return NextResponse.json({
      response: "Something went wrong. Please try again!"
    });
  }
}

// NEW: Handle natural review flow (step-by-step)
async function handleReviewNaturalFlow(message: string, employeeId: string, nextQuestion: string, collectedData: any) {
  try {
    if (nextQuestion === 'basic_review_info') {
      // Parse the basic review information
      const parsedData = parseReviewBatchData(message);
      
      const basicInfo = {
        client_name: parsedData.client_name,
        rating: parsedData.rating,
        review_text: parsedData.review_text
      };
      
      const missing = [];
      if (!basicInfo.client_name) missing.push('client name');
      if (!basicInfo.rating) missing.push('rating (1-5 stars)');
      if (!basicInfo.review_text) missing.push('review text');
      
      if (missing.length > 0) {
        return NextResponse.json({
          response: `I need the missing information:\n\n${missing.map(item => `• **${item.charAt(0).toUpperCase() + item.slice(1)}**`).join('\n')}\n\nPlease provide these details!`
        });
      }
      
      // Store basic info and move to optional details
      const updatedData = { ...collectedData, ...basicInfo };
      await updateConversationState({
        employeeId,
        currentFlow: 'review_entry_natural',
        collectedData: updatedData,
        nextQuestion: 'policy_number_optional',
        lastUpdated: new Date()
      });
      
      const starRating = '⭐'.repeat(basicInfo.rating);
      return NextResponse.json({
        response: `Great! I have the review details:

**✅ Client:** ${basicInfo.client_name}
**✅ Rating:** ${starRating} (${basicInfo.rating}/5)
**✅ Review:** "${basicInfo.review_text}"

**Optional:** Do you have the policy number for this review? (You can type it or just say "no")`
      });
    }
    
    if (nextQuestion === 'policy_number_optional') {
      let policyNumber: string = "REVIEW-ENTRY";
      
      if (message.toLowerCase().includes('no') || message.toLowerCase().includes('none')) {
        policyNumber = "REVIEW-ENTRY";
      } else {
        const extractedPolicy = extractDataFromResponse(message, 'policy_number');
        if (extractedPolicy && typeof extractedPolicy === 'string') {
          policyNumber = extractedPolicy;
        } else if (extractedPolicy && typeof extractedPolicy === 'number') {
          policyNumber = extractedPolicy.toString();
        }
      }
      
      const finalData = { ...collectedData, policy_number: policyNumber };
      
      // Save the review
      const result = await addClientReview({
        clientName: finalData.client_name,
        policyNumber: finalData.policy_number,
        rating: finalData.rating,
        review: finalData.review_text,
        reviewDate: new Date(),
        employeeId
      });
      
      if (result) {
        await clearConversationState(employeeId);
        const starRating = '⭐'.repeat(finalData.rating);
        return NextResponse.json({
          response: `🌟 **Fantastic feedback recorded!** 

**📝 Review Summary:**
• **Client:** ${finalData.client_name}
• **Rating:** ${starRating} (**${finalData.rating}/5**)
• **Review:** "${finalData.review_text}"
${policyNumber !== "REVIEW-ENTRY" ? `• **Policy:** ${policyNumber}` : ''}

${finalData.rating >= 4 ? 'Outstanding work! ' : 'Great job getting feedback! '}Reviews like this show the real impact you're making! 🎯`
        });
      } else {
        return NextResponse.json({
          response: "I had trouble saving that review. Could you please try again?"
        });
      }
    }
    
  } catch (error) {
    console.error('Error in handleReviewNaturalFlow:', error);
    return NextResponse.json({
      response: "Something went wrong. Please try again!"
    });
  }
}

// NEW: Handle policy batch flow
async function handlePolicyBatchFlow(message: string, employeeId: string) {
  try {
    const parsedData = parsePolicyBatchData(message);
    
    console.log('Parsed policy batch data:', parsedData);
    
    // Validate required fields
    const missing = [];
    if (!parsedData.policy_number) missing.push('policy number');
    if (!parsedData.client_name) missing.push('client name');
    if (!parsedData.policy_type) missing.push('policy type');
    if (!parsedData.policy_amount) missing.push('sale amount');
    
    if (missing.length > 0) {
      return NextResponse.json({
        response: `I need a bit more information. Please provide the missing details:\n\n${missing.map(item => `• **${item.charAt(0).toUpperCase() + item.slice(1)}**`).join('\n')}\n\nYou can include them all in one message!`
      });
    }
    
    // Save the policy sale
    const result = await addPolicySale({
      policyNumber: parsedData.policy_number,
      clientName: parsedData.client_name,
      policyType: parsedData.policy_type,
      amount: parsedData.policy_amount,
      brokerFee: parsedData.broker_fee,
      employeeId,
      saleDate: new Date(),
      crossSold: false,
      clientDescription: "Added via batch entry"
    });
    
    if (result) {
      await clearConversationState(employeeId);
      return NextResponse.json({
        response: `🎉 **Excellent work!** I've successfully recorded your policy sale:

**Policy Details:**
• Policy #${parsedData.policy_number}
• Client: ${parsedData.client_name}
• Type: ${parsedData.policy_type}
• Amount: **$${parsedData.policy_amount.toLocaleString()}**
• Broker Fee: **$${parsedData.broker_fee.toLocaleString()}**

Your performance metrics have been updated! Keep up the fantastic work! 💪✨`
      });
    } else {
      return NextResponse.json({
        response: "I had trouble saving that policy sale. Could you please try again?"
      });
    }
  } catch (error) {
    console.error('Error in handlePolicyBatchFlow:', error);
    return NextResponse.json({
      response: "Something went wrong while processing your policy sale. Please try again!"
    });
  }
}

// NEW: Handle review batch flow
async function handleReviewBatchFlow(message: string, employeeId: string) {
  try {
    const parsedData = parseReviewBatchData(message);
    
    console.log('Parsed review batch data:', parsedData);
    
    // Validate required fields
    const missing = [];
    if (!parsedData.client_name) missing.push('client name');
    if (!parsedData.rating) missing.push('rating (1-5 stars)');
    if (!parsedData.review_text) missing.push('review text');
    
    if (missing.length > 0) {
      return NextResponse.json({
        response: `I need a few more details to record this review:\n\n${missing.map(item => `• **${item.charAt(0).toUpperCase() + item.slice(1)}**`).join('\n')}\n\nPlease provide all the missing information in your next message!`
      });
    }
    
    // Save the client review
    const result = await addClientReview({
      clientName: parsedData.client_name,
      policyNumber: parsedData.policy_number || "BATCH-ENTRY",
      rating: parsedData.rating,
      review: parsedData.review_text,
      reviewDate: new Date(),
      employeeId
    });
    
    if (result) {
      await clearConversationState(employeeId);
      const starRating = '⭐'.repeat(parsedData.rating);
      return NextResponse.json({
        response: `🌟 **Fantastic feedback!** I've recorded this ${parsedData.rating}-star review:

**Review Details:**
• Client: ${parsedData.client_name}
• Rating: ${starRating} (**${parsedData.rating}/5**)
• Review: "${parsedData.review_text}"

${parsedData.rating >= 4 ? 'Outstanding work! ' : 'Great job getting feedback! '}Reviews like this show the real impact you're making with clients! 🎯`
      });
    } else {
      return NextResponse.json({
        response: "I had trouble saving that review. Could you please try again?"
      });
    }
  } catch (error) {
    console.error('Error in handleReviewBatchFlow:', error);
    return NextResponse.json({
      response: "Something went wrong while processing your review. Please try again!"
    });
  }
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
  if (data.cross_sold === 'yes' && !data.cross_sold_policy_number) return ['cross_sold_policy_number', false];
  if (data.cross_sold === 'yes' && !data.cross_sold_policy_amount) return ['cross_sold_policy_amount', false];
  if (data.cross_sold === 'yes' && !data.cross_sold_broker_fee) return ['cross_sold_broker_fee', false];
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

async function handlePolicyEntryFlow(data: any, nextQuestion: string, extractedValue: any, originalMessage: string, employeeData?: any): Promise<string> {
  // Debug log
  console.log('handlePolicyEntryFlow - nextQuestion:', nextQuestion, 'data:', data);
  
  // Use AI to generate natural responses
  if (nextQuestion && nextQuestion !== '') {
    return await generateFlowResponse('policy_entry', nextQuestion, data, originalMessage, employeeData);
  }
  
  return "Perfect! I have all the information needed to record this policy sale.";
}

async function handleReviewEntryFlow(data: any, nextQuestion: string, extractedValue: any, originalMessage: string, employeeData?: any): Promise<string> {
  console.log('handleReviewEntryFlow - nextQuestion:', nextQuestion, 'data:', data);
  
  // Use AI to generate natural responses
  if (nextQuestion && nextQuestion !== '') {
    return await generateFlowResponse('review_entry', nextQuestion, data, originalMessage, employeeData);
  }
  
  return "Perfect! I have all the review information.";
}

async function handleDailySummaryFlow(data: any, nextQuestion: string, extractedValue: any, originalMessage: string, employeeId: string, employeeData?: any): Promise<string> {
  console.log('handleDailySummaryFlow - nextQuestion:', nextQuestion, 'data:', data);
  
  // For daily summary, we want a casual motivating chat, not formal data collection
  if (nextQuestion && nextQuestion !== '') {
    // Generate a motivating response using AI
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [{
          role: "system",
          content: `You're a supportive HR assistant having a casual, motivating chat with an employee about their day. 

GUIDELINES:
- Be warm, encouraging, and conversational (2-3 sentences max)
- Show genuine interest in their experience
- Acknowledge their feelings and efforts
- Use motivating language and emojis
- Don't ask for formal data - just be supportive
- End with encouragement about tomorrow or their progress
- Examples: "That sounds challenging but you handled it well!", "Those back-to-back calls can be exhausting - great job pushing through!", "You're doing amazing work!"

The employee just shared: "${originalMessage}"`
        }, {
          role: "user",
          content: originalMessage
        }],
        max_tokens: 100,
        temperature: 0.8,
      });

      return completion.choices[0]?.message?.content || "Thanks for sharing! You're doing great work! 💪";
    } catch (error) {
      console.error('Error generating daily summary response:', error);
      return "Thanks for sharing! You're doing great work! 💪";
    }
  }
  
  return 'Thanks for sharing! You\'re doing amazing work! 🌟';
}

// Helper function to safely parse amounts that might have dollar signs
function parseAmount(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Remove dollar signs, commas, and parse
    const cleaned = value.replace(/[\$,]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

async function saveCollectedData(flowType: string, data: any, employeeId: string) {
  switch (flowType) {
    case 'policy_entry':
      // Save the main policy (NOT cross-sold)
      await addPolicySale({
        policyNumber: data.policy_number,
        clientName: data.client_name,
        policyType: data.policy_type,
        amount: parseAmount(data.policy_amount),
        brokerFee: parseAmount(data.broker_fee),
        employeeId,
        saleDate: new Date(),
        crossSold: false, // Main policy is NOT cross-sold
        crossSoldType: data.cross_sold_type || undefined,
        crossSoldTo: data.cross_sold === 'yes' ? data.client_name : undefined,
        clientDescription: data.client_description
      });
      
      // If cross-sold, save the cross-sold policy as a separate entry (THIS gets the cross-sold bonus)
      if (data.cross_sold === 'yes' && data.cross_sold_policy_number && data.cross_sold_policy_amount && data.cross_sold_broker_fee) {
        await addPolicySale({
          policyNumber: data.cross_sold_policy_number,
          clientName: data.client_name,
          policyType: data.cross_sold_type,
          amount: parseAmount(data.cross_sold_policy_amount),
          brokerFee: parseAmount(data.cross_sold_broker_fee),
          employeeId,
          saleDate: new Date(),
          crossSold: true, // This IS the cross-sold policy that gets the bonus
          isCrossSoldPolicy: true, // Mark as cross-sold policy for 2x bonus
          clientDescription: `Cross-sold to ${data.client_name} - ${data.client_description}`
        });
      }
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
      const totalSalesAmount = todayPolicies.reduce((sum: number, policy: any) => sum + policy.amount, 0);
      const totalBrokerFees = todayPolicies.reduce((sum: number, policy: any) => sum + policy.broker_fee, 0);
      
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