
'use server';

/**
 * @fileOverview A flow to answer general questions using a conversational AI.
 * It fetches the latest summary for context and then triggers full history summarization
 * via a separate API endpoint after generating its response.
 *
 * - answerFinancialQuestions - A function that answers questions.
 * - AnswerFinancialQuestionsInput - The input type for the answerFinancialQuestions function.
 * - AnswerFinancialQuestionsOutput - The return type for the answerFinancialQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
// Removed SummarizeConversationInput and summarizeConversation imports as summarization is now triggered via API
import { 
  getLatestSummary,
  // Removed getFullConversationHistory and addSummaryToSession as they are handled by the API route
} from '@/services/firestore-service'; 

const AnswerFinancialQuestionsInputSchema = z.object({
  question: z.string().describe('The user question to answer.'),
  companyName: z.string().optional().describe('The name of the company, if relevant.'),
  sessionId: z.string().describe("The active Firestore session ID for context."),
  queryId: z.string().describe("The ID of the current user query in Firestore. Not directly used by this flow but passed by client."),
});
export type AnswerFinancialQuestionsInput = z.infer<typeof AnswerFinancialQuestionsInputSchema>;

const AnswerFinancialQuestionsOutputSchema = z.object({
  answer: z.string().describe('The answer to the question.'),
  // summaryText is removed, as client will call /api/summarize-session
});
export type AnswerFinancialQuestionsOutput = z.infer<typeof AnswerFinancialQuestionsOutputSchema>;

export async function answerFinancialQuestions(
  input: AnswerFinancialQuestionsInput
): Promise<AnswerFinancialQuestionsOutput> {
  console.log('[answerFinancialQuestions exported function] ENTERED. Input keys:', Object.keys(input).join(', '));
  try {
    console.log('[answerFinancialQuestions exported function] Attempting to call answerFinancialQuestionsFlow with input.');
    const result = await answerFinancialQuestionsFlow(input);
    console.log('[answerFinancialQuestions exported function] Flow returned successfully.');
    return result;
  } catch (error) {
    const typedError = error as Error;
    console.error(
      "[answerFinancialQuestions exported function] CRITICAL ERROR DURING FLOW INVOCATION OR PROCESSING. Input keys:",
      Object.keys(input).join(', '),
      "Error_Name:", typedError.name,
      "Error_Message:", typedError.message,
      "Error_Stack:", typedError.stack,
      "Full_Error_Object_Details:", JSON.stringify(error, Object.getOwnPropertyNames(error))
    );
    return {
      answer: "An unexpected server-side error occurred while initiating the AI flow. The technical team has been notified. Please try again later.",
    };
  }
}

const MainAnswerPromptInputSchema = z.object({
  question: z.string(),
  companyName: z.string().optional(),
  conversationSummary: z.string().optional().describe("A summary of the preceding conversation context, if available.")
});

const mainAnswerPrompt = ai.definePrompt({
  name: 'answerFinancialQuestionsMainPrompt',
  input: {schema: MainAnswerPromptInputSchema},
  output: {schema: z.object({ answer: z.string() })},
  system: `You are a friendly and helpful conversational AI assistant for ProfitScout.
- Respond politely and conversationally to the user's questions.
- If the user provides a simple greeting (e.g., "Hi", "Hello"), respond in kind and briefly offer assistance with financial topics.
- If the question is very short or unclear, you can ask for clarification.
- Use the provided 'Previous Conversation Summary' if available, to maintain context and avoid repetition.
- Always ensure your final response strictly adheres to the output schema, providing only the 'answer' field as a string. Do not add any preamble or explanation outside of the 'answer' field.`,
  prompt: `{{#if conversationSummary}}Previous Conversation Summary:
{{{conversationSummary}}}

{{/if}}User question: {{{question}}}
{{#if companyName}}
(Relating to company: {{{companyName}}})
{{/if}}`,
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  },
});

const answerFinancialQuestionsFlow = ai.defineFlow(
  {
    name: 'answerFinancialQuestionsFlow',
    inputSchema: AnswerFinancialQuestionsInputSchema,
    outputSchema: AnswerFinancialQuestionsOutputSchema,
  },
  async (input: AnswerFinancialQuestionsInput): Promise<AnswerFinancialQuestionsOutput> => {
    const { sessionId, question, companyName, queryId } = input;
    
    console.log(`[answerFinancialQuestionsFlow] ENTERED. Processing input. SessionID: ${sessionId}, QueryID: ${queryId}`);

    // 1. Fetch latest summary for context for the main answer prompt
    let latestSummaryTextForPrompt: string | undefined;
    try {
      console.log(`[answerFinancialQuestionsFlow] Fetching latest summary for session: ${sessionId} to use as prompt context.`);
      const latestSummaryDoc = await getLatestSummary(sessionId);
      latestSummaryTextForPrompt = latestSummaryDoc?.summary_text;
      if (latestSummaryTextForPrompt) {
        console.log(`[answerFinancialQuestionsFlow] Using latest summary for prompt context: "${latestSummaryTextForPrompt.substring(0,70)}..."`);
      } else {
        console.log('[answerFinancialQuestionsFlow] No previous summary found to provide as context to main prompt.');
      }
    } catch (error) {
      console.warn('[answerFinancialQuestionsFlow] Error fetching latest summary for prompt context:', error);
      // Proceed without summary context if fetching fails
    }

    const promptInputForAnswer = { 
      question, 
      companyName, 
      conversationSummary: latestSummaryTextForPrompt 
    };
    
    let synthesizerResponseText: string;

    // 2. Get the main AI answer
    try {
      console.log('[answerFinancialQuestionsFlow] Calling mainAnswerPrompt with input including conversation summary (if any).');
      const {output} = await mainAnswerPrompt(promptInputForAnswer);

      if (!output || typeof output.answer === 'undefined') {
        console.warn("[answerFinancialQuestionsFlow] AI flow did not produce a valid output structure for main answer. Output from AI:", output);
        synthesizerResponseText = "I'm having a little trouble formulating a response right now. Could you try rephrasing?";
      } else if (output.answer.trim() === "") {
         console.warn("[answerFinancialQuestionsFlow] AI flow produced an empty answer for main answer. Output from AI:", output);
         synthesizerResponseText = "I received your message, but I don't have a specific response for that right now. How can I assist you with financial questions?";
      } else {
        console.log('[answerFinancialQuestionsFlow] Received output from mainAnswerPrompt successfully.');
        synthesizerResponseText = output.answer;
      }
    } catch (error) {
      const typedError = error as Error;
      console.error(
        "[answerFinancialQuestionsFlow] CRITICAL ERROR DURING AI mainAnswerPrompt CALL. Error_Name:", typedError.name,
        "Error_Message:", typedError.message, "Error_Stack:", typedError.stack,
        "Full_Error_Object_Details:", JSON.stringify(error, Object.getOwnPropertyNames(error))
      );
      // This error will be caught by the exported function's try/catch
      throw error; 
    }

    // 3. Summarization is now triggered by the client calling /api/summarize-session
    // This flow's responsibility is to return the answer.

    console.log(`[answerFinancialQuestionsFlow] Returning answer: "${synthesizerResponseText.substring(0,70)}..."`);
    return { answer: synthesizerResponseText };
  }
);
