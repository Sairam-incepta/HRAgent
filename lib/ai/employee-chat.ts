import { handlePolicyEntry } from './conversation-flows';
import { openai } from '@ai-sdk/openai';
import { addPolicySale } from '../db/policy-sales';

const TRIGGER_PHRASES = {
  policy_entry: ['new policy', 'log a policy', 'sold a policy', 'add a policy'],
  // other flows can be added here
};

interface PolicyDraft {
  clientName?: string;
  policyNumber?: string;
  policyType?: string;
  amount?: number;
  brokerFee?: number;
}

type Stage = 'basic' | 'financial' | 'cross' | null;

const userConversationState: Record<string, { stage: Stage; draft: PolicyDraft }> = {};

export async function handleEmployeeChat(message: string, userId: string): Promise<string> {
  if (!userId) {
    throw new Error('User ID is required');
  }

  const text = message.trim();

  // If we are mid-flow handle accordingly
  const state = userConversationState[userId];

  if (state) {
    switch (state.stage) {
      case 'basic': {
        // Expecting: client name, policy number, policy type
        const parts = text.split(',').map(p => p.trim());
        if (parts.length < 3) {
          return "Please provide the client's name, policy number, and policy type separated by commas (e.g., Omega, POL-123, Home).";
        }
        const [clientName, policyNumber, policyType] = parts;
        state.draft.clientName = clientName;
        state.draft.policyNumber = policyNumber;
        state.draft.policyType = policyType;
        state.stage = 'financial';
        return "Got it. Now, what's the total policy amount and your broker fee? (e.g., $1000, $150)";
      }
      case 'financial': {
        // Expecting amount and broker fee
        const nums = text.match(/[\d.,]+/g);
        if (!nums || nums.length < 2) {
          return "Please provide both the total amount and the broker fee, separated by a comma (e.g., $1000, $150).";
        }
        const amount = parseFloat(nums[0].replace(/,/g, ''));
        const fee = parseFloat(nums[1].replace(/,/g, ''));
        if (isNaN(amount) || isNaN(fee)) {
          return "I couldn't parse those numbers. Please provide them again (e.g., 1000, 150).";
        }
        state.draft.amount = amount;
        state.draft.brokerFee = fee;
        state.stage = 'cross';
        return "Was this policy cross-sold to an existing client? (yes/no)";
      }
      case 'cross': {
        const yes = /^(y|yes)/i.test(text);
        const no = /^(n|no)/i.test(text);
        if (!yes && !no) {
          return "Please answer yes or no – was this a cross-sold policy?";
        }

        const draft = state.draft;
        const crossSold = yes;
        const finalBrokerFee = crossSold ? (draft.brokerFee || 0) * 2 : draft.brokerFee || 0;

        // Save to DB
        await addPolicySale({
          employeeId: userId,
          clientName: draft.clientName!,
          policyNumber: draft.policyNumber!,
          policyType: draft.policyType!,
          amount: draft.amount!,
          brokerFee: finalBrokerFee,
          crossSold,
          saleDate: new Date(),
        });

        delete userConversationState[userId];
        return `Policy sale for ${draft.clientName} (Policy #${draft.policyNumber}) has been recorded! ${crossSold ? 'Cross-sell bonus applied.' : ''}`;
      }
    }
  }

  // If trigger phrase initiates new flow and not already in flow
  const lowerCaseMessage = text.toLowerCase();
  if (TRIGGER_PHRASES.policy_entry.some(phrase => lowerCaseMessage.includes(phrase))) {
    userConversationState[userId] = { stage: 'basic', draft: {} };
    return "Great! Let's log the policy. Please provide the client's name, policy number, and policy type (e.g., Omega, POL-123, Home).";
  }

  // General AI fallback
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant for an insurance agent. Keep responses concise and ask clarifying questions when necessary.`
          },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error fetching general AI response:', error);
    return "I'm sorry, I'm having trouble connecting at the moment. Please try again later.";
  }
}