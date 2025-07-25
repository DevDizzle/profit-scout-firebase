
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
import { answerFinancialQuestions, type AnswerFinancialQuestionsInput, type AnswerFinancialQuestionsOutput } from '@/ai/flows/answer-financial-questions';
import { useToast } from '@/hooks/use-toast';
import {
  createSession,
  addQueryToSession,
  addSynthesizerResponseToSession,
  updateSessionLastActive,
  getLatestSummary, // Import getLatestSummary
} from '@/services/firestore-service';

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
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

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
        const potentialCompany = match[1].trim();
        if (potentialCompany.toLowerCase() !== "the company" && potentialCompany.split(" ").length <= 3) {
           return potentialCompany;
        }
      }
    }
    return undefined;
  };


  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    if (!user) {
      toast({ title: "Authentication Error", description: "You must be logged in to chat.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const userMessageText = input;
    setInput(''); 

    const userMessage: Message = {
      id: Date.now().toString(), 
      text: userMessageText,
      sender: 'user',
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    let activeSessionId = currentSessionId;

    if (!activeSessionId) {
      try {
        console.log(`[ChatPage] Attempting to create session for user UID: ${user.uid}`);
        const companyForNewSession = extractCompanyContext(userMessageText) || currentCompanyContext;
        const newSessionId = await createSession(user.uid, companyForNewSession || null);
        setCurrentSessionId(newSessionId);
        activeSessionId = newSessionId;
        toast({ title: "New Session Started", description: `Session ID: ${newSessionId}`, duration: 2000 });
      } catch (error) {
        console.error("Error creating session:", error);
        toast({ title: "Session Creation Error", description: "Could not start a new session. " + (error instanceof Error ? error.message : "Please check console."), variant: "destructive" });
        setIsLoading(false);
        return; 
      }
    } else {
      try {
        await updateSessionLastActive(activeSessionId);
      } catch (error) {
        console.warn("Error updating session last active:", error);
      }
    }
    
    const detectedCompany = extractCompanyContext(userMessageText);
    if (detectedCompany) {
        setCurrentCompanyContext(detectedCompany);
    }
    const companyForQuery = detectedCompany || currentCompanyContext;


    let savedQueryId: string | undefined;
    if (activeSessionId) {
      try {
        savedQueryId = await addQueryToSession(activeSessionId, userMessageText);
        console.log(`[ChatPage] User query saved to Firestore with ID: ${savedQueryId}`);
      } catch (error) {
        console.error("Error saving user query to Firestore:", error);
        toast({ title: "Save Error", description: "Could not save your message to history.", variant: "destructive", duration: 2000 });
      }
    }

    if (!activeSessionId || !savedQueryId) {
        console.error("[ChatPage] Missing activeSessionId or savedQueryId. Cannot proceed with AI call and summarization.");
        toast({ title: "Error", description: "Session or Query ID missing. Cannot proceed.", variant: "destructive" });
        setIsLoading(false);
        return;
    }

    try {
      // Fetch latest summary before calling the AI flow
      let previousSummaryText: string | undefined;
      if (activeSessionId) {
        try {
          console.log(`[ChatPage] Fetching latest summary for session ${activeSessionId} to provide as context.`);
          const latestSummaryDoc = await getLatestSummary(activeSessionId);
          previousSummaryText = latestSummaryDoc?.summary_text;
          if (previousSummaryText) {
            console.log(`[ChatPage] Using latest summary for AI prompt context: "${previousSummaryText.substring(0, 70)}..."`);
          } else {
            console.log(`[ChatPage] No previous summary found for session ${activeSessionId}.`);
          }
        } catch (summaryError) {
          console.warn(`[ChatPage] Error fetching latest summary for session ${activeSessionId}:`, summaryError);
          // Proceed without summary if fetching fails
        }
      }

      const aiInput: AnswerFinancialQuestionsInput = {
        question: userMessageText,
        companyName: companyForQuery,
        sessionId: activeSessionId, 
        queryId: savedQueryId,
        conversationSummary: previousSummaryText, // Pass the fetched summary
      };
      
      console.log("[ChatPage] Calling answerFinancialQuestions flow with input:", { ...aiInput, question:aiInput.question.substring(0,50), conversationSummary: aiInput.conversationSummary ? aiInput.conversationSummary.substring(0,50) + '...' : undefined });
      const aiResponse: AnswerFinancialQuestionsOutput = await answerFinancialQuestions(aiInput);
      console.log("[ChatPage] Received response from answerFinancialQuestions flow:", { 
        answer: aiResponse.answer.substring(0,50), 
      });
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: aiResponse.answer,
        sender: 'ai',
        companyContext: companyForQuery, 
      };
      setMessages((prev) => [...prev, aiMessage]);

      // Save AI response to Firestore
      if (activeSessionId && savedQueryId) {
        try {
          await addSynthesizerResponseToSession(activeSessionId, {
            response_text: aiResponse.answer,
            query_id: savedQueryId,
          });
          console.log(`[ChatPage] AI (synthesizer) response saved to Firestore for query ID: ${savedQueryId}`);

          // After saving the AI response, trigger the summarization API endpoint
          console.log(`[ChatPage] Triggering summarization via API for session: ${activeSessionId}, query: ${savedQueryId}`);
          const summaryApiResponse = await fetch('/api/summarize-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              sessionId: activeSessionId, 
              queryId: savedQueryId,
              latestQueryText: userMessageText, // Pass latest query text
              latestResponseText: aiResponse.answer, // Pass latest response text
            }),
          });

          if (!summaryApiResponse.ok) {
            const errorData = await summaryApiResponse.json().catch(() => ({ error: "Failed to parse error response from summarization API" }));
            console.error(`[ChatPage] Error calling /api/summarize-session: ${summaryApiResponse.status}`, errorData);
            toast({
              title: "Summarization Error",
              description: `Could not trigger session summarization. Status: ${summaryApiResponse.status}. ${errorData.error || "Unknown error."}`,
              variant: "destructive",
            });
          } else {
            const summaryData = await summaryApiResponse.json();
            console.log(`[ChatPage] Summarization API call successful. Summary ID: ${summaryData.summaryId}, Summary: "${(summaryData.summaryText || "").substring(0,50)}..."`);
          }

        } catch (firestoreOrApiError) {
          console.error("Error saving AI response or triggering summarization API:", firestoreOrApiError);
          toast({ title: "Post-Processing Error", description: "Could not save AI response or process summary. "  + (firestoreOrApiError instanceof Error ? firestoreOrApiError.message : ""), variant: "destructive", duration: 2000 });
        }
      } else { 
        console.warn("[ChatPage] AI response not saved or summarization not triggered because session/query ID was missing.");
      }

    } catch (error) {
      console.error("Error getting AI response from flow:", error, "Details:", (error as Error).message, (error as Error).stack);
      const errorMessageText = "Sorry, I encountered an error trying to respond. Please check the console for details or try again later.";
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: errorMessageText,
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
      <div className="flex h-[calc(100vh-4rem-64px)] flex-col">
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
