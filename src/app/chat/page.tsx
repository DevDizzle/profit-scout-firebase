'use client';

import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';
import { useState } from 'react';

export default function ChatPage() {
  const [input, setInput] = useState('');

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;
    alert(`Message sent (locally, no AI): ${input}`);
    setInput('');
  };

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-4rem-64px)] flex-col">
        <Card className="flex-1 flex flex-col shadow-lg overflow-hidden">
          <CardContent className="p-0 flex-1 flex flex-col">
            <div className="flex-1 p-6 space-y-4">
              <p className="text-center text-muted-foreground">
                Chat UI (Simplified for Debugging)
              </p>
              <p className="text-center text-muted-foreground">
                AI functionality is temporarily disabled for this test.
              </p>
            </div>
            <div className="border-t p-4 bg-background">
              <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                <Input
                  type="text"
                  placeholder="Type a message (test)..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" size="icon" disabled={!input.trim()}>
                  <Send className="h-4 w-4" />
                  <span className="sr-only">Send</span>
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
