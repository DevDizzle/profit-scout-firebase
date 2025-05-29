
'use server';
/**
 * @fileOverview A Genkit flow to summarize conversation context.
 *
 * - summarizeConversation - Generates a summary of the conversation.
 * - SummarizeConversationInput - Input schema for the summarization flow.
 * - SummarizeConversationOutput - Output schema for the summarization flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Updated input schema to reflect the structure of conversation context needed
export const SummarizeConversationInputSchema = z.object({
  conversationContext: z.object({
    previousSummaryText: z.string().optional().describe("The summary from the previous turn, if any."),
    latestQueryText: z.string().describe("The most recent user query."),
    latestSpecialistOutputText: z.string().optional().describe("The most recent specialist output, if relevant to the last query."),
    latestSynthesizerResponseText: z.string().describe("The AI's latest response to the user."),
  }),
});
export type SummarizeConversationInput = z.infer<typeof SummarizeConversationInputSchema>;

export const SummarizeConversationOutputSchema = z.object({
  summaryText: z.string().describe('The generated concise summary of the conversation.'),
});
export type SummarizeConversationOutput = z.infer<typeof SummarizeConversationOutputSchema>;

export async function summarizeConversation(input: SummarizeConversationInput): Promise<SummarizeConversationOutput> {
  console.log('[summarizeConversation flow] ENTERED. Input received for summarization.');
  try {
    const result = await summarizeConversationGenkitFlow(input);
    console.log('[summarizeConversation flow] Summary generated successfully.');
    return result;
  } catch (error) {
    const typedError = error as Error;
    console.error(
      "[summarizeConversation flow] CRITICAL ERROR DURING SUMMARIZATION. Input received, Error_Name:", typedError.name,
      "Error_Message:", typedError.message, "Error_Stack:", typedError.stack
    );
    // Return a structured error or rethrow, depending on how the caller handles it.
    // For now, let's rethrow so the calling flow can decide.
    // Or, more safely for background tasks, log and return empty/error marker.
    // Given it's called async without await from main flow, just logging is safer.
    return { summaryText: "" }; // Return empty summary on error to prevent breaking caller
  }
}

const summarizationPrompt = ai.definePrompt({
  name: 'summarizeConversationPrompt',
  input: { schema: SummarizeConversationInputSchema.shape.conversationContext }, // Use the nested object schema for the prompt
  output: { schema: SummarizeConversationOutputSchema },
  prompt: `Generate a concise summary of the conversation to provide context for future responses, capturing all discussed topics, companies (e.g., MSFT, AAPL), key metrics (e.g., revenue, P/E ratio), insights (e.g., management outlook, risks), industries (e.g., tech, retail), and general queries (e.g., financial literacy). Use the provided conversation data:
Previous Summary (if any): {{{previousSummaryText}}}
User Query: {{{latestQueryText}}}
Specialist Output (if any): {{{latestSpecialistOutputText}}}
AI Response: {{{latestSynthesizerResponseText}}}
Keep the summary under 1000 characters, adjusting length to cover all relevant context (e.g., longer for multiple stocks/industries, shorter for single-topic discussions).`,
  config: {
    model: 'gemini-2.0-flash-001', // Ensure this is the desired model, or remove to use default from ai.ts
    temperature: 0.1,
    maxOutputTokens: 250, // Approx 1000 characters (1 char ~ 0.25 tokens)
    safetySettings: [ // Lenient safety settings for summarization
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
    console.log('[summarizeConversationGenkitFlow] Processing summarization prompt.');
    
    // Pass the nested conversationContext object to the prompt
    const { output } = await summarizationPrompt(input.conversationContext);

    if (!output || typeof output.summaryText === 'undefined' || output.summaryText.trim() === "") {
      console.warn("[summarizeConversationGenkitFlow] AI flow did not produce a valid summary text. Output from AI:", output);
      return { summaryText: "" }; // Return an empty summary if generation fails or is empty
    }
    console.log('[summarizeConversationGenkitFlow] Summary text generated.');
    return output;
  }
);
