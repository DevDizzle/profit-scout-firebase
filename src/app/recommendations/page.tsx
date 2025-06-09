
'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StockRecommendation } from '@/components/stock/StockRecommendation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search } from 'lucide-react';

export default function RecommendationsPage() {
  const [currentTicker, setCurrentTicker] = useState('');
  const [submittedTicker, setSubmittedTicker] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentTicker.trim()) {
      setSubmittedTicker(currentTicker.trim().toUpperCase());
    }
  };

  return (
    <AppShell>
      <div className="container mx-auto py-8 px-4 md:px-0">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-8">
          AI Stock Recommendation
        </h1>

        <Card className="mb-8 shadow-md">
          <CardHeader>
            <CardTitle className="text-xl">Search Stock Ticker</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-4">
              <Input
                type="text"
                placeholder="Enter stock ticker (e.g., AAPL, MSFT)"
                value={currentTicker}
                onChange={(e) => setCurrentTicker(e.target.value)}
                className="flex-1 text-base md:text-sm"
              />
              <Button type="submit" className="w-full sm:w-auto">
                <Search className="mr-2 h-4 w-4" /> Get Recommendation
              </Button>
            </form>
          </CardContent>
        </Card>

        {submittedTicker && (
          <div className="mt-6">
            <StockRecommendation ticker={submittedTicker} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
