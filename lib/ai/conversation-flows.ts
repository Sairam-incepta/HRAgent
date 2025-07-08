import { NextResponse } from 'next/server';
import openai from '@/lib/openai';
import { buildEmployeeSystemPrompt, buildDailySummaryPrompt } from './system-prompts';

// Clean up markdown formatting - selective bold formatting
function cleanMarkdownResponse(response: string): string {
  return response
    // Convert markdown to HTML - more comprehensive patterns
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // **bold** -> <strong>
    .replace(/\*(.*?)\*/g, '<em>$1</em>')              // *italic* -> <em>
    .replace(/__(.*?)__/g, '<strong>$1</strong>')      // __bold__ -> <strong>
    .replace(/_(.*?)_/g, '<em>$1</em>')                // _italic_ -> <em>
    // Handle any remaining markdown that might slip through
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') // Catch any missed **text**
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')             // Catch any missed *text*
    // Clean up bullet points
    .replace(/^\s*-\s*/gm, '• ')
    .replace(/^\s*\*\s*/gm, '• ')
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
  getTodayPolicySales,
  getTodayClientReviews
} from '@/lib/database';

// New streamlined conversation flow handler
export async function handleConversationFlow(conversationState: any, message: string, employeeId: string, employeeData?: any) {
  const { current_flow: currentFlow, collected_data: collectedData = {}, step } = conversationState;
  
  console.log('Streamlined flow - Current flow:', currentFlow, 'Step:', step);
  console.log('Collected data:', collectedData);
  console.log('User message:', message);
  
  // Ensure collectedData is an object
  const safeCollectedData = typeof collectedData === 'object' && collectedData !== null ? collectedData : {};
  
  // Handle different flows
  switch (currentFlow) {
    case 'policy_entry':
      return await handlePolicyEntryFlow(message, employeeId, step || 1, safeCollectedData, employeeData);
    
    case 'review_entry':
      return await handleReviewEntryFlow(message, employeeId, step || 1, safeCollectedData, employeeData);
    
    case 'daily_summary':
      return await handleDailySummaryFlow(message, employeeId, step || 1, safeCollectedData, employeeData);
    
    default:
      await clearConversationState(employeeId);
      return NextResponse.json({ 
        response: "I'm not sure what we were discussing. Let's start fresh! What would you like to do?" 
      });
  }
}

