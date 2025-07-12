// lib/ai/employee-chat.ts
// REPLACED CONTENT — full AI-driven chat handler

import openai from '@/lib/openai';
import {
  addPolicySale,
  addClientReview,
  addDailySummary,
  getChatMessages,
} from '@/lib/database';
import { buildEmployeeSystemPrompt } from './system-prompts';
import type { ChatCompletionMessageParam } from 'openai/resources';

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
      { role: 'system', content: buildEmployeeSystemPrompt() },
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