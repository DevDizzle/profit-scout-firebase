/**
 * @fileOverview A Genkit tool for querying a Google Cloud Vertex AI Search Data Store.
 *
 * - queryGenAppBuilderTool - A Genkit tool that uses the Discovery Engine SDK to search a data store.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { SearchServiceClient } from '@google-cloud/discoveryengine';

// You will need to fill these in with your Gen App Builder details
// You can find these in your Google Cloud Console under "Vertex AI Search and Conversation"
const GCP_PROJECT_ID = 'YOUR_GCP_PROJECT_ID'; // e.g., 'my-gcp-project-123'
const GCP_LOCATION = 'global'; // e.g., 'global' or 'us-central1'
const DATA_STORE_ID = 'YOUR_DATA_STORE_ID'; // e.g., 'my-data-store_12345'
const SERVING_CONFIG_ID = 'default_search'; // Usually 'default_search' unless you created a custom one

// Initialize the Discovery Engine client
const discoveryEngineClient = new SearchServiceClient();

export const QueryGenAppBuilderInputSchema = z.object({
  query: z.string().describe('The search query to send to the data store.'),
});
export type QueryGenAppBuilderInput = z.infer<typeof QueryGenAppBuilderInputSchema>;

export const QueryGenAppBuilderOutputSchema = z.object({
    results: z.array(z.object({
        source: z.string().describe('The URI of the source document.'),
        snippet: z.string().describe('A relevant snippet from the document.'),
    })).describe('An array of search results from the data store.'),
});
export type QueryGenAppBuilderOutput = z.infer<typeof QueryGenAppBuilderOutputSchema>;

export const queryGenAppBuilderTool = ai.defineTool(
  {
    name: 'queryDataStore',
    description: 'Searches a specialized financial data store to find information about companies, market trends, and financial reports. Use this tool to find context to answer user questions.',
    inputSchema: QueryGenAppBuilderInputSchema,
    outputSchema: QueryGenAppBuilderOutputSchema,
  },
  async (input: QueryGenAppBuilderInput): Promise<QueryGenAppBuilderOutput> => {
    console.log(`[queryDataStore Tool] Called with query: "${input.query}"`);

    if (GCP_PROJECT_ID === 'YOUR_GCP_PROJECT_ID' || DATA_STORE_ID === 'YOUR_DATA_STORE_ID') {
        const errorMessage = "[queryDataStore Tool] ERROR: GCP_PROJECT_ID or DATA_STORE_ID are placeholders. Please update them in src/ai/tools/query-gen-app-builder-tool.ts.";
        console.error(errorMessage);
        // Returning a structured error that the LLM can understand.
        return {
            results: [{
                source: "Tool Configuration Error",
                snippet: `The tool is not configured. ${errorMessage}`,
            }],
        };
    }

    const servingConfig = `projects/${GCP_PROJECT_ID}/locations/${GCP_LOCATION}/collections/default_collection/dataStores/${DATA_STORE_ID}/servingConfigs/${SERVING_CONFIG_ID}`;

    try {
        const [response] = await discoveryEngineClient.search({
            servingConfig: servingConfig,
            query: input.query,
            pageSize: 5, // Limit to 5 results for conciseness
            contentSearchSpec: {
                snippetSpec: {
                    returnSnippet: true,
                },
                summarySpec: {
                    summaryResultCount: 3,
                    ignoreAdversarialQuery: true,
                    includeCitations: false,
                }
            },
        });
        
        console.log(`[queryDataStore Tool] Received ${response.results?.length ?? 0} results from Discovery Engine.`);

        const results = response.results?.map(result => {
            const document = result.document;
            const snippet = document?.derivedStructData?.fields?.extractive_answers?.listValue?.values?.[0]?.structValue?.fields?.content?.stringValue || "No snippet available.";
            return {
                source: document?.derivedStructData?.fields?.link?.stringValue || 'Unknown source',
                snippet: snippet,
            };
        }).filter(r => r.snippet !== "No snippet available.") ?? [];

        return { results };

    } catch (error) {
        console.error(`[queryDataStore Tool] Error querying Discovery Engine:`, error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while querying the data store.";
        // Return a structured error for the LLM
        return {
            results: [{
                source: "Tool Execution Error",
                snippet: `Failed to query the data store: ${errorMessage}`,
            }]
        };
    }
  }
);
