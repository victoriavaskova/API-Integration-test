import { PrismaClient } from '@prisma/client';
import type { 
  ApiLog, 
  CreateApiLogData 
} from '../types/database.js';
import type { BaseRepository, FindManyOptions, PaginatedResult } from './base.repository.js';

export interface ApiLogRepository extends BaseRepository<ApiLog, CreateApiLogData, never> {
  findByUserId(userId: number, options?: FindManyOptions): Promise<ApiLog[]>;
  findByUserIdPaginated(userId: number, page: number, limit: number): Promise<PaginatedResult<ApiLog>>;
  findByEndpoint(endpoint: string, options?: FindManyOptions): Promise<ApiLog[]>;
  findByStatusCode(statusCode: number, options?: FindManyOptions): Promise<ApiLog[]>;
  findErrorLogs(options?: FindManyOptions): Promise<ApiLog[]>;
  findSlowRequests(minDuration: number, options?: FindManyOptions): Promise<ApiLog[]>;
  createApiLog(data: CreateApiLogData): Promise<ApiLog>;
  getApiStats(userId?: number): Promise<ApiStatsResult>;
  cleanupOldLogs(olderThanDays: number): Promise<number>;
}

export interface ApiStatsResult {
  totalRequests: number;
  successRequests: number;
  errorRequests: number;
  averageResponseTime: number;
  slowestRequest: number;
  mostUsedEndpoint: string;
  errorRate: number;
}

export class PrismaApiLogRepository implements ApiLogRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: number): Promise<ApiLog | null> {
    return await this.prisma.apiLog.findUnique({
      where: { id }
    });
  }

  async findMany(options?: FindManyOptions): Promise<ApiLog[]> {
    return await this.prisma.apiLog.findMany({
      where: options?.where,
      orderBy: options?.orderBy || { createdAt: 'desc' },
      skip: options?.skip,
      take: options?.take,
      include: options?.include
    });
  }

  async findByUserId(userId: number, options?: FindManyOptions): Promise<ApiLog[]> {
    return await this.prisma.apiLog.findMany({
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

  async findByUserIdPaginated(userId: number, page: number = 1, limit: number = 10): Promise<PaginatedResult<ApiLog>> {
    const skip = (page - 1) * limit;
    
    const [data, total] = await Promise.all([
      this.prisma.apiLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.apiLog.count({
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

  async findByEndpoint(endpoint: string, options?: FindManyOptions): Promise<ApiLog[]> {
    return await this.prisma.apiLog.findMany({
      where: { 
        endpoint,
        ...options?.where
      },
      orderBy: options?.orderBy || { createdAt: 'desc' },
      skip: options?.skip,
      take: options?.take,
      include: options?.include
    });
  }

  async findByStatusCode(statusCode: number, options?: FindManyOptions): Promise<ApiLog[]> {
    return await this.prisma.apiLog.findMany({
      where: { 
        statusCode,
        ...options?.where
      },
      orderBy: options?.orderBy || { createdAt: 'desc' },
      skip: options?.skip,
      take: options?.take,
      include: options?.include
    });
  }

  async findErrorLogs(options?: FindManyOptions): Promise<ApiLog[]> {
    return await this.prisma.apiLog.findMany({
      where: { 
        statusCode: { gte: 400 },
        ...options?.where
      },
      orderBy: options?.orderBy || { createdAt: 'desc' },
      skip: options?.skip,
      take: options?.take,
      include: options?.include
    });
  }

  async findSlowRequests(minDuration: number, options?: FindManyOptions): Promise<ApiLog[]> {
    return await this.prisma.apiLog.findMany({
      where: { 
        requestDurationMs: { gte: minDuration },
        ...options?.where
      },
      orderBy: options?.orderBy || { requestDurationMs: 'desc' },
      skip: options?.skip,
      take: options?.take,
      include: options?.include
    });
  }

  async create(data: CreateApiLogData): Promise<ApiLog> {
    const prismaData: any = {
      endpoint: data.endpoint,
      method: data.method,
      statusCode: data.statusCode,
      userId: data.userId || null,
      requestBody: data.requestBody || null,
      responseBody: data.responseBody || null,
      requestDurationMs: data.requestDurationMs || null,
      ipAddress: data.ipAddress || null
    };
    return await this.prisma.apiLog.create({
      data: prismaData
    });
  }

  async createApiLog(data: CreateApiLogData): Promise<ApiLog> {
    return await this.create(data);
  }

  async update(_id: number, _data: never): Promise<ApiLog> {
    throw new Error('API logs cannot be updated');
  }

  async delete(id: number): Promise<void> {
    await this.prisma.apiLog.delete({
      where: { id }
    });
  }

  async count(where?: Record<string, unknown>): Promise<number> {
    return await this.prisma.apiLog.count({ where });
  }

  async getApiStats(userId?: number): Promise<ApiStatsResult> {
    const whereClause = userId ? { userId } : {};

    const [
      totalRequests,
      successRequests,
      errorRequests,
      avgResponseTime,
      slowestRequest,
      endpointStats
    ] = await Promise.all([
      this.prisma.apiLog.count({ where: whereClause }),
      this.prisma.apiLog.count({ 
        where: { 
          ...whereClause,
          statusCode: { lt: 400 }
        }
      }),
      this.prisma.apiLog.count({ 
        where: { 
          ...whereClause,
          statusCode: { gte: 400 }
        }
      }),
      this.prisma.apiLog.aggregate({
        where: whereClause,
        _avg: { requestDurationMs: true }
      }),
      this.prisma.apiLog.aggregate({
        where: whereClause,
        _max: { requestDurationMs: true }
      }),
      this.prisma.apiLog.groupBy({
        by: ['endpoint'],
        where: whereClause,
        _count: { endpoint: true },
        orderBy: { _count: { endpoint: 'desc' } },
        take: 1
      })
    ]);

    return {
      totalRequests,
      successRequests,
      errorRequests,
      averageResponseTime: Number(avgResponseTime._avg.requestDurationMs || 0),
      slowestRequest: Number(slowestRequest._max.requestDurationMs || 0),
      mostUsedEndpoint: endpointStats[0]?.endpoint || '',
      errorRate: totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0
    };
  }

  async cleanupOldLogs(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.apiLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate }
      }
    });

    return result.count;
  }
} 