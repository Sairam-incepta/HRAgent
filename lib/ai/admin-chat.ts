import { NextResponse } from 'next/server';
import openai from '@/lib/openai';
import { getEmployees } from '../util/employee';
import { getPolicySales } from '../util/policies';
import { getOvertimeRequests } from '../util/overtime-requests';
import { getAllRequests } from '../util/requests';
import { getClientReviews } from '../util/client-reviews';
import { getHighValuePolicyNotificationsList } from '../util/high-value-policy-notifications';
import { buildAdminSystemPrompt } from './system-prompts';
import { getChatMessages } from '../util/chat-messages'; // Add this import

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

export async function handleAdminChat(message: string, userId: string) {
  // Handle admin welcome message with simple placeholder (no AI generation needed)
  if (message === "ADMIN_WELCOME_MESSAGE") {
    return NextResponse.json({ 
      response: "Welcome back! I'm your HR Admin Assistant, ready to help you manage your team and analyze performance metrics. What would you like to review today?" 
    });
  }

  try {
    // Get admin data for context - get ALL data for company-wide view
    const [employees, allOvertimeRequests, allPolicySales, allRequests, allReviews, highValueNotifications, chatHistory] = await Promise.all([
      getEmployees(),
      getOvertimeRequests(),
      getPolicySales(), // This gets ALL policy sales, not just for one employee
      getAllRequests(),
      getClientReviews(),
      getHighValuePolicyNotificationsList(),
      getChatMessages({ userId, limit: 10 }) // Get last 10 messages for context
    ]);

    const activeEmployees = employees.filter(emp => emp.status === 'active');
    const pendingRequests = allOvertimeRequests.filter(req => req.status === 'pending');
    const pendingAllRequests = allRequests.filter(req => req.status === 'pending');
    const totalSales = allPolicySales.reduce((sum, sale) => sum + sale.amount, 0);
    const pendingHighValuePolicies = highValueNotifications.filter(hvp => hvp.status === 'pending');

    // Create context for the AI with ALL company data
    const systemPrompt = buildAdminSystemPrompt(
      employees,
      activeEmployees, 
      pendingRequests,
      allPolicySales,
      totalSales,
      pendingAllRequests,
      allReviews,
      pendingHighValuePolicies
    );

    // Build conversation history for OpenAI
    const messages: any[] = [
      {
        role: "system",
        content: systemPrompt
      }
    ];

    // Add recent chat history (excluding the current message)
    if (chatHistory && chatHistory.length > 0) {
      // Convert chat history to OpenAI format
      chatHistory
        .filter(msg => msg.content !== message) // Exclude current message
        .slice(-8) // Take last 8 messages to avoid token limits
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
    });

    const rawResponse = completion.choices[0]?.message?.content || "I'm sorry, I couldn't process your request.";
    const cleanedResponse = cleanMarkdownResponse(rawResponse);
    return NextResponse.json({ response: cleanedResponse });

  } 
  catch (error) {
    console.error('Admin chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process admin chat request' },
      { status: 500 }
    );
  }
}