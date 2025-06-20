import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { 
  getTodayTimeTracking,
  getTodayPolicySales,
  addDailySummary,
  addChatMessage
} from '@/lib/database';
import { handleAdminChat } from '@/lib/ai/admin-chat';
import { handleEmployeeChat } from '@/lib/ai/employee-chat';

// Helper function to determine user role
const getUserRole = (userId: string, userEmail?: string) => {
  const isAdmin = userEmail === 'admin@letsinsure.hr' || 
                  userId === 'user_2y2ylH58JkmHljhJT0BXIfjHQui';
  return isAdmin ? 'admin' : 'employee';
};

export async function POST(request: NextRequest) {
  console.log('Received POST /api/chat');
  try {
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { message, userRole, isDailySummarySubmission } = await request.json();

    // Determine actual user role if not provided
    const actualUserRole = userRole || getUserRole(userId);

    // Save the user's message to the database
    await addChatMessage({ userId, role: actualUserRole, content: message });

    // Handle daily summary submission directly
    if (isDailySummarySubmission) {
      return await handleDailySummarySubmission(message, userId);
    }

    // Handle admin vs employee differently
    let aiResponse;
    if (actualUserRole === 'admin') {
      aiResponse = await handleAdminChat(message, userId);
    } else {
      aiResponse = await handleEmployeeChat(message, userId);
    }

    // Extract the response text from the returned NextResponse
    let responseText = '';
    if (aiResponse && aiResponse.body) {
      const body = await aiResponse.json();
      responseText = body.response || '';
      // Save the bot's response to the database
      if (responseText) {
        await addChatMessage({ userId, role: 'bot', content: responseText });
      }
      // Return a new NextResponse with the parsed body
      return NextResponse.json({ response: responseText });
    } else {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }
  } catch (error) {
    console.error('OpenAI API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}

async function handleDailySummarySubmission(description: string, employeeId: string) {
  try {
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
      description: description.trim(),
      keyActivities: ['Work activities', 'Client interactions', 'Administrative tasks']
    });

    return NextResponse.json({ 
      response: "Daily summary submitted successfully! You can now clock out." 
    });
  } catch (error) {
    console.error('Error submitting daily summary:', error);
    return NextResponse.json(
      { error: 'Failed to submit daily summary' },
      { status: 500 }
    );
  }
}