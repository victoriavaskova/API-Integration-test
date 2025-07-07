import { PrismaClient } from '@prisma/client';
import type { 
  Transaction, 
  TransactionWithRelations,
  CreateTransactionData, 
  TransactionType
} from '../types/database.js';
import type { BaseRepository, FindManyOptions, PaginatedResult } from './base.repository.js';

export interface TransactionRepository extends BaseRepository<Transaction, CreateTransactionData, never> {
  findByUserId(userId: number, options?: FindManyOptions): Promise<Transaction[]>;
  findByUserIdPaginated(userId: number, page: number, limit: number): Promise<PaginatedResult<Transaction>>;
  findByUserIdWithRelations(userId: number, options?: FindManyOptions): Promise<TransactionWithRelations[]>;
  findByBetId(betId: number): Promise<Transaction[]>;
  findByType(type: TransactionType, userId?: number): Promise<Transaction[]>;
  getUserTransactionStats(userId: number): Promise<TransactionStatsResult>;
  createBetTransaction(userId: number, betId: number, amount: number, balanceBefore: number, balanceAfter: number): Promise<Transaction>;
  createWinTransaction(userId: number, betId: number, amount: number, balanceBefore: number, balanceAfter: number): Promise<Transaction>;
}

export interface TransactionStatsResult {
  totalTransactions: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalBets: number;
  totalWins: number;
  netAmount: number;
}

export class PrismaTransactionRepository implements TransactionRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: number): Promise<Transaction | null> {
    return await this.prisma.transaction.findUnique({
      where: { id }
    });
  }

  async findMany(options?: FindManyOptions): Promise<Transaction[]> {
    return await this.prisma.transaction.findMany({
      where: options?.where,
      orderBy: options?.orderBy,
      skip: options?.skip,
      take: options?.take,
      include: options?.include
    });
  }

  async findByUserId(userId: number, options?: FindManyOptions): Promise<Transaction[]> {
    return await this.prisma.transaction.findMany({
      where: { 
        userId,
        ...options?.where
      },
      orderBy: options?.orderBy || { createdAt: 'desc' },
      skip: options?.skip,
      take: options?.take,
      include: options?.include
    });
  }

  async findByUserIdPaginated(userId: number, page: number = 1, limit: number = 10): Promise<PaginatedResult<Transaction>> {
    const skip = (page - 1) * limit;
    
    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.transaction.count({
        where: { userId }
      })
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async findByUserIdWithRelations(userId: number, options?: FindManyOptions): Promise<TransactionWithRelations[]> {
    return await this.prisma.transaction.findMany({
      where: { 
        userId,
        ...options?.where
      },
      include: {
        user: true,
        bet: true
      },
      orderBy: options?.orderBy || { createdAt: 'desc' },
      skip: options?.skip,
      take: options?.take
    });
  }

  async findByBetId(betId: number): Promise<Transaction[]> {
    return await this.prisma.transaction.findMany({
      where: { betId },
      orderBy: { createdAt: 'asc' }
    });
  }

  async findByType(type: TransactionType, userId?: number): Promise<Transaction[]> {
    return await this.prisma.transaction.findMany({
      where: {
        type,
        ...(userId && { userId })
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async create(data: CreateTransactionData): Promise<Transaction> {
    return await this.prisma.transaction.create({
      data
    });
  }

  async createBetTransaction(userId: number, betId: number, amount: number, balanceBefore: number, balanceAfter: number): Promise<Transaction> {
    return await this.prisma.transaction.create({
      data: {
        userId,
        betId,
        type: 'BET',
        amount: -Math.abs(amount), // Ставка всегда отрицательная
        balanceBefore,
        balanceAfter,
        description: `Bet placement #${betId}`
      }
    });
  }

  async createWinTransaction(userId: number, betId: number, amount: number, balanceBefore: number, balanceAfter: number): Promise<Transaction> {
    return await this.prisma.transaction.create({
      data: {
        userId,
        betId,
        type: 'WIN',
        amount: Math.abs(amount), // Выигрыш всегда положительный
        balanceBefore,
        balanceAfter,
        description: `Win amount for bet #${betId}`
      }
    });
  }

  async update(id: number, data: never): Promise<Transaction> {
    throw new Error('Transactions cannot be updated');
  }

  async delete(id: number): Promise<void> {
    await this.prisma.transaction.delete({
      where: { id }
    });
  }

  async count(where?: Record<string, unknown>): Promise<number> {
    return await this.prisma.transaction.count({ where });
  }

  async getUserTransactionStats(userId: number): Promise<TransactionStatsResult> {
    const [
      totalTransactions,
      deposits,
      withdrawals,
      bets,
      wins
    ] = await Promise.all([
      this.prisma.transaction.count({
        where: { userId }
      }),
      this.prisma.transaction.aggregate({
        where: { 
          userId,
          type: 'DEPOSIT'
        },
        _sum: { amount: true }
      }),
      this.prisma.transaction.aggregate({
        where: { 
          userId,
          type: 'WITHDRAWAL'
        },
        _sum: { amount: true }
      }),
      this.prisma.transaction.aggregate({
        where: { 
          userId,
          type: 'BET'
        },
        _sum: { amount: true }
      }),
      this.prisma.transaction.aggregate({
        where: { 
          userId,
          type: 'WIN'
        },
        _sum: { amount: true }
      })
    ]);

    const totalDeposits = Number(deposits._sum.amount || 0);
    const totalWithdrawals = Number(withdrawals._sum.amount || 0);
    const totalBets = Number(bets._sum.amount || 0);
    const totalWins = Number(wins._sum.amount || 0);

    return {
      totalTransactions,
      totalDeposits,
      totalWithdrawals: Math.abs(totalWithdrawals),
      totalBets: Math.abs(totalBets),
      totalWins,
      netAmount: totalDeposits + totalWithdrawals + totalBets + totalWins
    };
  }
} 