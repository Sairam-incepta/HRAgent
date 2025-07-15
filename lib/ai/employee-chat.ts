import openai from '@/lib/openai';
import { addPolicySale } from '../util/policies';
import { addClientReview } from '../util/client-reviews';
import { addDailySummary } from '../util/daily-summaries';
import { createHighValuePolicyNotification } from '../util/high-value-policy-notifications';
import { buildEmployeeSystemPrompt } from './system-prompts';
import { appSettings } from '../config/app-settings';

interface ConversationState {
  type: 'policy_sale' | 'client_review' | 'daily_summary' | 'general';
  startedAt: Date;
  data: Record<string, any>;
  step: number;
  isComplete: boolean;
}

// In-memory conversation states (in production, use Redis or database)
const activeConversations = new Map<string, ConversationState>();

function detectConversationType(message: string): 'policy_sale' | 'client_review' | 'daily_summary' | 'general' {
  const lowerMessage = message.toLowerCase();
  
  // Policy sale triggers
  if (lowerMessage.includes('sale') || lowerMessage.includes('sold') || lowerMessage.includes('policy')) {
    return 'policy_sale';
  }
  
  // Review triggers
  if (lowerMessage.includes('review') || lowerMessage.includes('feedback')) {
    return 'client_review';
  }
  
  // Daily summary triggers
  if (lowerMessage.includes('clock_out_prompt') || lowerMessage.includes('daily summary')) {
    return 'daily_summary';
  }
  
  return 'general';
}

function initializeConversationState(type: string, employeeId: string): ConversationState {
  return {
    type: type as any,
    startedAt: new Date(),
    data: {},
    step: 0,
    isComplete: false
  };
}

function getConversationKey(employeeId: string): string {
  return `conv_${employeeId}`;
}

function parseUserResponse(message: string, expectedFields: string[]): Record<string, any> {
  const parsed: Record<string, any> = {};
  
  // Handle comma-separated responses like "John Smith, auto" or "POL-123, $2000"
  const parts = message.split(',').map(s => s.trim());
  
  if (parts.length >= 2) {
    // Multi-field response
    expectedFields.forEach((field, index) => {
      if (parts[index]) {
        let value = parts[index];
        
        // Parse monetary values
        if (field.includes('amount') || field.includes('fee')) {
          value = value.replace(/[$,]/g, '');
          parsed[field] = parseFloat(value) || 0;
        } 
        // Parse boolean values
        else if (field.includes('cross')) {
          const lowerValue = value.toLowerCase();
          parsed[field] = ['yes', 'y', 'true', 'yep', 'sure', 'absolutely'].includes(lowerValue);
        }
        // Parse rating
        else if (field === 'rating') {
          const numberMatch = value.match(/\d+/);
          if (numberMatch) {
            parsed[field] = parseInt(numberMatch[0]);
          } else if (value.toLowerCase().includes('five')) {
            parsed[field] = 5;
          } else if (value.toLowerCase().includes('four')) {
            parsed[field] = 4;
          } // etc.
        }
        else {
          parsed[field] = value;
        }
      }
    });
  } else {
    // Single field response
    if (expectedFields.length === 1) {
      const field = expectedFields[0];
      let value = message;
      
      if (field.includes('amount') || field.includes('fee')) {
        value = value.replace(/[$,]/g, '');
        parsed[field] = parseFloat(value) || 0;
      } else if (field.includes('cross')) {
        const lowerValue = value.toLowerCase();
        parsed[field] = ['yes', 'y', 'true', 'yep', 'sure', 'absolutely'].includes(lowerValue);
      } else {
        parsed[field] = value;
      }
    }
  }
  
  return parsed;
}

async function handlePolicySaleConversation(
  message: string, 
  state: ConversationState, 
  employeeId: string
): Promise<string> {
  const requiredSteps = [
    { fields: ['clientName', 'policyType'], question: "Great! What's the client's name and what type of policy did they purchase?" },
    { fields: ['policyNumber', 'amount'], question: "What's the policy number and policy amount?" },
    { fields: ['brokerFee'], question: "What broker fee did you earn on this sale?" },
    { fields: ['crossSold'], question: "Finally, is this a cross-sold policy?" }
  ];
  
  const currentStep = requiredSteps[state.step];
  
  if (!currentStep) {
    // All data collected, execute action
    try {
      await addPolicySale({
        employeeId,
        clientName: state.data.clientName,
        policyNumber: state.data.policyNumber,
        policyType: state.data.policyType,
        amount: state.data.amount,
        brokerFee: state.data.brokerFee,
        crossSold: state.data.crossSold,
        saleDate: new Date(),
      });

      let highValueMessage = '';
              if (state.data.amount > appSettings.highValueThreshold) {
        try {
          await createHighValuePolicyNotification({
            employeeId,
            policyNumber: state.data.policyNumber,
            policyAmount: state.data.amount,
            brokerFee: state.data.brokerFee,
            currentBonus: 0, // Default bonus, admin can adjust
            isCrossSoldPolicy: state.data.crossSold,
          });
          highValueMessage = ' 🎉 This high-value policy has been flagged for potential bonus review by admin!';
        } catch (hvpError) {
          console.error('Error creating high-value policy notification:', hvpError);
          // Don't fail the main transaction, just log the error
          highValueMessage = ' (Note: High-value policy notification could not be created)';
        }
      }
      
      // Clear conversation state
      activeConversations.delete(getConversationKey(employeeId));
      
      return `✅ Policy sale for ${state.data.clientName} (#${state.data.policyNumber}) recorded successfully.${highValueMessage}`;
    } catch (error) {
      console.error('Error saving policy sale:', error);
      return '⚠️ I tried to save that data but ran into a problem. Please try again later.';
    }
  }
  
  // Parse user response for expected fields
  const parsedData = parseUserResponse(message, currentStep.fields);
  
  // Update state with parsed data
  Object.assign(state.data, parsedData);
  
  // Check if we got all required fields for this step
  const hasAllFields = currentStep.fields.every(field => state.data[field] !== undefined);
  
  if (hasAllFields) {
    // Move to next step
    state.step++;
    
    // Check if we're done
    const nextStep = requiredSteps[state.step];
    if (!nextStep) {
      // Execute the action (recursive call)
      return handlePolicySaleConversation('', state, employeeId);
    } else {
      // Ask next question
      return nextStep.question;
    }
  } else {
    // Still missing fields, ask again
    return currentStep.question;
  }
}

