import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { 
  getTodayTimeTracking,
  getTodayPolicySales,
  addDailySummary
} from '@/lib/database';
import { handleAdminChat as handleAdminChatModule } from '@/lib/ai/admin-chat';
import { handleEmployeeChat as handleEmployeeChatModule } from '@/lib/ai/employee-chat';

const getUserRole = (userId: string, userEmail?: string) => {
  // Admin user IDs (hardcoded for now)
  const adminUserIds = ['user_2i6FgJGfONEjZYWwCjgbRPWcXPX'];
  return adminUserIds.includes(userId) ? 'admin' : 'employee';
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { message, userRole, isDailySummarySubmission } = await request.json();

    // Determine actual user role if not provided
    const actualUserRole = userRole || getUserRole(userId);

    // Handle daily summary submission directly
    if (isDailySummarySubmission) {
      return await handleDailySummarySubmission(message, userId);
    }

    // Handle admin vs employee differently using proper modules
    if (actualUserRole === 'admin') {
      return await handleAdminChat(message, userId);
    } else {
      return await handleEmployeeChatModule(message, userId);
    }

  } catch (error) {
    console.error('Chat API error:', error);
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

async function handleAdminChat(message: string, userId: string) {
  // Use the proper admin chat handler (which now handles welcome messages)
  return await handleAdminChatModule(message, userId);
}