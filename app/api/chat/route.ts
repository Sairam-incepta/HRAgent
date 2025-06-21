import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { 
  getTodayTimeTracking,
  getTodayPolicySales,
  addDailySummary,
  addChatMessage,
  addPolicySale,
  addClientReview
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

    const { message, userRole, isDailySummarySubmission, userName, isClockOutPrompt } = await request.json();

    // Determine actual user role if not provided
    const actualUserRole = userRole || getUserRole(userId);

    // Handle special message types
    if (message === 'INITIAL_GREETING') {
      const greeting = await generateInitialGreeting(actualUserRole, userName);
      await addChatMessage({ userId, role: 'bot', content: greeting });
      return NextResponse.json({ response: greeting });
    }

    if (message === 'CLOCK_OUT_PROMPT') {
      const clockOutMessage = await generateClockOutMessage(userName);
      await addChatMessage({ userId, role: 'bot', content: clockOutMessage });
      return NextResponse.json({ response: clockOutMessage });
    }

    // Save the user's message to the database (unless it's a system message)
    if (!message.startsWith('INITIAL_') && !message.startsWith('CLOCK_OUT_')) {
      await addChatMessage({ userId, role: actualUserRole, content: message });
    }

    // Handle daily summary submission directly
    if (isDailySummarySubmission) {
      return await handleDailySummarySubmission(message, userId, userName);
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

async function generateInitialGreeting(userRole: string, userName: string) {
  const currentHour = new Date().getHours();
  let greeting = "Hello";
  
  if (currentHour < 12) {
    greeting = "Good morning";
  } else if (currentHour < 17) {
    greeting = "Good afternoon";
  } else {
    greeting = "Good evening";
  }

  if (userRole === 'admin') {
    return `${greeting}, ${userName}! 👋 I'm your Let's Insure Admin Assistant. I'm here to help you manage your team and analyze company performance.

🎯 **I can help you with:**
• View employee performance metrics and analytics
• Analyze company-wide sales data and trends  
• Review overtime requests and team management
• Track department performance and KPIs

What would you like to know about your team today?`;
  } else {
    return `${greeting}, ${userName}! 🌟 I'm your HR Assistant, ready to help you track your achievements and support your success.

✨ **I'm here to help you:**
• Record policy sales and track performance
• Log client reviews and feedback  
• Share daily summaries and achievements
• Answer questions about work

Ready to make today productive? What can I help you with?`;
  }
}

async function generateClockOutMessage(userName: string) {
  const encouraging_openings = [
    `Hey ${userName}! 🌟 What a day you've had!`,
    `${userName}, you did it! 💪 Another productive day complete!`,
    `Great work today, ${userName}! 🎉`,
    `${userName}, you've earned this moment! ✨`,
    `Amazing effort today, ${userName}! 🚀`,
  ];

  const questions = [
    "How did your day go? I'd love to hear about the highlights and challenges!",
    "Tell me about your day - what went well, what did you learn, or just how you're feeling!",
    "I'm curious about your journey today. What made it special or memorable?",
    "Share with me how today unfolded - the wins, the lessons, everything in between!",
    "What's your story from today? I'm here to listen and celebrate with you!",
  ];

  const randomOpening = encouraging_openings[Math.floor(Math.random() * encouraging_openings.length)];
  const randomQuestion = questions[Math.floor(Math.random() * questions.length)];

  return `${randomOpening} ${randomQuestion}`;
}

async function handleDailySummarySubmission(description: string, employeeId: string, userName: string) {
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

    // Generate encouraging response based on their day
    const encouragingResponses = [
      `Thank you for sharing, ${userName}! 🌟 It sounds like you put in great effort today. Every day is a step forward in your journey, and I'm proud of your dedication!`,
      `${userName}, I really appreciate you taking the time to reflect on your day! 💫 Your commitment to growth and excellence shows, and tomorrow is another opportunity to shine!`,
      `What a thoughtful summary, ${userName}! 🚀 It's clear you care about what you do, and that makes all the difference. Rest well - you've earned it!`,
      `Thanks for sharing your day with me, ${userName}! ✨ Whether it was smooth sailing or had its challenges, you showed up and that's what matters. Keep being amazing!`,
      `${userName}, I love hearing about your experiences! 🎯 Your dedication to reflecting and improving is inspiring. Have a wonderful evening!`,
    ];

    const randomResponse = encouragingResponses[Math.floor(Math.random() * encouragingResponses.length)];

    return NextResponse.json({ 
      response: randomResponse
    });
  } catch (error) {
    console.error('Error submitting daily summary:', error);
    return NextResponse.json(
      { error: 'Failed to submit daily summary' },
      { status: 500 }
    );
  }
}