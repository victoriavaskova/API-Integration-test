import { PrismaClient } from '@prisma/client';
import type { 
  Bet, 
  BetWithRelations,
  CreateBetData, 
  UpdateBetData, 
  BetStatus
} from '../types/database.js';
import type { BaseRepository, FindManyOptions, PaginatedResult } from './base.repository.js';

export interface BetRepository extends BaseRepository<Bet, CreateBetData, UpdateBetData> {
  findByExternalId(externalBetId: string): Promise<Bet | null>;
  findByUserId(userId: number, options?: FindManyOptions): Promise<Bet[]>;
  findByUserIdPaginated(userId: number, page: number, limit: number): Promise<PaginatedResult<Bet>>;
  findByUserIdWithRelations(userId: number, options?: FindManyOptions): Promise<BetWithRelations[]>;
  findPendingBets(userId?: number): Promise<Bet[]>;
  findCompletedBets(userId?: number): Promise<Bet[]>;
  updateStatus(id: number, status: BetStatus, winAmount?: number): Promise<Bet>;
  completeBet(id: number, winAmount: number): Promise<Bet>;
  getUserBetsStats(userId: number): Promise<BetStatsResult>;
}

export interface BetStatsResult {
  totalBets: number;
  totalWagered: number;
  totalWon: number;
  winRate: number;
  pendingBets: number;
}

export class PrismaBetRepository implements BetRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: number): Promise<Bet | null> {
    return await this.prisma.bet.findUnique({
      where: { id }
    });
  }

  async findMany(options?: FindManyOptions): Promise<Bet[]> {
    return await this.prisma.bet.findMany({
      where: options?.where,
      orderBy: options?.orderBy,
      skip: options?.skip,
      take: options?.take,
      include: options?.include
    });
  }

  async findByExternalId(externalBetId: string): Promise<Bet | null> {
    return await this.prisma.bet.findUnique({
      where: { externalBetId }
    });
  }

  async findByUserId(userId: number, options?: FindManyOptions): Promise<Bet[]> {
    return await this.prisma.bet.findMany({
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

  async findByUserIdPaginated(userId: number, page: number = 1, limit: number = 10): Promise<PaginatedResult<Bet>> {
    const skip = (page - 1) * limit;
    
    const [data, total] = await Promise.all([
      this.prisma.bet.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.bet.count({
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

  async findByUserIdWithRelations(userId: number, options?: FindManyOptions): Promise<BetWithRelations[]> {
    return await this.prisma.bet.findMany({
      where: { 
        userId,
        ...options?.where
      },
      include: {
        user: true,
        transactions: true
      },
      orderBy: options?.orderBy || { createdAt: 'desc' },
      skip: options?.skip,
      take: options?.take
    });
  }

  async findPendingBets(userId?: number): Promise<Bet[]> {
    return await this.prisma.bet.findMany({
      where: {
        status: 'PENDING',
        ...(userId && { userId })
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findCompletedBets(userId?: number): Promise<Bet[]> {
    return await this.prisma.bet.findMany({
      where: {
        status: 'COMPLETED',
        ...(userId && { userId })
      },
      orderBy: { completedAt: 'desc' }
    });
  }

  async create(data: CreateBetData): Promise<Bet> {
    return await this.prisma.bet.create({
      data
    });
  }

  async update(id: number, data: UpdateBetData): Promise<Bet> {
    return await this.prisma.bet.update({
      where: { id },
      data
    });
  }

  async updateStatus(id: number, status: BetStatus, winAmount?: number): Promise<Bet> {
    return await this.prisma.bet.update({
      where: { id },
      data: {
        status,
        ...(winAmount !== undefined && { winAmount }),
        ...(status === 'COMPLETED' && { completedAt: new Date() })
      }
    });
  }

  async completeBet(id: number, winAmount: number): Promise<Bet> {
    return await this.prisma.bet.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        winAmount,
        completedAt: new Date()
      }
    });
  }

  async delete(id: number): Promise<void> {
    await this.prisma.bet.delete({
      where: { id }
    });
  }

  async count(where?: Record<string, unknown>): Promise<number> {
    return await this.prisma.bet.count({ where });
  }

  async getUserBetsStats(userId: number): Promise<BetStatsResult> {
    const [
      totalBets,
      totalWagered,
      totalWon,
      winningBets,
      pendingBets
    ] = await Promise.all([
      this.prisma.bet.count({
        where: { userId }
      }),
      this.prisma.bet.aggregate({
        where: { userId },
        _sum: { amount: true }
      }),
      this.prisma.bet.aggregate({
        where: { 
          userId,
          status: 'COMPLETED',
          winAmount: { gt: 0 }
        },
        _sum: { winAmount: true }
      }),
      this.prisma.bet.count({
        where: { 
          userId,
          status: 'COMPLETED',
          winAmount: { gt: 0 }
        }
      }),
      this.prisma.bet.count({
        where: { 
          userId,
          status: 'PENDING'
        }
      })
    ]);

    const completedBets = await this.prisma.bet.count({
      where: { 
        userId,
        status: 'COMPLETED'
      }
    });

    return {
      totalBets,
      totalWagered: Number(totalWagered._sum.amount || 0),
      totalWon: Number(totalWon._sum.winAmount || 0),
      winRate: completedBets > 0 ? (winningBets / completedBets) * 100 : 0,
      pendingBets
    };
  }
} 