import { addPolicySale } from '@/lib/database';

// A simple, stateless function to handle the policy entry "flow".
// It tries to parse all information from a single user message.
export async function handlePolicyEntry(message: string, employeeId: string): Promise<string> {
    const prompt = `
        You are an intelligent data extraction assistant for an insurance brokerage. Your persona is "LI", a friendly and efficient AI assistant.
        Your primary goal is to extract policy sale information from a user's message.
        You must extract the following fields from their message:
        - clientName (string)
        - policyNumber (string)
        - policyType (e.g., Auto, Home, Life)
        - policyAmount (numeric)
        - brokerFee (numeric)

        Here are your rules based on the user's message: "${message}"

        1.  **Check for completeness:** Analyze the message to see if it contains enough information to fill the required fields (clientName, policyNumber, policyType, policyAmount).
        
        2.  **If INCOMPLETE:** The user has not provided all the details. DO NOT respond with JSON. Instead, respond with a single, friendly, natural language question asking for all the necessary details at once.
            - Example response: "I can log that new policy for you. Could you please provide the client's name, policy number, policy type, and the total amount?"

        3.  **If COMPLETE:** The user has provided all necessary details. Respond ONLY with a valid JSON object containing the extracted data. The keys must be: \`clientName\`, \`policyNumber\`, \`policyType\`, \`policyAmount\`, and \`brokerFee\` (if provided).
            - Example response: \`{"clientName": "John Doe", "policyNumber": "A12345B", "policyType": "Auto", "policyAmount": 1500, "brokerFee": 150}\`

        Do not ask for information one piece at a time. Ask for everything you need in one go if the initial message is incomplete.
    `;

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
                    { role: 'system', content: "You are an intelligent data extraction assistant that only responds in JSON format or with a question if data is missing." },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.1,
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API request failed with status ${response.status}`);
        }

        const data = await response.json();
        const extractedData = data.choices[0].message.content;
        
        // Check if the response is a question (meaning info is missing)
        if (extractedData.includes('?')) {
            return extractedData;
        }

        const policyData = JSON.parse(extractedData);

        // Validate required fields
        if (!policyData.clientName || !policyData.policyNumber || !policyData.policyType || !policyData.policyAmount) {
            return "I seem to be missing some key information. Please provide the Client Name, Policy Number, Policy Type, and Amount.";
        }
        
        const success = await addPolicySale({
            employeeId: employeeId,
            clientName: policyData.clientName,
            policyNumber: policyData.policyNumber,
            policyType: policyData.policyType,
            amount: policyData.policyAmount,
            brokerFee: policyData.brokerFee || 0,
            crossSold: policyData.crossSold || false,
        saleDate: new Date(),
        });

        if (success) {
            return `Policy sale for ${policyData.clientName} (Policy #${policyData.policyNumber}) has been successfully recorded! Great work!`;
      } else {
            return "I had trouble saving that policy to the database. Please try again or contact support.";
        }
  } catch (error) {
        console.error("Error processing or saving policy data:", error);
        return "I'm having trouble understanding the policy details. Could you please provide them in a clear format? For example: 'Client: John Doe, Policy #: 12345, Type: Auto, Amount: $1500, Fee: $150'";
  }
}