// Policy Entry Flow - Streamlined with fewer steps
async function handlePolicyEntryFlow(message: string, employeeId: string, step: number, collectedData: any, employeeData?: any) {
  switch (step) {
    case 1:
      // Step 1: Collect ALL main policy details in one message
      const mainPolicyData = parseMainPolicyData(message);
      
      if (!mainPolicyData.policy_type || !mainPolicyData.policy_amount || !mainPolicyData.broker_fee || !mainPolicyData.client_name || !mainPolicyData.policy_number) {
        return NextResponse.json({ 
          response: cleanMarkdownResponse("Great job! To add your new policy, I'll need a few details all at once:\n• **Policy type** (e.g., Auto, Home, Life)\n• **Policy number**\n• **Client name**\n• **Total policy amount** (the full value of the policy)\n• **Broker fee** (your commission/fee from this sale)\n\nPlease provide all of these details, and we'll get your new policy added.")
        });
      }
      
      // Store main policy data and move to step 2
      const updatedData = { ...collectedData, ...mainPolicyData };
      await updateConversationState({
        employeeId,
        currentFlow: 'policy_entry',
        collectedData: updatedData,
        step: 2,
        lastUpdated: new Date()
      });
      
      return NextResponse.json({
        response: cleanMarkdownResponse(`Perfect! I've got your **${mainPolicyData.policy_type}** policy for **${mainPolicyData.client_name}** (Policy #${mainPolicyData.policy_number}) - **$${mainPolicyData.policy_amount.toLocaleString()}** policy with **$${mainPolicyData.broker_fee.toLocaleString()}** broker fee. 

Did you cross-sell any additional policies to this client? (Yes/No)`)
      });
    
    case 2:
      // Step 2: Check for cross-sold policies
      const crossSoldResponse = message.toLowerCase().trim();
      const hasCrossSold = crossSoldResponse.includes('yes') || crossSoldResponse.includes('y');
      
      const stepTwoData = { ...collectedData, cross_sold: hasCrossSold ? 'yes' : 'no' };
      
      if (hasCrossSold) {
    await updateConversationState({
      employeeId,
          currentFlow: 'policy_entry',
          collectedData: stepTwoData,
          step: 3,
      lastUpdated: new Date()
    });
        
        return NextResponse.json({
          response: cleanMarkdownResponse("Great! Please provide the cross-sold policy details:\n• **Policy type**\n• **Policy number**\n• **Policy amount**\n• **Broker fee**\n\nProvide all details in one message.")
        });
      } else {
      await updateConversationState({
        employeeId,
          currentFlow: 'policy_entry',
          collectedData: stepTwoData,
          step: 4,
        lastUpdated: new Date()
      });
      
      return NextResponse.json({
          response: "Got it! Did the client leave any reviews or feedback? (Yes/No)"
        });
      }
    
    case 3:
      // Step 3: Collect cross-sold policy details
      const crossSoldData = parseCrossSoldPolicyData(message);
      
      if (!crossSoldData.cross_sold_type || !crossSoldData.cross_sold_policy_amount || !crossSoldData.cross_sold_broker_fee || !crossSoldData.cross_sold_policy_number) {
        return NextResponse.json({
          response: cleanMarkdownResponse("I need all the cross-sold policy details. Please provide:\n• **Policy type**\n• **Policy number**\n• **Policy amount**\n• **Broker fee**\n\nProvide all details for the cross-sold policy.")
        });
      }
      
      const stepThreeData = { ...collectedData, ...crossSoldData };
      await updateConversationState({
        employeeId,
        currentFlow: 'policy_entry',
        collectedData: stepThreeData,
        step: 4,
        lastUpdated: new Date()
      });
      
      return NextResponse.json({
        response: cleanMarkdownResponse(`Excellent! Cross-sold **${crossSoldData.cross_sold_type}** policy (${crossSoldData.cross_sold_policy_number}) for **$${crossSoldData.cross_sold_policy_amount.toLocaleString()}** with **$${crossSoldData.cross_sold_broker_fee.toLocaleString()}** broker fee.

Did the client leave any reviews or feedback? (Yes/No)`)
      });
    
    case 4:
      // Step 4: Check for client reviews
      const hasReview = message.toLowerCase().includes('yes') || message.toLowerCase().includes('y');
      
      if (hasReview) {
        await updateConversationState({
          employeeId,
          currentFlow: 'policy_entry',
          collectedData: collectedData,
          step: 5,
          lastUpdated: new Date()
        });
        
        return NextResponse.json({
          response: cleanMarkdownResponse("Perfect! Please provide the **rating (1-5 stars)** and **what the client said** in one message.")
        });
      } else {
        await updateConversationState({
          employeeId,
          currentFlow: 'policy_entry',
          collectedData: collectedData,
          step: 6,
          lastUpdated: new Date()
        });
        
        return NextResponse.json({
          response: cleanMarkdownResponse("Do you have any additional notes about this client or the sale?")
        });
      }
    
    case 5:
      // Step 5: Collect review details
      const reviewData = parseReviewData(message);
      
      if (!reviewData.rating || !reviewData.review_text) {
        return NextResponse.json({
          response: cleanMarkdownResponse("Please provide both the **rating (1-5 stars)** and **what the client said** in your message.")
        });
      }
      
      const stepFiveData = { ...collectedData, ...reviewData };
      await updateConversationState({
        employeeId,
        currentFlow: 'policy_entry',
        collectedData: stepFiveData,
        step: 6,
        lastUpdated: new Date()
      });
      
      return NextResponse.json({
        response: cleanMarkdownResponse(`Great! **${reviewData.rating}/5 stars** - "${reviewData.review_text}"

Do you have any additional notes about this client or the sale?`)
      });
    
    case 6:
      // Step 6: Collect additional notes and save everything
      const additionalNotes = message.trim();
      const finalData = { ...collectedData, client_description: additionalNotes };
      
      // Save all the data
      const success = await savePolicyData(finalData, employeeId);
      
      if (success) {
        await clearConversationState(employeeId);
        
        // Generate success message with policy number
        let successMessage = `🎉 **Policy sale recorded successfully!**

**Main Policy:**
• ${finalData.policy_type} for ${finalData.client_name}
• Policy Number: **${finalData.policy_number}**
• Policy Amount: **$${finalData.policy_amount.toLocaleString()}**
• Broker Fee: **$${finalData.broker_fee.toLocaleString()}**`;

        if (finalData.cross_sold === 'yes') {
          successMessage += `

**Cross-sold Policy:**
• ${finalData.cross_sold_type}
• Policy Number: **${finalData.cross_sold_policy_number}**
• Policy Amount: **$${finalData.cross_sold_policy_amount.toLocaleString()}**
• Broker Fee: **$${finalData.cross_sold_broker_fee.toLocaleString()}**`;
        }

        if (finalData.rating) {
          successMessage += `

**Client Review:** ${finalData.rating}/5 stars - "${finalData.review_text}"`;
        }

        successMessage += `

Great work! Keep up the excellent sales performance! 💪`;

        return NextResponse.json({ response: cleanMarkdownResponse(successMessage) });
      } else {
        await clearConversationState(employeeId);
        return NextResponse.json({
          response: cleanMarkdownResponse("I had trouble saving that policy. Please try again or contact support if the problem persists.")
        });
    }
    
    default:
      await clearConversationState(employeeId);
    return NextResponse.json({
        response: cleanMarkdownResponse("Something went wrong. Let's start over! What would you like to do?")
    });
  }
}

