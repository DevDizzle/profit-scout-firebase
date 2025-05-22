
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
  const maskedApiKey = `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
  console.log(
    `[genkit.ts] GOOGLE_API_KEY found in process.env. Starts with: ${apiKey.substring(0, 4)}, Ends with: ${apiKey.substring(apiKey.length - 4)}, Length: ${apiKey.length}. It will be used by Genkit googleAI plugin.`
  );
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: apiKey, // Explicitly pass the API key
    }),
  ],
  model: 'googleai/gemini-2.0-flash',
});

