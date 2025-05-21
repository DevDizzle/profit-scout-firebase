'use client';

import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, DollarSign, TrendingUp, TrendingDown, FileText } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Bar, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Line, ComposedChart, Tooltip as RechartsTooltip } from 'recharts';
import type { ChartConfig } from "@/components/ui/chart";
import Image from 'next/image';

interface KPICardProps {
  title: string;
  value: string;
  description?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  colorClass?: string; // e.g., text-green-500 for positive trend
}

function KPICard({ title, value, description, icon: Icon, trend, trendValue, colorClass }: KPICardProps) {
  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-5 w-5" style={{color: 'hsl(var(--prosperity-gold))'}} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-foreground">{value}</div>
        {description && <p className="text-xs text-muted-foreground pt-1">{description}</p>}
        {trend && trendValue && (
          <div className={`mt-2 flex items-center text-xs ${trend === 'up' ? 'text-accent' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground'}`}>
            {trend === 'up' && <TrendingUp className="mr-1 h-4 w-4" />}
            {trend === 'down' && <TrendingDown className="mr-1 h-4 w-4" />}
            <span>{trendValue} from last period</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const chartDataMonthly = [
  { month: "Jan", revenue: 18600, expenses: 8000, profit: 10600 },
  { month: "Feb", revenue: 20500, expenses: 9500, profit: 11000 },
  { month: "Mar", revenue: 23700, expenses: 10200, profit: 13500 },
  { month: "Apr", revenue: 21300, expenses: 11000, profit: 10300 },
  { month: "May", revenue: 27800, expenses: 11500, profit: 16300 },
  { month: "Jun", revenue: 29000, expenses: 12000, profit: 17000 },
];

const chartConfigMonthly: ChartConfig = {
  revenue: { label: "Revenue", color: "hsl(var(--chart-1))" },
  expenses: { label: "Expenses", color: "hsl(var(--chart-2))" },
  profit: { label: "Profit", color: "hsl(var(--chart-3))" },
};

const quarterlyData = [
    { quarter: 'Q1 23', revenue: 50000, profitMargin: 0.20 },
    { quarter: 'Q2 23', revenue: 55000, profitMargin: 0.22 },
    { quarter: 'Q3 23', revenue: 62000, profitMargin: 0.21 },
    { quarter: 'Q4 23', revenue: 58000, profitMargin: 0.23 },
    { quarter: 'Q1 24', revenue: 65000, profitMargin: 0.24 },
];

const quarterlyChartConfig: ChartConfig = {
    revenue: { label: "Quarterly Revenue", color: "hsl(var(--chart-1))" },
    profitMargin: { label: "Profit Margin (%)", color: "hsl(var(--chart-4))", icon: TrendingUp },
};


export default function DashboardPage() {
  return (
    <AppShell>
      <div className="space-y-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Financial Dashboard</h1>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <KPICard title="Total Revenue" value="$1.2M" description="YTD" icon={DollarSign} trend="up" trendValue="+15.2%" />
          <KPICard title="Net Profit" value="$320K" description="YTD" icon={TrendingUp} trend="up" trendValue="+12.8%" />
          <KPICard title="Current Ratio" value="2.1" description="Healthy liquidity" icon={BarChart} trend="neutral" trendValue="Stable" />
          <KPICard title="Quick Ratio" value="1.5" description="Good short-term solvency" icon={FileText} trend="down" trendValue="-0.1" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Monthly Performance</CardTitle>
              <CardDescription>Revenue, Expenses, and Profit Overview (Last 6 Months)</CardDescription>
            </CardHeader>
            <CardContent className="h-[350px] p-2">
              <ChartContainer config={chartConfigMonthly} className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartDataMonthly} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                    <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} barSize={20} />
                    <Line type="monotone" dataKey="profit" stroke="var(--color-profit)" strokeWidth={3} dot={{ r: 5, fill: 'var(--color-profit)', strokeWidth: 1}} activeDot={{ r: 7 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Quarterly Revenue & Profit Margin</CardTitle>
              <CardDescription>Tracking key performance indicators over quarters.</CardDescription>
            </CardHeader>
            <CardContent className="h-[350px] p-2">
               <ChartContainer config={quarterlyChartConfig} className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={quarterlyData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                        <XAxis dataKey="quarter" tickLine={false} axisLine={false} tickMargin={8}/>
                        <YAxis yAxisId="left" orientation="left" stroke="var(--color-revenue)" tickLine={false} axisLine={false} tickMargin={8} />
                        <YAxis yAxisId="right" orientation="right" stroke="var(--color-profitMargin)" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar yAxisId="left" dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} barSize={30} />
                        <Line yAxisId="right" type="monotone" dataKey="profitMargin" stroke="var(--color-profitMargin)" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} />
                    </ComposedChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
        
        <div className="grid gap-6 md:grid-cols-1">
           <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Recent Financial Reports</CardTitle>
              <CardDescription>Access your latest generated reports.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {[
                  { name: "Q1 2024 Performance Summary", date: "2024-04-15", size: "1.2MB" },
                  { name: "Annual Financial Statement 2023", date: "2024-03-01", size: "5.5MB" },
                  { name: "Competitor Analysis - Tech Sector", date: "2024-02-20", size: "2.1MB" },
                ].map((report) => (
                  <li key={report.name} className="flex items-center justify-between p-3 rounded-md hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <FileText className="h-6 w-6 text-primary" />
                      <div>
                        <p className="font-medium text-foreground">{report.name}</p>
                        <p className="text-xs text-muted-foreground">Uploaded: {report.date} &middot; Size: {report.size}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">Download</Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

      </div>
    </AppShell>
  );
}