// Review Entry Flow - Streamlined
async function handleReviewEntryFlow(message: string, employeeId: string, step: number, collectedData: any, employeeData?: any) {
  switch (step) {
    case 1:
      // Step 1: Collect client name, policy number, and optionally rating/review
      const clientData = parseClientData(message);
      const reviewData = parseReviewData(message);
      
      // Check if we have the minimum required data (client name and policy number)
      if (!clientData.client_name || !clientData.policy_number) {
        return NextResponse.json({
          response: cleanMarkdownResponse("I need both the **client name** and **policy number** to record this review. Please provide both in your message.")
        });
      }
      
      // If we have all the data (including rating and review), save it immediately
      if (reviewData.rating && reviewData.review_text) {
        const completeData = { ...collectedData, ...clientData, ...reviewData };
        
        // Save the review
        const success = await saveReviewData(completeData, employeeId);
        
        if (success) {
          await clearConversationState(employeeId);
        return NextResponse.json({
            response: cleanMarkdownResponse(`🌟 **Review recorded successfully!**

**Client:** ${completeData.client_name}
**Policy:** ${completeData.policy_number}
**Rating:** ${completeData.rating}/5 stars
**Review:** "${completeData.review_text}"

Thanks for keeping track of client feedback! 👍`)
          });
        } else {
          await clearConversationState(employeeId);
          return NextResponse.json({
            response: cleanMarkdownResponse("I had trouble saving that review. Please try again or contact support if the problem persists.")
          });
        }
      }
      
      // If we only have client data, move to step 2 for rating/review
      const stepOneData = { ...collectedData, ...clientData };
      await updateConversationState({
        employeeId,
        currentFlow: 'review_entry',
        collectedData: stepOneData,
        step: 2,
        lastUpdated: new Date()
      });
      
      return NextResponse.json({
        response: cleanMarkdownResponse(`Got it! Recording review for **${clientData.client_name}** (Policy: **${clientData.policy_number}**). 

Please provide:
• **Rating** (1-5 stars)
• **Review text** (what the client said)

Provide both in one message.`)
      });
    
    case 2:
      // Step 2: Collect rating and review text, then save
      const reviewDataStep2 = parseReviewData(message);
      
      if (!reviewDataStep2.rating || !reviewDataStep2.review_text) {
        return NextResponse.json({
          response: cleanMarkdownResponse("Please provide both:\n• **Rating** (1-5 stars)\n• **Review text** (what the client said)\n\nProvide both in one message.")
        });
      }
      
      const finalData = { ...collectedData, ...reviewDataStep2 };
      
      // Save the review
      const success = await saveReviewData(finalData, employeeId);
      
      if (success) {
        await clearConversationState(employeeId);
        return NextResponse.json({
          response: cleanMarkdownResponse(`🌟 **Review recorded successfully!**

**Client:** ${finalData.client_name}
**Policy:** ${finalData.policy_number}
**Rating:** ${finalData.rating}/5 stars
**Review:** "${finalData.review_text}"

Thanks for keeping track of client feedback! 👍`)
        });
      } else {
        await clearConversationState(employeeId);
        return NextResponse.json({
          response: cleanMarkdownResponse("I had trouble saving that review. Please try again or contact support if the problem persists.")
        });
    }
    
    default:
      await clearConversationState(employeeId);
    return NextResponse.json({
        response: cleanMarkdownResponse("Something went wrong. Let's start over! What would you like to do?")
    });
  }
}

