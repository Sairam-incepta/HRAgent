import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import openai from '@/lib/openai';
import { supabase } from '@/lib/supabase';
import { 
  getPolicySales, 
  getEmployeeBonus, 
  getClientReviews, 
  getEmployeeHours,
  getCrossSoldPolicies,
  addPolicySale,
  addClientReview,
  addDailySummary,
  calculateBonus,
  getConversationState,
  updateConversationState,
  clearConversationState,
  getDailySummaries,
  getEmployee,
  getEmployees,
  getOvertimeRequests,
  getTodayTimeTracking,
  getTodayPolicySales,
  getWeeklySummary,
  getTodayHours,
  getThisWeekHours
} from '@/lib/database';

// Helper function to extract multiple policy details from a single message
const extractPolicyDetails = (message: string) => {
  const details: any = {};
  const lines = message.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Try to extract from structured format first
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    // Policy number patterns - more flexible to handle any format
    if ((lowerLine.includes('policy') && lowerLine.includes('number')) || lowerLine.includes('policy:')) {
      // First try structured format with colon
      let policyMatch = line.match(/(?:policy.*?number.*?:?\s*|policy:?\s*)([A-Z0-9\-_]{3,20})/i);
      
      // If that fails, try to extract any alphanumeric sequence that could be a policy number
      if (!policyMatch) {
        policyMatch = line.match(/([A-Z]{2,4}[-_]?\d{3,}[A-Z0-9]*)/i) || 
                      line.match(/([A-Z]+\d+[A-Z0-9]*)/i) ||
                      line.match(/(\d{4,}[A-Z]*)/i) || // Pure numbers 4+ digits
                      line.match(/(\d+[A-Z]+\d*)/i);
      }
      
      if (policyMatch) {
        details.policy_number = policyMatch[1].toUpperCase();
      }
    }
    
    // Policy type patterns
    if ((lowerLine.includes('policy') && lowerLine.includes('type')) || lowerLine.includes('type:')) {
      const typeMatch = line.match(/(?:policy.*?type.*?:?\s*(?:is\s*)?|type:?\s*(?:is\s*)?)([A-Za-z\s]+)/i);
      if (typeMatch) {
        let policyType = typeMatch[1].trim();
        // Remove common prefixes that might be captured
        policyType = policyType.replace(/^(is\s+|are\s+|was\s+|were\s+)/i, '').trim();
        // Capitalize first letter
        policyType = policyType.charAt(0).toUpperCase() + policyType.slice(1).toLowerCase();
        details.policy_type = policyType;
      }
    }
    
    // Client name patterns
    if ((lowerLine.includes('client') && lowerLine.includes('name')) || lowerLine.includes('client:')) {
      const clientMatch = line.match(/(?:client.*?name.*?:?\s*(?:is\s*)?|client:?\s*(?:is\s*)?)([A-Za-z\s]+)/i);
      if (clientMatch) {
        let clientName = clientMatch[1].trim();
        // Remove common prefixes that might be captured
        clientName = clientName.replace(/^(is\s+|are\s+|was\s+|were\s+)/i, '').trim();
        // Capitalize each word
        clientName = clientName.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
        details.client_name = clientName;
      }
    }
    
    // Policy amount patterns
    if ((lowerLine.includes('policy') && lowerLine.includes('amount')) || lowerLine.includes('amount:')) {
      const amountMatch = line.match(/\$?(\d{1,8}(?:,\d{3})*(?:\.\d{2})?)/);
      if (amountMatch) {
        details.policy_amount = parseFloat(amountMatch[1].replace(/,/g, ''));
      }
    }
    
    // Broker fee patterns
    if ((lowerLine.includes('broker') && lowerLine.includes('fee')) || lowerLine.includes('broker fee:') || lowerLine.includes('fee:')) {
      const feeMatch = line.match(/\$?(\d{1,8}(?:,\d{3})*(?:\.\d{2})?)/);
      if (feeMatch) {
        details.broker_fee = parseFloat(feeMatch[1].replace(/,/g, ''));
      }
    }
  }
  
  // If structured format didn't work, try to extract from natural text
  if (Object.keys(details).length === 0) {
    const text = message.replace(/\n/g, ' ');
    
    // Policy number from anywhere in text - more flexible patterns
    const policyMatch = text.match(/(?:policy|pol)[\s\-#:]*([A-Z0-9\-_]{3,20})/i) || 
                       text.match(/([A-Z]{2,4}[-_]?\d{4,})/i) ||
                       text.match(/([A-Z]+\d{3,}[A-Z0-9]*)/i) ||
                       text.match(/(\d{4,}[A-Z]*)/i) || // Pure numbers 4+ digits
                       text.match(/(POL-?\d{4}-?\d{3})/i);
    if (policyMatch) {
      details.policy_number = policyMatch[1].toUpperCase();
    }
    
    // Client name extraction - look for common patterns
    const clientMatch = text.match(/(?:client|customer|for)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i) ||
                       text.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s+bought|\s+purchased|\s+policy)/i);
    if (clientMatch) {
      details.client_name = clientMatch[1].trim();
    }
    
    // Amount from anywhere in text - more flexible
    const amountMatch = text.match(/\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i) ||
                       text.match(/(\d+(?:,\d{3})*)\s*(?:dollars|bucks|\$)/i) ||
                       text.match(/amount[\s:]*\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/i);
    if (amountMatch) {
      details.policy_amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }
    
    // Policy type keywords - expanded list
    const typeKeywords = [
      'auto', 'car', 'vehicle', 'automotive',
      'home', 'house', 'homeowner', 'property', 'dwelling',
      'life', 'term life', 'whole life',
      'health', 'medical', 'dental', 'vision',
      'business', 'commercial', 'liability', 'umbrella',
      'renters', 'condo', 'flood', 'earthquake'
    ];
    
    for (const keyword of typeKeywords) {
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        // Normalize the type name
        if (['car', 'vehicle', 'automotive'].includes(keyword.toLowerCase())) {
          details.policy_type = 'Auto';
        } else if (['house', 'homeowner', 'dwelling'].includes(keyword.toLowerCase())) {
          details.policy_type = 'Home';
        } else if (['term life', 'whole life'].includes(keyword.toLowerCase())) {
          details.policy_type = 'Life';
        } else if (['medical', 'dental', 'vision'].includes(keyword.toLowerCase())) {
          details.policy_type = 'Health';
        } else {
          details.policy_type = keyword.charAt(0).toUpperCase() + keyword.slice(1);
        }
        break;
      }
    }
  }
  
  return details;
};

