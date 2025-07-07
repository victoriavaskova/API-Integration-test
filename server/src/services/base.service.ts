import type { Repositories } from '../repositories/index.js';
import type { ExternalApiClient } from './external-api.client.js';

/**
 * Базовый интерфейс для всех сервисов
 */
export interface BaseService {
  /**
   * Инициализация сервиса
   */
  initialize?(): Promise<void>;
  
  /**
   * Очистка ресурсов при завершении работы
   */
  cleanup?(): Promise<void>;
}

/**
 * Результат операции сервиса
 */
export interface ServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: ServiceError;
}

/**
 * Ошибка сервиса
 */
export interface ServiceError {
  code: string;
  message: string;
  details?: Record<string, any>;
  originalError?: Error;
}

/**
 * Пагинированный результат
 */
export interface PaginatedServiceResult<T> extends ServiceResult<T[]> {
  pagination?: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

/**
 * Опции для операций сервиса
 */
export interface ServiceOptions {
  skipValidation?: boolean;
  logOperation?: boolean;
  retryOnFailure?: boolean;
}

/**
 * Базовый класс для всех сервисов
 */
export abstract class BaseServiceImpl implements BaseService {
  protected repositories: Repositories;
  protected externalApiClient: ExternalApiClient;

  constructor(repositories: Repositories, externalApiClient: ExternalApiClient) {
    this.repositories = repositories;
    this.externalApiClient = externalApiClient;
  }

  /**
   * Создает успешный результат
   */
  protected createSuccessResult<T>(data: T): ServiceResult<T> {
    return {
      success: true,
      data
    };
  }

  /**
   * Создает результат с ошибкой
   */
  protected createErrorResult<T = any>(
    code: string,
    message: string,
    details?: Record<string, any>,
    originalError?: Error
  ): ServiceResult<T> {
    return {
      success: false,
      error: {
        code,
        message,
        details,
        originalError
      }
    };
  }

  /**
   * Создает пагинированный результат
   */
  protected createPaginatedResult<T>(
    data: T[],
    pagination: {
      total: number;
      page: number;
      limit: number;
      pages: number;
    }
  ): PaginatedServiceResult<T> {
    return {
      success: true,
      data,
      pagination
    };
  }

  /**
   * Обрабатывает ошибки и преобразует их в ServiceError
   */
  protected handleError(error: any, operation: string): ServiceError {
    if (error instanceof ServiceError) {
      return error;
    }

    return {
      code: 'SERVICE_ERROR',
      message: `Failed to ${operation}: ${error.message || 'Unknown error'}`,
      originalError: error instanceof Error ? error : new Error(String(error))
    };
  }

  /**
   * Логирует операцию (можно переопределить в наследниках)
   */
  protected async logOperation(
    operation: string,
    userId?: number,
    details?: Record<string, any>
  ): Promise<void> {
    // Базовая реализация - просто консольный вывод
    console.log(`[${this.constructor.name}] ${operation}`, {
      userId,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  /**
   * Валидирует входные данные
   */
  protected validateInput(data: any, schema: ValidationSchema): void {
    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];
      
      if (rules.required && (value === undefined || value === null)) {
        throw new Error(`Field '${field}' is required`);
      }
      
      if (value !== undefined && value !== null) {
        if (rules.type && typeof value !== rules.type) {
          throw new Error(`Field '${field}' must be of type ${rules.type}`);
        }
        
        if (rules.min && typeof value === 'number' && value < rules.min) {
          throw new Error(`Field '${field}' must be at least ${rules.min}`);
        }
        
        if (rules.max && typeof value === 'number' && value > rules.max) {
          throw new Error(`Field '${field}' must be at most ${rules.max}`);
        }
        
        if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
          throw new Error(`Field '${field}' does not match required pattern`);
        }
      }
    }
  }
}

/**
 * Схема валидации для входных данных
 */
export interface ValidationSchema {
  [field: string]: {
    required?: boolean;
    type?: 'string' | 'number' | 'boolean' | 'object';
    min?: number;
    max?: number;
    pattern?: RegExp;
  };
}

/**
 * Коды ошибок сервисов
 */
export const SERVICE_ERROR_CODES = {
  // Общие ошибки
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  
  // Пользователи
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  
  // Ставки
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  INVALID_BET_AMOUNT: 'INVALID_BET_AMOUNT',
  BET_NOT_FOUND: 'BET_NOT_FOUND',
  BET_ALREADY_COMPLETED: 'BET_ALREADY_COMPLETED',
  
  // Внешнее API
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  EXTERNAL_API_UNAVAILABLE: 'EXTERNAL_API_UNAVAILABLE',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  
  // Баланс
  BALANCE_SYNC_ERROR: 'BALANCE_SYNC_ERROR',
  BALANCE_NOT_FOUND: 'BALANCE_NOT_FOUND'
} as const;

export type ServiceErrorCode = typeof SERVICE_ERROR_CODES[keyof typeof SERVICE_ERROR_CODES]; 