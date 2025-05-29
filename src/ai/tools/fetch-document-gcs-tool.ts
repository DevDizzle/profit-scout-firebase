
/**
 * @fileOverview A Genkit tool for fetching document content from Google Cloud Storage.
 *
 * - fetchDocumentFromGCSTool - A Genkit tool that uses the GCS service to retrieve file content.
 */
import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { readTextFileFromGCS, GCSFileRequestSchema } from '@/services/gcs-service';

export const FetchDocumentGCSInputSchema = GCSFileRequestSchema;
export type FetchDocumentGCSInput = z.infer<typeof FetchDocumentGCSInputSchema>;

export const FetchDocumentGCSOutputSchema = z.object({
  fileContent: z.string().describe('The text content of the fetched file from GCS.'),
  sourcePath: z.string().describe('The GCS path of the fetched file, e.g., gs://bucket-name/file-name.txt'),
});
export type FetchDocumentGCSOutput = z.infer<typeof FetchDocumentGCSOutputSchema>;

export const fetchDocumentFromGCSTool = ai.defineTool(
  {
    name: 'fetchDocumentFromGCS',
    description: 'Fetches the text content of a specified file from a Google Cloud Storage bucket. Use this to retrieve documents, reports, or data files stored in GCS when you know the bucket and file name.',
    inputSchema: FetchDocumentGCSInputSchema,
    outputSchema: FetchDocumentGCSOutputSchema,
  },
  async (input: FetchDocumentGCSInput): Promise<FetchDocumentGCSOutput> => {
    console.log(`[FetchDocumentGCSTool] Called with input: ${JSON.stringify(input)}`);
    try {
      const content = await readTextFileFromGCS(input.bucketName, input.fileName);
      return {
        fileContent: content,
        sourcePath: `gs://${input.bucketName}/${input.fileName}`,
      };
    } catch (error) {
      console.error(`[FetchDocumentGCSTool] Error fetching GCS document:`, error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while fetching the document from GCS.";
      throw new Error(`Tool fetchDocumentFromGCS failed: ${errorMessage}`);
    }
  }
);
