import { NextResponse } from 'next/server';
import openai from '@/lib/openai';
import { addPolicySale } from '../util/policies';
import { addClientReview } from '../util/client-reviews';
import { addDailySummary } from '../util/daily-summaries';
import { createHighValuePolicyNotification } from '../util/high-value-policy-notifications';
import { buildEmployeeSystemPrompt } from './system-prompts';
import { appSettings } from '../config/app-settings';
import { getChatMessages } from '../util/chat-messages';
import { getTodayTimeTracking, getTodayPolicySales } from '@/lib/util/today';
import { getEmployee } from '../util/employee';

// Clean up markdown formatting - avoid double formatting
function cleanMarkdownResponse(response: string): string {
  return response
    // First, clean up any existing HTML tags to avoid conflicts
    .replace(/<\/?strong>/g, '')
    .replace(/<\/?em>/g, '')
    // Convert markdown to HTML (only once)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // **bold** -> <strong>
    .replace(/\*(.*?)\*/g, '<em>$1</em>')              // *italic* -> <em>
    .replace(/__(.*?)__/g, '<strong>$1</strong>')      // __bold__ -> <strong>
    .replace(/_(.*?)_/g, '<em>$1</em>')                // _italic_ -> <em>
    // Clean up bullet points
    .replace(/^\s*-\s*/gm, '• ')
    // Clean up excessive line breaks
    .replace(/\n\n\n+/g, '\n\n')
    // Fix any nested strong tags that might have been created
    .replace(/<strong><strong>(.*?)<\/strong><\/strong>/g, '<strong>$1</strong>')
    .replace(/<em><em>(.*?)<\/em><\/em>/g, '<em>$1</em>')
    .trim();
}

// Parse JSON response from OpenAI and execute the appropriate action
async function executeAction(response: string, employeeId: string): Promise<string> {
  try {
    // Look for JSON in the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return response; // No JSON found, return as-is
    }

    const actionData = JSON.parse(jsonMatch[0]);
    const { action, payload } = actionData;

    switch (action) {
      case 'add_policy_sale':
        await addPolicySale({
          employeeId,
          clientName: payload.clientName,
          policyNumber: payload.policyNumber,
          policyType: payload.policyType,
          amount: payload.amount,
          brokerFee: payload.brokerFee,
          crossSold: payload.crossSold,
          saleDate: payload.saleDate ? new Date(payload.saleDate) : new Date(),
        });

        let highValueMessage = '';
        if (payload.amount > appSettings.highValueThreshold) {
          try {
            await createHighValuePolicyNotification({
              employeeId,
              policyNumber: payload.policyNumber,
              policyAmount: payload.amount,
              brokerFee: payload.brokerFee,
              currentBonus: 0,
              isCrossSoldPolicy: payload.crossSold,
            });
            highValueMessage = ' This high-value policy has been flagged for potential bonus review by admin!';
          } catch (hvpError) {
            console.error('Error creating high-value policy notification:', hvpError);
            highValueMessage = ' (Note: High-value policy notification could not be created)';
          }
        }

        // Generate AI response for policy sale success
        return await generateSuccessMessage('policy_sale', {
          clientName: payload.clientName,
          policyNumber: payload.policyNumber,
          policyType: payload.policyType,
          amount: payload.amount,
          brokerFee: payload.brokerFee,
          crossSold: payload.crossSold,
          highValueMessage,
          isHighValue: payload.amount > appSettings.highValueThreshold
        });

      case 'add_client_review':
        await addClientReview({
          employeeId,
          clientName: payload.clientName,
          policyNumber: payload.policyNumber || 'Unknown',
          rating: payload.rating,
          review: payload.review,
          reviewDate: payload.reviewDate ? new Date(payload.reviewDate) : new Date(),
        });

        // Generate AI response for client review success
        return await generateSuccessMessage('client_review', {
          clientName: payload.clientName,
          rating: payload.rating,
          review: payload.review,
          policyNumber: payload.policyNumber || 'Unknown'
        });

      case 'add_daily_summary':
        // Get today's actual data from database
        const [todayTimeTracking, todayPolicies] = await Promise.all([
          getTodayTimeTracking(employeeId),
          getTodayPolicySales(employeeId)
        ]);

        // Calculate real values from actual data
        const hoursWorked = todayTimeTracking.totalHours || payload.hoursWorked || 8;
        const policiesSold = todayPolicies.length;
        const totalSalesAmount = todayPolicies.reduce((sum, policy) => sum + policy.amount, 0);
        const totalBrokerFees = todayPolicies.reduce((sum, policy) => sum + policy.broker_fee, 0);

        await addDailySummary({
          employeeId,
          date: payload.date ? new Date(payload.date) : new Date(),
          hoursWorked,
          policiesSold,
          totalSalesAmount,
          totalBrokerFees,
          description: payload.description,
          keyActivities: payload.keyActivities || payload.description.split(',').map((s: string) => s.trim()),
        });

        // Generate AI response for daily summary success
        return await generateSuccessMessage('daily_summary', {
          hoursWorked,
          policiesSold,
          totalSalesAmount,
          totalBrokerFees,
          description: payload.description,
          keyActivities: payload.keyActivities || payload.description.split(',').map((s: string) => s.trim())
        });

      default:
        return response; // Unknown action, return original response
    }
  } catch (error) {
    console.error('Error executing action:', error);
    return '⚠️ I tried to process that request but ran into a problem. Please try again later.';
  }
}

