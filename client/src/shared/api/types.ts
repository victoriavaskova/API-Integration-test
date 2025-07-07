// API Response types matching server specifications

export interface User {
  id: string;
  username: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  expiresIn: number;
}

export interface Bet {
  id: string;
  amount: number;
  status: 'pending' | 'completed' | 'cancelled';
  win_amount?: number;
  created_at: string;
  completed_at?: string;
}

export interface BetsResponse {
  bets: Bet[];
}

export interface RecommendedBetResponse {
  recommended_amount: number;
}

export interface BalanceResponse {
  balance: number;
  last_updated: string;
}

export interface Transaction {
  id: string;
  type: 'bet_win' | 'bet_place' | 'deposit' | 'withdrawal';
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  created_at: string;
}

export interface TransactionsResponse {
  transactions: Transaction[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  services: {
    api: 'ok' | 'error';
    database: 'ok' | 'error';
    external_api: 'ok' | 'error';
  };
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}

// Request types
export interface LoginRequest {
  username: string;
}

export interface PlaceBetRequest {
  amount: number;
}

// Auth state
export interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  user: User | null;
} 