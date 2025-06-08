
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Zap, BarChart2, MessageSquare, Loader2 } from 'lucide-react';
// Removed Image import since it's no longer used
// import Image from 'next/image'; 

function Logo() {
  return (
    <Link href="/landing" className="flex items-center gap-2 text-xl font-semibold text-primary">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
        <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2 7L12 12M12 12L22 7M12 12V22M12 2V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M7 4.5L17 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span>ProfitScout</span>
    </Link>
  );
}

const benefits = [
  {
    icon: <Zap className="h-6 w-6 text-primary" />,
    title: 'Accurate Predictions',
    description: '30-day probability predictions for stock price increases post-earnings.',
  },
  {
    icon: <BarChart2 className="h-6 w-6 text-primary" />,
    title: 'Comprehensive Analysis',
    description: 'Data synthesized from news, earnings calls, SEC filings, technicals, and fundamentals.',
  },
  {
    icon: <MessageSquare className="h-6 w-6 text-primary" />,
    title: 'Easy-to-Use Chat',
    description: 'Personalized recommendations through a simple chat interface.',
  },
  {
    icon: <CheckCircle className="h-6 w-6 text-primary" />,
    title: 'Investor Tailored',
    description: 'Designed for all stock market investors, including those trading call options.',
  },
];

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: 'Error', description: 'Please enter your email address.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/waitlist-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (response.ok) {
        toast({ title: 'Success!', description: "You've been added to the waitlist." });
        setEmail('');
      } else {
        toast({ title: 'Error', description: data.error || 'Something went wrong.', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Could not submit email. Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 max-w-screen-2xl items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-4">
            <Link href="/login" legacyBehavior passHref>
              <Button variant="ghost">Sign In</Button>
            </Link>
            {/* You can add a Sign Up button here if needed */}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-br from-background to-muted/30">
          <div className="container px-4 md:px-6">
            {/* Adjusted grid to be single column and text centered */}
            <div className="grid gap-6 lg:gap-12 items-center text-center">
              <div className="space-y-4 md:space-y-6 max-w-3xl mx-auto"> {/* Added max-w and mx-auto for centering text block */}
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none text-primary">
                  ProfitScout: Your AI-Powered Aide for Smarter Stock Investments
                </h1>
                <p className="text-lg text-muted-foreground md:text-xl">
                  Get a 30-day probability of stocks rising over 12% after earnings calls, plus BUY, HOLD, or SELL recommendations.
                </p>
                <p className="text-foreground md:text-lg"> {/* Removed max-w from here, parent div handles it */}
                  ProfitScout helps you navigate stock purchases by providing synthesized analysis from headline news, earnings calls, SEC filings, technicals, fundamentals, and price history for Russell 1000 stocks. Designed for stock market investors, especially those interested in call options, ProfitScout aims to help you make more informed investment decisions through a simple chat interface.
                </p>
              </div>
              {/* Image component removed */}
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section id="benefits" className="w-full py-12 md:py-24 lg:py-32 bg-background">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-foreground">Key Benefits</h2>
              <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Discover how ProfitScout empowers your investment strategy with cutting-edge AI and comprehensive data.
              </p>
            </div>
            <div className="mx-auto grid items-start gap-8 sm:max-w-4xl sm:grid-cols-2 md:gap-12 lg:max-w-5xl lg:grid-cols-2">
              {benefits.map((benefit, index) => (
                <Card key={index} className="shadow-md hover:shadow-xl transition-shadow duration-300">
                  <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-3">
                    {benefit.icon}
                    <div className="flex-1 space-y-1">
                      <CardTitle className="text-xl text-primary">{benefit.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{benefit.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Sign-up Form Section */}
        <section id="waitlist" className="w-full py-12 md:py-24 lg:py-32 bg-muted/50">
          <div className="container grid items-center justify-center gap-4 px-4 text-center md:px-6">
            <div className="space-y-3">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight text-foreground">Join the Waitlist</h2>
              <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Sign up to join the waitlist and be the first to try ProfitScout.
              </p>
            </div>
            <div className="mx-auto w-full max-w-sm space-y-2">
              <Card className="shadow-lg">
                <CardContent className="pt-6">
                  <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="max-w-lg flex-1"
                      disabled={isLoading}
                    />
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Sign Up for Waitlist
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} ProfitScout. All rights reserved.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link href="#" className="text-xs hover:underline underline-offset-4 text-muted-foreground">
            Terms of Service
          </Link>
          <Link href="#" className="text-xs hover:underline underline-offset-4 text-muted-foreground">
            Privacy Policy
          </Link>
        </nav>
      </footer>
    </div>
  );
}
