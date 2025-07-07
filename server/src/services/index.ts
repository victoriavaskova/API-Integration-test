import type { Repositories } from '../repositories/index.js';
import { ExternalApiClient } from './external-api.client.js';

// Импорты сервисов
import { AuthServiceImpl, type AuthService, type AuthConfig } from './auth.service.js';
import { BettingServiceImpl, type BettingService } from './betting.service.js';
import { BalanceServiceImpl, type BalanceService } from './balance.service.js';

/**
 * Интерфейс для всех сервисов
 */
export interface Services {
  auth: AuthService;
  betting: BettingService;
  balance: BalanceService;
}

/**
 * Конфигурация для сервисов
 */
export interface ServicesConfig {
  auth: AuthConfig;
  externalApi: {
    maxRetries: number;
    retryDelay: number;
    timeout: number;
    enableLogging: boolean;
  };
}

/**
 * Factory для создания всех сервисов
 */
export class ServiceFactory {
  private static instance: ServiceFactory;
  private services: Services | null = null;

  private constructor() {}

  /**
   * Получает singleton instance фабрики сервисов
   */
  public static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory();
    }
    return ServiceFactory.instance;
  }

  /**
   * Создает и возвращает все сервисы
   */
  public createServices(
    repositories: Repositories,
    config: ServicesConfig
  ): Services {
    if (!this.services) {
      // Создаем External API Client
      const externalApiClient = new ExternalApiClient(
        config.externalApi,
        repositories.apiLog
      );

      // Создаем сервисы
      this.services = {
        auth: new AuthServiceImpl(repositories, externalApiClient, config.auth),
        betting: new BettingServiceImpl(repositories, externalApiClient),
        balance: new BalanceServiceImpl(repositories, externalApiClient)
      };
    }
    return this.services;
  }

  /**
   * Получает существующие сервисы (должны быть созданы ранее)
   */
  public getServices(): Services {
    if (!this.services) {
      throw new Error('Services not initialized. Call createServices() first.');
    }
    return this.services;
  }

  /**
   * Инициализация всех сервисов
   */
  public async initializeServices(): Promise<void> {
    if (!this.services) {
      throw new Error('Services not created. Call createServices() first.');
    }

    const initPromises: Promise<void>[] = [];

    for (const [name, service] of Object.entries(this.services)) {
      if (service.initialize) {
        initPromises.push(
          service.initialize().catch(error => {
            console.error(`Failed to initialize ${name} service:`, error);
            throw error;
          })
        );
      }
    }

    await Promise.all(initPromises);
    console.log('✅ All services initialized successfully');
  }

  /**
   * Очистка ресурсов всех сервисов
   */
  public async cleanupServices(): Promise<void> {
    if (!this.services) {
      return;
    }

    const cleanupPromises: Promise<void>[] = [];

    for (const [name, service] of Object.entries(this.services)) {
      if (service.cleanup) {
        cleanupPromises.push(
          service.cleanup().catch(error => {
            console.error(`Failed to cleanup ${name} service:`, error);
          })
        );
      }
    }

    await Promise.all(cleanupPromises);
    console.log('✅ All services cleaned up successfully');
  }

  /**
   * Сбрасывает singleton instance (для тестирования)
   */
  public static resetInstance(): void {
    ServiceFactory.instance = null as any;
  }
}

// Экспорт типов и классов для прямого использования
export {
  type AuthService,
  type BettingService,
  type BalanceService,
  AuthServiceImpl,
  BettingServiceImpl,
  BalanceServiceImpl,
  ExternalApiClient
};

// Экспорт базовых интерфейсов и типов
export type { 
  BaseService, 
  ServiceResult, 
  ServiceError, 
  PaginatedServiceResult,
  ServiceOptions,
  ServiceErrorCode 
} from './base.service.js';

// Экспорт специфичных типов сервисов
export type { 
  LoginResult, 
  TokenPayload, 
  AuthConfig 
} from './auth.service.js';

export type { 
  RecommendedBetResult, 
  PlaceBetResult, 
  BetResultResponse, 
  BetStatsResponse,
  ProcessedBetsResult 
} from './betting.service.js';

export type { 
  BalanceResult, 
  BalanceSyncResult, 
  TransactionResult, 
  BalanceHistoryResult,
  BalanceConsistencyResult 
} from './balance.service.js';

export type { ExternalApiClientConfig } from './external-api.client.js';

/**
 * Хелпер функция для быстрого создания сервисов
 */
export function createServices(
  repositories: Repositories,
  config: ServicesConfig
): Services {
  return ServiceFactory.getInstance().createServices(repositories, config);
}

/**
 * Хелпер функция для получения сервисов
 */
export function getServices(): Services {
  return ServiceFactory.getInstance().getServices();
}

/**
 * Хелпер функция для инициализации сервисов
 */
export async function initializeServices(): Promise<void> {
  return ServiceFactory.getInstance().initializeServices();
}

/**
 * Хелпер функция для очистки сервисов
 */
export async function cleanupServices(): Promise<void> {
  return ServiceFactory.getInstance().cleanupServices();
} 