async function handleClientReviewConversation(
  message: string, 
  state: ConversationState, 
  employeeId: string
): Promise<string> {
  const requiredSteps = [
    { fields: ['clientName', 'rating'], question: "What's the client's name and what rating did they give (1-5)?" },
    { fields: ['review'], question: "What did they say in their review?" }
  ];
  
  const currentStep = requiredSteps[state.step];
  
  if (!currentStep) {
    // All data collected, execute action
    try {
      await addClientReview({
        employeeId,
        clientName: state.data.clientName,
        policyNumber: 'Unknown',
        rating: state.data.rating,
        review: state.data.review,
        reviewDate: new Date(),
      });
      
      // Clear conversation state
      activeConversations.delete(getConversationKey(employeeId));
      
      return `✅ Client review from ${state.data.clientName} saved — great job!`;
    } catch (error) {
      console.error('Error saving client review:', error);
      return '⚠️ I tried to save that data but ran into a problem. Please try again later.';
    }
  }
  
  // Parse user response
  const parsedData = parseUserResponse(message, currentStep.fields);
  Object.assign(state.data, parsedData);
  
  // Check if we got all required fields for this step
  const hasAllFields = currentStep.fields.every(field => state.data[field] !== undefined);
  
  if (hasAllFields) {
    state.step++;
    const nextStep = requiredSteps[state.step];
    if (!nextStep) {
      return handleClientReviewConversation('', state, employeeId);
    } else {
      return nextStep.question;
    }
  } else {
    return currentStep.question;
  }
}

async function handleDailySummaryConversation(
  message: string, 
  state: ConversationState, 
  employeeId: string
): Promise<string> {
  if (state.step === 0) {
    // First interaction - ask about their day
    state.step++;
    return "How was your day today? Could you give me a brief summary of your key activities?";
  } else {
    // Save the summary
    try {
      const keyActivities = message.split(',').map(s => s.trim()).filter(s => s.length > 0);
      
      await addDailySummary({
        employeeId,
        date: new Date(),
        hoursWorked: 8, // Default, could be calculated from time tracking
        policiesSold: 0, // Default, could be calculated from today's sales
        totalSalesAmount: 0,
        totalBrokerFees: 0,
        description: message,
        keyActivities,
      });
      
      // Clear conversation state
      activeConversations.delete(getConversationKey(employeeId));
      
      return '✅ Daily summary submitted successfully. Have a great evening!';
    } catch (error) {
      console.error('Error saving daily summary:', error);
      return '⚠️ I tried to save that data but ran into a problem. Please try again later.';
    }
  }
}

export async function handleEmployeeChat(message: string, employeeId: string): Promise<string> {
  const conversationKey = getConversationKey(employeeId);
  let state = activeConversations.get(conversationKey);
  
  // If no active conversation or it's a new conversation starter, detect type and initialize
  if (!state || detectConversationType(message) !== 'general') {
    const conversationType = detectConversationType(message);
    
    if (conversationType !== 'general') {
      // Start new conversation
      state = initializeConversationState(conversationType, employeeId);
      activeConversations.set(conversationKey, state);
      
      // Handle the conversation based on type
      switch (conversationType) {
        case 'policy_sale':
          return handlePolicySaleConversation(message, state, employeeId);
        case 'client_review':
          return handleClientReviewConversation(message, state, employeeId);
        case 'daily_summary':
          return handleDailySummaryConversation(message, state, employeeId);
      }
    }
  } else {
    // Continue existing conversation
    switch (state.type) {
      case 'policy_sale':
        return handlePolicySaleConversation(message, state, employeeId);
      case 'client_review':
        return handleClientReviewConversation(message, state, employeeId);
      case 'daily_summary':
        return handleDailySummaryConversation(message, state, employeeId);
    }
  }
  
  // General conversation - use OpenAI for non-structured responses
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.7,
    max_tokens: 200,
    messages: [
      { 
        role: 'system', 
        content: buildEmployeeSystemPrompt()},
      { role: 'user', content: message }
    ],
  });

  return completion.choices[0].message.content?.trim() || "I'm here to help! What can I assist you with today?";
}