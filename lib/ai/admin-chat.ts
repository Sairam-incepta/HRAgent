import { NextResponse } from 'next/server';
import openai from '@/lib/openai';
import { 
  getEmployees, 
  getPolicySales, 
  getOvertimeRequests 
} from '@/lib/database';
import { buildAdminSystemPrompt } from './system-prompts';

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

    const response = completion.choices[0]?.message?.content || "I'm sorry, I couldn't process your request.";
    return NextResponse.json({ response });

  } catch (error) {
    console.error('Admin chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process admin chat request' },
      { status: 500 }
    );
  }
} 