
import { NextRequest, NextResponse } from 'next/server';
import { summarizeConversation, type SummarizeConversationInput } from '@/ai/flows/summarize-conversation-flow';
import { z } from 'zod';
import admin from 'firebase-admin';
import type { FullConversationHistory, QueryEntry, SynthesizerResponseEntry, SummaryEntry } from '@/types/firestore';
import type { Timestamp } from 'firebase-admin/firestore'; // Import Timestamp from firebase-admin

// Initialize Firebase Admin SDK
// Ensure your service account key is set in the environment variables for deployed environments
// e.g., GOOGLE_APPLICATION_CREDENTIALS pointing to your service account JSON file.
// For local development, this will also use GOOGLE_APPLICATION_CREDENTIALS if set,
// or fall back to other ADC methods.
if (!admin.apps.length) {
  admin.initializeApp({
    // If using a service account key directly (less common for Cloud Run/Functions):
    // credential: admin.credential.cert(require('./path/to/your/serviceAccountKey.json')),
    // projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, // Ensure this is your target project
  });
  console.log('[API /api/summarize-session] Firebase Admin SDK Initialized.');
}

const firestoreAdmin = admin.firestore();

const apiRequestSchema = z.object({
  sessionId: z.string(),
  queryId: z.string(),
});

async function getAdminFullConversationHistory(sessionId: string): Promise<FullConversationHistory> {
  console.log(`[API Admin SDK] getFullConversationHistory called for session: ${sessionId}`);
  try {
    const queriesSnapshot = await firestoreAdmin
      .collection('sessions')
      .doc(sessionId)
      .collection('queries')
      .orderBy('timestamp', 'asc')
      .get();
    const allQueries = queriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QueryEntry));

    const responsesSnapshot = await firestoreAdmin
      .collection('sessions')
      .doc(sessionId)
      .collection('synthesizer_responses')
      .orderBy('timestamp', 'asc')
      .get();
    const allSynthesizerResponses = responsesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SynthesizerResponseEntry));
    
    const latestSummarySnapshot = await firestoreAdmin
        .collection('sessions')
        .doc(sessionId)
        .collection('summaries')
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();
    
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
    console.error(`[API Admin SDK] Error fetching full conversation history for session ${sessionId}:`, typedError.message, typedError.stack);
    return {
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
    timestamp: admin.firestore.FieldValue.serverTimestamp() as Timestamp,
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
        console.warn(`[API /api/summarize-session] No significant conversation data found to summarize for session ${sessionId}.`);
        return NextResponse.json({ summaryId: null, summaryText: "No new content to summarize." }, { status: 200 });
    }

    // Construct fullChatHistory string
    let fullChatHistoryString = "";
    const mergedHistory: (QueryEntry | SynthesizerResponseEntry)[] = [];
    let qIdx = 0, rIdx = 0;

    const dbQueries = conversationHistory.allQueries;
    const dbResponses = conversationHistory.allSynthesizerResponses;

    while(qIdx < dbQueries.length || rIdx < dbResponses.length) {
      const query = dbQueries[qIdx];
      const response = dbResponses[rIdx];

      // Convert Firestore Timestamps to milliseconds for comparison
      const queryTimestampMs = query ? (query.timestamp as unknown as Timestamp).toMillis() : Infinity;
      const responseTimestampMs = response ? (response.timestamp as unknown as Timestamp).toMillis() : Infinity;

      if (query && queryTimestampMs <= responseTimestampMs) {
        mergedHistory.push(query);
        qIdx++;
      } else if (response) {
        mergedHistory.push(response);
        rIdx++;
      }
    }

    fullChatHistoryString = mergedHistory.map(turn => {
      if ('text' in turn) return `User: ${turn.text}`; // QueryEntry
      if ('response_text' in turn) return `AI: ${turn.response_text}`; // SynthesizerResponseEntry
      return '';
    }).join('\n');

    const latestQuery = conversationHistory.allQueries.length > 0 
        ? conversationHistory.allQueries[conversationHistory.allQueries.length - 1] 
        : null;
    const latestResponse = conversationHistory.allSynthesizerResponses.length > 0
        ? conversationHistory.allSynthesizerResponses[conversationHistory.allSynthesizerResponses.length -1]
        : null;

    const summaryFlowInput: SummarizeConversationInput = {
      previousSummaryText: conversationHistory.latestSummary?.summary_text,
      fullChatHistory: fullChatHistoryString,
      latestQueryText: latestQuery?.text || "N/A",
      latestSynthesizerResponseText: latestResponse?.response_text || "N/A",
    };
    
    console.log(`[API /api/summarize-session] Calling summarizeConversation flow for session: ${sessionId}. Input includes: previousSummary (${!!summaryFlowInput.previousSummaryText}), fullChatHistory length (${summaryFlowInput.fullChatHistory.length}), latestQuery ("${summaryFlowInput.latestQueryText.substring(0,50)}..."), latestResponse ("${summaryFlowInput.latestSynthesizerResponseText.substring(0,50)}...")`);
    
    // 2. Call Genkit flow to generate summary
    const summaryResult = await summarizeConversation(summaryFlowInput);

    if (!summaryResult || !summaryResult.summaryText) {
      console.error(`[API /api/summarize-session] Summarization flow did not return summary text for session: ${sessionId}`);
      return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
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
    console.error('[API /api/summarize-session] Error:', typedError.message, typedError.stack, JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return NextResponse.json({ error: 'Internal Server Error', details: typedError.message }, { status: 500 });
  }
}
