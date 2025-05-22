
import { config } from 'dotenv';
config();

import '@/ai/flows/summarize-financial-data.ts';
import '@/ai/flows/generate-financial-report.ts';
import '@/ai/flows/answer-financial-questions.ts';
import '@/ai/tools/fetch-company-data-tool.ts';
import '@/ai/tools/fetch-document-gcs-tool.ts'; // Added new tool
