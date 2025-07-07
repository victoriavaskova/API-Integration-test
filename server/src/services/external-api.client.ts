import fetch from 'node-fetch';
import { createSignature, getExternalApiUrl, createExternalApiHeaders, getOperationTimeout } from '../config/externalApi.js';
import type {
  AuthRequest,
  AuthResponse,
  BalanceRequest,
  BalanceResponse,
  BetRequest,
  BetResponse,
  RecommendedBetResponse,
  WinRequest,
  WinResponse,
  CheckBalanceRequest,
  CheckBalanceResponse,
  ExternalApiError,
  ExternalApiResult,
  HttpMethod
} from '../types/external-api.js';
import type { ApiLogRepository } from '../repositories/api-log.repository.js';

export interface ExternalApiClientConfig {
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  enableLogging: boolean;
}

export class ExternalApiClient {
  private config: ExternalApiClientConfig;
  private apiLogRepository?: ApiLogRepository;

  constructor(
    config: Partial<ExternalApiClientConfig> = {},
    apiLogRepository?: ApiLogRepository
  ) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      enableLogging: true,
      ...config
    };
    this.apiLogRepository = apiLogRepository;
  }

  /**
   * Аутентификация пользователя в внешнем API
   */
  async authenticate(externalUserId: string, secretKey: string): Promise<ExternalApiResult<AuthResponse>> {
    const requestBody: AuthRequest = {};
    
    return await this.makeRequest(
      'POST',
      'auth',
      requestBody,
      externalUserId,
      secretKey,
      'auth'
    );
  }

  /**
   * Установка начального баланса
   */
  async setBalance(externalUserId: string, secretKey: string, balance: number): Promise<ExternalApiResult<BalanceResponse>> {
    const requestBody: BalanceRequest = { balance };
    
    return await this.makeRequest(
      'POST',
      'balance',
      requestBody,
      externalUserId,
      secretKey,
      'balance'
    );
  }

  /**
   * Получение текущего баланса
   */
  async getBalance(externalUserId: string, secretKey: string): Promise<ExternalApiResult<BalanceResponse>> {
    const requestBody: BalanceRequest = {};
    
    return await this.makeRequest(
      'POST',
      'balance',
      requestBody,
      externalUserId,
      secretKey,
      'balance'
    );
  }

  /**
   * Проверка баланса
   */
  async checkBalance(externalUserId: string, secretKey: string, expectedBalance: number): Promise<ExternalApiResult<CheckBalanceResponse>> {
    const requestBody: CheckBalanceRequest = { expected_balance: expectedBalance };
    
    return await this.makeRequest(
      'POST',
      'checkBalance',
      requestBody,
      externalUserId,
      secretKey,
      'balance'
    );
  }

  /**
   * Получение рекомендуемой ставки
   */
  async getRecommendedBet(externalUserId: string, secretKey: string): Promise<ExternalApiResult<RecommendedBetResponse>> {
    return await this.makeRequest(
      'GET',
      'bet',
      undefined,
      externalUserId,
      secretKey,
      'bet'
    );
  }

  /**
   * Размещение ставки
   */
  async placeBet(externalUserId: string, secretKey: string, amount: number): Promise<ExternalApiResult<BetResponse>> {
    const requestBody: BetRequest = { bet: amount };
    
    return await this.makeRequest(
      'POST',
      'bet',
      requestBody,
      externalUserId,
      secretKey,
      'bet'
    );
  }

  /**
   * Получение результата ставки
   */
  async getWinResult(externalUserId: string, secretKey: string, betId: string): Promise<ExternalApiResult<WinResponse>> {
    const requestBody: WinRequest = { bet_id: betId };
    
    return await this.makeRequest(
      'POST',
      'win',
      requestBody,
      externalUserId,
      secretKey,
      'win'
    );
  }

  /**
   * Проверка здоровья API
   */
  async checkHealth(): Promise<ExternalApiResult<{ status: string; database: string; timestamp: string }>> {
    return await this.makeRequest(
      'GET',
      'health',
      undefined,
      undefined,
      undefined,
      'health'
    );
  }

  /**
   * Основной метод для выполнения HTTP запросов
   */
  private async makeRequest<T>(
    method: HttpMethod,
    endpoint: keyof typeof import('../config/externalApi.js').EXTERNAL_API_CONFIG.endpoints,
    body?: any,
    externalUserId?: string,
    secretKey?: string,
    operation?: 'auth' | 'balance' | 'bet' | 'win' | 'health'
  ): Promise<ExternalApiResult<T>> {
    const url = getExternalApiUrl(endpoint);
    const startTime = Date.now();
    let lastError: Error | null = null;

    // Логирование запроса
    const logData = {
      endpoint: `/${endpoint}`,
      method,
      requestBody: body,
      userId: externalUserId ? Number(externalUserId) : null,
      timestamp: new Date(),
      ipAddress: null
    };

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };

        // Добавляем заголовки аутентификации если есть
        if (externalUserId && secretKey) {
          const signature = createSignature(body, secretKey);
          const authHeaders = createExternalApiHeaders(signature, externalUserId);
          Object.assign(headers, authHeaders);
        }

        const timeout = operation ? getOperationTimeout(operation) : this.config.timeout;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const duration = Date.now() - startTime;
        const responseBody = await response.json();

        // Логирование ответа
        if (this.config.enableLogging && this.apiLogRepository) {
          await this.apiLogRepository.createApiLog({
            ...logData,
            responseBody,
            statusCode: response.status,
            requestDurationMs: duration
          });
        }

        if (response.ok) {
          return {
            success: true,
            data: responseBody as T,
            statusCode: response.status,
            duration
          };
        } else {
          const error: ExternalApiError = {
            error: responseBody.error || 'Unknown error',
            message: responseBody.message || 'An error occurred',
            statusCode: response.status
          };

          // Не повторяем попытки для 4xx ошибок (клиентские ошибки)
          if (response.status >= 400 && response.status < 500) {
            return {
              success: false,
              error,
              statusCode: response.status,
              duration
            };
          }

          lastError = new Error(`HTTP ${response.status}: ${error.message}`);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        const duration = Date.now() - startTime;
        
        // Логирование ошибки
        if (this.config.enableLogging && this.apiLogRepository) {
          await this.apiLogRepository.createApiLog({
            ...logData,
            responseBody: { error: lastError.message },
            statusCode: 0,
            requestDurationMs: duration
          });
        }
      }

      // Если это не последняя попытка, ждем перед повтором
      if (attempt < this.config.maxRetries) {
        await this.delay(this.config.retryDelay * attempt);
      }
    }

    // Все попытки исчерпаны
    const duration = Date.now() - startTime;
    return {
      success: false,
      error: {
        error: 'Request failed',
        message: lastError?.message || 'All retry attempts failed',
        statusCode: 0
      },
      statusCode: 0,
      duration
    };
  }

  /**
   * Вспомогательный метод для задержки
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Валидация суммы ставки
   */
  public static validateBetAmount(amount: number): void {
    if (!Number.isInteger(amount) || amount < 1 || amount > 5) {
      throw new Error('Bet amount must be an integer between 1 and 5');
    }
  }

  /**
   * Валидация баланса
   */
  public static validateBalance(balance: number): void {
    if (typeof balance !== 'number' || balance < 0) {
      throw new Error('Balance must be a non-negative number');
    }
  }

  /**
   * Обновление конфигурации клиента
   */
  public updateConfig(config: Partial<ExternalApiClientConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Получение текущей конфигурации
   */
  public getConfig(): ExternalApiClientConfig {
    return { ...this.config };
  }
} 