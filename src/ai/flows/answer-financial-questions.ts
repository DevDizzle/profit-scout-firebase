
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
  system: `You are a friendly and helpful financial analyst chat assistant. Your primary goal is to answer financial questions.
- If the user provides a simple greeting (e.g., "Hi", "Hello"), respond politely and briefly, then offer to assist with financial questions. For example: "Hello! How can I help you with your financial questions today?"
- If the user asks a question about a company, use the 'fetchCompanyData' tool to get information about the specified company: {{companyName}}.
- Base your answer on the information provided by the tool and the user's question.
- If the tool returns no specific data for the company, or if no specific company is mentioned and the context is general, clearly state that specific company data is not available and offer to answer questions about companies if the user provides a name.
- If the question is very generic and not finance-related, politely state your purpose as a financial assistant.
- Always ensure your final response strictly adheres to the output schema, providing only the 'answer' field as a string. Do not add any preamble or explanation outside of the 'answer' field.`,
  prompt: `{{{question}}}`,
  // Example of safety settings if needed, though for "Hi" it's usually not a safety issue.
  // config: {
  //   safetySettings: [
  //     {
  //       category: 'HARM_CATEGORY_HARASSMENT',
  //       threshold: 'BLOCK_ONLY_HIGH',
  //     },
  //     {
  //       category: 'HARM_CATEGORY_HATE_SPEECH',
  //       threshold: 'BLOCK_ONLY_HIGH',
  //     },
  //   ],
  // }
});

const answerFinancialQuestionsFlow = ai.defineFlow(
  {
    name: 'answerFinancialQuestionsFlow',
    inputSchema: AnswerFinancialQuestionsInputSchema,
    outputSchema: AnswerFinancialQuestionsOutputSchema,
  },
  async input => {
    try {
      const {output} = await prompt(input);
      if (!output || typeof output.answer === 'undefined' || output.answer.trim() === "") {
        // This case handles if Genkit returns a valid structure but the answer is empty,
        // or if the model genuinely can't answer based on the prompt despite trying.
        console.warn("AI flow did not produce a meaningful answer. Input:", input, "Output from AI:", output);
        return { answer: "I received your message, but I'm not sure how to respond to that in a financial context. Could you please ask a specific financial question?" };
      }
      return output;
    } catch (error) {
      console.error("Error in answerFinancialQuestionsFlow:", error, "Input:", input);
      // This error will be caught by the frontend and display the generic message.
      // For more specific error messages to the user, this would need to be more nuanced.
      // Re-throwing or returning a structured error is an option.
      // For now, let it be caught by the frontend's generic handler.
      // To provide a flow-specific fallback to the user (instead of frontend generic error):
      // return { answer: "I'm having a little trouble processing that. Please try rephrasing or ask another question."};
      throw error; // Re-throw to be caught by the frontend, which shows the "Sorry, I couldn't process..."
    }
  }
);

