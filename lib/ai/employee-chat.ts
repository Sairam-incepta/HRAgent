// lib/ai/employee-chat.ts
// REPLACED CONTENT — full AI-driven chat handler

import openai from '@/lib/openai';
import {
  addPolicySale,
  addClientReview,
  addDailySummary,
  getChatMessages,
} from '@/lib/database';
import type { ChatCompletionMessageParam } from 'openai/resources';

// System prompt that tells GPT-4 what it can do and how to format actions
const SYSTEM_PROMPT = `
You are "Let's Insure Employee Assistant" (pet name/codename "LI"), an AI assistant helping insurance brokerage employees.

Conversation rules when gathering data:
• For a new policy sale, ask for missing details in this order, each time in friendly natural language:
  1. Client name **and** policy type in one question.
  2. Policy number **and** policy amount in one question.
  3. Broker fee earned.
  4. Whether the policy was cross-sold (yes/no).

Guidelines for interpreting user answers:
• The employee may provide multiple requested fields in a single message, either comma-separated (e.g. "2025-POL-2, $2,000") or in free natural language (e.g. "It was for 2 000 dollars, policy number 2025-POL-2").
• Extract any details you can find from the response and only ask follow-up questions for the specific pieces of information that are still missing. Never re-ask for data you already have.
• Accept common yes/no variations (yes, y, yep, yup, sure, absolutely / no, n, nope, nah) when confirming whether a policy was cross-sold.
• Monetary values may include currency symbols or commas (e.g. "$2,000" or "2 000"). Strip non-numeric characters and parse them as numbers.
• After a field has been answered clearly, do NOT ask for it again. If all required fields have been provided, immediately return the JSON action without further questioning.

• For a client review, ask first for client name **and** rating (1-5), then ask for the review text.
  • Rating may be provided as a digit (1-5) or written word ("five"). Parse either form.
  • Accept comma-separated answers like "Krpt, 4" and treat the first token as name, second as rating.
  • Once you have name, rating, and review text, output the JSON action immediately; never ask twice.

• For an end-of-day *clock-out* interaction, gently ask the employee how their day was and request a short description of key activities. Use that description in the \`description\` / \`keyActivities\` fields of the \`add_daily_summary\` action. Respond with an encouraging remark once the summary is logged.
  • Treat the literal message \`CLOCK_OUT_PROMPT\` as a signal that the employee has just clocked out and you should start the daily summary flow by asking "How was your day today? ..." as above.

When all required info is available, reply ONLY with a single JSON object of the form:
 {
   "action": "add_policy_sale" | "add_client_review" | "add_daily_summary",
   "payload": { ...details }
 }

Details for each action:
1. add_policy_sale
   payload: {
     clientName: string,
     policyNumber: string,
     policyType: string,
     amount: number,           // total premium
     brokerFee: number,        // fee earned
     crossSold: boolean,      // whether it was cross-sold
     saleDate?: ISODate        // defaults to now if omitted
   }
2. add_client_review
   payload: {
     clientName: string,
     rating: 1 | 2 | 3 | 4 | 5,
     review: string,
     policyNumber?: string,
     reviewDate?: ISODate      // defaults to now if omitted
   }
3. add_daily_summary
   payload: {
     hoursWorked: number,
     policiesSold: number,
     totalSalesAmount: number,
     totalBrokerFees: number,
     description: string,
     keyActivities: string[],
     date?: ISODate            // defaults to today if omitted
   }

If information is missing, ask follow-up questions (as described) in natural language **instead of** returning JSON.
Never output markdown fences—return raw JSON only when you are executing an action.
`;

interface LIAssistantResponse {
  action?: 'add_policy_sale' | 'add_client_review' | 'add_daily_summary';
  payload?: Record<string, any>;
}

export async function handleEmployeeChat(message: string, employeeId: string): Promise<string> {
  // 0. Retrieve brief conversation history (last 10 messages)
  const historyRecords = await getChatMessages({ userId: employeeId, limit: 30 });

  // Oldest-first and drop consecutive duplicate messages to reduce confusion
  const history: ChatCompletionMessageParam[] = [];
  let lastContent: string | null = null;
  historyRecords.reverse().forEach((m: any) => {
    const content = m.content as string;
    if (content !== lastContent) {
      history.push({
        role: (m.role === 'bot' ? 'assistant' : 'user') as 'assistant' | 'user',
        content,
      } as ChatCompletionMessageParam);
      lastContent = content;
    }
  });

  // Front-end already saves the user message; skip duplicate logging here

  // 1. Send the message to GPT-4 with the system prompt plus history
  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1',
    temperature: 0.3,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      // Avoid sending the same message twice in a row to GPT
      ...(history.length && history[history.length - 1].content === message
        ? []
        : [{ role: 'user', content: message } as ChatCompletionMessageParam]),
    ],
  });

  const assistantReply = (completion.choices[0].message.content ?? '').trim();

  // 2. Try to parse a JSON action
  let parsed: LIAssistantResponse | null = null;
  if (assistantReply.startsWith('{')) {
    try {
      parsed = JSON.parse(assistantReply) as LIAssistantResponse;
    } catch (_) {
      // Not valid JSON → fall through to returning raw reply
    }
  }

  // 3. Execute action if present
  if (parsed && parsed.action && parsed.payload) {
    try {
      switch (parsed.action) {
        case 'add_policy_sale': {
          const {
            clientName,
            policyNumber,
            policyType,
            amount,
            brokerFee,
            saleDate,
          } = parsed.payload;
          const crossSold = parsed.payload.crossSold ?? false;
        await addPolicySale({
            employeeId,
            clientName,
            policyNumber,
            policyType,
            amount: Number(amount),
            brokerFee: Number(brokerFee),
            crossSold,
            saleDate: saleDate ? new Date(saleDate) : new Date(),
          });
          return `✅ Policy sale for ${clientName} (#${policyNumber}) recorded successfully.`;
      }
        case 'add_client_review': {
          const {
            clientName,
            rating,
            review,
            policyNumber = 'Unknown',
            reviewDate,
          } = parsed.payload;
          await addClientReview({
            employeeId,
            clientName,
            policyNumber,
            rating: Number(rating),
            review,
            reviewDate: reviewDate ? new Date(reviewDate) : new Date(),
          });
          return `✅ Client review from ${clientName} saved — great job!`;
  }
        case 'add_daily_summary': {
          const {
            hoursWorked,
            policiesSold,
            totalSalesAmount,
            totalBrokerFees,
            description,
            keyActivities,
            date,
          } = parsed.payload;
          await addDailySummary({
            employeeId,
            date: date ? new Date(date) : new Date(),
            hoursWorked: Number(hoursWorked),
            policiesSold: Number(policiesSold),
            totalSalesAmount: Number(totalSalesAmount),
            totalBrokerFees: Number(totalBrokerFees),
            description,
            keyActivities: keyActivities || [],
          });
          return '✅ Daily summary submitted successfully.';
        }
      }
    } catch (err) {
      console.error('Error executing AI action:', err);
      return '⚠️ I tried to save that data but ran into a problem. Please try again later or contact support.';
  }
  }

  // 4. No action → just relay GPT’s reply

  // Front-end records the assistant reply, so no need to save it again here

  return assistantReply;
}