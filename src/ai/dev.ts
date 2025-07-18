
import { config } from 'dotenv';
config();

import '@/ai/flows/summarize-financial-data.ts';
import '@/ai/flows/generate-financial-report.ts';
import '@/ai/flows/answer-financial-questions.ts';
import '@/ai/flows/summarize-conversation-flow.ts'; // Make sure this is imported if used by API

// Ensure tools are imported for registration with Genkit if they are used by any flows.
// The answerFinancialQuestions flow now uses these tools.
import '@/ai/tools/fetch-company-data-tool.ts';
import '@/ai/tools/fetch-document-gcs-tool.ts';
import '@/ai/tools/query-gen-app-builder-tool.ts';
