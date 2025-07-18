
import { NextRequest, NextResponse } from 'next/server';
import { summarizeConversation, type SummarizeConversationInput } from '@/ai/flows/summarize-conversation-flow';
import { z } from 'zod';
import admin from 'firebase-admin';
import type { FullConversationHistory, QueryEntry, SynthesizerResponseEntry, SummaryEntry } from '@/types/firestore';
import type { Timestamp } from 'firebase-admin/firestore'; // Import Timestamp from firebase-admin

// Initialize Firebase Admin SDK
// Ensure your service account key is set in the environment variables for deployed environments
// e.g., GOOGLE_APPLICATION_CREDENTIALS pointing to your service account JSON file,
// or ensure the Cloud Run service account has necessary IAM permissions.
if (!admin.apps.length) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID; // Ensure this var is available in Cloud Run env
  if (projectId) {
    admin.initializeApp({
      projectId: projectId,
    });
    console.log(`[API /api/summarize-session] Firebase Admin SDK Initialized for project: ${projectId}.`);
  } else {
    admin.initializeApp();
    console.warn('[API /api/summarize-session] Firebase Admin SDK Initialized without explicit projectId. Relying on ADC default. This could cause issues if the wrong project is targeted.');
  }
}

const firestoreAdmin = admin.firestore();

const apiRequestSchema = z.object({
  sessionId: z.string(),
  queryId: z.string(),
});

async function getAdminFullConversationHistory(sessionId: string): Promise<FullConversationHistory> {
  console.log(`[API Admin SDK] getFullConversationHistory called for session: ${sessionId}`);
  try {
    const queriesCol = firestoreAdmin
      .collection('sessions')
      .doc(sessionId)
      .collection('queries');
    
    const responsesCol = firestoreAdmin
      .collection('sessions')
      .doc(sessionId)
      .collection('synthesizer_responses');

    const summariesCol = firestoreAdmin
      .collection('sessions')
      .doc(sessionId)
      .collection('summaries');

    const queriesSnapshot = await queriesCol.orderBy('timestamp', 'asc').get();
    if (queriesSnapshot.empty) {
      console.log(`[API Admin SDK] No query documents found for session ${sessionId}.`);
    }
    const allQueries = queriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QueryEntry));

    const responsesSnapshot = await responsesCol.orderBy('timestamp', 'asc').get();
     if (responsesSnapshot.empty) {
      console.log(`[API Admin SDK] No synthesizer_response documents found for session ${sessionId}.`);
    }
    const allSynthesizerResponses = responsesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SynthesizerResponseEntry));
    
    const latestSummarySnapshot = await summariesCol.orderBy('timestamp', 'desc').limit(1).get();
    if (latestSummarySnapshot.empty) {
      console.log(`[API Admin SDK] No summary documents found for session ${sessionId}.`);
    }
    
    let latestSummary: SummaryEntry | null = null;
    if (!latestSummarySnapshot.empty) {
        latestSummary = { id: latestSummarySnapshot.docs[0].id, ...latestSummarySnapshot.docs[0].data() } as SummaryEntry;
    }

    console.log(`[API Admin SDK] Fetched for session ${sessionId}: ${allQueries.length} queries, ${allSynthesizerResponses.length} responses. Latest summary exists: ${!!latestSummary}`);
    return {
      allQueries,
      allSynthesizerResponses,
      latestSummary,
    };
  } catch (error) {
    const typedError = error as Error;
    console.error(
        `[API Admin SDK] Error fetching full conversation history for session ${sessionId}: Message: ${typedError.message}, Stack: ${typedError.stack}. Full error object:`, 
        JSON.stringify(error, Object.getOwnPropertyNames(error))
      );
    return { // Return empty/default data on error to prevent the API route from crashing
      allQueries: [],
      allSynthesizerResponses: [],
      latestSummary: null,
    };
  }
}

