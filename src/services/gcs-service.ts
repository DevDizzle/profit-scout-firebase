
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

/**
 * Lists files in a GCS bucket, optionally filtered by a prefix.
 * @param bucketName The name of the GCS bucket.
 * @param prefix The prefix to filter files by (e.g., 'financial-statements/ABBV/').
 * @returns A promise that resolves with an array of filenames.
 */
export async function listFiles(bucketName: string, prefix: string): Promise<string[]> {
  try {
    console.log(`[GCSService] Listing files in gs://${bucketName} with prefix '${prefix}'`);
    const [files] = await storage.bucket(bucketName).getFiles({ prefix });
    const fileNames = files.map(file => file.name);
    console.log(`[GCSService] Found ${fileNames.length} files with prefix '${prefix}' in gs://${bucketName}`);
    return fileNames;
  } catch (error) {
    console.error(`[GCSService] Error listing files from GCS (gs://${bucketName}/${prefix}):`, error);
    throw new Error(
      `Failed to list files from GCS (gs://${bucketName}/${prefix}): ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Extracts and returns the most recent file from a list of filenames based on date in the name.
 * Assumes filenames follow a pattern like 'TICKER_YYYY-MM-DD.json' or similar ending.
 * @param filePaths Full GCS paths like 'financial-statements/ABBV/ABBV_2022-12-31.json'
 * @param tickerSymbol The ticker symbol to ensure we're only looking at relevant files.
 * @returns The full path of the most recent file, or null if none found or dates are invalid.
 */
export function getMostRecentFile(filePaths: string[], tickerSymbol: string): string | null {
  let mostRecentFile: string | null = null;
  let maxDate: Date | null = null;

  const tickerPrefix = `${tickerSymbol}_`;

  for (const filePath of filePaths) {
    // Extract filename from path: e.g., 'ABBV_2022-12-31.json' from 'financial-statements/ABBV/ABBV_2022-12-31.json'
    const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);

    if (fileName.startsWith(tickerPrefix) && fileName.toLowerCase().endsWith('.json')) {
      // Extract date part: e.g., '2022-12-31' from 'ABBV_2022-12-31.json'
      const dateString = fileName.substring(tickerPrefix.length, fileName.toLowerCase().lastIndexOf('.json'));
      const currentDate = new Date(dateString);

      if (!isNaN(currentDate.getTime())) { // Check if date is valid
        if (!maxDate || currentDate > maxDate) {
          maxDate = currentDate;
          mostRecentFile = filePath; // Store the full path
        }
      }
    }
  }
  if (mostRecentFile) {
    console.log(`[GCSService getMostRecentFile] Most recent file for ${tickerSymbol} identified as: ${mostRecentFile}`);
  } else {
    console.log(`[GCSService getMostRecentFile] No valid recent file found for ${tickerSymbol} from list:`, filePaths);
  }
  return mostRecentFile;
}
