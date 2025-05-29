
import { NextRequest, NextResponse } from 'next/server';
import { summarizeConversation, type SummarizeConversationInput } from '@/ai/flows/summarize-conversation-flow';
import { getLatestConversationDataForSummarization, addSummaryToSession } from '@/services/firestore-service';
import { z } from 'zod';

const apiRequestSchema = z.object({
  sessionId: z.string(),
  queryId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = apiRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid request body', details: validationResult.error.format() }, { status: 400 });
    }

    const { sessionId, queryId } = validationResult.data;

    console.log(`[API /api/summarize-session] Received request for session: ${sessionId}, query: ${queryId}`);

    // 1. Fetch latest conversation data from Firestore
    const conversationData = await getLatestConversationDataForSummarization(sessionId);
    if (!conversationData.latestQuery && !conversationData.latestSynthesizerResponse) {
        console.warn(`[API /api/summarize-session] No significant conversation data found to summarize for session ${sessionId}.`);
        // Decide if this is an error or just means no summary needed yet
        return NextResponse.json({ summaryId: null, summaryText: "No new content to summarize." }, { status: 200 });
    }

    // Prepare input for the summarization flow
    // The summarization flow expects the *current* query and response, not just DB state.
    // This API is typically called *after* current query/response are saved.
    // So, getLatestConversationDataForSummarization should correctly pick them up.
    const summaryFlowInput: SummarizeConversationInput = {
      conversationContext: {
        previousSummaryText: conversationData.latestSummary?.summary_text,
        latestQueryText: conversationData.latestQuery?.text || "N/A", // Fallback if no query found
        latestSpecialistOutputText: conversationData.latestSpecialistOutput?.output_text,
        latestSynthesizerResponseText: conversationData.latestSynthesizerResponse?.response_text || "N/A", // Fallback
      }
    };
    
    console.log(`[API /api/summarize-session] Calling summarizeConversation flow for session: ${sessionId}`);
    // 2. Call Genkit flow to generate summary
    const summaryResult = await summarizeConversation(summaryFlowInput);

    if (!summaryResult || !summaryResult.summaryText) {
      console.error(`[API /api/summarize-session] Summarization flow did not return summary text for session: ${sessionId}`);
      return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
    }
    
    console.log(`[API /api/summarize-session] Summary generated for session ${sessionId}: "${summaryResult.summaryText.substring(0,50)}..."`);

    // 3. Save summary to Firestore
    const summaryId = await addSummaryToSession(sessionId, {
      summary_text: summaryResult.summaryText,
      query_id: queryId, // Link to the query that triggered this response cycle
    });
    
    console.log(`[API /api/summarize-session] Summary saved with ID: ${summaryId} for session: ${sessionId}`);

    // 4. Return summary
    return NextResponse.json({ summaryId, summaryText: summaryResult.summaryText }, { status: 200 });

  } catch (error) {
    const typedError = error as Error;
    console.error('[API /api/summarize-session] Error:', typedError.message, typedError.stack);
    return NextResponse.json({ error: 'Internal Server Error', details: typedError.message }, { status: 500 });
  }
}
