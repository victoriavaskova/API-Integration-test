import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import type { 
  UserBalance, 
  CreateUserBalanceData, 
  UpdateUserBalanceData 
} from '../types/database.js';
import type { BaseRepository, FindManyOptions } from './base.repository.js';

export interface BalanceRepository extends BaseRepository<UserBalance, CreateUserBalanceData, UpdateUserBalanceData> {
  findByUserId(userId: number): Promise<UserBalance | null>;
  updateBalance(userId: number, newBalance: Decimal): Promise<UserBalance>;
  updateExternalBalance(userId: number, externalBalance: Decimal): Promise<UserBalance>;
  syncBalances(userId: number, internalBalance: Decimal, externalBalance: Decimal): Promise<UserBalance>;
  addToBalance(userId: number, amount: Decimal): Promise<UserBalance>;
  subtractFromBalance(userId: number, amount: Decimal): Promise<UserBalance>;
  getBalanceHistory(userId: number): Promise<BalanceHistoryItem[]>;
  createOrUpdateBalance(userId: number, balance: Decimal): Promise<UserBalance>;
}

export interface BalanceHistoryItem {
  date: Date;
  balance: Decimal;
  externalBalance: Decimal | null;
  difference: Decimal | null;
}

export class PrismaBalanceRepository implements BalanceRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: number): Promise<UserBalance | null> {
    return await this.prisma.userBalance.findUnique({
      where: { id }
    });
  }

  async findMany(options?: FindManyOptions): Promise<UserBalance[]> {
    return await this.prisma.userBalance.findMany({
      where: options?.where,
      orderBy: options?.orderBy,
      skip: options?.skip,
      take: options?.take,
      include: options?.include
    });
  }

  async findByUserId(userId: number): Promise<UserBalance | null> {
    return await this.prisma.userBalance.findUnique({
      where: { userId }
    });
  }

  async create(data: CreateUserBalanceData): Promise<UserBalance> {
    return await this.prisma.userBalance.create({
      data: {
        userId: data.userId,
        balance: data.balance || new Decimal(0),
        externalBalance: data.externalBalance,
        lastCheckedAt: new Date()
      }
    });
  }

  async createOrUpdateBalance(userId: number, balance: Decimal): Promise<UserBalance> {
    return await this.prisma.userBalance.upsert({
      where: { userId },
      update: {
        balance,
        lastCheckedAt: new Date()
      },
      create: {
        userId,
        balance,
        lastCheckedAt: new Date()
      }
    });
  }

  async update(id: number, data: UpdateUserBalanceData): Promise<UserBalance> {
    return await this.prisma.userBalance.update({
      where: { id },
      data: {
        ...data,
        lastCheckedAt: new Date()
      }
    });
  }

  async updateBalance(userId: number, newBalance: Decimal): Promise<UserBalance> {
    return await this.prisma.userBalance.update({
      where: { userId },
      data: {
        balance: newBalance,
        lastCheckedAt: new Date()
      }
    });
  }

  async updateExternalBalance(userId: number, externalBalance: Decimal): Promise<UserBalance> {
    return await this.prisma.userBalance.update({
      where: { userId },
      data: {
        externalBalance,
        lastCheckedAt: new Date()
      }
    });
  }

  async syncBalances(userId: number, internalBalance: Decimal, externalBalance: Decimal): Promise<UserBalance> {
    return await this.prisma.userBalance.update({
      where: { userId },
      data: {
        balance: internalBalance,
        externalBalance,
        lastCheckedAt: new Date()
      }
    });
  }

  async addToBalance(userId: number, amount: Decimal): Promise<UserBalance> {
    const currentBalance = await this.findByUserId(userId);
    if (!currentBalance) {
      throw new Error(`User balance not found for user ${userId}`);
    }

    const newBalance = currentBalance.balance.add(amount);
    return await this.updateBalance(userId, newBalance);
  }

  async subtractFromBalance(userId: number, amount: Decimal): Promise<UserBalance> {
    const currentBalance = await this.findByUserId(userId);
    if (!currentBalance) {
      throw new Error(`User balance not found for user ${userId}`);
    }

    const newBalance = currentBalance.balance.sub(amount);
    if (newBalance.lt(0)) {
      throw new Error(`Insufficient balance. Current: ${currentBalance.balance}, Requested: ${amount}`);
    }

    return await this.updateBalance(userId, newBalance);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.userBalance.delete({
      where: { id }
    });
  }

  async count(where?: Record<string, unknown>): Promise<number> {
    return await this.prisma.userBalance.count({ where });
  }

  async getBalanceHistory(userId: number): Promise<BalanceHistoryItem[]> {
    // Получаем историю транзакций для построения истории баланса
    const transactions = await this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: {
        createdAt: true,
        balanceAfter: true
      }
    });

    const currentBalance = await this.findByUserId(userId);
    
    const history: BalanceHistoryItem[] = transactions.map(tx => ({
      date: tx.createdAt,
      balance: tx.balanceAfter,
      externalBalance: null,
      difference: null
    }));

    // Добавляем текущий баланс
    if (currentBalance) {
      history.push({
        date: currentBalance.lastCheckedAt || new Date(),
        balance: currentBalance.balance,
        externalBalance: currentBalance.externalBalance,
        difference: currentBalance.externalBalance 
          ? currentBalance.balance.sub(currentBalance.externalBalance)
          : null
      });
    }

    return history;
  }
} 