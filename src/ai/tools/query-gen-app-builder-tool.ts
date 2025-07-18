/**
 * @fileOverview A Genkit tool for querying a Google Cloud Vertex AI Search Data Store.
 *
 * - queryGenAppBuilderTool - A Genkit tool that uses the Discovery Engine SDK to search a data store.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { SearchServiceClient } from '@google-cloud/discoveryengine';

// Gen App Builder details are expected to be provided via environment variables.
// You can find these IDs in your Google Cloud Console under
// "Vertex AI Search and Conversation".
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID;
const GCP_LOCATION = process.env.GCP_LOCATION;
const DATA_STORE_ID = process.env.DATA_STORE_ID;
const SERVING_CONFIG_ID = process.env.SERVING_CONFIG_ID;

// Validate environment variables on module load for early visibility
const missingEnvVars: string[] = [];
if (!GCP_PROJECT_ID) missingEnvVars.push('GCP_PROJECT_ID');
if (!GCP_LOCATION) missingEnvVars.push('GCP_LOCATION');
if (!DATA_STORE_ID) missingEnvVars.push('DATA_STORE_ID');
if (!SERVING_CONFIG_ID) missingEnvVars.push('SERVING_CONFIG_ID');
if (missingEnvVars.length > 0) {
  console.error(
    `[queryDataStore Tool] Missing required environment variable(s): ${missingEnvVars.join(', ')}. ` +
    'The queryDataStore tool will not work until these are provided.'
  );
}

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

    if (!GCP_PROJECT_ID || !GCP_LOCATION || !DATA_STORE_ID || !SERVING_CONFIG_ID) {
        const missing = [
            !GCP_PROJECT_ID && 'GCP_PROJECT_ID',
            !GCP_LOCATION && 'GCP_LOCATION',
            !DATA_STORE_ID && 'DATA_STORE_ID',
            !SERVING_CONFIG_ID && 'SERVING_CONFIG_ID',
        ].filter(Boolean).join(', ');
        const errorMessage = `[queryDataStore Tool] ERROR: Missing required environment variable(s): ${missing}.`;
        console.error(errorMessage);
        // Returning a structured error that the LLM can understand.
        return {
            results: [{
                source: 'Tool Configuration Error',
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
