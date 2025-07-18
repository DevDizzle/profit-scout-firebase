# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Environment Variables

1. Copy the provided `.env.example` file to `.env` in the project root:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your Firebase and Google Cloud values.

   - The `NEXT_PUBLIC_*` variables come from your Firebase project settings.
   - `GCP_PROJECT_ID`, `GCP_LOCATION`, `DATA_STORE_ID`, and `SERVING_CONFIG_ID` correspond to your Vertex AI Search (Gen App Builder) configuration.
   - `GOOGLE_APPLICATION_CREDENTIALS` should point to a service account key file if you are not relying on Application Default Credentials.
