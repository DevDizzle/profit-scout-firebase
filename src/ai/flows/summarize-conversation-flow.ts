
'use server';
/**
 * @fileOverview A Genkit flow to summarize conversation context using full history.
 *
 * - summarizeConversation - Generates a summary of the conversation.
 * - SummarizeConversationInput - Input schema for the summarization flow.
 * - SummarizeConversationOutput - Output schema for the summarization flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const SummarizeConversationInputSchema = z.object({
  previousSummaryText: z.string().optional().describe("The summary from the previous turn, if any."),
  fullChatHistory: z.string().describe("A string containing all user queries and AI synthesizer responses, ordered by timestamp. e.g., 'User: Hi\\nAI: Hello\\nUser: What's up?\\nAI: Not much.'"),
  latestQueryText: z.string().describe("The most recent user query text. This should be the last user message in the fullChatHistory."),
  latestSynthesizerResponseText: z.string().describe("The AI's latest response for the most recent query. This should be the last AI message in the fullChatHistory."),
});
export type SummarizeConversationInput = z.infer<typeof SummarizeConversationInputSchema>;

const SummarizeConversationOutputSchema = z.object({
  summaryText: z.string().describe('The generated concise summary of the conversation.'),
});
export type SummarizeConversationOutput = z.infer<typeof SummarizeConversationOutputSchema>;

export async function summarizeConversation(input: SummarizeConversationInput): Promise<SummarizeConversationOutput> {
  console.log('[summarizeConversation exported function] ENTERED. Input received for summarization.');
  try {
    const result = await summarizeConversationGenkitFlow(input);
    if (result && result.summaryText) {
        console.log(`[summarizeConversation exported function] Summary successfully generated by Genkit flow: "${result.summaryText.substring(0,70)}..."`);
    } else {
        console.warn('[summarizeConversation exported function] Genkit flow did not return valid summary text.');
    }
    return result;
  } catch (error) {
    const typedError = error as Error;
    console.error(
      "[summarizeConversation exported function] CRITICAL ERROR DURING SUMMARIZATION. Input keys:", Object.keys(input).join(', '),
      "Error_Name:", typedError.name,
      "Error_Message:", typedError.message, "Error_Stack:", typedError.stack,
      "Full_Error_Object:", JSON.stringify(error, Object.getOwnPropertyNames(error))
    );
    // Return an empty summary on error to prevent breaking the calling flow
    return { summaryText: "" };
  }
}

const summarizationPrompt = ai.definePrompt({
  name: 'summarizeFullConversationHistoryPrompt',
  input: { schema: SummarizeConversationInputSchema },
  output: { schema: SummarizeConversationOutputSchema },
  prompt: `Generate a summary to provide context for future responses, capturing all discussed topics, companies (e.g., MSFT, AAPL), key metrics (e.g., revenue, P/E ratio), insights (e.g., management outlook, risks), industries (e.g., tech, retail), and general queries (e.g., financial literacy) from the full conversation history. Use the provided data:
Previous Summary: {{{previousSummaryText}}}
Full Chat History:
{{{fullChatHistory}}}
Latest User Query: {{{latestQueryText}}}
Latest AI Response: {{{latestSynthesizerResponseText}}}
Keep the summary concise, under 1000 characters, adjusting length to cover all relevant context.`,
  config: {
    temperature: 0.1,
    maxOutputTokens: 250, // Supports ~1000 characters
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  },
});

const summarizeConversationGenkitFlow = ai.defineFlow(
  {
    name: 'summarizeConversationGenkitFlow',
    inputSchema: SummarizeConversationInputSchema,
    outputSchema: SummarizeConversationOutputSchema,
  },
  async (input: SummarizeConversationInput): Promise<SummarizeConversationOutput> => {
    console.log('[summarizeConversationGenkitFlow] Processing summarization prompt with full history.');
    console.log('[summarizeConversationGenkitFlow] Input Details:', {
      previousSummaryTextExists: !!input.previousSummaryText,
      fullChatHistoryLength: input.fullChatHistory.length,
      latestQueryText: input.latestQueryText.substring(0, 100) + "...",
      latestSynthesizerResponseText: input.latestSynthesizerResponseText.substring(0, 100) + "..."
    });

    const {output} = await summarizationPrompt(input);

    if (!output || typeof output.summaryText === 'undefined' || output.summaryText.trim() === "") {
      console.warn("[summarizeConversationGenkitFlow] AI flow did not produce a valid summary text. Output from AI:", output);
      return { summaryText: "" }; // Return empty summary if AI output is invalid
    }
    console.log('[summarizeConversationGenkitFlow] Summary text generated.');
    return output;
  }
);
