
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

// Input schema can remain, but companyName will be ignored by the simplified prompt
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
  return answerFinancialQuestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'answerFinancialQuestionsPrompt',
  input: {schema: AnswerFinancialQuestionsInputSchema},
  output: {schema: AnswerFinancialQuestionsOutputSchema},
  // Tools have been removed
  system: `You are a friendly and helpful conversational AI assistant.
- Respond politely and conversationally to the user's questions.
- If the user provides a simple greeting (e.g., "Hi", "Hello"), respond in kind.
- Always ensure your final response strictly adheres to the output schema, providing only the 'answer' field as a string. Do not add any preamble or explanation outside of the 'answer' field.`,
  prompt: `User question: {{{question}}}`,
});

const answerFinancialQuestionsFlow = ai.defineFlow(
  {
    name: 'answerFinancialQuestionsFlow',
    inputSchema: AnswerFinancialQuestionsInputSchema,
    outputSchema: AnswerFinancialQuestionsOutputSchema,
  },
  async (input: AnswerFinancialQuestionsInput) => {
    // companyName from input is available but will be ignored by the simplified prompt
    const promptInput = {
      question: input.question,
      companyName: input.companyName, // Pass it along, though the prompt won't use it for tools
    };

    try {
      console.log('[answerFinancialQuestionsFlow] Calling prompt with input:', promptInput);
      const {output} = await prompt(promptInput);
      
      if (!output || typeof output.answer === 'undefined') {
        console.warn("[answerFinancialQuestionsFlow] AI flow did not produce a valid output structure. Input:", promptInput, "Output from AI:", output);
        return { answer: "I'm having a little trouble formulating a response right now. Could you try rephrasing?" };
      }
      if (output.answer.trim() === "") {
         console.warn("[answerFinancialQuestionsFlow] AI flow produced an empty answer. Input:", promptInput, "Output from AI:", output);
         // You might want to provide a more specific message or try a different approach
         return { answer: "I received your message, but I don't have a specific response for that right now." };
      }
      console.log('[answerFinancialQuestionsFlow] Received output from AI:', output);
      return output;
    } catch (error) {
      console.error("[answerFinancialQuestionsFlow] Error during AI prompt call:", error, "Input:", promptInput);
      // It's often better to let the calling function (e.g., chat UI) handle the display of a generic error
      // by re-throwing, but for debugging, you could return a specific error message here.
      // For now, re-throw so the chat UI's catch block handles it.
      throw error; 
    }
  }
);
