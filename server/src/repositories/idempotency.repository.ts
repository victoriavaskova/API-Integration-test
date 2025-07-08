import type { PrismaClient, IdempotencyKey } from '@prisma/client';
import { createHash } from 'crypto';

export interface IdempotencyKeyRepository {
  find(key: string): Promise<IdempotencyKey | null>;
  create(data: {
    key: string;
    userId: number;
    endpoint: string;
    requestBody: any;
  }): Promise<IdempotencyKey>;
  update(key: string, data: {
    responseBody: any;
    statusCode: number;
  }): Promise<IdempotencyKey>;
  isLocked(key: string, timeoutMs?: number): Promise<boolean>;
}

export class PrismaIdempotencyKeyRepository implements IdempotencyKeyRepository {
  constructor(private prisma: PrismaClient) {}

  private generateRequestHash(body: any): string {
    return createHash('sha256').update(JSON.stringify(body)).digest('hex');
  }

  async find(key: string): Promise<IdempotencyKey | null> {
    return this.prisma.idempotencyKey.findUnique({
      where: { id: key },
    });
  }

  async create(data: {
    key: string;
    userId: number;
    endpoint: string;
    requestBody: any;
  }): Promise<IdempotencyKey> {
    const requestHash = this.generateRequestHash(data.requestBody);

    return this.prisma.idempotencyKey.create({
      data: {
        id: data.key,
        userId: data.userId,
        endpoint: data.endpoint,
        requestHash: requestHash,
        responseBody: {},
        statusCode: 0,
        lockedAt: new Date(),
      },
    });
  }

  async update(key: string, data: {
    responseBody: any;
    statusCode: number;
  }): Promise<IdempotencyKey> {
    return this.prisma.idempotencyKey.update({
      where: { id: key },
      data: {
        responseBody: data.responseBody,
        statusCode: data.statusCode,
      },
    });
  }

  async isLocked(key: string, timeoutMs: number = 5000): Promise<boolean> {
    const record = await this.find(key);
    if (!record) {
      return false;
    }

    // Если запись завершена (есть statusCode), она не заблокирована
    if (record.statusCode > 0) {
      return false;
    }
    
    // Если запись не завершена, проверяем время блокировки
    const timeSinceLock = Date.now() - new Date(record.lockedAt).getTime();
    return timeSinceLock < timeoutMs;
  }
} 