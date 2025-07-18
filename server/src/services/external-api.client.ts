import fetch, { Response } from 'node-fetch';
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
  ExternalApiError,
  ExternalApiResult,
  HttpMethod
} from '../types/external-api.js';
import type { ApiLogRepository } from '../repositories/api-log.repository.js';
import logger from '../config/logger.js';

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
  async authenticate(externalUserId: string, secretKey: string, internalUserId?: number): Promise<ExternalApiResult<AuthResponse>> {
    const requestBody: AuthRequest = {};
    
    return await this.makeRequest(
      'POST',
      'auth',
      requestBody,
      externalUserId,
      secretKey,
      'auth',
      internalUserId
    );
  }

  /**
   * Установка начального баланса
   */
  async setBalance(externalUserId: string, secretKey: string, balance: number, internalUserId?: number): Promise<ExternalApiResult<BalanceResponse>> {
    const requestBody: BalanceRequest = { balance };
    
    return await this.makeRequest(
      'POST',
      'balance',
      requestBody,
      externalUserId,
      secretKey,
      'balance',
      internalUserId
    );
  }

  /**
   * Получение текущего баланса
   */
  async getBalance(externalUserId: string, secretKey: string, internalUserId?: number): Promise<ExternalApiResult<BalanceResponse>> {
    return await this.makeRequest(
      'POST',
      'balance',
      undefined,       // POST-запрос без тела для получения баланса
      externalUserId,
      secretKey,
      'balance',
      internalUserId
    );
  }

  /**
   * Получение рекомендуемой ставки
   */
  async getRecommendedBet(externalUserId: string, secretKey: string, internalUserId?: number): Promise<ExternalApiResult<RecommendedBetResponse>> {
    return await this.makeRequest(
      'GET',
      'bet',
      undefined,
      externalUserId,
      secretKey,
      'bet',
      internalUserId
    );
  }

  /**
   * Размещение ставки
   */
  async placeBet(externalUserId: string, secretKey: string, amount: number, internalUserId?: number): Promise<ExternalApiResult<BetResponse>> {
    const requestBody: BetRequest = { bet: amount };
    
    return await this.makeRequest(
      'POST',
      'bet',
      requestBody,
      externalUserId,
      secretKey,
      'bet',
      internalUserId
    );
  }

  /**
   * Получение результата ставки
   */
  async getWinResult(externalUserId: string, secretKey: string, betId: string, internalUserId?: number): Promise<ExternalApiResult<WinResponse>> {
    const requestBody: WinRequest = { bet_id: betId };
    
    return await this.makeRequest(
      'POST',
      'win',
      requestBody,
      externalUserId,
      secretKey,
      'win',
      internalUserId
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
    endpoint: string, 
    body?: any,
    externalUserId?: string,
    secretKey?: string,
    operation?: 'auth' | 'balance' | 'bet' | 'win' | 'health',
    internalUserId?: number
  ): Promise<ExternalApiResult<T>> {
    const url = getExternalApiUrl(endpoint as any); 
    const startTime = Date.now();
    let lastError: Error | null = null;
    let response: Response | null = null;

    // Логирование запроса
    const logData = {
      endpoint: `/${endpoint}`,
      method,
      requestBody: body,
      userId: internalUserId || null, 
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

        response = await fetch(url, {
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
          logger.info(`External API call successful: ${method} ${url}`, { duration, status: response.status });
          return {
            success: true,
            data: responseBody as T,
            statusCode: response.status,
            duration
          };
        }
        
        // Обработка ошибок
        const error: ExternalApiError = {
          error: (responseBody as any)?.error || 'Unknown error',
          message: (responseBody as any)?.message || 'An error occurred',
          statusCode: response.status
        };

        // НЕ повторяем попытки для 4xx ошибок (клиентские ошибки)
        if (response.status >= 400 && response.status < 500) {
          logger.warn(`External API call failed with client error (no retry): ${method} ${url}`, { duration, status: response.status, error: error.message });
          return {
            success: false,
            error,
            statusCode: response.status,
            duration
          };
        }
        
        // Для 5xx ошибок продолжаем и пробуем снова
        lastError = new Error(`HTTP ${response.status}: ${error.message}`);
        logger.warn(`External API call failed with server error (attempt ${attempt}/${this.config.maxRetries}): ${method} ${url}`, { duration, status: response.status, error: lastError });

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        logger.error(`External API call failed with network error (attempt ${attempt}/${this.config.maxRetries}): ${method} ${url}`, { error: lastError });
      }
        
      // Задержка перед следующей попыткой
      if (attempt < this.config.maxRetries) {
        await this.delay(this.config.retryDelay * attempt);
      }
    }
    
    // Если все попытки провалились
    const duration = Date.now() - startTime;
    logger.error(`External API call failed after ${this.config.maxRetries} attempts: ${method} ${url}`, {
      error: lastError,
      duration,
    });
    return {
      success: false,
      error: {
        error: lastError?.name || 'ServiceUnavailable',
        message: lastError?.message || 'External service is unavailable after multiple retries',
        statusCode: response?.status || 503,
      },
      statusCode: response?.status || 503,
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