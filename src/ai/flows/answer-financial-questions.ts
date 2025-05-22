
'use server';

/**
 * @fileOverview A flow to answer financial questions about a company, potentially using company data or documents from GCS.
 *
 * - answerFinancialQuestions - A function that answers financial questions based on available data.
 * - AnswerFinancialQuestionsInput - The input type for the answerFinancialQuestions function.
 * - AnswerFinancialQuestionsOutput - The return type for the answerFinancialQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { fetchCompanyDataTool } from '@/ai/tools/fetch-company-data-tool';
import { fetchDocumentFromGCSTool } from '@/ai/tools/fetch-document-gcs-tool'; // Import the GCS tool

const AnswerFinancialQuestionsInputSchema = z.object({
  question: z.string().describe('The financial question to answer.'),
  companyName: z.string().optional().describe('The name of the company, if relevant. This helps focus company-specific data retrieval.'),
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
  tools: [fetchCompanyDataTool, fetchDocumentFromGCSTool], // Add GCS tool here
  system: `You are a friendly and helpful financial analyst chat assistant. Your primary goal is to answer financial questions accurately.
- If the user provides a simple greeting (e.g., "Hi", "Hello"), respond politely and briefly, then offer to assist with financial questions. For example: "Hello! How can I help you with your financial questions today?"
- You have access to two tools:
  1. 'fetchCompanyData': Use this tool if the user asks a general question about a specific company (e.g., "Tell me about Innovatech", "What's Globex's revenue?"). Use the 'companyName' from the input if provided.
  2. 'fetchDocumentFromGCS': Use this tool if the user asks a question that requires information from a specific document stored in Google Cloud Storage (GCS) AND they provide a GCS path (e.g., "gs://bucket-name/file-name.txt"). The tool requires 'bucketName' and 'fileName'.
- If the user's question seems to need a document from GCS but they DO NOT provide the GCS path (bucket and file name), you MUST respond by stating that you need the GCS bucket and file name to access the document. For example: "I can help with that, but I'll need the GCS bucket and file name for the document." Do not attempt to guess the path or use the tool without it.
- Base your answer on the information provided by the tools (if used) and the user's question.
- If a tool returns no specific data, or if no specific company is mentioned and the context is general, clearly state that specific data is not available and offer to answer questions about companies or documents if the user provides the necessary details.
- If the question is very generic and not finance-related, or if you cannot answer even with tools, politely state your purpose as a financial assistant or indicate you cannot fulfill the request.
- Always ensure your final response strictly adheres to the output schema, providing only the 'answer' field as a string. Do not add any preamble or explanation outside of the 'answer' field.`,
  prompt: `User question: {{{question}}}
{{#if companyName}}Company context: {{{companyName}}}{{/if}}`,
});

const answerFinancialQuestionsFlow = ai.defineFlow(
  {
    name: 'answerFinancialQuestionsFlow',
    inputSchema: AnswerFinancialQuestionsInputSchema,
    outputSchema: AnswerFinancialQuestionsOutputSchema,
  },
  async (input: AnswerFinancialQuestionsInput) => {
    // Ensure companyName is passed if available, otherwise it's undefined
    const promptInput = {
      question: input.question,
      companyName: input.companyName || undefined,
    };

    try {
      const {output} = await prompt(promptInput);
      if (!output || typeof output.answer === 'undefined' || output.answer.trim() === "") {
        console.warn("AI flow did not produce a meaningful answer or the answer was empty. Input:", promptInput, "Output from AI:", output);
        return { answer: "I received your message, but I'm having trouble formulating a specific financial response right now. Could you try rephrasing or asking a different question?" };
      }
      return output;
    } catch (error) {
      console.error("Error in answerFinancialQuestionsFlow:", error, "Input:", promptInput);
      // This error will be caught by the frontend and display the generic message.
      // To provide a flow-specific fallback to the user (instead of frontend generic error):
      // return { answer: "I'm having a little trouble processing that. Please try rephrasing or ask another question."};
      throw error; // Re-throw to be caught by the frontend, which shows the "Sorry, I couldn't process..."
    }
  }
);