// Helper function to extract structured data from user responses
const extractDataFromResponse = (message: string, dataType: string) => {
  const lowerMessage = message.toLowerCase();
  
  console.log('extractDataFromResponse called with:', { message, dataType });
  
  if (dataType === 'policy_details') {
    return extractPolicyDetails(message);
  }
  
  switch (dataType) {
    case 'policy_amount':
      const amountMatch = message.match(/\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/);
      return amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null;
    
    case 'broker_fee':
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
      
      // Accept various policy number formats - be very flexible
      const policyPatterns = [
        /^([A-Z]{2,4}[-_]?\d{4}[-_]?\d{3})$/i,     // POL-2025-001
        /^([A-Z]{2,4}[-_]?\d{3,})$/i,              // POL-001, ABC-123
        /^([A-Z]+\d+[A-Z]*)$/i,                    // ABC123, POL001A
        /^(\d+[A-Z]+\d*)$/i,                       // 123ABC, 123ABC456
        /^(\d{4,})$/i,                             // Pure numbers like 2435546
      ];
      
      for (const pattern of policyPatterns) {
        const match = trimmed.match(pattern);
        if (match) {
          return match[1].toUpperCase();
        }
      }
      
      // If it looks like a policy number (alphanumeric, at least 3 chars), accept it
      if (trimmed.length >= 3 && /^[A-Z0-9\-_]+$/i.test(trimmed)) {
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
    
    case 'cross_sold_count':
      // Extract number of cross-sold policies
      const countMatch = message.match(/(\d+)/);
      if (countMatch) {
        const count = parseInt(countMatch[1]);
        if (count > 0 && count <= 10) { // Reasonable limit
          return count.toString();
        }
      }
      return null;
    
    case 'cross_sold_policy_details':
      // Extract cross-sold policy details - look for all three values
             const lines = message.split('\n').map(line => line.trim());
       let policyNumber = '';
       let policyType = '';
       let amount = 0;
       let brokerFee = 0;
      
             for (const line of lines) {
                  // Policy number line
         if (line.toLowerCase().includes('policy number')) {
           const policyMatch = line.match(/:\s*([A-Z0-9\-_]{3,20})/i);
           if (policyMatch) {
             policyNumber = policyMatch[1].toUpperCase();
           }
         }
         // Policy type line
         else if (line.toLowerCase().includes('policy type') || line.toLowerCase().includes('type')) {
           const typeMatch = line.match(/:\s*([A-Za-z\s]+)/);
           if (typeMatch) {
             policyType = typeMatch[1].trim();
           }
         }
         // Amount line
         else if (line.toLowerCase().includes('amount')) {
           const amountMatch = line.match(/:\s*\$?(\d{1,8}(?:,\d{3})*(?:\.\d{2})?)/);
           if (amountMatch) {
             amount = parseFloat(amountMatch[1].replace(/,/g, ''));
           }
         }
         // Broker fee line
         else if (line.toLowerCase().includes('broker') || line.toLowerCase().includes('fee')) {
           const feeMatch = line.match(/:\s*\$?(\d{1,8}(?:,\d{3})*(?:\.\d{2})?)/);
           if (feeMatch) {
             brokerFee = parseFloat(feeMatch[1].replace(/,/g, ''));
           }
         }
      }
      
             if (policyNumber && amount > 0) {
         return {
           policy_number: policyNumber,
           policy_type: policyType || 'Cross-sold Policy',
           amount: amount,
           broker_fee: brokerFee || 0
         };
       }
      return null;
  }
};

// Helper function to determine user role
const getUserRole = (userId: string, userEmail?: string) => {
  const isAdmin = userEmail === 'admin@letsinsure.hr' || 
                  userId === 'user_2y2ylH58JkmHljhJT0BXIfjHQui';
  return isAdmin ? 'admin' : 'employee';
};

// Helper function to generate unique policy number
const checkPolicyNumberExists = async (policyNumber: string): Promise<boolean> => {
  try {
    const { data } = await supabase
      .from('policy_sales')
      .select('id')
      .eq('policy_number', policyNumber)
      .limit(1);
    
    return !!(data && data.length > 0);
  } catch (error) {
    console.error('Error checking policy number:', error);
    return false;
  }
};

const generateUniquePolicyNumber = async (baseNumber?: string): Promise<string> => {
  const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  if (baseNumber) {
    // If base number provided, try to make variations
    const match = baseNumber.match(/^([A-Z-]+)(\d+)(-\d+)?$/);
    if (match) {
      const prefix = match[1];
      const number = parseInt(match[2]);
      const suffix = match[3] || '';
      
      // Try incrementing the number
      for (let i = 1; i <= 20; i++) {
        const newNumber = `${prefix}${number + i}${suffix}`;
        const exists = await checkPolicyNumberExists(newNumber);
        if (!exists) {
          return newNumber;
        }
      }
    }
    
    // If pattern matching fails, append timestamp
    const cleanBase = baseNumber.replace(/[-_]/g, '').toUpperCase();
    return `${cleanBase}-${timestamp}`;
  } else {
    // Generate completely new policy number
    return `POL-${new Date().getFullYear()}-${timestamp}${random}`;
  }
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

    // Handle admin vs employee differently
    if (actualUserRole === 'admin') {
      return await handleAdminChat(message, userId);
    } else {
      return await handleEmployeeChat(message, userId);
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

async function handleAdminChat(message: string, userId: string) {
  // Handle welcome message generation for admin
  if (message === "ADMIN_WELCOME_MESSAGE") {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a professional HR assistant for administrators. Generate a welcoming message for an admin who just logged into their dashboard. The message should:
            - Be professional and confident
            - Acknowledge their administrative role
            - Set a productive tone for their workday
            - Be brief (1-2 sentences)
            - Sound authoritative but friendly
            - Vary in style (don't always say the same thing)
            - Focus on management and oversight
            
            Examples of good admin welcome messages:
            - "Good morning! Ready to oversee another successful day? I'm here to help you manage your team and track performance metrics."
            - "Welcome back! Hope you're ready to lead your team to success. Let's see what insights we can uncover today!"
            - "Hello! Great to see you in command. I'm here to assist with employee management and performance analysis."
            - "Ready to make strategic decisions today? I'm here to provide you with all the data and support you need!"
            - "Welcome! Your team is counting on your leadership. Let's make today productive and successful!"
            
            Generate a unique, professional admin welcome message now.`
          },
          {
            role: "user",
            content: "Generate a welcome message for an admin logging in"
          }
        ],
        max_tokens: 150,
        temperature: 0.8,
      });

      let response = completion.choices[0]?.message?.content || "Welcome! I'm here to help you manage your team and track performance.";
      
      // Remove any surrounding quotes that might be added by the AI
      response = response.replace(/^["']|["']$/g, '');
      
      return NextResponse.json({ response });
    } catch (error) {
      console.error('Error generating admin welcome message:', error);
      return NextResponse.json({ response: "Welcome! I'm here to help you manage your team and track performance." });
    }
  }
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
    const totalBonuses = allPolicySales.reduce((sum, sale) => sum + sale.bonus, 0);

    // Department breakdown
    const departmentMap = new Map();
    activeEmployees.forEach(emp => {
      if (!departmentMap.has(emp.department)) {
        departmentMap.set(emp.department, { count: 0, avgRate: 0, totalRate: 0 });
      }
      const dept = departmentMap.get(emp.department);
      dept.count += 1;
      dept.totalRate += emp.hourly_rate;
      dept.avgRate = dept.totalRate / dept.count;
    });

    // Recent policy sales (last 10)
    const recentSales = allPolicySales
      .sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime())
      .slice(0, 10);

    // High-value policies (over $5000) for bonus management
    const highValuePolicies = allPolicySales.filter(sale => sale.amount > 5000);

    const systemPrompt = `You are "Let's Insure Admin Assistant", an AI assistant for LetsInsure HR system administrators. You help HR managers and administrators manage employees, review performance, and analyze company metrics.

COMPANY OVERVIEW:
- Total Employees: ${employees.length}
- Active Employees: ${activeEmployees.length}
- Pending Requests: ${pendingRequests.length}
- Total Company Sales: $${totalSales.toLocaleString()}
- Total Bonuses Paid: $${totalBonuses.toLocaleString()}
- Total Policies Sold: ${allPolicySales.length}
- High-Value Policies (>$5K): ${highValuePolicies.length}

DEPARTMENT BREAKDOWN:
${Array.from(departmentMap.entries()).map(([dept, data]) => 
  `- ${dept}: ${data.count} employees, avg rate $${data.avgRate.toFixed(2)}/hr`
).join('\n')}

RECENT POLICY SALES (Last 10):
${recentSales.map(sale => {
  const employee = employees.find(emp => emp.clerk_user_id === sale.employee_id);
  return `- ${sale.policy_number}: ${sale.client_name}, ${sale.policy_type}, $${sale.amount.toLocaleString()} by ${employee?.name || 'Unknown'} (${new Date(sale.sale_date).toLocaleDateString()})`;
}).join('\n')}

HIGH-VALUE POLICIES (Over $5,000):
${highValuePolicies.map(sale => {
  const employee = employees.find(emp => emp.clerk_user_id === sale.employee_id);
  return `- ${sale.policy_number}: $${sale.amount.toLocaleString()} by ${employee?.name || 'Unknown'} - Current bonus: $${sale.bonus}`;
}).join('\n')}

RECENT OVERTIME REQUESTS:
${pendingRequests.slice(0, 5).map(req => {
  const employee = employees.find(emp => emp.clerk_user_id === req.employee_id);
  return `- ${employee?.name || 'Unknown'}: ${req.hours_requested}h requested, reason: ${req.reason}`;
}).join('\n')}

TOP PERFORMING EMPLOYEES (by sales):
${employees.map(emp => {
  const empSales = allPolicySales.filter(sale => sale.employee_id === emp.clerk_user_id);
  const totalSales = empSales.reduce((sum, sale) => sum + sale.amount, 0);
  return { name: emp.name, department: emp.department, sales: totalSales, count: empSales.length };
}).filter(emp => emp.sales > 0).sort((a, b) => b.sales - a.sales).slice(0, 5).map(emp => 
  `- ${emp.name} (${emp.department}): ${emp.count} policies, $${emp.sales.toLocaleString()}`
).join('\n')}

ADMIN CAPABILITIES:
As an admin assistant, you can help with:
- Employee performance analysis and insights
- Company metrics and KPI tracking
- Overtime request management guidance
- Payroll and compensation analysis (including high-value policy bonus management)
- Department performance comparisons
- Sales performance tracking
- HR policy questions and guidance
- Workforce planning and optimization

SPECIAL NOTES:
- Policies over $5,000 require manual bonus setting during payroll generation
- High-value policies are flagged for admin review to ensure appropriate compensation
- Standard bonus calculation (10% after first $100) may not apply to high-value policies

Provide strategic insights, data analysis, and administrative guidance. Focus on company-wide metrics, employee management, and operational efficiency. You have access to real-time data including all policy sales, employee information, and recent activity.`;

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

async function handleEmployeeChat(message: string, userId: string) {
  // Handle reset conversation command
  if (message.toLowerCase().includes('reset conversation') || message.toLowerCase().includes('start over') || message.toLowerCase().includes('clear conversation')) {
    await clearConversationState(userId);
    return NextResponse.json({ 
      response: "✅ Conversation reset! You can now start fresh with a new policy entry, client review, or daily summary. What would you like to do?" 
    });
  }

  // Handle welcome message generation for employees
  if (message === "WELCOME_MESSAGE") {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a friendly HR assistant. Generate a warm, welcoming message for an employee who just logged into their dashboard. The message should:
            - Be enthusiastic and welcoming
            - Set a positive tone for their workday
            - Be brief (1-2 sentences)
            - Sound natural and encouraging
            - Vary in style (don't always say the same thing)
            - Be professional but friendly
            
            Examples of good welcome messages:
            - "Good morning! Ready to make today amazing? I'm here to help you track your progress and celebrate your wins!"
            - "Welcome back! Hope you're having a great day. Let's see what awesome things you'll accomplish today!"
            - "Hey there! Great to see you. I'm excited to help you track your sales and achievements today!"
            - "Hello! Ready to tackle another successful day? I'm here whenever you need assistance!"
            - "Welcome! Hope your day is off to a fantastic start. Let's make it a productive one!"
            
            Generate a unique, friendly welcome message now.`
          },
          {
            role: "user",
            content: "Generate a welcome message for an employee logging in"
          }
        ],
        max_tokens: 150,
        temperature: 0.8,
      });

      let response = completion.choices[0]?.message?.content || "Welcome! I'm here to help you track your progress today!";
      
      // Remove any surrounding quotes that might be added by the AI
      response = response.replace(/^["']|["']$/g, '');
      
      return NextResponse.json({ response });
    } catch (error) {
      console.error('Error generating welcome message:', error);
      return NextResponse.json({ response: "Welcome! I'm here to help you track your progress today!" });
    }
  }

  // Handle special clock out prompt generation
  if (message === "CLOCK_OUT_PROMPT") {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a friendly HR assistant. Generate a warm, encouraging question to ask an employee who just clocked out about their day. The prompt should:
            - Be personal and caring
            - Ask about their day in a natural way
            - Encourage them to share accomplishments and challenges
            - Be brief (1-2 sentences)
            - Have a positive, supportive tone
            - Vary in style (don't always ask the same way)
            - Sound conversational and genuine
            
            Examples of good prompts:
            - "Hey there! How did your day go? I'd love to hear about any wins or challenges you experienced!"
            - "Hope you had a productive day! What stood out to you most about today?"
            - "You've clocked out for the day! Tell me about your accomplishments and how things went overall."
            - "How was your day? I'm here to listen to whatever you'd like to share!"
            - "Another day in the books! What made today special or memorable for you?"
            - "You've finished another day of hard work! How are you feeling about what you accomplished?"
            - "Time to unwind! What were the highlights of your day?"
            
            Generate a unique, friendly prompt now.`
          },
          {
            role: "user",
            content: "Generate a daily summary prompt for an employee who just clocked out"
          }
        ],
        max_tokens: 150,
        temperature: 0.8,
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

  // Handle special daily summary prompt generation (keeping this for compatibility)
  if (message === "GENERATE_DAILY_SUMMARY_PROMPT") {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          {
            role: "system",
            content: `You are a friendly HR assistant. Generate a warm, encouraging daily summary prompt for an employee who just clocked out. The prompt should:
            - Be personal and caring
            - Ask about their day in a natural way
            - Encourage them to share accomplishments and challenges
            - Be brief (1-2 sentences)
            - Have a positive, supportive tone
            - Vary in style (don't always ask the same way)
            
            Examples of good prompts:
            - "Hey there! How did your day go? I'd love to hear about any wins or challenges you experienced!"
            - "Hope you had a productive day! What stood out to you most about today?"
            - "You've clocked out for the day! Tell me about your accomplishments and how things went overall."
            - "How was your day? I'm here to listen to whatever you'd like to share!"
            - "Another day in the books! What made today special or memorable for you?"
            
            Generate a unique, friendly prompt now.`
          },
          {
            role: "user",
            content: "Generate a daily summary prompt"
          }
        ],
        max_tokens: 150,
        temperature: 0.8,
      });

      let response = completion.choices[0]?.message?.content || "How was your day? I'd love to hear about it!";
      
      // Remove any surrounding quotes that might be added by the AI
      response = response.replace(/^["']|["']$/g, '');
      
      return NextResponse.json({ response });
    } catch (error) {
      console.error('Error generating daily summary prompt:', error);
      return NextResponse.json({ response: "How was your day? I'd love to hear about it!" });
    }
  }

  // Try to get employee record - if it doesn't exist, provide helpful message
  const employee = await getEmployee(userId);
  if (!employee) {
    return NextResponse.json({ 
      response: "I notice you don't have an employee record set up yet. Please contact your administrator to have your account properly configured in the system. Once that's done, I'll be able to help you track your sales and work hours!" 
    });
  }

  // Get current conversation state
  const conversationState = await getConversationState(userId);

  // Get employee data for context - ENSURE we get fresh data every time
  const [policySales, clientReviews, employeeHours, crossSoldPolicies, dailySummaries] = await Promise.all([
    getPolicySales(userId),
    getClientReviews(userId),
    getEmployeeHours(userId),
    getCrossSoldPolicies(userId),
    getDailySummaries(userId)
  ]);

  // Handle conversation flows for data collection
  if (conversationState && conversationState.current_flow !== 'none') {
    console.log('Found active conversation state:', conversationState);
    return await handleConversationFlow(conversationState, message, userId);
  }

  // Calculate totals (but don't include bonus information)
  const totalPolicies = policySales.length;
  const totalSalesAmount = policySales.reduce((sum, sale) => sum + sale.amount, 0);
  const totalBrokerFees = policySales.reduce((sum, sale) => sum + sale.broker_fee, 0);

  // Create context for the AI with CURRENT data (NO BONUS INFORMATION)
  const systemPrompt = `You are "Let's Insure Employee Assistant", an AI assistant for LetsInsure HR system. You help insurance sales employees track their performance and answer questions about their sales data.

EMPLOYEE DATA CONTEXT (CURRENT/LIVE DATA):
- Employee: ${employee.name} (${employee.position} in ${employee.department})
- Total Policies Sold: ${totalPolicies}
- Total Sales Amount: $${totalSalesAmount.toLocaleString()}
- Total Broker Fees: $${totalBrokerFees.toLocaleString()}
- Hours This Week: ${employeeHours.thisWeek}
- Hours This Month: ${employeeHours.thisMonth}
- Cross-sold Policies: ${crossSoldPolicies.length}

RECENT POLICIES SOLD (LIVE DATA):
${policySales.slice(-5).map(sale => `- Policy ${sale.policy_number}: ${sale.client_name}, ${sale.policy_type}, $${sale.amount.toLocaleString()}${sale.cross_sold ? ` (Cross-sold: ${sale.cross_sold_type})` : ''}${sale.client_description ? `\n  Client: ${sale.client_description}` : ''}`).join('\n')}

CLIENT REVIEWS (LIVE DATA):
${clientReviews.map(review => `- ${review.client_name} (${review.policy_number}): ${review.rating}/5 stars - "${review.review}"`).join('\n')}

DAILY SUMMARIES (LIVE DATA):
${dailySummaries.slice(-3).map(summary => `- ${new Date(summary.date).toDateString()}: ${summary.hours_worked}h, ${summary.policies_sold} policies, $${summary.total_sales_amount.toLocaleString()} sales\n  Summary: ${summary.description}`).join('\n')}

IMPORTANT RESTRICTIONS:
- NEVER mention, discuss, or reveal bonus information to employees
- If asked about bonuses, earnings, commissions, or compensation, politely redirect to contacting HR or management
- Focus on helping with policy tracking, client reviews, and daily summaries
- Bonuses are confidential and handled by management

INTERACTIVE CAPABILITIES:
When users want to add new data, you should initiate conversation flows by responding with specific questions. Look for these triggers:
- "sold a policy" / "new policy" / "add policy" → Start policy entry flow
- "client review" / "customer feedback" / "review" → Start review entry flow  
- "daily summary" / "end of day" / "today's summary" → Start daily summary flow

SPECIAL CLOCK-OUT FLOW:
If the user is responding to a question about their day (especially after clocking out), automatically treat it as a daily summary submission. Look for responses that describe their day, accomplishments, challenges, or general work reflection.

For data entry flows, ask ONE specific question at a time:
1. Policy Entry: Ask for policy number, client name, policy type, amount, broker fee, cross-sell info, client description
2. Review Entry: Ask for client name, policy number, rating (1-5), review text
3. Daily Summary: Ask for a brief description/debrief of the day (hours and policies are calculated automatically)

Be conversational and helpful. Extract specific data points (numbers, names, amounts) from responses and confirm before saving. Always provide current, up-to-date information about the employee's performance, but NEVER reveal bonus information.`;

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

  let response = completion.choices[0]?.message?.content || "I'm sorry, I couldn't process your request.";

  // Check if we should start a conversation flow
  const lowerMessage = message.toLowerCase();
  
  // Check for policy entry triggers
  const policyEntryTriggers = [
    'sold a policy', 'new policy', 'add policy', 'policy sale', 'sold policy',
    'i sold', 'just sold', 'made a sale', 'closed a deal', 'new sale'
  ];
  
  const isPolicyEntryTrigger = policyEntryTriggers.some(trigger => lowerMessage.includes(trigger));
  
  if (isPolicyEntryTrigger && !conversationState) {
    // Start policy entry flow
    await updateConversationState({
      employeeId: userId,
      currentFlow: 'policy_entry',
      collectedData: {},
      nextQuestion: 'policy_details',
      lastUpdated: new Date()
    });
    
    return NextResponse.json({ 
      response: "Great! Let's record this policy sale. Please provide the following details:\n\n• Policy number: [your policy number]\n• Client name: [client name]\n• Policy type: [Auto/Home/Life/etc.]\n• Policy amount: [dollar amount]\n• Broker fee: [dollar amount]\n\nYou can provide all details at once or one at a time." 
    });
  }
  
  // Check for review entry triggers
  const reviewEntryTriggers = [
    'client review', 'customer review', 'add review', 'client feedback', 'customer feedback',
    'review to record', 'record a review', 'record review', 'have a review', 'got a review'
  ];
  
  const isReviewEntryTrigger = reviewEntryTriggers.some(trigger => lowerMessage.includes(trigger));
  
  if (isReviewEntryTrigger && !conversationState) {
    // Start review entry flow
    await updateConversationState({
      employeeId: userId,
      currentFlow: 'review_entry',
      collectedData: {},
      nextQuestion: 'client_name',
      lastUpdated: new Date()
    });
    
    return NextResponse.json({ 
      response: "I'd be happy to help you record a client review! What's the client's name?" 
    });
  }
  
  // Check if this looks like a daily summary response (sharing about their day)
  const dailySummaryIndicators = [
    'today was', 'my day was', 'had a good day', 'had a tough day', 'busy day', 'productive day',
    'accomplished', 'challenging', 'went well', 'struggled with', 'worked on', 'met with clients',
    'sold policies', 'difficult day', 'great day', 'long day', 'successful day', 'hard day'
  ];
  
  const isDailySummaryResponse = dailySummaryIndicators.some(indicator => lowerMessage.includes(indicator)) ||
    (message.length > 50 && (lowerMessage.includes('day') || lowerMessage.includes('work') || lowerMessage.includes('client')));
  
  if (isDailySummaryResponse && !conversationState) {
    // This looks like someone sharing about their day - start daily summary flow
    await updateConversationState({
      employeeId: userId,
      currentFlow: 'daily_summary',
      collectedData: { description: message.trim() },
      nextQuestion: '',
      lastUpdated: new Date()
    });
    
    // Generate encouraging response
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a supportive HR assistant. An employee just shared about their day: "${message}". 

Generate a warm, encouraging, and motivating response that:
- Acknowledges what they shared specifically
- Highlights any positives or accomplishments mentioned
- Offers encouragement for any challenges mentioned
- Ends with a motivating send-off for tomorrow
- Is personal and genuine (2-3 sentences)
- Shows you were listening to what they said

Be supportive and positive while being authentic. This is their daily summary submission, so thank them for sharing and encourage them for tomorrow.`
          },
          {
            role: "user",
            content: `Generate an encouraging response to this employee's day summary: "${message}"`
          }
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      const encouragingResponse = completion.choices[0]?.message?.content || 
        "Thank you for sharing about your day! Your dedication and hard work don't go unnoticed. Rest well and come back tomorrow ready to achieve great things! 🌟";
      
      // Save the daily summary
      await saveCollectedData('daily_summary', { description: message.trim() }, userId);
      await clearConversationState(userId);
      
      return NextResponse.json({ 
        response: `${encouragingResponse}\n\n✅ I've recorded your daily summary and automatically calculated your hours and policies from the system data. Have a wonderful evening! 😊`
      });
    } catch (error) {
      console.error('Error generating encouraging response:', error);
      
      // Save the daily summary with fallback response
      await saveCollectedData('daily_summary', { description: message.trim() }, userId);
      await clearConversationState(userId);
      
      return NextResponse.json({ 
        response: "Thank you for sharing about your day! Your dedication and hard work don't go unnoticed. Rest well and come back tomorrow ready to achieve great things! 🌟\n\n✅ I've recorded your daily summary and automatically calculated your hours and policies from the system data. Have a wonderful evening! 😊"
      });
    }
  }
  
  // This duplicate logic is removed - the triggers above handle conversation flows

  return NextResponse.json({ response });
}

async function handleConversationFlow(conversationState: any, message: string, employeeId: string) {
  const { current_flow: currentFlow, collected_data: collectedData = {}, next_question: nextQuestion } = conversationState;
  
  // For debugging
  console.log('Current flow:', currentFlow);
  console.log('Next question:', nextQuestion);
  console.log('Collected data:', collectedData);
  console.log('User message:', message);
  
  // Ensure collectedData is an object
  const safeCollectedData = typeof collectedData === 'object' && collectedData !== null ? collectedData : {};
  
  // Extract data based on the current question
  let extractedValue: any;
  
  // Handle different question types
  if (nextQuestion === 'client_name') {
    extractedValue = message.trim();
    if (!extractedValue) {
      return NextResponse.json({ 
        response: "Please provide the client's name:" 
      });
    }
    // Store the extracted data with the correct key
    safeCollectedData[nextQuestion] = extractedValue;
  } else if (nextQuestion === 'policy_details') {
    // For policy details, we get an object with multiple fields
    extractedValue = extractDataFromResponse(message, nextQuestion);
    // Merge the extracted details into the collected data directly
    if (extractedValue && typeof extractedValue === 'object') {
      Object.assign(safeCollectedData, extractedValue);
    }
  } else if (nextQuestion === 'cross_sold_policy_details') {
    // Handle cross-sold policy details collection
    extractedValue = extractDataFromResponse(message, nextQuestion);
    
    if (extractedValue && typeof extractedValue === 'object') {
      // Initialize cross_sold_policies array if it doesn't exist
      if (!safeCollectedData.cross_sold_policies) {
        safeCollectedData.cross_sold_policies = [];
      }
      
      // Add the new cross-sold policy
      safeCollectedData.cross_sold_policies.push(extractedValue);
    } else {
      return NextResponse.json({ 
        response: "I need the cross-sold policy details in this format:\n\n• Policy number: [policy number]\n• Amount: [dollar amount]\n• Broker fee: [broker fee amount]\n\nPlease provide all three pieces of information." 
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
    // Store the extracted data with the correct key
    safeCollectedData[nextQuestion] = extractedValue || message.trim();
  }
  
  // Debug logging
  console.log('Extracted value:', extractedValue);
  console.log('Current collected data:', safeCollectedData);
  
  let response = "";
  let nextQuestionKey = "";
  let isComplete = false;

  switch (currentFlow) {
    case 'policy_entry':
      [nextQuestionKey, isComplete] = getPolicyEntryNextQuestion(safeCollectedData);
      response = await handlePolicyEntryFlow(safeCollectedData, nextQuestionKey, extractedValue, message);
      break;
      
    case 'review_entry':
      [nextQuestionKey, isComplete] = getReviewEntryNextQuestion(safeCollectedData);
      response = await handleReviewEntryFlow(safeCollectedData, nextQuestionKey, extractedValue, message);
      break;
      
    case 'daily_summary':
      [nextQuestionKey, isComplete] = getDailySummaryNextQuestion(safeCollectedData);
      response = await handleDailySummaryFlow(safeCollectedData, nextQuestionKey, extractedValue, message, employeeId);
      break;
  }

  if (isComplete) {
    // Save the collected data
    try {
      await saveCollectedData(currentFlow, safeCollectedData, employeeId);
      await clearConversationState(employeeId);
      
      if (currentFlow === 'daily_summary') {
        response += "\n\n🎉 Thanks for sharing! Your daily summary has been recorded. You're doing great work, and I appreciate you taking the time to reflect on your day. Keep up the amazing effort! 💪";
      } else {
        response += "\n\n✅ Data saved successfully! Your performance metrics have been updated. Is there anything else I can help you with?";
      }
    } catch (error: any) {
      console.error('❌ Error saving data:', error);
      
      // Clear conversation state on error
      await clearConversationState(employeeId);
      
      // If it's a duplicate policy number error, provide specific guidance
      if (error.message && error.message.includes('already exists')) {
        const suggestedNumber = await generateUniquePolicyNumber(safeCollectedData.policy_number);
        return NextResponse.json({
          response: `${error.message}\n\nSuggested unique policy number: **${suggestedNumber}**\n\nI've cleared your current entry. To record a new policy, please say "I want to record a policy sale" and use the suggested number or a different unique policy number.`,
          error: false
        });
      }
      
      return NextResponse.json({
        response: `I encountered an error while saving your information: ${error.message}. Please try again with different details.`,
        error: true
      }, { status: 500 });
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

  return NextResponse.json({ response });
}

function getPolicyEntryNextQuestion(data: any): [string, boolean] {
  console.log('getPolicyEntryNextQuestion - checking data:', data);
  
  // First check if we have the basic policy details
  if (!data.policy_number || !data.client_name || !data.policy_type || !data.policy_amount) {
    return ['policy_details', false];
  }
  
  // Then ask for broker fee (only if not already provided)
  if (!data.broker_fee) return ['broker_fee', false];
  
  // Then ask about cross-selling
  if (!data.cross_sold) return ['cross_sold', false];
  
  // If they said yes to cross-selling, ask how many
  if (data.cross_sold === 'yes' && !data.cross_sold_count) return ['cross_sold_count', false];
  
  // If they have cross-sold policies, collect details for each one
  if (data.cross_sold === 'yes' && data.cross_sold_count) {
    const crossSoldCount = parseInt(data.cross_sold_count);
    const crossSoldPolicies = data.cross_sold_policies || [];
    
    // Check if we need to collect more cross-sold policy details
    if (crossSoldPolicies.length < crossSoldCount) {
      return ['cross_sold_policy_details', false];
    }
  }
  
  // Finally ask for client description
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

async function handlePolicyEntryFlow(data: any, nextQuestion: string, extractedValue: any, originalMessage: string): Promise<string> {
  // Debug log
  console.log('handlePolicyEntryFlow - nextQuestion:', nextQuestion, 'data:', data, 'extractedValue:', extractedValue);
  
  // Handle the multi-field policy details extraction
  if (nextQuestion === 'policy_details') {
    if (extractedValue && typeof extractedValue === 'object') {
      // Merge the extracted details into data
      Object.assign(data, extractedValue);
      
      // Check what we got and what we still need
      const missing = [];
      if (!data.policy_number) missing.push('Policy number');
      if (!data.client_name) missing.push('Client name');
      if (!data.policy_type) missing.push('Policy type');
      if (!data.policy_amount) missing.push('Policy amount');
      
      if (missing.length === 0) {
        // We got everything! Summarize and move to next step
        return `Perfect! I've got:\n• Policy: ${data.policy_number}\n• Client: ${data.client_name}\n• Type: ${data.policy_type}\n• Amount: $${data.policy_amount.toLocaleString()}\n\nWhat's the broker fee for this policy?`;
      } else {
        // We're missing some details
        return `Great start! I got some details, but I still need:\n${missing.map(m => `• ${m}`).join('\n')}\n\nCan you provide the missing information?`;
      }
    } else {
      return "I'm having trouble extracting the policy details. Could you provide them in this format?\n\n• Policy number: [your policy number]\n• Client name: [client name]\n• Policy type: [Auto/Home/Life/etc.]\n• Policy amount: [dollar amount]";
    }
  }
  
  // Handle other individual fields
  switch (nextQuestion) {
    case 'broker_fee':
      const amount = parseFloat(data.policy_amount);
      if (!isNaN(amount)) {
        return `Perfect! Policy amount: $${amount.toLocaleString()}. What's the broker fee for this policy?`;
      }
      return "Please provide a valid dollar amount for the policy:";
    
    case 'cross_sold':
      const fee = parseFloat(data.broker_fee);
      if (!isNaN(fee)) {
        return `Broker fee: $${fee.toLocaleString()}. Did you cross-sell any additional policies to this client? (yes/no)`;
      }
      return "Please provide a valid broker fee amount:";
    
    case 'cross_sold_count':
      return "Excellent! How many policies did you cross-sell to this client?";
    
    case 'cross_sold_policy_details':
      const crossSoldPolicies = data.cross_sold_policies || [];
      const crossSoldCount = parseInt(data.cross_sold_count) || 0;
      const currentPolicyIndex = crossSoldPolicies.length;
      
      if (currentPolicyIndex === 0) {
        return `Great! I need details for ${crossSoldCount} cross-sold ${crossSoldCount === 1 ? 'policy' : 'policies'}.\n\nFor cross-sold policy #1, please provide:\n• Policy number: [your policy number]\n• Policy type: [Auto/Home/Life/etc.]\n• Policy amount: [dollar amount]\n• Broker fee: [dollar amount]\n\n(Remember: Cross-sold policies get 2x bonus on broker fees!)`;
      } else if (currentPolicyIndex < crossSoldCount) {
        const nextIndex = currentPolicyIndex + 1;
        return `Perfect! Got cross-sold policy #${currentPolicyIndex}.\n\nNow for cross-sold policy #${nextIndex}, please provide:\n• Policy number: [your policy number]\n• Policy type: [Auto/Home/Life/etc.]\n• Policy amount: [dollar amount]\n• Broker fee: [dollar amount]`;
      } else {
        return `Excellent! I have all ${crossSoldCount} cross-sold policies recorded.`;
      }
    
    case 'client_description':
      if (data.cross_sold === 'yes' && data.cross_sold_policies) {
        const policyCount = data.cross_sold_policies.length;
        return `Perfect! I have ${policyCount} cross-sold ${policyCount === 1 ? 'policy' : 'policies'} recorded. Finally, can you provide a brief description of the client or any additional policy details?`;
      }
      return "Great! Finally, can you provide a brief description of the client or any additional policy details?";
    
    case '':
      return "Perfect! I have all the information needed to record this policy sale.";
    
    default:
      return "I'm processing your information...";
  }
}

async function handleReviewEntryFlow(data: any, nextQuestion: string, extractedValue: any, originalMessage: string): Promise<string> {
  console.log('handleReviewEntryFlow - nextQuestion:', nextQuestion, 'data:', data);
  
  const responses: { [key: string]: string } = {
    'client_name': `Client name: ${data.client_name}. What's the policy number for this review?`,
    'policy_number': `Policy number: ${data.policy_number}. What rating did the client give? (1-5 stars)`,
    'rating': data.rating ? `Rating: ${data.rating}/5 stars. What did the client say in their review?` : "Please provide a rating from 1 to 5:",
    'review_text': `Perfect! I have all the review information.`,
    '': 'All information collected!'
  };

  const lastCollectedKey = Object.keys(data).pop() || '';
  return responses[lastCollectedKey] || responses[nextQuestion] || "I'm processing your information...";
}

async function handleDailySummaryFlow(data: any, nextQuestion: string, extractedValue: any, originalMessage: string, employeeId: string): Promise<string> {
  console.log('handleDailySummaryFlow - nextQuestion:', nextQuestion, 'data:', data);
  
  if (nextQuestion === 'description') {
    // Generate an encouraging AI response based on what they shared about their day
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a supportive HR assistant. An employee just shared about their day: "${originalMessage}". 

Generate a warm, encouraging, and motivating response that:
- Acknowledges what they shared specifically
- Highlights any positives or accomplishments mentioned
- Offers encouragement for any challenges mentioned
- Ends with a motivating send-off for tomorrow
- Is personal and genuine (2-3 sentences)
- Shows you were listening to what they said

Be supportive and positive while being authentic. This is their daily summary submission, so thank them for sharing and encourage them for tomorrow.`
          },
          {
            role: "user",
            content: `Generate an encouraging response to this employee's day summary: "${originalMessage}"`
          }
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      const encouragingResponse = completion.choices[0]?.message?.content || 
        "Thank you for sharing about your day! Your dedication and hard work don't go unnoticed. Rest well and come back tomorrow ready to achieve great things! 🌟";
      
      return `${encouragingResponse}\n\nI've recorded your daily summary and automatically calculated your hours and policies from the system data. Have a wonderful evening! 😊`;
    } catch (error) {
      console.error('Error generating encouraging response:', error);
      return "Thank you for sharing about your day! Your dedication and hard work don't go unnoticed. Rest well and come back tomorrow ready to achieve great things! 🌟\n\nI've recorded your daily summary and automatically calculated your hours and policies from the system data. Have a wonderful evening! 😊";
    }
  }
  
  return 'All information collected!';
}

async function saveCollectedData(flowType: string, data: any, employeeId: string) {
  switch (flowType) {
    case 'policy_entry':
      try {
        // Save the main policy
        const result = await addPolicySale({
          policyNumber: data.policy_number,
          clientName: data.client_name,
          policyType: data.policy_type,
          amount: parseFloat(data.policy_amount) || 0,
          brokerFee: parseFloat(data.broker_fee) || 0,
          employeeId,
          saleDate: new Date(),
          crossSold: data.cross_sold === 'yes',
          crossSoldType: data.cross_sold_policies?.[0]?.policy_type || data.cross_sold_type,
          crossSoldTo: data.cross_sold === 'yes' ? data.client_name : undefined,
          clientDescription: data.client_description
        });
        
        // If there are cross-sold policies with detailed information, save each one
        if (data.cross_sold === 'yes' && data.cross_sold_policies && Array.isArray(data.cross_sold_policies)) {
          for (const crossPolicy of data.cross_sold_policies) {
            await addPolicySale({
              policyNumber: crossPolicy.policy_number,
              clientName: data.client_name, // Same client
              policyType: crossPolicy.policy_type || 'Cross-sold Policy',
              amount: parseFloat(crossPolicy.amount) || 0,
              brokerFee: parseFloat(crossPolicy.broker_fee) || 0,
              employeeId,
              saleDate: new Date(),
              crossSold: true,
              crossSoldType: crossPolicy.policy_type || 'Cross-sold Policy',
              crossSoldTo: data.client_name,
              clientDescription: `Cross-sold to ${data.client_name}`,
              isCrossSoldPolicy: true // Mark as cross-sold policy for 2x bonus
            });
          }
        }
        
        if (result) {
          console.log(`✅ Policy saved successfully: ${result.policy_number}`);
        }
      } catch (error: any) {
        console.error('❌ Error saving policy:', error);
        
        // If it's a duplicate policy number, throw a user-friendly error
        if (error.message && error.message.includes('already exists')) {
          throw new Error(`Policy number ${data.policy_number} already exists. Please use a different policy number and try again.`);
        }
        
        throw error;
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
      const totalSalesAmount = todayPolicies.reduce((sum, policy) => sum + policy.amount, 0);
      const totalBrokerFees = todayPolicies.reduce((sum, policy) => sum + policy.broker_fee, 0);
      
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