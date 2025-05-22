
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.error(
    '[genkit.ts] CRITICAL: GOOGLE_API_KEY not found in process.env. ' +
    'The Genkit googleAI plugin will likely fail to initialize. ' +
    'Ensure this environment variable is set in your deployment environment (e.g., Cloud Run).'
  );
} else {
  console.log('[genkit.ts] GOOGLE_API_KEY found in process.env and will be used by Genkit googleAI plugin.');
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: apiKey, // Explicitly pass the API key
    }),
  ],
  model: 'googleai/gemini-2.0-flash',
});

