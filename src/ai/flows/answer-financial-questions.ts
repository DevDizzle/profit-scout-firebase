
'use server';

/**
 * @fileOverview A flow to answer general questions using a conversational AI.
 *
 * - answerFinancialQuestions - A function that answers questions based on the input.
 * - AnswerFinancialQuestionsInput - The input type for the answerFinancialQuestions function.
 * - AnswerFinancialQuestionsOutput - The return type for the answerFinancialQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const AnswerFinancialQuestionsInputSchema = z.object({
  question: z.string().describe('The user question to answer.'),
  companyName: z.string().optional().describe('The name of the company, if relevant (currently ignored by the simplified prompt).'),
});
export type AnswerFinancialQuestionsInput = z.infer<typeof AnswerFinancialQuestionsInputSchema>;

const AnswerFinancialQuestionsOutputSchema = z.object({
  answer: z.string().describe('The answer to the question.'),
});
export type AnswerFinancialQuestionsOutput = z.infer<typeof AnswerFinancialQuestionsOutputSchema>;

export async function answerFinancialQuestions(
  input: AnswerFinancialQuestionsInput
): Promise<AnswerFinancialQuestionsOutput> {
  console.log('[answerFinancialQuestions exported function] ENTERED. Input:', JSON.stringify(input));
  try {
    console.log('[answerFinancialQuestions exported function] Attempting to call answerFinancialQuestionsFlow with input:', input);
    const result = await answerFinancialQuestionsFlow(input);
    console.log('[answerFinancialQuestions exported function] Flow returned successfully:', JSON.stringify(result));
    return result;
  } catch (error) {
    const typedError = error as Error;
    console.error(
      "[answerFinancialQuestions exported function] CRITICAL ERROR DURING FLOW INVOCATION OR PROCESSING. Input:",
      JSON.stringify(input),
      "Error_Name:", typedError.name,
      "Error_Message:", typedError.message,
      "Error_Stack:", typedError.stack,
      "Full_Error_Object_Details:", JSON.stringify(error, Object.getOwnPropertyNames(error))
    );
    // Ensure the returned object matches the schema expected by the client
    return {
      answer: "An unexpected server-side error occurred while initiating the AI flow. The technical team has been notified. Please try again later."
    };
  }
}

const prompt = ai.definePrompt({
  name: 'answerFinancialQuestionsPrompt',
  input: {schema: AnswerFinancialQuestionsInputSchema},
  output: {schema: AnswerFinancialQuestionsOutputSchema},
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
    outputSchema: AnswerFinancialQuestionsOutputSchema,
  },
  async (input: AnswerFinancialQuestionsInput): Promise<AnswerFinancialQuestionsOutput> => {
    const promptInput = {
      question: input.question,
      // companyName is not used in the current simplified prompt, but good to pass if available
      // companyName: input.companyName,
    };
    console.log('[answerFinancialQuestionsFlow] ENTERED. Processing promptInput:', JSON.stringify(promptInput));

    try {
      console.log('[answerFinancialQuestionsFlow] Calling prompt with input:', promptInput);
      const {output} = await prompt(promptInput);

      if (!output || typeof output.answer === 'undefined') {
        console.warn("[answerFinancialQuestionsFlow] AI flow did not produce a valid output structure. Input:", promptInput, "Output from AI:", output);
        return { answer: "I'm having a little trouble formulating a response right now. Could you try rephrasing?" };
      }
      if (output.answer.trim() === "") {
         console.warn("[answerFinancialQuestionsFlow] AI flow produced an empty answer. Input:", promptInput, "Output from AI:", output);
         return { answer: "I received your message, but I don't have a specific response for that right now. How can I assist you with financial questions?" };
      }
      console.log('[answerFinancialQuestionsFlow] Received output from AI successfully:', JSON.stringify(output));
      return output;
    } catch (error) {
      const typedError = error as Error;
      console.error(
        "[answerFinancialQuestionsFlow] CRITICAL ERROR DURING AI PROMPT CALL. Input:",
        JSON.stringify(promptInput),
        "Error_Name:", typedError.name,
        "Error_Message:", typedError.message,
        "Error_Stack:", typedError.stack,
        "Full_Error_Object_Details:", JSON.stringify(error, Object.getOwnPropertyNames(error))
      );
      // Return a structured error response to the client instead of re-throwing
      return {
        answer: "I'm sorry, an unexpected error occurred while trying to process your request. The technical team has been notified. Please try again in a moment."
      };
    }
  }
);
