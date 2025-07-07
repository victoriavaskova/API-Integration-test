import { PrismaClient } from '@prisma/client';
import { PrismaUserRepository, type UserRepository } from './user.repository.js';
import { PrismaBetRepository, type BetRepository } from './bet.repository.js';
import { PrismaTransactionRepository, type TransactionRepository } from './transaction.repository.js';
import { PrismaBalanceRepository, type BalanceRepository } from './balance.repository.js';
import { PrismaApiLogRepository, type ApiLogRepository } from './api-log.repository.js';

/**
 * Интерфейс для всех репозиториев
 */
export interface Repositories {
  user: UserRepository;
  bet: BetRepository;
  transaction: TransactionRepository;
  balance: BalanceRepository;
  apiLog: ApiLogRepository;
}

/**
 * Factory для создания всех репозиториев
 */
export class RepositoryFactory {
  private static instance: RepositoryFactory;
  private repositories: Repositories | null = null;

  private constructor() {}

  /**
   * Получает singleton instance фабрики репозиториев
   */
  public static getInstance(): RepositoryFactory {
    if (!RepositoryFactory.instance) {
      RepositoryFactory.instance = new RepositoryFactory();
    }
    return RepositoryFactory.instance;
  }

  /**
   * Создает и возвращает все репозитории
   */
  public createRepositories(prisma: PrismaClient): Repositories {
    if (!this.repositories) {
      this.repositories = {
        user: new PrismaUserRepository(prisma),
        bet: new PrismaBetRepository(prisma),
        transaction: new PrismaTransactionRepository(prisma),
        balance: new PrismaBalanceRepository(prisma),
        apiLog: new PrismaApiLogRepository(prisma)
      };
    }
    return this.repositories;
  }

  /**
   * Получает существующие репозитории (должны быть созданы ранее)
   */
  public getRepositories(): Repositories {
    if (!this.repositories) {
      throw new Error('Repositories not initialized. Call createRepositories() first.');
    }
    return this.repositories;
  }

  /**
   * Сбрасывает singleton instance (для тестирования)
   */
  public static resetInstance(): void {
    RepositoryFactory.instance = null as any;
  }
}

// Экспорт типов и классов для прямого использования
export {
  type UserRepository,
  type BetRepository,
  type TransactionRepository,
  type BalanceRepository,
  type ApiLogRepository,
  PrismaUserRepository,
  PrismaBetRepository,
  PrismaTransactionRepository,
  PrismaBalanceRepository,
  PrismaApiLogRepository
};

// Экспорт базовых интерфейсов
export type { BaseRepository, FindManyOptions, PaginatedResult } from './base.repository.js';

// Экспорт дополнительных типов
export type { BetStatsResult } from './bet.repository.js';
export type { TransactionStatsResult } from './transaction.repository.js';
export type { BalanceHistoryItem } from './balance.repository.js';
export type { ApiStatsResult } from './api-log.repository.js';

/**
 * Хелпер функция для быстрого создания репозиториев
 */
export function createRepositories(prisma: PrismaClient): Repositories {
  return RepositoryFactory.getInstance().createRepositories(prisma);
}

/**
 * Хелпер функция для получения репозиториев
 */
export function getRepositories(): Repositories {
  return RepositoryFactory.getInstance().getRepositories();
} 