// Daily Summary Flow - AI-generated with GPT-4
async function handleDailySummaryFlow(message: string, employeeId: string, step: number, collectedData: any, employeeData?: any) {
  switch (step) {
    case 1:
      // Step 1: Generate AI summary automatically, then ask for additional notes
      try {
        const { employee, totalPolicies, totalSalesAmount, totalBrokerFees, policySales, clientReviews } = employeeData || {};
        
        if (!employee) {
          await clearConversationState(employeeId);
      return NextResponse.json({
            response: cleanMarkdownResponse("I couldn't find your employee information. Please contact support.")
          });
        }
        
        // Get today's time tracking for hours worked
        const timeTracking = await getTodayTimeTracking(employeeId);
        const hoursWorked = timeTracking?.totalHours || 0;
        
        // Get today's data
        const todayPolicySales = await getTodayPolicySales(employeeId);
        const todayClientReviews = await getTodayClientReviews(employeeId);
        
        // Calculate today's totals
        const todayPoliciesCount = todayPolicySales.length;
        const todayTotalSales = todayPolicySales.reduce((sum, sale) => sum + sale.amount, 0);
        const todayTotalFees = todayPolicySales.reduce((sum, sale) => sum + sale.broker_fee, 0);
        
        // Generate AI summary
        const aiSummary = await generateDailySummary(
          employee.name,
          hoursWorked,
          todayPoliciesCount,
          todayTotalSales,
          todayTotalFees,
          todayPolicySales,
          todayClientReviews
        );
        
        // Store the AI summary and move to step 2
        const stepOneData = { ...collectedData, ai_generated_summary: aiSummary };
        await updateConversationState({
      employeeId,
          currentFlow: 'daily_summary',
          collectedData: stepOneData,
          step: 2,
          lastUpdated: new Date()
        });
        
        return NextResponse.json({
          response: cleanMarkdownResponse(`📊 **Here's your AI-generated daily summary:**

${aiSummary}

Would you like to add any additional notes about your day? You can include:
• **Key accomplishments**
• **Challenges faced**
• **Notes for tomorrow**
• **Any other thoughts**`)
        });
        
      } catch (error) {
        console.error('Error generating daily summary:', error);
      await clearConversationState(employeeId);
      return NextResponse.json({
          response: cleanMarkdownResponse("I had trouble generating your daily summary. Please try again or contact support.")
        });
      }
    
    case 2:
      // Step 2: Collect additional notes and save complete summary
      const additionalNotes = message.trim();
      const finalData = { 
        ...collectedData, 
        additional_notes: additionalNotes,
        employee_id: employeeId
      };
      
      // Save the daily summary
      const success = await saveDailySummary(finalData);
      
      if (success) {
        await clearConversationState(employeeId);
        return NextResponse.json({
          response: cleanMarkdownResponse(`✅ **Daily summary saved successfully!**

Your day has been documented with:
• **AI-generated insights**
• **Your personal notes**
• **Performance metrics**

Have a great evening and see you tomorrow! 👋`)
      });
    } else {
        await clearConversationState(employeeId);
      return NextResponse.json({
          response: cleanMarkdownResponse("I had trouble saving your daily summary. Please try again or contact support if the problem persists.")
      });
    }
    
    default:
      await clearConversationState(employeeId);
    return NextResponse.json({
        response: cleanMarkdownResponse("Something went wrong. Let's start over! What would you like to do?")
    });
  }
}

// Helper function to generate AI daily summary
async function generateDailySummary(
  employeeName: string,
  hoursWorked: number,
  policiesSold: number,
  totalSalesAmount: number,
  totalBrokerFees: number,
  policySales: any[],
  clientReviews: any[],
  userNotes?: string
): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [{
        role: "system",
        content: buildDailySummaryPrompt(
          employeeName,
          hoursWorked,
          policiesSold,
          totalSalesAmount,
          totalBrokerFees,
          policySales,
          clientReviews,
          userNotes
        )
      }, {
        role: "user",
        content: "Generate the daily summary"
      }],
      max_tokens: 200,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || `${employeeName} worked ${hoursWorked} hours today, sold ${policiesSold} policies for $${totalSalesAmount.toLocaleString()} in total sales, earning $${totalBrokerFees.toLocaleString()} in broker fees. Great work!`;
  } catch (error) {
    console.error('Error generating daily summary:', error);
    return `${employeeName} worked ${hoursWorked} hours today, sold ${policiesSold} policies for $${totalSalesAmount.toLocaleString()} in total sales, earning $${totalBrokerFees.toLocaleString()} in broker fees. Great work!`;
  }
}

