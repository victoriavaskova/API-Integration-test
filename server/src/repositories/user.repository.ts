import { PrismaClient } from '@prisma/client';
import type { 
  User, 
  ExternalApiAccount, 
  CreateUserData, 
  UpdateUserData, 
  UserWithRelations,
  CreateExternalApiAccountData 
} from '../types/database.js';
import type { BaseRepository, FindManyOptions } from './base.repository.js';

export interface UserRepository extends BaseRepository<User, CreateUserData, UpdateUserData> {
  findByUsername(username: string): Promise<User | null>;
  findByUsernameWithRelations(username: string): Promise<UserWithRelations | null>;
  findWithExternalAccount(userId: number): Promise<UserWithRelations | null>;
  findByExternalUserId(externalUserId: string): Promise<User | null>;
  updateLastLogin(userId: number): Promise<void>;
  updateEmail(userId: number, email: string): Promise<void>;
  
  // Методы для работы с внешними аккаунтами
  createExternalAccount(data: CreateExternalApiAccountData): Promise<ExternalApiAccount>;
  getExternalAccount(userId: number): Promise<ExternalApiAccount | null>;
  getExternalAccountByExternalId(externalUserId: string): Promise<ExternalApiAccount | null>;
  updateExternalAccountStatus(userId: number, isActive: boolean): Promise<void>;
}

export class PrismaUserRepository implements UserRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: number): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { id }
    });
  }

  async findMany(options?: FindManyOptions): Promise<User[]> {
    return await this.prisma.user.findMany({
      where: options?.where,
      orderBy: options?.orderBy,
      skip: options?.skip,
      take: options?.take,
      include: options?.include
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { username }
    });
  }

  async findByUsernameWithRelations(username: string): Promise<UserWithRelations | null> {
    return await this.prisma.user.findUnique({
      where: { username },
      include: {
        externalApiAccounts: true,
        userBalance: true,
        bets: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });
  }

  async findWithExternalAccount(userId: number): Promise<UserWithRelations | null> {
    return await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        externalApiAccounts: {
          where: { isActive: true }
        },
        userBalance: true
      }
    });
  }

  async findByExternalUserId(externalUserId: string): Promise<User | null> {
    const externalAccount = await this.prisma.externalApiAccount.findFirst({
      where: { externalUserId },
      include: { user: true }
    });
    
    return externalAccount?.user || null;
  }

  async create(data: CreateUserData): Promise<User> {
    return await this.prisma.user.create({
      data
    });
  }

  async update(id: number, data: UpdateUserData): Promise<User> {
    return await this.prisma.user.update({
      where: { id },
      data
    });
  }

  async delete(id: number): Promise<void> {
    await this.prisma.user.delete({
      where: { id }
    });
  }

  async count(where?: Record<string, unknown>): Promise<number> {
    return await this.prisma.user.count({ where });
  }

  async updateLastLogin(userId: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLogin: new Date() }
    });
  }

  async updateEmail(userId: number, email: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { email }
    });
  }

  // Методы для работы с внешними аккаунтами
  async createExternalAccount(data: CreateExternalApiAccountData): Promise<ExternalApiAccount> {
    return await this.prisma.externalApiAccount.create({
      data
    });
  }

  async getExternalAccount(userId: number): Promise<ExternalApiAccount | null> {
    return await this.prisma.externalApiAccount.findFirst({
      where: { 
        userId,
        isActive: true 
      }
    });
  }

  async getExternalAccountByExternalId(externalUserId: string): Promise<ExternalApiAccount | null> {
    return await this.prisma.externalApiAccount.findFirst({
      where: { 
        externalUserId,
        isActive: true 
      }
    });
  }

  async updateExternalAccountStatus(userId: number, isActive: boolean): Promise<void> {
    await this.prisma.externalApiAccount.updateMany({
      where: { userId },
      data: { isActive }
    });
  }
} 