
'use server';

/**
 * @fileOverview A flow to answer general questions using a conversational AI.
 * It first uses a selector LLM to identify relevant data sources based on the user's query and provided metadata.
 * Then, it uses an answer LLM, equipped with tools to fetch data from these sources, to generate the final response.
 * Context (conversation summary) is passed by the client. Summarization is triggered via a separate API endpoint.
 *
 * - answerFinancialQuestions - A function that answers questions.
 * - AnswerFinancialQuestionsInput - The input type for the answerFinancialQuestions function.
 * - AnswerFinancialQuestionsOutput - The return type for the answerFinancialQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { fetchDocumentFromGCSTool } from '@/ai/tools/fetch-document-gcs-tool';
import { fetchCompanyDataTool } from '@/ai/tools/fetch-company-data-tool';
import { queryGenAppBuilderTool } from '@/ai/tools/query-gen-app-builder-tool';

const AnswerFinancialQuestionsInputSchema = z.object({
  question: z.string().describe('The user question to answer.'),
  companyName: z.string().optional().describe('The name of the company, if relevant.'),
  sessionId: z.string().describe("The active Firestore session ID for context."),
  queryId: z.string().describe("The ID of the current user query in Firestore. Not directly used by this flow but passed by client."),
  conversationSummary: z.string().optional().describe("A summary of the preceding conversation context, if available, provided by the client."),
});
export type AnswerFinancialQuestionsInput = z.infer<typeof AnswerFinancialQuestionsInputSchema>;

const AnswerFinancialQuestionsOutputSchema = z.object({
  answer: z.string().describe('The answer to the question.'),
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
    };
  }
}

// Selector Prompt Schemas & Definition
const SelectorInputSchema = z.object({
  userQuery: z.string(),
  availableDataMetadataJson: z.string().describe("A JSON string describing available data files, their GCS paths, and brief descriptions."),
});

const SelectorOutputSchema = z.object({
  relevantDataSources: z.array(z.string().url().describe("GCS URLs of relevant documents")).describe("A list of GCS URLs pointing to relevant data sources."),
});

const selectorPrompt = ai.definePrompt({
  name: 'financialDataSelectorPrompt',
  input: { schema: SelectorInputSchema },
  output: { schema: SelectorOutputSchema },
  system: `You are an intelligent data selector for a financial AI assistant. Based on the user's query and the provided JSON metadata of available financial documents, identify the GCS links of the most relevant sources to answer the query.
Return ONLY a JSON object matching the output schema: { "relevantDataSources": ["gs://...", "gs://..."] }.
If no specific documents are relevant, return an empty array for "relevantDataSources".
Prioritize documents explicitly mentioned or implied by the query. Consider the type of information requested (e.g., earnings call details, annual financial statements, specific company data).`,
  prompt: `User Query: {{{userQuery}}}

Available Data Metadata (JSON):
\`\`\`json
{{{availableDataMetadataJson}}}
\`\`\`
`,
  config: { 
    temperature: 0.0, // For deterministic selection
    safetySettings: [ // Copied from mainAnswerPrompt for consistency
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  } 
});


// Main Answer Prompt Schemas & Definition
const MainAnswerPromptInputSchema = z.object({
  question: z.string(),
  companyName: z.string().optional(),
  conversationSummary: z.string().optional().describe("A summary of the preceding conversation context, if available."),
  relevantDataSources: z.array(z.string().url()).optional().describe("Optional list of GCS URLs for context documents."),
});

const mainAnswerPrompt = ai.definePrompt({
  name: 'answerFinancialQuestionsMainPrompt',
  input: {schema: MainAnswerPromptInputSchema},
  output: {schema: z.object({ answer: z.string() })},
  tools: [fetchDocumentFromGCSTool, fetchCompanyDataTool, queryGenAppBuilderTool],
  system: `You are a friendly and helpful conversational AI assistant for ProfitScout. Your role is to answer user questions about finance and companies by intelligently using the tools at your disposal.

GENERAL INSTRUCTIONS:
- Respond politely and conversationally.
- If a user provides a simple greeting (e.g., "Hi", "Hello"), respond in kind and briefly offer assistance.
- If a question is unclear, ask for clarification.
- Use the 'Previous Conversation Summary' to maintain context.

TOOL USAGE INSTRUCTIONS:
You have access to three tools to gather information. The output from these tools will be in JSON format. You must process this JSON data to formulate a human-readable answer.

1.  **'queryDataStore'**: This is your primary tool. Use it to search a specialized financial data store with the user's question to get relevant data snippets.
2.  **'fetchDocumentFromGCS'**: If specific GCS documents are identified as relevant (listed below), use this tool to retrieve their full text content. Provide the GCS path (e.g., "gs://bucket/file.txt").
3.  **'fetchCompanyData'**: Use this tool to get general, up-to-date information about a specific company if its name is mentioned.

- **After calling a tool and receiving JSON data, DO NOT simply output the raw JSON.** Synthesize the information from the JSON fields (like 'snippet', 'fileContent', 'companyData') into a coherent, natural language answer.
- Briefly mention the source of the information if it adds credibility (e.g., "According to the Q4 earnings call transcript...", "I found in our data store that...").
- Always ensure your final response strictly adheres to the output schema, providing only the 'answer' field as a string.

{{#if relevantDataSources.length}}
- You can consult the following relevant data sources using the 'fetchDocumentFromGCS' tool.
  Relevant Data Sources:
  {{#each relevantDataSources}}
  - {{{this}}}
  {{/each}}
{{else}}
- No specific GCS documents were identified as primarily relevant for this query. Rely on 'queryDataStore' and 'fetchCompanyData' to find an answer.
{{/if}}`,
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
    const { sessionId, question, companyName, queryId, conversationSummary } = input;
    
    console.log(`[answerFinancialQuestionsFlow] ENTERED. Processing input. SessionID: ${sessionId}, QueryID: ${queryId}`);
    if (conversationSummary) {
      console.log(`[answerFinancialQuestionsFlow] Using conversation summary provided by client: "${conversationSummary.substring(0,70)}..."`);
    } else {
      console.log('[answerFinancialQuestionsFlow] No conversation summary provided by client for prompt context.');
    }
    
    // Placeholder for available data metadata. In a real system, this would come from a database or GCS listing.
    // Ensure GCS paths are valid if you intend for fetchDocumentFromGCSTool to actually work with them.
    const placeholderAvailableDataMetadataJson = JSON.stringify({
      "documents": [
        { "name": "Microsoft Q4 2023 Earnings Call Transcript", "gcsPath": "gs://profitscout-data-public/MSFT_Q4_2023_Earnings_Transcript_mock.txt", "description": "Transcript of Microsoft's Q4 2023 earnings call discussing financial performance and future outlook." },
        { "name": "Apple Inc. 10-K Annual Report 2023", "gcsPath": "gs://profitscout-data-public/AAPL_10K_2023_mock.txt", "description": "Apple's annual 10-K filing for fiscal year 2023, detailing financial statements and business operations." },
        { "name": "Google Q1 2024 Financial Summary", "gcsPath": "gs://profitscout-data-public/GOOG_Q1_2024_Financial_Summary_mock.txt", "description": "A summary document outlining Google's key financial results for the first quarter of 2024." },
        { "name": "General Market Analysis Q2 2024", "gcsPath": "gs://profitscout-data-public/Market_Analysis_Q2_2024_mock.txt", "description": "Broad overview of market trends and economic indicators for Q2 2024."}
      ],
      "data_tools": [
        { "name": "fetchCompanyDataTool", "description": "Tool to fetch generic, up-to-date information about a specific company by its name or ticker symbol."}
      ]
    }, null, 2);

    let relevantDataSources: string[] = [];
    try {
      console.log(`[answerFinancialQuestionsFlow] Calling selectorPrompt for query: "${question.substring(0,100)}..."`);
      const selectorInput = { userQuery: question, availableDataMetadataJson: placeholderAvailableDataMetadataJson };
      const { output: selectorOutput } = await selectorPrompt(selectorInput);

      if (selectorOutput?.relevantDataSources && selectorOutput.relevantDataSources.length > 0) {
        relevantDataSources = selectorOutput.relevantDataSources;
        console.log(`[answerFinancialQuestionsFlow] Selector identified relevant GCS sources:`, relevantDataSources);
      } else {
        console.log('[answerFinancialQuestionsFlow] Selector did not identify specific relevant GCS sources.');
      }
    } catch (selectorError) {
      const typedError = selectorError as Error;
      console.error(`[answerFinancialQuestionsFlow] Error in selectorPrompt. Query: "${question.substring(0,100)}...". Error: ${typedError.message}`, typedError.stack);
      // Continue without specific GCS documents if selector fails, main prompt can still try to answer generally
    }
    
    const promptInputForAnswer = { 
      question, 
      companyName, 
      conversationSummary,
      relevantDataSources, // Pass the selected GCS sources
    };
    
    let synthesizerResponseText: string;

    try {
      console.log('[answerFinancialQuestionsFlow] Calling mainAnswerPrompt with input including selected GCS sources and new Data Store tool.');
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
      throw error; 
    }

    console.log(`[answerFinancialQuestionsFlow] Returning answer: "${synthesizerResponseText.substring(0,70)}..."`);
    return { answer: synthesizerResponseText };
  }
);