// Data parsing functions
function parseMainPolicyData(message: string): any {
  const data: any = {};
  
  // Extract policy number - REQUIRED FIELD (bullets first)
  const policyNumberPatterns = [
    /•\s*policy\s*(?:number|#)\s*:?\s*([A-Z0-9\-_]+)/i,
    /•\s*pol\s*#?\s*:?\s*([A-Z0-9\-_]+)/i,
    /\*\s*policy\s*(?:number|#)\s*:?\s*([A-Z0-9\-_]+)/i,
    /\*\s*pol\s*#?\s*:?\s*([A-Z0-9\-_]+)/i,
    /policy\s*(?:number|#)\s*(?:is)?\s*:?\s*([A-Z0-9\-_]+)/i,
    /pol\s*#\s*(?:is)?\s*:?\s*([A-Z0-9\-_]+)/i,
    /\b(POL-[A-Z0-9\-_]+)\b/i,  // Specific pattern for POL- prefixed numbers
    /\b([A-Z]{3,}-[A-Z0-9\-_]+)\b/i  // Pattern for XXX-YYYY format (must have letters)
  ];
  
  for (const pattern of policyNumberPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      data.policy_number = match[1].toUpperCase();
      break;
    }
  }
  
  // Extract policy type - ENHANCED PATTERNS (bullets first)
  const typePatterns = [
    /•\s*policy\s*type\s*:?\s*([A-Za-z\s]{2,20})/i,
    /•\s*type\s*:?\s*([A-Za-z\s]{2,20})/i,
    /\*\s*policy\s*type\s*:?\s*([A-Za-z\s]{2,20})/i,
    /\*\s*type\s*:?\s*([A-Za-z\s]{2,20})/i,
    /my\s*policy\s*type\s*(?:is)?\s*([A-Za-z\s]{2,20})/i,
    /policy\s*type\s*(?:is)?\s*([A-Za-z\s]{2,20})/i,
    /type\s*(?:is)?\s*([A-Za-z\s]{2,20})/i,
    /\b(auto|home|life|health|dental|vision|commercial|business)\b/i
  ];
  
  for (const pattern of typePatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      data.policy_type = match[1].trim();
      break;
    }
  }
  
  // Extract client name - ENHANCED PATTERNS (bullets first)
  const clientPatterns = [
    /•\s*client\s*(?:name)?\s*:?\s*([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?=\s*\n|$)/i,
    /•\s*customer\s*(?:name)?\s*:?\s*([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?=\s*\n|$)/i,
    /•\s*name\s*:?\s*([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?=\s*\n|$)/i,
    /\*\s*client\s*(?:name)?\s*:?\s*([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?=\s*\n|$)/i,
    /\*\s*customer\s*(?:name)?\s*:?\s*([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?=\s*\n|$)/i,
    /\*\s*name\s*:?\s*([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?=\s*\n|$)/i,
    /client'?s\s*name\s*(?:is)?\s*:?\s*([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?=\s*\n|$)/i,
    /client\s*(?:name)?\s*(?:is)?\s*:?\s*([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?=\s*\n|$)/i,
    /customer\s*(?:name)?\s*(?:is)?\s*:?\s*([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?=\s*\n|$)/i,
    /name\s*(?:is)?\s*:?\s*([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?=\s*\n|$)/i
  ];
  
  for (const pattern of clientPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      data.client_name = match[1].trim();
      break;
    }
  }
  
  // Extract amounts - ENHANCED PATTERNS (bullets first)
  const policyAmountPatterns = [
    /•\s*policy\s*(?:amount|value)\s*:?\s*\$?(\d{1,7}(?:,\d{3})*(?:\.\d{2})?)/i,
    /•\s*(?:total\s*)?(?:policy\s*)?amount\s*:?\s*\$?(\d{1,7}(?:,\d{3})*(?:\.\d{2})?)/i,
    /\*\s*policy\s*(?:amount|value)\s*:?\s*\$?(\d{1,7}(?:,\d{3})*(?:\.\d{2})?)/i,
    /\*\s*(?:total\s*)?(?:policy\s*)?amount\s*:?\s*\$?(\d{1,7}(?:,\d{3})*(?:\.\d{2})?)/i,
    /my\s*policy\s*(?:amount|value)\s*(?:is)?\s*\$?(\d{1,7}(?:,\d{3})*(?:\.\d{2})?)/i,
    /policy\s*(?:amount|value)\s*(?:is)?\s*\$?(\d{1,7}(?:,\d{3})*(?:\.\d{2})?)/i,
    /amount\s*(?:is)?\s*\$?(\d{1,7}(?:,\d{3})*(?:\.\d{2})?)/i
  ];
  
  const brokerFeePatterns = [
    /•\s*broker\s*fee\s*:?\s*\$?(\d{1,7}(?:,\d{3})*(?:\.\d{2})?)/i,
    /•\s*commission\s*:?\s*\$?(\d{1,7}(?:,\d{3})*(?:\.\d{2})?)/i,
    /•\s*fee\s*:?\s*\$?(\d{1,7}(?:,\d{3})*(?:\.\d{2})?)/i,
    /\*\s*broker\s*fee\s*:?\s*\$?(\d{1,7}(?:,\d{3})*(?:\.\d{2})?)/i,
    /\*\s*commission\s*:?\s*\$?(\d{1,7}(?:,\d{3})*(?:\.\d{2})?)/i,
    /\*\s*fee\s*:?\s*\$?(\d{1,7}(?:,\d{3})*(?:\.\d{2})?)/i,
    /my\s*broker\s*fee\s*(?:is)?\s*\$?(\d{1,7}(?:,\d{3})*(?:\.\d{2})?)/i,
    /broker\s*fee\s*(?:is)?\s*\$?(\d{1,7}(?:,\d{3})*(?:\.\d{2})?)/i,
    /commission\s*(?:is)?\s*\$?(\d{1,7}(?:,\d{3})*(?:\.\d{2})?)/i,
    /fee\s*(?:is)?\s*\$?(\d{1,7}(?:,\d{3})*(?:\.\d{2})?)/i
  ];
  
  // Extract policy amount
  for (const pattern of policyAmountPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      data.policy_amount = parseFloat(match[1].replace(/,/g, ''));
      break;
    }
  }
  
  // Extract broker fee
  for (const pattern of brokerFeePatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      data.broker_fee = parseFloat(match[1].replace(/,/g, ''));
      break;
    }
  }
  
  return data;
}

function parseCrossSoldPolicyData(message: string): any {
  const data: any = {};
  
  // Extract policy number first
  const policyNumberPatterns = [
    /•\s*policy\s*(?:number|#)\s*:?\s*([A-Z0-9\-_]+)/i,
    /•\s*pol\s*#?\s*:?\s*([A-Z0-9\-_]+)/i,
    /\*\s*policy\s*(?:number|#)\s*:?\s*([A-Z0-9\-_]+)/i,
    /\*\s*pol\s*#?\s*:?\s*([A-Z0-9\-_]+)/i,
    /policy\s*(?:number|#)\s*(?:is)?\s*:?\s*([A-Z0-9\-_]+)/i,
    /pol\s*#?\s*(?:is)?\s*:?\s*([A-Z0-9\-_]+)/i,
    /\b(POL-[A-Z0-9\-_]+)/i,
    /\b([A-Z]{3,}-[0-9\-_]+)/i
  ];
  
  for (const pattern of policyNumberPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      data.cross_sold_policy_number = match[1].toUpperCase();
      break;
    }
  }
  
  // Extract policy type
  const typePatterns = [
    /type\s*:?\s*([A-Za-z\s]{2,20})/i,
    /policy\s*type\s*:?\s*([A-Za-z\s]{2,20})/i,
    /\b(auto|home|life|health|dental|vision|commercial|business)\b/i
  ];
  
  for (const pattern of typePatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      data.cross_sold_type = match[1].trim();
      break;
    }
  }
  
  // Extract amounts
  const policyAmountPatterns = [
    /policy\s*(?:amount|value)\s*:?\s*\$?(\d{1,7}(?:,\d{3})*(?:\.\d{2})?)/i,
    /amount\s*:?\s*\$?(\d{1,7}(?:,\d{3})*(?:\.\d{2})?)/i
  ];
  
  const brokerFeePatterns = [
    /broker\s*fee\s*:?\s*\$?(\d{1,7}(?:,\d{3})*(?:\.\d{2})?)/i,
    /commission\s*:?\s*\$?(\d{1,7}(?:,\d{3})*(?:\.\d{2})?)/i,
    /fee\s*:?\s*\$?(\d{1,7}(?:,\d{3})*(?:\.\d{2})?)/i
  ];
  
  // Extract policy amount
  for (const pattern of policyAmountPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      data.cross_sold_policy_amount = parseFloat(match[1].replace(/,/g, ''));
      break;
    }
  }
  
  // Extract broker fee
  for (const pattern of brokerFeePatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      data.cross_sold_broker_fee = parseFloat(match[1].replace(/,/g, ''));
      break;
    }
  }
  
  return data;
}

function parseReviewData(message: string): any {
  const data: any = {};
  
  // Extract rating - ENHANCED PATTERNS to handle more formats
  const ratingPatterns = [
    // Bullet formats
    /•\s*rating\s*:?\s*(\d)/i,
    /•\s*(\d)\s*(?:stars?|\/5)/i,
    /\*\s*rating\s*:?\s*(\d)/i,
    /\*\s*(\d)\s*(?:stars?|\/5)/i,
    // Standard formats
    /rating\s*:?\s*(\d)/i,
    /(\d)\s*(?:stars?|\/5)/i,
    /(\d)\s*out\s*of\s*5/i,
    // Simple formats like "5," or "5 " at start of message
    /^(\d)\s*[,\s]/,
    // Handle "5, he said..." format
    /^(\d)\s*,\s*(?:he|she|they|client)\s+said/i,
    // Just a standalone digit (1-5)
    /\b([1-5])\b/
  ];
  
  for (const pattern of ratingPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const rating = parseInt(match[1]);
      if (rating >= 1 && rating <= 5) {
        data.rating = rating;
        break;
      }
    }
  }
  
  // Extract review text - ENHANCED PATTERNS to handle more formats
  const reviewPatterns = [
    // Bullet formats
    /•\s*(?:review|feedback|comment|message)\s*:?\s*["']?([^"'\n]+)["']?/i,
    /•\s*(?:said|client said)\s*:?\s*["']?([^"'\n]+)["']?/i,
    /\*\s*(?:review|feedback|comment|message)\s*:?\s*["']?([^"'\n]+)["']?/i,
    /\*\s*(?:said|client said)\s*:?\s*["']?([^"'\n]+)["']?/i,
    // Standard formats
    /message\s*:?\s*["']?([^"'\n]+)["']?/i,
    /"([^"]+)"/,
    /(?:said|review|feedback)\s*:?\s*["']?([^"'\n]+)["']?/i,
    /(?:they said|client said|review was|he said|she said)\s*:?\s*["']?([^"'\n]+)["']?/i,
    // Handle "5, he said we were amazing" format
    /^\d\s*,\s*(?:he|she|they|client)\s+said\s+(.+)/i,
    // Handle "Rating: 5\nMessage: Amazing" format
    /message\s*:?\s*(.+)/i,
    // Extract text after "said" in any context
    /said\s+["']?([^"'\n]+)["']?/i,
    // Just quoted text anywhere
    /"([^"]+)"/,
    // Handle "Amazing" as standalone review
    /^([A-Za-z\s]{3,50})$/
  ];
  
  for (const pattern of reviewPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      let reviewText = match[1].trim();
      // Clean up common artifacts
      reviewText = reviewText.replace(/^["']|["']$/g, ''); // Remove quotes
      reviewText = reviewText.replace(/^\s*we\s+were\s+/i, ''); // Clean "we were amazing" to "amazing"
      if (reviewText.length > 0) {
        data.review_text = reviewText;
        break;
      }
    }
  }
  
  return data;
}

function parseClientData(message: string): any {
  const data: any = {};
  
  // Extract client name - ENHANCED PATTERNS (bullets first)
  const clientPatterns = [
    /•\s*client\s*(?:name)?\s*:?\s*([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?=\s*\n|$)/i,
    /•\s*customer\s*(?:name)?\s*:?\s*([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?=\s*\n|$)/i,
    /•\s*name\s*:?\s*([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?=\s*\n|$)/i,
    /\*\s*client\s*(?:name)?\s*:?\s*([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?=\s*\n|$)/i,
    /\*\s*customer\s*(?:name)?\s*:?\s*([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?=\s*\n|$)/i,
    /\*\s*name\s*:?\s*([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?=\s*\n|$)/i,
    /client'?s?\s*name\s*(?:is)?\s*:?\s*([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?=\s*\n|$)/i,
    /client\s*(?:name)?\s*(?:is)?\s*:?\s*([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?=\s*\n|$)/i,
    /customer\s*(?:name)?\s*(?:is)?\s*:?\s*([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?=\s*\n|$)/i,
    /name\s*(?:is)?\s*:?\s*([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?=\s*\n|$)/i
  ];
  
  for (const pattern of clientPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      data.client_name = match[1].trim();
      break;
    }
  }
  
  // Extract policy number - ENHANCED PATTERNS (bullets first)
  const policyPatterns = [
    /•\s*policy\s*(?:number|#)\s*:?\s*([A-Z0-9\-_]+)/i,
    /•\s*pol\s*#?\s*:?\s*([A-Z0-9\-_]+)/i,
    /\*\s*policy\s*(?:number|#)\s*:?\s*([A-Z0-9\-_]+)/i,
    /\*\s*pol\s*#?\s*:?\s*([A-Z0-9\-_]+)/i,
    /policy\s*(?:number|#)\s*(?:is)?\s*:?\s*([A-Z0-9\-_]+)/i,
    /pol\s*#?\s*(?:is)?\s*:?\s*([A-Z0-9\-_]+)/i,
    /\b(POL-[A-Z0-9\-_]+)/i,  // Specific pattern for POL- prefixed numbers
    /\b([A-Z]{3,}-[0-9\-_]+)/i  // Pattern for XXX-YYYY format
  ];
  
  for (const pattern of policyPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      data.policy_number = match[1].toUpperCase();
      break;
    }
  }
  
  return data;
}

// Data saving functions
async function savePolicyData(data: any, employeeId: string): Promise<boolean> {
  try {
    // Use the provided policy number (now required)
    const policyNumber = data.policy_number;
    
    // Save the main policy
      await addPolicySale({
      policyNumber,
        clientName: data.client_name,
        policyType: data.policy_type,
      amount: data.policy_amount,
      brokerFee: data.broker_fee,
        employeeId,
        saleDate: new Date(),
      crossSold: false,
        crossSoldType: data.cross_sold_type || undefined,
        crossSoldTo: data.cross_sold === 'yes' ? data.client_name : undefined,
        clientDescription: data.client_description
      });
    
    // Save cross-sold policy if exists
    if (data.cross_sold === 'yes' && data.cross_sold_type && data.cross_sold_policy_amount && data.cross_sold_broker_fee && data.cross_sold_policy_number) {
      await addPolicySale({
        policyNumber: data.cross_sold_policy_number,
        clientName: data.client_name,
        policyType: data.cross_sold_type,
        amount: data.cross_sold_policy_amount,
        brokerFee: data.cross_sold_broker_fee,
        employeeId,
        saleDate: new Date(),
        crossSold: true,
        isCrossSoldPolicy: true,
        clientDescription: `Cross-sold to ${data.client_name} - ${data.client_description || ''}`
      });
    }
    
    // Save client review if exists
    if (data.rating && data.review_text) {
      await addClientReview({
        clientName: data.client_name,
        policyNumber,
        rating: data.rating,
        review: data.review_text,
        reviewDate: new Date(),
        employeeId
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error saving policy data:', error);
    return false;
  }
}

async function saveReviewData(data: any, employeeId: string): Promise<boolean> {
  try {
    await addClientReview({
      clientName: data.client_name,
      policyNumber: data.policy_number,
      rating: data.rating,
      review: data.review_text,
      reviewDate: new Date(),
      employeeId
    });
    return true;
  } catch (error) {
    console.error('Error saving review data:', error);
    return false;
  }
}

async function saveDailySummary(data: any): Promise<boolean> {
  try {
      await addDailySummary({
      employeeId: data.employee_id,
        date: new Date(),
      hoursWorked: 0, // Will be filled from time tracking
      policiesSold: 0, // Will be calculated from today's sales
      totalSalesAmount: 0, // Will be calculated from today's sales
      totalBrokerFees: 0, // Will be calculated from today's sales
        description: `${data.ai_generated_summary}\n\nAdditional Notes: ${data.additional_notes}`,
        keyActivities: ['Policy sales', 'Client interactions', 'Administrative tasks']
      });
    return true;
  } catch (error) {
    console.error('Error saving daily summary:', error);
    return false;
  }
}

// Function to detect trigger phrases - must be exported
export function getTriggerPhrase(message: string): 'policy_entry' | 'review_entry' | 'daily_summary' | null {
  const lowerCaseMessage = message.toLowerCase();
  
  const policyTriggers = ['sold a policy', 'new policy', 'add policy', 'policy entry'];
  const reviewTriggers = ['client review', 'add review', 'log a review', 'new review'];
  const summaryTriggers = ['daily summary', 'end of day', 'log my day', 'summary'];

  if (policyTriggers.some(phrase => lowerCaseMessage.includes(phrase))) {
    return 'policy_entry';
  }
  if (reviewTriggers.some(phrase => lowerCaseMessage.includes(phrase))) {
    return 'review_entry';
  }
  if (summaryTriggers.some(phrase => lowerCaseMessage.includes(phrase))) {
    return 'daily_summary';
  }
  
  return null;
}