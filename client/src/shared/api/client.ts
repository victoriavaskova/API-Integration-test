import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';
import type { 
  LoginRequest, 
  AuthResponse, 
  BalanceResponse, 
  TransactionsResponse, 
  BetsResponse, 
  Bet,
  RecommendedBetResponse, 
  PlaceBetRequest 
} from './types';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'http://localhost:3003/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for adding auth token
    this.client.interceptors.request.use((config: any) => {
      console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
      
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor for logging and error handling
    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error(`🚨 Response Error: ${error.response?.status}`, error.response?.data);
        return Promise.reject(error);
      }
    );
  }

  // Helper to handle server responses (both direct and wrapped)
  private handleResponse<T>(response: AxiosResponse): T {
    const data = response.data;
    
    // Check if it's a wrapped response with success field
    if (data && typeof data === 'object' && 'success' in data) {
      if (data.success && data.data !== undefined) {
        return data.data;
      }
      throw new Error(data.error?.message || 'API request failed');
    }
    
    // Direct response (like auth/login, balance, transactions, bets)
    return data as T;
  }

  // Auth endpoints
  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await this.client.post('/auth/login', data);
    return this.handleResponse<AuthResponse>(response);
  }

  async refreshToken(token: string): Promise<AuthResponse> {
    const response = await this.client.post('/auth/refresh', { token });
    return this.handleResponse<AuthResponse>(response);
  }

  async logout(): Promise<void> {
    const response = await this.client.post('/auth/logout');
    this.handleResponse<void>(response);
  }

  async getCurrentUser(): Promise<any> {
    const response = await this.client.get('/auth/me');
    return this.handleResponse<any>(response);
  }

  // Balance endpoints
  async getBalance(): Promise<BalanceResponse> {
    const response = await this.client.get('/balance');
    return this.handleResponse<BalanceResponse>(response);
  }

  async getTransactions(page: number = 1, limit: number = 10): Promise<TransactionsResponse> {
    const response = await this.client.get(`/transactions?page=${page}&limit=${limit}`);
    return this.handleResponse<TransactionsResponse>(response);
  }

  // Betting endpoints
  async getBets(): Promise<BetsResponse> {
    const response = await this.client.get('/bets');
    return this.handleResponse<BetsResponse>(response);
  }

  async getBet(id: string): Promise<Bet> {
    const response = await this.client.get(`/bets/${id}`);
    return this.handleResponse<Bet>(response);
  }

  async placeBet(data: PlaceBetRequest): Promise<Bet> {
    const response = await this.client.post('/bets', data);
    return this.handleResponse<Bet>(response);
  }

  async getRecommendedBet(): Promise<RecommendedBetResponse> {
    const response = await this.client.get('/bets/recommended');
    return this.handleResponse<RecommendedBetResponse>(response);
  }

  async checkBetResult(betId: string): Promise<Bet> {
    console.log('🎲 API Call: Check bet result', { betId, endpoint: `/bets/result/${betId}` });
    const response = await this.client.get(`/bets/result/${betId}`);
    const result = this.handleResponse<Bet>(response);
    console.log('📊 API Response: Bet result', result);
    return result;
  }

  // Error handling helper
  handleError(error: any): { message: string; code?: string } {
    if (error.response?.data) {
      const errorData = error.response.data;
      
      // Handle wrapped error responses
      if (errorData.error?.message) {
        return {
          message: errorData.error.message,
          code: errorData.error.code
        };
      }
      
      // Handle direct error messages
      if (errorData.message) {
        return { message: errorData.message };
      }
    }

    // Fallback for network or other errors
    return { 
      message: error.message || 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR'
    };
  }
}

export const apiClient = new ApiClient(); 