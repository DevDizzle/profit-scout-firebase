
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// The API key is read from environment variables by the build process.
// We directly use the variable here.
const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.error(
    '[genkit.ts] CRITICAL: GOOGLE_API_KEY not found. ' +
    'The Genkit googleAI plugin will likely fail to initialize. ' +
    'Ensure this environment variable is set in your .env file.'
  );
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: apiKey, // Pass the key directly to the plugin
    }),
  ],
  // This specifies the default model for text generation unless overridden.
  // It's good practice to set a default.
  model: 'googleai/gemini-1.5-flash',
});
