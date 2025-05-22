
'use client';

import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { answerFinancialQuestions, AnswerFinancialQuestionsInput } from '@/ai/flows/answer-financial-questions';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  text: string | React.ReactNode;
  sender: 'user' | 'ai';
  companyContext?: string;
}

export default function ChatPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentCompanyContext, setCurrentCompanyContext] = useState<string | undefined>(undefined);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length === 1) return names[0].substring(0, 2).toUpperCase();
    return names[0][0].toUpperCase() + names[names.length - 1][0].toUpperCase();
  };

  const extractCompanyContext = (text: string): string | undefined => {
    // Simple heuristic: look for "about X", "for Y", "on Z" where X,Y,Z might be company names
    // More sophisticated NLP could be used here.
    const patterns = [
      /about\s+([A-Za-z0-9\s]+)/i,
      /for\s+([A-Za-z0-9\s]+)/i,
      /on\s+([A-Za-z0-9\s]+)/i,
      /([A-Za-z0-9\s]+)\s*company/i,
      /([A-Za-z0-9\s]+)\s*inc/i,
      /([A-Za-z0-9\s]+)\s*corp/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        // Check if the match is not a generic term
        const potentialCompany = match[1].trim();
        if (potentialCompany.toLowerCase() !== "the company" && potentialCompany.split(" ").length <= 3) {
           return potentialCompany;
        }
      }
    }
    // If no specific pattern, check if currentCompanyContext is still relevant or default to a primary subject.
    // This part can be improved. For now, if no new company is detected, stick to the old one or clear it if the question is generic.
    if (text.toLowerCase().includes("company") || text.toLowerCase().includes("firm") || text.toLowerCase().includes("organization")) {
        // Heuristic: if these general terms are used without a clear new name, the context might be shifting or is unclear.
        // If a company name is part of the question, it should ideally be caught by patterns above.
    }
    return undefined; // Or return currentCompanyContext if we want to maintain context across turns more aggressively
  };


  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Extract company name for context or use existing
    let companyForQuery = extractCompanyContext(input) || currentCompanyContext;
    if (extractCompanyContext(input)) { // If a new company is detected in the input
        setCurrentCompanyContext(extractCompanyContext(input));
        companyForQuery = extractCompanyContext(input);
    } else if (!companyForQuery) {
        // If no company context at all, prompt AI that it's a general question or ask for clarification
         // For now, let's default to a placeholder if none is found.
        // This can be improved by asking the user "Which company are you asking about?"
        // Or by designing the AI prompt to handle general financial questions.
        // For now, we'll send a generic company name if none is explicitly found or maintained.
        // companyForQuery = "the user's previously mentioned company or a general context";
        // Let's make it "a general financial question" if no company is found
    }


    try {
      const aiInput: AnswerFinancialQuestionsInput = {
        question: userMessage.text as string,
        // Ensure companyName is always a string, even if it's a placeholder for "general context"
        companyName: companyForQuery || "the company in question", 
      };
      
      const aiResponse = await answerFinancialQuestions(aiInput);
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: aiResponse.answer,
        sender: 'ai',
        companyContext: companyForQuery, // Store company context with AI message if desired
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error getting AI response:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I encountered an error trying to respond. Please check the console for details or try again later.",
        sender: 'ai',
      };
      setMessages((prev) => [...prev, errorMessage]);
      toast({
        title: "AI Error",
        description: "Could not get a response from the AI. " + ((error as Error).message || "Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-4rem-64px)] flex-col"> {/* Adjusted height */}
        <Card className="flex-1 flex flex-col shadow-lg overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle className="text-xl">Financial Chat Assistant</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col">
            <ScrollArea className="flex-1 p-6 space-y-4" ref={scrollAreaRef}>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start gap-3 ${
                    message.sender === 'user' ? 'justify-end' : ''
                  }`}
                >
                  {message.sender === 'ai' && (
                    <Avatar className="h-8 w-8 border">
                      <AvatarFallback>AI</AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[70%] rounded-xl px-4 py-3 text-sm shadow-md ${
                      message.sender === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card text-card-foreground'
                    }`}
                  >
                    {typeof message.text === 'string' ? (
                        message.text.split('\n').map((line, index) => (
                          <span key={index}>
                            {line}
                            {index !== message.text.split('\n').length - 1 && <br />}
                          </span>
                        ))
                      ) : (
                        message.text
                      )
                    }
                    {message.companyContext && message.sender === 'ai' && (
                        <p className="text-xs opacity-70 mt-1 pt-1 border-t border-opacity-20">
                            Context: {message.companyContext}
                        </p>
                    )}
                  </div>
                  {message.sender === 'user' && user && (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.photoURL || undefined} />
                      <AvatarFallback>{getInitials(user.displayName || user.email)}</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8 border">
                    <AvatarFallback>AI</AvatarFallback>
                  </Avatar>
                  <div className="max-w-[70%] rounded-xl px-4 py-3 text-sm shadow-md bg-card text-card-foreground">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </ScrollArea>
            <div className="border-t p-4 bg-background">
              <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                <Input
                  type="text"
                  placeholder="Ask about financial data, companies, or reports..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
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