async function addAdminSummaryToSession(
  sessionId: string,
  data: Pick<SummaryEntry, 'summary_text' | 'query_id'>
): Promise<string> {
  const subColRef = firestoreAdmin
    .collection('sessions')
    .doc(sessionId)
    .collection('summaries');
  
  const docRef = await subColRef.add({
    ...data,
    timestamp: admin.firestore.FieldValue.serverTimestamp() as Timestamp, // Use FieldValue for server timestamp
  });
  return docRef.id;
}


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = apiRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid request body', details: validationResult.error.format() }, { status: 400 });
    }

    const { sessionId, queryId } = validationResult.data;

    console.log(`[API /api/summarize-session] Received request for session: ${sessionId}, query: ${queryId}`);

    // 1. Fetch full conversation data from Firestore using Admin SDK
    const conversationHistory = await getAdminFullConversationHistory(sessionId);
    
    if (conversationHistory.allQueries.length === 0 && conversationHistory.allSynthesizerResponses.length === 0) {
        console.warn(`[API /api/summarize-session] No significant conversation data found to summarize for session ${sessionId}. This might happen if the session ID is incorrect or if no queries/responses have been saved yet.`);
        // Still attempt to generate a summary if there's a previous one or a very first query.
        // The summarizeConversation flow should handle empty inputs gracefully.
    }

    // Construct fullChatHistory string
    let fullChatHistoryString = "";
    const mergedHistory: (QueryEntry | SynthesizerResponseEntry)[] = [];
    let qIdx = 0, rIdx = 0;

    const dbQueries = conversationHistory.allQueries;
    const dbResponses = conversationHistory.allSynthesizerResponses;

    while(qIdx < dbQueries.length || rIdx < dbResponses.length) {
      const queryEntry = dbQueries[qIdx];
      const responseEntry = dbResponses[rIdx];

      // Convert Firestore Timestamps to milliseconds for comparison - WITH ROBUST CHECKS
      const queryTimestampMs = (queryEntry?.timestamp as unknown as Timestamp)?.toMillis?.() ?? Infinity;
      const responseTimestampMs = (responseEntry?.timestamp as unknown as Timestamp)?.toMillis?.() ?? Infinity;

      if (queryEntry && queryTimestampMs <= responseTimestampMs) {
        mergedHistory.push(queryEntry);
        qIdx++;
      } else if (responseEntry) {
        mergedHistory.push(responseEntry);
        rIdx++;
      } else if (queryEntry) { // Only queries left
        mergedHistory.push(queryEntry);
        qIdx++;
      } else if (responseEntry) { // Only responses left
        mergedHistory.push(responseEntry);
        rIdx++;
      } else { // Should not happen if loop condition is correct
        break;
      }
    }

    fullChatHistoryString = mergedHistory.map(turn => {
      if ('text' in turn && turn.text) return `User: ${turn.text}`;
      if ('response_text' in turn && turn.response_text) return `AI: ${turn.response_text}`;
      return '';
    }).filter(Boolean).join('\n');
    
    console.log(`[API /api/summarize-session] Constructed fullChatHistoryString (length ${fullChatHistoryString.length}): "${fullChatHistoryString.substring(0,200)}..."`);

    const latestQuery = conversationHistory.allQueries.length > 0 
        ? conversationHistory.allQueries[conversationHistory.allQueries.length - 1] 
        : null;
    const latestResponse = conversationHistory.allSynthesizerResponses.length > 0
        ? conversationHistory.allSynthesizerResponses[conversationHistory.allSynthesizerResponses.length -1]
        : null;

    if (!latestQuery || !latestResponse) {
        console.warn(`[API /api/summarize-session] Missing latest query or response for session ${sessionId}. This is unusual if summarization is triggered after a response. Query found: ${!!latestQuery}, Response found: ${!!latestResponse}`);
        // Avoid calling summarize if core components are missing.
        return NextResponse.json({ error: 'Cannot summarize without latest query and response data.' }, { status: 400 });
    }


    const summaryFlowInput: SummarizeConversationInput = {
      previousSummaryText: conversationHistory.latestSummary?.summary_text,
      fullChatHistory: fullChatHistoryString,
      latestQueryText: latestQuery.text,
      latestSynthesizerResponseText: latestResponse.response_text,
    };
    
    console.log(`[API /api/summarize-session] Calling summarizeConversation flow for session: ${sessionId}. Input includes: previousSummary (${!!summaryFlowInput.previousSummaryText}), fullChatHistory length (${summaryFlowInput.fullChatHistory.length}), latestQuery ("${summaryFlowInput.latestQueryText.substring(0,50)}..."), latestResponse ("${summaryFlowInput.latestSynthesizerResponseText.substring(0,50)}...")`);
    
    // 2. Call Genkit flow to generate summary
    const summaryResult = await summarizeConversation(summaryFlowInput);

    if (!summaryResult || !summaryResult.summaryText) {
      console.error(`[API /api/summarize-session] Summarization flow did not return valid summary text for session: ${sessionId}. Summary result:`, summaryResult);
      // Still save an empty summary or a marker? Or return error?
      // For now, let's return an error if summarization truly fails to produce text.
      return NextResponse.json({ error: 'Failed to generate summary text from AI flow.' }, { status: 500 });
    }
    
    console.log(`[API /api/summarize-session] Summary generated for session ${sessionId}: "${summaryResult.summaryText.substring(0,70)}..."`);

    // 3. Save summary to Firestore using Admin SDK
    const summaryId = await addAdminSummaryToSession(sessionId, {
      summary_text: summaryResult.summaryText,
      query_id: queryId, 
    });
    
    console.log(`[API /api/summarize-session] Summary saved with ID: ${summaryId} for session: ${sessionId}`);

    // 4. Return summary
    return NextResponse.json({ summaryId, summaryText: summaryResult.summaryText }, { status: 200 });

  } catch (error) {
    const typedError = error as Error;
    console.error('[API /api/summarize-session] Unhandled error in POST handler:', typedError.message, typedError.stack, JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return NextResponse.json({ error: 'Internal Server Error in summarize-session API.', details: typedError.message }, { status: 500 });
  }
}

    
