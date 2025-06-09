
import { NextRequest, NextResponse } from 'next/server';
import { VertexAI } from '@google-cloud/vertex-ai';
import { z } from 'zod';
import { blackScholes } from 'black-scholes';

// Zod Schema for validating the agent's response structure
// Adjust this schema based on the actual JSON structure your Vertex AI agent returns
const AgentResponseSchema = z.object({
  recommendation: z.enum(['Buy', 'Sell', 'Hold']),
  reason: z.string(),
  // Add other fields your agent might return, e.g., confidence, price_target
});
export type AgentResponseType = z.infer<typeof AgentResponseSchema>;

interface OTMCallSuggestion {
  strike: number;
  optionPrice: number | string; // blackScholes can return NaN, handle as string for "N/A"
  days_to_expiry: number;
}

// Placeholder for actual agent interaction details
// You MUST replace these with your actual project, location, and agent model ID/endpoint.
const GCP_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'your-gcp-project-id';
const GCP_LOCATION = 'us-central1'; // Or your agent's location
const AGENT_MODEL_ID = 'your-agent-model-id'; // This is the ID of your deployed reasoning engine or model

async function queryFinancialAgent(ticker: string): Promise<AgentResponseType | null> {
  if (!GCP_PROJECT_ID || GCP_PROJECT_ID === 'your-gcp-project-id' || !AGENT_MODEL_ID || AGENT_MODEL_ID === 'your-agent-model-id') {
    console.error('[API stock-recommendation] Missing GCP_PROJECT_ID or AGENT_MODEL_ID configuration.');
    // Simulating a generic response for local development if not configured
    // In a real scenario, you'd throw an error or handle this more robustly.
    if (process.env.NODE_ENV === 'development') {
        console.warn('[API stock-recommendation] Development mode: Returning mock agent response due to missing configuration.');
        return {
            recommendation: 'Hold',
            reason: `Mock response for ${ticker}: Agent not fully configured. Market conditions are mixed.`,
        };
    }
    throw new Error('Vertex AI agent is not configured.');
  }

  const vertexAI = new VertexAI({ project: GCP_PROJECT_ID, location: GCP_LOCATION });
  
  // This model ID should be your deployed reasoning engine's ID.
  // Example: 'projects/your-project-id/locations/us-central1/reasoningEngines/your-engine-id'
  // Or if it's a standard generative model: 'gemini-pro' etc.
  // For an agent, it's usually the reasoningEngine full path.
  const generativeModel = vertexAI.getGenerativeModel({
    model: AGENT_MODEL_ID, // Or the full resource name of the reasoning engine
  });

  // Customize this prompt according to your agent's expected input and your desired output.
  const prompt = `For ticker ${ticker}, provide a financial analysis including a buy/sell/hold recommendation, a brief reason. Format the output as a JSON object.`;

  try {
    const result = await generativeModel.generateContent(prompt);
    const response = result.response;
    
    if (!response.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error('[API stock-recommendation] No text part in agent response for ticker:', ticker, JSON.stringify(response, null, 2));
      throw new Error('Agent returned an empty or invalid response structure.');
    }

    const rawTextResponse = response.candidates[0].content.parts[0].text;
    console.log('[API stock-recommendation] Raw text response from agent for', ticker, ':', rawTextResponse);

    // Attempt to parse the text response as JSON
    let parsedJsonResponse;
    try {
      parsedJsonResponse = JSON.parse(rawTextResponse);
    } catch (parseError) {
      console.error('[API stock-recommendation] Failed to parse agent response as JSON for ticker:', ticker, rawTextResponse, parseError);
      throw new Error('Agent response was not valid JSON.');
    }
    
    // Validate with Zod
    const validationResult = AgentResponseSchema.safeParse(parsedJsonResponse);
    if (!validationResult.success) {
      console.error('[API stock-recommendation] Zod validation failed for agent response:', ticker, validationResult.error.format(), 'Raw JSON:', parsedJsonResponse);
      throw new Error('Agent response did not match expected schema.');
    }
    
    return validationResult.data;

  } catch (error) {
    const typedError = error as Error;
    console.error(`[API stock-recommendation] Error querying Vertex AI agent for ${ticker}:`, typedError.message, typedError.stack);
    // For development, you might return a mock error or a specific structure
    if (process.env.NODE_ENV === 'development') {
        return {
            recommendation: 'Hold',
            reason: `Error fetching real data for ${ticker}: ${typedError.message}. Showing mock data.`,
        };
    }
    throw error; // Re-throw for production to be caught by the handler
  }
}

// Dummy function for OTM call suggestion, replace with actual data/logic
// You'll need current stock price, volatility, risk-free rate for blackScholes
function suggestOtmCall(ticker: string, currentPrice: number | undefined, volatility: number | undefined): OTMCallSuggestion | null {
  if (typeof currentPrice !== 'number' || typeof volatility !== 'number') {
    // console.warn(`[API stock-recommendation] Missing currentPrice or volatility for ${ticker}, cannot suggest OTM call.`);
    return null; // Or provide a default/error message
  }
  
  const daysToExpiry = 60;
  const riskFreeRate = 0.02; // Example: 2% annual risk-free rate
  const strikePrice = currentPrice * 1.15; // 15% OTM

  try {
    const optionPrice = blackScholes(
      currentPrice,
      strikePrice,
      daysToExpiry / 365, // time to expiration in years
      volatility, // e.g., 0.2 for 20% annualized volatility
      riskFreeRate,
      'call'
    );
    return {
      strike: parseFloat(strikePrice.toFixed(2)),
      optionPrice: !isNaN(optionPrice) ? parseFloat(optionPrice.toFixed(2)) : "N/A",
      days_to_expiry: daysToExpiry,
    };
  } catch (e) {
    console.error(`[API stock-recommendation] Error calculating Black-Scholes for ${ticker}:`, e);
    return null;
  }
}

export async function GET(request: NextRequest, { params }: { params: { ticker: string } }) {
  const { ticker } = params;

  if (!ticker) {
    return NextResponse.json({ error: 'Ticker symbol is required' }, { status: 400 });
  }

  try {
    const agentData = await queryFinancialAgent(ticker.toUpperCase());
    
    if (!agentData) {
         return NextResponse.json({ error: `No data found for ${ticker}. Agent might be misconfigured or returned empty.` }, { status: 404 });
    }

    // Dummy data for currentPrice and volatility for OTM call suggestion
    // In a real app, fetch this from a market data API or your GCS data
    const marketData = {
      [ticker.toUpperCase()]: { currentPrice: 150, volatility: 0.30 } // Example
    };
    const stockMarketData = marketData[ticker.toUpperCase()];

    const otmSuggestion = suggestOtmCall(
        ticker.toUpperCase(), 
        stockMarketData?.currentPrice, 
        stockMarketData?.volatility
    );

    return NextResponse.json({
      ticker: ticker.toUpperCase(),
      ...agentData,
      otm_call_suggestion: otmSuggestion,
    });

  } catch (error) {
    const typedError = error as Error
    console.error(`[API stock-recommendation] Handler error for ${ticker}:`, typedError);
    return NextResponse.json({ error: `Failed to get recommendation for ${ticker}: ${typedError.message}` }, { status: 500 });
  }
}
