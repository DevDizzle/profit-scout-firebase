
'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, TrendingUp, TrendingDown, MinusCircle } from 'lucide-react';
import type { AgentResponseType } from '@/app/api/stock-recommendation/[ticker]/route'; // Adjust path if needed

interface OTMCallSuggestion {
  strike: number;
  optionPrice: number | string;
  days_to_expiry: number;
}
interface StockRecommendationData extends AgentResponseType {
  ticker: string;
  otm_call_suggestion: OTMCallSuggestion | null;
}

async function fetchStockRecommendation(ticker: string): Promise<StockRecommendationData> {
  if (!ticker) throw new Error("Ticker symbol cannot be empty.");
  const response = await fetch(`/api/stock-recommendation/${ticker}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Failed to fetch recommendation and parse error."}));
    throw new Error(errorData.error || `Network response was not ok: ${response.statusText}`);
  }
  return response.json();
}

interface StockRecommendationProps {
  ticker: string;
}

export function StockRecommendation({ ticker }: StockRecommendationProps) {
  const { data, isLoading, error, isError } = useQuery<StockRecommendationData, Error>({
    queryKey: ['stockRecommendation', ticker],
    queryFn: () => fetchStockRecommendation(ticker),
    enabled: !!ticker, // Only run query if ticker is provided
    retry: 1, // Retry once on failure
  });

  if (!ticker) {
    return (
        <Alert variant="default" className="mt-4">
            <MinusCircle className="h-4 w-4" />
            <AlertTitle>Enter a Ticker</AlertTitle>
            <AlertDescription>
                Please enter a stock ticker symbol above to get a recommendation.
            </AlertDescription>
        </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading recommendation for {ticker.toUpperCase()}...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive" className="mt-4">
        <MinusCircle className="h-4 w-4" />
        <AlertTitle>Error Fetching Recommendation</AlertTitle>
        <AlertDescription>
          Could not fetch recommendation for {ticker.toUpperCase()}: {error?.message || "Unknown error"}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return (
         <Alert variant="default" className="mt-4">
            <MinusCircle className="h-4 w-4" />
            <AlertTitle>No Data</AlertTitle>
            <AlertDescription>
                No recommendation data found for {ticker.toUpperCase()}.
            </AlertDescription>
        </Alert>
    );
  }
  
  const getRecommendationIcon = () => {
    if (data.recommendation === 'Buy') return <TrendingUp className="h-5 w-5 text-accent" />;
    if (data.recommendation === 'Sell') return <TrendingDown className="h-5 w-5 text-destructive" />;
    return <MinusCircle className="h-5 w-5 text-muted-foreground" />;
  };


  return (
    <Card className="mt-6 shadow-lg w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">
                Recommendation for {data.ticker.toUpperCase()}
            </CardTitle>
            {getRecommendationIcon()}
        </div>
        <CardDescription>AI-powered analysis from Vertex AI Financial Agent</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold text-lg text-primary">{data.recommendation}</h3>
          <p className="text-sm text-muted-foreground mt-1">{data.reason}</p>
        </div>

        {data.otm_call_suggestion && (
          <div className="pt-4 border-t">
            <h4 className="font-semibold text-md text-primary mb-1">OTM Call Suggestion ({data.otm_call_suggestion.days_to_expiry}-day)</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <p className="text-muted-foreground">Strike Price:</p>
              <p className="font-medium text-right">${data.otm_call_suggestion.strike}</p>
              <p className="text-muted-foreground">Est. Option Price:</p>
              <p className="font-medium text-right">
                {typeof data.otm_call_suggestion.optionPrice === 'number' 
                  ? `$${data.otm_call_suggestion.optionPrice.toFixed(2)}` 
                  : data.otm_call_suggestion.optionPrice}
              </p>
            </div>
          </div>
        )}
         {!data.otm_call_suggestion && (
            <div className="pt-4 border-t">
                 <h4 className="font-semibold text-md text-primary mb-1">OTM Call Suggestion</h4>
                 <p className="text-sm text-muted-foreground">Not available or insufficient data for OTM call suggestion.</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
