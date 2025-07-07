import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Типы данных согласно ТЗ
export interface User {
  id: number;
  username: string;
  email: string;
}

export interface LoginRequest {
  username: string;
}

export interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    expiresIn: number;
    user: User;
  };
}

export interface Bet {
  id: string;
  amount: number;
  status: 'pending' | 'completed' | 'cancelled';
  win_amount?: number;
  created_at: string;
  completed_at?: string;
}

export interface BetRequest {
  amount: number;
}

export interface BetResponse {
  success: boolean;
  data: Bet;
}

export interface BetsHistoryResponse {
  success: boolean;
  data: {
    bets: Bet[];
  };
}

export interface RecommendedBetResponse {
  success: boolean;
  data: {
    recommended_amount: number;
  };
}

export interface Balance {
  balance: number;
  last_updated: string;
}

export interface BalanceResponse {
  success: boolean;
  data: Balance;
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
  success: boolean;
  data: {
    transactions: Transaction[];
    pagination?: {
      total: number;
      page: number;
      limit: number;
      pages: number;
    };
  };
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}

export class ApiClient {
  private axios: AxiosInstance;
  private authToken: string | null = null;

  constructor(baseURL: string = 'http://localhost:3003/api') {
    this.axios = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Interceptor для добавления токена в запросы
    this.axios.interceptors.request.use((config) => {
      if (this.authToken) {
        config.headers.Authorization = `Bearer ${this.authToken}`;
      }
      
      // Логирование запросов
      console.log(`🔄 API Request: ${config.method?.toUpperCase()} ${config.url}`, {
        data: config.data,
        headers: config.headers.Authorization ? '***TOKEN***' : 'No Auth'
      });
      
      return config;
    });

    // Interceptor для обработки ответов
    this.axios.interceptors.response.use(
      (response) => {
        console.log(`✅ API Response: ${response.status}`, response.data);
        return response;
      },
      (error) => {
        console.error(`❌ API Error:`, {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        
        // Если токен недействителен, удаляем его
        if (error.response?.status === 401) {
          this.clearAuth();
        }
        
        return Promise.reject(error);
      }
    );

    // Восстанавливаем токен из localStorage при инициализации
    this.restoreAuth();
  }

  // Управление токенами
  setAuthToken(token: string) {
    this.authToken = token;
    localStorage.setItem('auth_token', token);
    console.log('🔐 Auth token set');
  }

  clearAuth() {
    this.authToken = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');
    console.log('🚪 Auth cleared');
  }

  private restoreAuth() {
    const token = localStorage.getItem('auth_token');
    if (token) {
      this.authToken = token;
      console.log('🔐 Auth token restored from localStorage');
    }
  }

  isAuthenticated(): boolean {
    return !!this.authToken;
  }

  getCurrentUser(): User | null {
    const userString = localStorage.getItem('current_user');
    return userString ? JSON.parse(userString) : null;
  }

  // API Методы согласно ТЗ

  // Аутентификация
  async login(request: LoginRequest): Promise<LoginResponse> {
    const response: AxiosResponse<LoginResponse> = await this.axios.post('/auth/login', request);
    
    // Сохраняем токен и пользователя
    if (response.data.success) {
      this.setAuthToken(response.data.data.token);
      localStorage.setItem('current_user', JSON.stringify(response.data.data.user));
    }
    
    return response.data;
  }

  async logout(): Promise<void> {
    try {
      await this.axios.post('/auth/logout');
    } catch (error) {
      // Логируем ошибку, но все равно очищаем локальные данные
      console.warn('Logout request failed, but clearing local auth anyway');
    }
    this.clearAuth();
  }

  async validateToken(): Promise<boolean> {
    if (!this.authToken) return false;
    
    try {
      await this.axios.get('/auth/validate', {
        params: { token: this.authToken }
      });
      return true;
    } catch (error) {
      this.clearAuth();
      return false;
    }
  }

  async getCurrentUserInfo(): Promise<User> {
    const response: AxiosResponse<{ success: boolean; data: User }> = await this.axios.get('/auth/me');
    return response.data.data;
  }

  // Управление ставками
  async getBetsHistory(): Promise<Bet[]> {
    const response: AxiosResponse<BetsHistoryResponse> = await this.axios.get('/bets');
    return response.data.data.bets;
  }

  async getBetById(id: string): Promise<Bet> {
    const response: AxiosResponse<{ success: boolean; data: Bet }> = await this.axios.get(`/bets/${id}`);
    return response.data.data;
  }

  async placeBet(request: BetRequest): Promise<Bet> {
    const response: AxiosResponse<BetResponse> = await this.axios.post('/bets', request);
    return response.data.data;
  }

  async getRecommendedBet(): Promise<number> {
    const response: AxiosResponse<RecommendedBetResponse> = await this.axios.get('/bets/recommended');
    return response.data.data.recommended_amount;
  }

  // Управление балансом
  async getBalance(): Promise<Balance> {
    const response: AxiosResponse<BalanceResponse> = await this.axios.get('/balance');
    return response.data.data;
  }

  async getTransactions(page: number = 1, limit: number = 10): Promise<TransactionsResponse['data']> {
    const response: AxiosResponse<TransactionsResponse> = await this.axios.get('/transactions', {
      params: { page, limit }
    });
    return response.data.data;
  }

  // Health check
  async healthCheck(): Promise<any> {
    const response = await this.axios.get('/health');
    return response.data;
  }
}

// Singleton instance
export const apiClient = new ApiClient(); 