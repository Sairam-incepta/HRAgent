import { NextResponse } from 'next/server';
import openai from '@/lib/openai';
import { 
  getEmployees, 
  getPolicySales, 
  getOvertimeRequests 
} from '@/lib/database';
import { buildAdminSystemPrompt } from './system-prompts';

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

export async function handleAdminChat(message: string, userId: string) {
  try {
    // Get admin data for context - get ALL policy sales for company-wide view
    const [employees, allOvertimeRequests, allPolicySales] = await Promise.all([
      getEmployees(),
      getOvertimeRequests(),
      getPolicySales() // This gets ALL policy sales, not just for one employee
    ]);

    const activeEmployees = employees.filter(emp => emp.status === 'active');
    const pendingRequests = allOvertimeRequests.filter(req => req.status === 'pending');
    const totalSales = allPolicySales.reduce((sum, sale) => sum + sale.amount, 0);

    // Create context for the AI with ALL company data
    const systemPrompt = buildAdminSystemPrompt(
      employees,
      activeEmployees, 
      pendingRequests,
      allPolicySales,
      totalSales
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

    const rawResponse = completion.choices[0]?.message?.content || "I'm sorry, I couldn't process your request.";
    const cleanedResponse = cleanMarkdownResponse(rawResponse);
    return NextResponse.json({ response: cleanedResponse });

  } catch (error) {
    console.error('Admin chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process admin chat request' },
      { status: 500 }
    );
  }
} 