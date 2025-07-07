const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export class ApiClient {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    
    // Загружаем токен из localStorage при инициализации
    this.authToken = localStorage.getItem('auth_token');
    
    console.log('🔧 ApiClient initialized:', {
      baseUrl: this.baseUrl,
      hasToken: !!this.authToken
    });
  }

  /**
   * Установка токена авторизации
   */
  setAuthToken(token: string | null): void {
    this.authToken = token;
    if (token) {
      localStorage.setItem('auth_token', token);
      console.log('🔑 Auth token set and saved to localStorage');
    } else {
      localStorage.removeItem('auth_token');
      console.log('🚪 Auth token removed from localStorage');
    }
  }

  /**
   * Получение токена авторизации
   */
  getAuthToken(): string | null {
    return this.authToken;
  }

  /**
   * Очистка токена авторизации
   */
  clearAuthToken(): void {
    this.setAuthToken(null);
  }

  /**
   * Основной метод для выполнения HTTP запросов
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const startTime = Date.now();

    // Подготавливаем заголовки
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Добавляем токен авторизации, если он есть
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const requestOptions: RequestInit = {
      ...options,
      headers,
    };

    // Логируем исходящий запрос
    console.group(`📤 API Request: ${options.method || 'GET'} ${endpoint}`);
    console.log('URL:', url);
    console.log('Headers:', headers);
    
    if (options.body) {
      console.log('Request Body:', JSON.parse(options.body as string));
    }

    try {
      const response = await fetch(url, requestOptions);
      const responseTime = Date.now() - startTime;
      
      // Пытаемся парсить JSON ответ
      let responseData: any;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      // Логируем ответ
      console.log(`📥 API Response (${responseTime}ms):`, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data: responseData
      });

      if (response.ok) {
        console.log('✅ Request successful');
        console.groupEnd();
        return responseData;
      } else {
        console.warn('⚠️ Request failed with status:', response.status);
        console.groupEnd();
        
        return {
          success: false,
          error: {
            code: `HTTP_${response.status}`,
            message: responseData?.message || response.statusText || 'Request failed',
            details: responseData
          }
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error(`❌ API Request failed (${responseTime}ms):`, error);
      console.groupEnd();
      
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network error occurred',
          details: error
        }
      };
    }
  }

  /**
   * GET запрос
   */
  async get<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    let url = endpoint;
    
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    return this.makeRequest<T>(url, { method: 'GET' });
  }

  /**
   * POST запрос
   */
  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT запрос
   */
  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE запрос
   */
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { method: 'DELETE' });
  }

  /**
   * Проверка здоровья API
   */
  async healthCheck(): Promise<ApiResponse<{
    status: string;
    timestamp: string;
    services: Record<string, string>;
  }>> {
    console.log('🏥 Checking API health...');
    return this.get('/health');
  }

  /**
   * Аутентификация
   */
  async login(username: string): Promise<ApiResponse<{
    token: string;
    expiresIn: number;
  }>> {
    console.log('🔐 Attempting login for user:', username);
    const response = await this.post('/auth/login', { username });
    
    if (response.success && response.data?.token) {
      this.setAuthToken(response.data.token);
      console.log('✅ Login successful, token saved');
    } else {
      console.log('❌ Login failed:', response.error?.message);
    }
    
    return response;
  }

  /**
   * Выход из системы
   */
  async logout(): Promise<ApiResponse<any>> {
    console.log('🚪 Logging out...');
    const response = await this.post('/auth/logout');
    
    this.clearAuthToken();
    console.log('✅ Logout completed, token cleared');
    
    return response;
  }

  /**
   * Получение информации о текущем пользователе
   */
  async getCurrentUser(): Promise<ApiResponse<{
    id: number;
    username: string;
    email: string | null;
    isAdmin: boolean;
    permissions: string[];
  }>> {
    console.log('👤 Getting current user info...');
    return this.get('/auth/me');
  }

  /**
   * Получение баланса пользователя
   */
  async getBalance(): Promise<ApiResponse<{
    balance: number;
    last_updated: string;
  }>> {
    console.log('💰 Getting user balance...');
    return this.get('/balance');
  }

  /**
   * Получение истории ставок
   */
  async getBets(): Promise<ApiResponse<{
    bets: Array<{
      id: string;
      amount: number;
      status: string;
      win_amount?: number;
      created_at: string;
      completed_at?: string;
    }>;
  }>> {
    console.log('🎲 Getting user bets...');
    return this.get('/bets');
  }

  /**
   * Размещение ставки
   */
  async placeBet(amount: number): Promise<ApiResponse<{
    id: string;
    amount: number;
    status: string;
    created_at: string;
  }>> {
    console.log('🎯 Placing bet with amount:', amount);
    return this.post('/bets', { amount });
  }

  /**
   * Получение рекомендуемой ставки
   */
  async getRecommendedBet(): Promise<ApiResponse<{
    recommended_amount: number;
  }>> {
    console.log('💡 Getting recommended bet...');
    return this.get('/bets/recommended');
  }

  /**
   * Получение истории транзакций
   */
  async getTransactions(page: number = 1, limit: number = 10): Promise<ApiResponse<{
    transactions: Array<{
      id: string;
      type: string;
      amount: number;
      balance_before: number;
      balance_after: number;
      description: string;
      created_at: string;
    }>;
    pagination: {
      total: number;
      page: number;
      limit: number;
      pages: number;
    };
  }>> {
    console.log('📊 Getting transactions...', { page, limit });
    return this.get('/balance/transactions', { 
      page: page.toString(), 
      limit: limit.toString() 
    });
  }
}

// Создаем глобальный экземпляр API клиента
export const apiClient = new ApiClient();

// Экспортируем для использования в компонентах
export default apiClient; 