
'use server';

/**
 * @fileOverview A flow to answer general questions using a conversational AI,
 * and then trigger conversation summarization.
 *
 * - answerFinancialQuestions - A function that answers questions and triggers summarization.
 * - AnswerFinancialQuestionsInput - The input type for the answerFinancialQuestions function.
 * - AnswerFinancialQuestionsOutput - The return type for the answerFinancialQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { summarizeConversation, type SummarizeConversationInput } from './summarize-conversation-flow';
import { getLatestConversationDataForSummarization, addSummaryToSession } from '@/services/firestore-service';

const AnswerFinancialQuestionsInputSchema = z.object({
  question: z.string().describe('The user question to answer.'),
  companyName: z.string().optional().describe('The name of the company, if relevant (currently ignored by the simplified prompt).'),
  sessionId: z.string().describe("The active Firestore session ID for summarization context."),
  queryId: z.string().describe("The ID of the user's query in Firestore, to link the summary."),
});
export type AnswerFinancialQuestionsInput = z.infer<typeof AnswerFinancialQuestionsInputSchema>;

const AnswerFinancialQuestionsOutputSchema = z.object({
  answer: z.string().describe('The answer to the question.'),
  summaryText: z.string().optional().describe('The generated summary of the conversation turn, if successful.')
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
      summaryText: undefined
    };
  }
}

const mainAnswerPrompt = ai.definePrompt({
  name: 'answerFinancialQuestionsMainPrompt',
  input: {schema: AnswerFinancialQuestionsInputSchema.pick({ question: true, companyName: true })},
  // Output schema for this prompt is just the answer
  output: {schema: z.object({ answer: z.string() })},
  system: `You are a friendly and helpful conversational AI assistant for ProfitScout.
- Respond politely and conversationally to the user's questions.
- If the user provides a simple greeting (e.g., "Hi", "Hello"), respond in kind and briefly offer assistance with financial topics. For example: "Hello! How can I help you with your financial questions today?"
- If the question is very short or unclear, you can ask for clarification.
- Always ensure your final response strictly adheres to the output schema, providing only the 'answer' field as a string. Do not add any preamble or explanation outside of the 'answer' field.`,
  prompt: `User question: {{{question}}}`,
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
    outputSchema: AnswerFinancialQuestionsOutputSchema, // Ensure this output schema includes summaryText
  },
  async (input: AnswerFinancialQuestionsInput): Promise<AnswerFinancialQuestionsOutput> => {
    const { sessionId, queryId, question, companyName } = input;
    const promptInputForAnswer = { question, companyName };
    
    console.log('[answerFinancialQuestionsFlow] ENTERED. Processing promptInputForAnswer keys:', Object.keys(promptInputForAnswer).join(', '));
    console.log(`[answerFinancialQuestionsFlow] SessionID: ${sessionId}, QueryID: ${queryId}`);

    let synthesizerResponseText: string;

    try {
      console.log('[answerFinancialQuestionsFlow] Calling mainAnswerPrompt with input.');
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
      // Return early as we can't proceed to summarization if the main answer failed critically
      return { 
        answer: "I'm sorry, an unexpected error occurred while trying to process your request for the main answer. The technical team has been notified. Please try again in a moment.",
        summaryText: undefined 
      };
    }

    // Generate summary to be returned to the client for saving
    let generatedSummaryText: string | undefined = undefined;
    try {
      console.log(`[answerFinancialQuestionsFlow - Summarization] Attempting summarization for session: ${sessionId}, query: ${queryId}`);
      const conversationDataFromDb = await getLatestConversationDataForSummarization(sessionId);
      
      const summaryFlowInput: SummarizeConversationInput = {
        conversationContext: {
          previousSummaryText: conversationDataFromDb.latestSummary?.summary_text,
          latestQueryText: question, 
          latestSpecialistOutputText: conversationDataFromDb.latestSpecialistOutput?.output_text, 
          latestSynthesizerResponseText: synthesizerResponseText, 
        }
      };
      
      console.log(`[answerFinancialQuestionsFlow - Summarization] Calling summarizeConversation flow with input:`, {
          previousSummaryTextExists: !!summaryFlowInput.conversationContext.previousSummaryText,
          latestQueryText: summaryFlowInput.conversationContext.latestQueryText.substring(0,100) + "...",
          latestSpecialistOutputTextExists: !!summaryFlowInput.conversationContext.latestSpecialistOutputText,
          latestSynthesizerResponseText: summaryFlowInput.conversationContext.latestSynthesizerResponseText.substring(0,100) + "..."
      });
      const summaryOutput = await summarizeConversation(summaryFlowInput);
      
      if (summaryOutput && summaryOutput.summaryText && summaryOutput.summaryText.trim() !== "") {
        generatedSummaryText = summaryOutput.summaryText;
        console.log(`[answerFinancialQuestionsFlow - Summarization] Summary generated by flow: "${generatedSummaryText.substring(0, 100)}..."`);
      } else {
        console.warn(`[answerFinancialQuestionsFlow - Summarization] Summarization did not produce valid text for session: ${sessionId}. Summary output received:`, JSON.stringify(summaryOutput));
      }
    } catch (summarizationError) {
      const typedSummarizationError = summarizationError as Error;
      console.error(
        `[answerFinancialQuestionsFlow - Summarization] Error during summarization for session ${sessionId}:`,
        "Error_Name:", typedSummarizationError.name, 
        "Error_Message:", typedSummarizationError.message, 
        "Error_Stack:", typedSummarizationError.stack,
        "Full_Error_Object:", JSON.stringify(summarizationError, Object.getOwnPropertyNames(summarizationError))
      );
      // Do not save summary if an error occurred during its generation
    }

    return { answer: synthesizerResponseText, summaryText: generatedSummaryText };
  }
);
