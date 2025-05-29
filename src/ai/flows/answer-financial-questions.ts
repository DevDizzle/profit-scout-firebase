
'use server';

/**
 * @fileOverview A flow to answer general questions using a conversational AI,
 * and then trigger conversation summarization using full history.
 *
 * - answerFinancialQuestions - A function that answers questions and triggers summarization.
 * - AnswerFinancialQuestionsInput - The input type for the answerFinancialQuestions function.
 * - AnswerFinancialQuestionsOutput - The return type for the answerFinancialQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { summarizeConversation, type SummarizeConversationInput } from './summarize-conversation-flow';
import { 
  getFullConversationHistory, 
  getLatestSummary,
  type FullConversationHistory,
  type QueryEntry,
  type SynthesizerResponseEntry
} from '@/services/firestore-service'; // Removed addSummaryToSession import

const AnswerFinancialQuestionsInputSchema = z.object({
  question: z.string().describe('The user question to answer.'),
  companyName: z.string().optional().describe('The name of the company, if relevant.'),
  sessionId: z.string().describe("The active Firestore session ID for summarization context."),
  // queryId is still needed to be passed to the client for linking the summary it saves
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

const MainAnswerPromptInputSchema = z.object({
  question: z.string(),
  companyName: z.string().optional(),
  conversationSummary: z.string().optional().describe("A summary of the preceding conversation context, if available.")
});

const mainAnswerPrompt = ai.definePrompt({
  name: 'answerFinancialQuestionsMainPrompt',
  input: {schema: MainAnswerPromptInputSchema},
  output: {schema: z.object({ answer: z.string() })}, // Output schema for this prompt is just the answer
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
    const { sessionId, question, companyName } = input;
    
    console.log('[answerFinancialQuestionsFlow] ENTERED. Processing input. SessionID:', sessionId);

    // 1. Fetch latest summary for context
    let latestSummaryTextForPrompt: string | undefined;
    try {
      const latestSummaryDoc = await getLatestSummary(sessionId);
      latestSummaryTextForPrompt = latestSummaryDoc?.summary_text;
      if (latestSummaryTextForPrompt) {
        console.log(`[answerFinancialQuestionsFlow] Using latest summary for prompt context: "${latestSummaryTextForPrompt.substring(0,70)}..."`);
      } else {
        console.log('[answerFinancialQuestionsFlow] No previous summary found to provide as context to main prompt.');
      }
    } catch (error) {
      console.warn('[answerFinancialQuestionsFlow] Error fetching latest summary for prompt context:', error);
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
      return { 
        answer: "I'm sorry, an unexpected error occurred while trying to process your request for the main answer. The technical team has been notified. Please try again in a moment.",
        summaryText: undefined 
      };
    }

    // 3. Generate new summary using full history (including the latest interaction)
    let generatedSummaryText: string | undefined = undefined;
    try {
      console.log(`[answerFinancialQuestionsFlow - Summarization] Attempting full history summarization for session: ${sessionId}`);
      const conversationHistory: FullConversationHistory = await getFullConversationHistory(sessionId);
      
      // Construct fullChatHistory string
      // This simple concatenation might need refinement for very long histories.
      // For now, it interleaves queries and responses.
      let fullChatHistoryString = "";
      const mergedHistory: (QueryEntry | SynthesizerResponseEntry)[] = [];
      let qIdx = 0, rIdx = 0;
      while(qIdx < conversationHistory.allQueries.length || rIdx < conversationHistory.allSynthesizerResponses.length) {
        const query = conversationHistory.allQueries[qIdx];
        const response = conversationHistory.allSynthesizerResponses[rIdx];

        if (query && (!response || query.timestamp.toMillis() <= response.timestamp.toMillis())) {
          mergedHistory.push(query);
          qIdx++;
        } else if (response) {
          mergedHistory.push(response);
          rIdx++;
        }
      }
      // Add current query (not yet in DB's allQueries) and current response
      // For the history string, we want *all* saved queries and *all* saved responses *plus* the current interaction
      
      let tempFullChatHistory = "";
      conversationHistory.allQueries.forEach(q => tempFullChatHistory += `User: ${q.text}\n`);
      // The current `synthesizerResponseText` is the latest AI response.
      // The current `question` is the latest user query.
      // We should get all *previous* queries and synthesizer responses from DB for `fullChatHistory`
      // And then pass the current query and current response separately.
      
      // Let's refine how fullChatHistory is built
      const dbQueries = conversationHistory.allQueries;
      const dbResponses = conversationHistory.allSynthesizerResponses;
      
      // Merge and sort queries and responses by timestamp to create a coherent dialogue string
      const dialogueTurns: {type: 'User' | 'AI', text: string, timestamp: Timestamp}[] = [];
      dbQueries.forEach(q => dialogueTurns.push({type: 'User', text: q.text, timestamp: q.timestamp}));
      dbResponses.forEach(r => dialogueTurns.push({type: 'AI', text: r.response_text, timestamp: r.timestamp}));
      dialogueTurns.sort((a,b) => a.timestamp.toMillis() - b.timestamp.toMillis());

      fullChatHistoryString = dialogueTurns.map(turn => `${turn.type}: ${turn.text}`).join('\n');

      const summaryFlowInput: SummarizeConversationInput = {
        previousSummaryText: conversationHistory.latestSummary?.summary_text,
        fullChatHistory: fullChatHistoryString,
        latestQueryText: question, // Current user question
        latestSynthesizerResponseText: synthesizerResponseText, // Current AI response
      };
      
      console.log(`[answerFinancialQuestionsFlow - Summarization] Calling summarizeConversation flow. Input includes: previousSummary (${!!summaryFlowInput.previousSummaryText}), fullChatHistory length (${summaryFlowInput.fullChatHistory.length}), latestQuery ("${summaryFlowInput.latestQueryText.substring(0,50)}..."), latestResponse ("${summaryFlowInput.latestSynthesizerResponseText.substring(0,50)}...")`);
      
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
    }

    // 4. Return the main answer and the newly generated summary text to the client
    console.log(`[answerFinancialQuestionsFlow] Returning answer: "${synthesizerResponseText.substring(0,70)}..." and summary: "${(generatedSummaryText || "").substring(0,70)}..."`);
    return { answer: synthesizerResponseText, summaryText: generatedSummaryText };
  }
);
