import type { User as FirebaseUser } from 'firebase/auth';

export interface UserProfile extends FirebaseUser {
  // Add any custom user profile fields here
  // Example: role?: 'admin' | 'user';
}

export interface FinancialDataPoint {
  date: string; // or Date object
  value: number;
  category?: string;
}

export interface KPIData {
  id: string;
  title: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string | number;
  description?: string;
}
