
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// The API key is read from environment variables by the build process.
// We use the same key as the Firebase client-side config, which is prefixed
// with NEXT_PUBLIC_ for availability across the Next.js app.
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

if (!apiKey) {
  console.error(
    '[genkit.ts] CRITICAL: NEXT_PUBLIC_FIREBASE_API_KEY not found. ' +
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
