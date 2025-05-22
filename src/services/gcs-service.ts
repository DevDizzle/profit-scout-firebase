
'use server';
/**
 * @fileOverview Service for interacting with Google Cloud Storage (GCS).
 *
 * - readTextFileFromGCS - Reads a text file from a GCS bucket.
 */

import { Storage } from '@google-cloud/storage';
import { z } from 'zod';

const storage = new Storage(); // Assumes Application Default Credentials

export const GCSFileRequestSchema = z.object({
  bucketName: z.string().describe('The name of the GCS bucket.'),
  fileName: z.string().describe('The name of the file in the GCS bucket (including any paths).'),
});
export type GCSFileRequest = z.infer<typeof GCSFileRequestSchema>;


/**
 * Reads the content of a text file from a GCS bucket.
 * @param bucketName The name of the GCS bucket.
 * @param fileName The name (path) of the file within the bucket.
 * @returns A promise that resolves with the string content of the file.
 * @throws Error if the file cannot be read or does not exist.
 */
export async function readTextFileFromGCS(
  bucketName: string,
  fileName: string
): Promise<string> {
  try {
    console.log(`[GCSService] Attempting to read gs://${bucketName}/${fileName}`);
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);

    const [exists] = await file.exists();
    if (!exists) {
      console.error(`[GCSService] File not found: gs://${bucketName}/${fileName}`);
      throw new Error(`File not found: gs://${bucketName}/${fileName}`);
    }

    const [content] = await file.download();
    console.log(`[GCSService] Successfully read file gs://${bucketName}/${fileName}`);
    return content.toString('utf-8');
  } catch (error) {
    console.error(`[GCSService] Error reading file from GCS (gs://${bucketName}/${fileName}):`, error);
    if (error instanceof Error && error.message.includes('bucket not found')) {
        throw new Error(`Bucket not found: ${bucketName}. Ensure the bucket exists and the application has 'storage.buckets.get' permission.`);
    }
    if (error instanceof Error && error.message.includes('does not have storage.objects.get access')) {
        throw new Error(`Permission denied for gs://${bucketName}/${fileName}. Ensure the service account has 'Storage Object Viewer' role or equivalent.`);
    }
    throw new Error(
      `Failed to read file from GCS (gs://${bucketName}/${fileName}): ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