// Generate contextual success messages using AI
async function generateSuccessMessage(actionType: string, data: any): Promise<string> {
  try {
    let prompt = '';
    
    switch (actionType) {
      case 'policy_sale':
        prompt = `Generate a brief, supportive success message for recording a policy sale. ${data.isHighValue ? 'This was a high-value policy.' : ''} Keep it simple and encouraging. One sentence max.`;
        break;

      case 'client_review':
        prompt = `Generate a brief, supportive success message for recording a client review. ${data.rating >= 4 ? 'It was a positive review.' : 'It was feedback from a client.'} Keep it simple and encouraging. One sentence max.`;
        break;

      case 'daily_summary':
        prompt = `Generate a brief, supportive end-of-day message for submitting a daily summary. Keep it simple and encouraging. One sentence max.`;
        break;

      default:
        return '✅ Done!';
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a supportive workplace assistant. Generate very brief, simple success messages. Be encouraging but not overly enthusiastic. Keep it professional and concise."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 50,
      temperature: 0.7,
    });

    let aiResponse = completion.choices[0]?.message?.content || '✅ Successfully recorded!';
    
    // Add high-value message if applicable
    if (actionType === 'policy_sale' && data.highValueMessage) {
      aiResponse += data.highValueMessage;
    }
    
    return cleanMarkdownResponse(aiResponse);

  } catch (error) {
    console.error('Error generating success message:', error);
    // Fallback to simple success messages if AI generation fails
    switch (actionType) {
      case 'policy_sale':
        return `✅ Policy sale recorded successfully.${data.highValueMessage}`;
      case 'client_review':
        return `✅ Client review saved — great job!`;
      case 'daily_summary':
        return '✅ Daily summary submitted successfully.';
      default:
        return '✅ Done!';
    }
  }
}

export async function handleEmployeeChat(message: string, employeeId: string): Promise<string> {
  // Handle employee welcome message with simple placeholder (no AI generation needed)
  if (message === "EMPLOYEE_WELCOME_MESSAGE") {
    return "Hey there! I'm your personal work assistant. I can help you log policy sales, client reviews, daily summaries, and answer any work-related questions. What can I help you with today?";
  }

  // Handle clock out prompt
  if (message === "CLOCK_OUT_PROMPT") {
    return "How was your day today? Could you give me a brief summary of your key activities?";
  }

  try {
    // Get employee data and today's context
    const [employee, todayTimeTracking, todayPolicies, chatHistory] = await Promise.all([
      getEmployee(employeeId),
      getTodayTimeTracking(employeeId),
      getTodayPolicySales(employeeId),
      getChatMessages({ userId: employeeId, limit: 10 })
    ]);

    // Calculate today's stats for context
    const todayStats = {
      hoursWorked: todayTimeTracking.totalHours || 0,
      policiesSold: todayPolicies.length,
      totalSalesAmount: todayPolicies.reduce((sum, policy) => sum + policy.amount, 0),
      totalBrokerFees: todayPolicies.reduce((sum, policy) => sum + policy.broker_fee, 0),
    };

    // Create enhanced system prompt with employee context
    const systemPrompt = buildEmployeeSystemPrompt() + `

EMPLOYEE CONTEXT:
- Name: ${employee?.name || 'Employee'}
- Department: ${employee?.department || 'Sales'}
- Position: ${employee?.position || 'Insurance Agent'}
- Today's Hours: ${todayStats.hoursWorked}
- Today's Policies Sold: ${todayStats.policiesSold}
- Today's Sales Amount: $${todayStats.totalSalesAmount.toLocaleString()}
- Today's Broker Fees: $${todayStats.totalBrokerFees.toLocaleString()}

TODAY'S POLICY SALES:
${todayPolicies.map(sale => `- ${sale.policy_type} policy (${sale.policy_number}) for ${sale.client_name}: $${sale.amount.toLocaleString()}${sale.is_cross_sold_policy ? ' (Cross-sold)' : ''}`).join('\n')}

Use this context to provide personalized responses and acknowledge the employee's work when appropriate.`;

    // Build conversation history for OpenAI
    const messages: any[] = [
      {
        role: "system",
        content: systemPrompt
      }
    ];

    // Add recent chat history (excluding the current message)
    if (chatHistory && chatHistory.length > 0) {
      chatHistory
        .filter(msg => msg.content !== message)
        .slice(-8)
        .forEach(msg => {
          messages.push({
            role: msg.role === 'bot' ? 'assistant' : 'user',
            content: msg.content
          });
        });
    }

    // Add current user message
    messages.push({
      role: "user",
      content: message
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7,
      top_p: 0.9,
    });

    const rawResponse = completion.choices[0]?.message?.content || "I'm here to help! What can I assist you with today?";
    
    // Try to execute any actions in the response
    const actionResult = await executeAction(rawResponse, employeeId);
    
    // Clean up markdown formatting
    const cleanedResponse = cleanMarkdownResponse(actionResult);
    
    return cleanedResponse;

  } catch (error) {
    console.error('Employee chat error:', error);
    return '⚠️ I encountered an issue processing your request. Please try again later.';
  }
}