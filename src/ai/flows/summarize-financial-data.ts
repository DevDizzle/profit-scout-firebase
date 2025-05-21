// Summarize Financial Data Flow
'use server';
/**
 * @fileOverview A financial data summarization AI agent.
 *
 * - summarizeFinancialData - A function that handles the financial data summarization process.
 * - SummarizeFinancialDataInput - The input type for the summarizeFinancialData function.
 * - SummarizeFinancialDataOutput - The return type for the summarizeFinancialData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeFinancialDataInputSchema = z.object({
  financialDocumentDataUri: z
    .string()
    .describe(
      "A financial document (e.g., balance sheet, income statement) as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type SummarizeFinancialDataInput = z.infer<typeof SummarizeFinancialDataInputSchema>;

const SummarizeFinancialDataOutputSchema = z.object({
  summary: z.string().describe('A summary of the key insights and trends from the financial document.'),
});
export type SummarizeFinancialDataOutput = z.infer<typeof SummarizeFinancialDataOutputSchema>;

export async function summarizeFinancialData(input: SummarizeFinancialDataInput): Promise<SummarizeFinancialDataOutput> {
  return summarizeFinancialDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeFinancialDataPrompt',
  input: {schema: SummarizeFinancialDataInputSchema},
  output: {schema: SummarizeFinancialDataOutputSchema},
  prompt: `You are an expert financial analyst. You will analyze the provided financial document and summarize the key insights and trends.  The summary should be in plain language and easily understood by someone with limited financial knowledge.\n\nFinancial Document:\n{{media url=financialDocumentDataUri}}`,
});

const summarizeFinancialDataFlow = ai.defineFlow(
  {
    name: 'summarizeFinancialDataFlow',
    inputSchema: SummarizeFinancialDataInputSchema,
    outputSchema: SummarizeFinancialDataOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
