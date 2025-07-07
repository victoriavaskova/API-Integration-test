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

// Server wrapper type for all responses
type WrappedResponse<T> = {
  success: boolean;
  data?: T;
  error?: any;
  pagination?: any;
};

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

  // Helper to unwrap server responses
  private unwrapResponse<T>(response: AxiosResponse<WrappedResponse<T>>): T {
    if (response.data.success && response.data.data !== undefined) {
      return response.data.data;
    }
    
    // If response failed, throw the error
    const errorMessage = response.data.error?.message || 'Unknown error occurred';
    throw new Error(errorMessage);
  }

  // Auth endpoints
  async login(data: LoginRequest): Promise<AuthResponse> {
    const response: AxiosResponse<WrappedResponse<AuthResponse>> = await this.client.post('/auth/login', data);
    return this.unwrapResponse(response);
  }

  async refreshToken(token: string): Promise<AuthResponse> {
    const response: AxiosResponse<WrappedResponse<AuthResponse>> = await this.client.post('/auth/refresh', { token });
    return this.unwrapResponse(response);
  }

  async logout(): Promise<void> {
    const response: AxiosResponse<WrappedResponse<any>> = await this.client.post('/auth/logout');
    this.unwrapResponse(response);
  }

  async getCurrentUser(): Promise<any> {
    const response: AxiosResponse<WrappedResponse<any>> = await this.client.get('/auth/me');
    return this.unwrapResponse(response);
  }

  // Balance endpoints
  async getBalance(): Promise<BalanceResponse> {
    const response: AxiosResponse<WrappedResponse<BalanceResponse>> = await this.client.get('/balance');
    return this.unwrapResponse(response);
  }

  async getTransactions(page: number = 1, limit: number = 10): Promise<TransactionsResponse> {
    const response: AxiosResponse<WrappedResponse<TransactionsResponse>> = await this.client.get(`/transactions?page=${page}&limit=${limit}`);
    return this.unwrapResponse(response);
  }

  // Betting endpoints
  async getBets(): Promise<BetsResponse> {
    const response: AxiosResponse<WrappedResponse<BetsResponse>> = await this.client.get('/bets');
    return this.unwrapResponse(response);
  }

  async getBet(id: string): Promise<Bet> {
    const response: AxiosResponse<WrappedResponse<Bet>> = await this.client.get(`/bets/${id}`);
    return this.unwrapResponse(response);
  }

  async placeBet(data: PlaceBetRequest): Promise<Bet> {
    const response: AxiosResponse<WrappedResponse<Bet>> = await this.client.post('/bets', data);
    return this.unwrapResponse(response);
  }

  async getRecommendedBet(): Promise<RecommendedBetResponse> {
    const response: AxiosResponse<WrappedResponse<RecommendedBetResponse>> = await this.client.get('/bets/recommended');
    return this.unwrapResponse(response);
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