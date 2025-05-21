'use server';

/**
 * @fileOverview A flow to answer financial questions about a company.
 *
 * - answerFinancialQuestions - A function that answers financial questions based on available data.
 * - AnswerFinancialQuestionsInput - The input type for the answerFinancialQuestions function.
 * - AnswerFinancialQuestionsOutput - The return type for the answerFinancialQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { fetchCompanyDataTool } from '@/ai/tools/fetch-company-data-tool';

const AnswerFinancialQuestionsInputSchema = z.object({
  question: z.string().describe('The financial question to answer.'),
  companyName: z.string().describe('The name of the company.'),
});
export type AnswerFinancialQuestionsInput = z.infer<typeof AnswerFinancialQuestionsInputSchema>;

const AnswerFinancialQuestionsOutputSchema = z.object({
  answer: z.string().describe('The answer to the financial question.'),
});
export type AnswerFinancialQuestionsOutput = z.infer<typeof AnswerFinancialQuestionsOutputSchema>;

export async function answerFinancialQuestions(
  input: AnswerFinancialQuestionsInput
): Promise<AnswerFinancialQuestionsOutput> {
  return answerFinancialQuestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'answerFinancialQuestionsPrompt',
  input: {schema: AnswerFinancialQuestionsInputSchema},
  output: {schema: AnswerFinancialQuestionsOutputSchema},
  tools: [fetchCompanyDataTool],
  system: `You are a helpful financial analyst.
When asked a question about a company, use the 'fetchCompanyData' tool to get information about the specified company.
Base your answer on the information provided by the tool and the user's question.
If the tool returns no specific data, state that clearly in your answer.
Ensure your final response strictly adheres to the output schema, providing only the 'answer' field as a string.
The user is asking about {{companyName}}.`,
  prompt: `{{{question}}}`,
});

const answerFinancialQuestionsFlow = ai.defineFlow(
  {
    name: 'answerFinancialQuestionsFlow',
    inputSchema: AnswerFinancialQuestionsInputSchema,
    outputSchema: AnswerFinancialQuestionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output || typeof output.answer === 'undefined') {
      // This case should ideally be handled by Genkit throwing an error if the schema isn't met or content is filtered.
      // However, to be safe and provide a fallback:
      console.error("AI flow did not produce a valid output matching the schema. Input:", input);
      return { answer: "I apologize, but I encountered an issue generating a response. The information might be unavailable or the request could not be fully processed." };
    }
    return output; 
  }
);
