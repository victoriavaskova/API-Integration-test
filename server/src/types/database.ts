import { Decimal } from '@prisma/client/runtime/library';

// Enum типы
export enum BetStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  BET = 'BET',
  WIN = 'WIN'
}

// Основные типы моделей
export interface User {
  id: number;
  username: string;
  email: string | null;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExternalApiAccount {
  id: number;
  userId: number;
  externalUserId: string;
  externalSecretKey: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Bet {
  id: number;
  userId: number;
  externalBetId: string;
  amount: Decimal;
  status: BetStatus;
  winAmount: Decimal | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface Transaction {
  id: number;
  userId: number;
  betId: number | null;
  type: TransactionType;
  amount: Decimal;
  balanceBefore: Decimal;
  balanceAfter: Decimal;
  createdAt: Date;
  description: string | null;
}

export interface ApiLog {
  id: number;
  userId: number | null;
  endpoint: string;
  method: string;
  requestBody: unknown | null;
  responseBody: unknown | null;
  statusCode: number;
  createdAt: Date;
  requestDurationMs: number | null;
  ipAddress: string | null;
}

export interface UserBalance {
  id: number;
  userId: number;
  balance: Decimal;
  externalBalance: Decimal | null;
  lastCheckedAt: Date | null;
}

// Типы для создания записей (без auto-generated полей)
export interface CreateUserData {
  username: string;
  email?: string;
}

export interface CreateExternalApiAccountData {
  userId: number;
  externalUserId: string;
  externalSecretKey: string;
  isActive?: boolean;
}

export interface CreateBetData {
  userId: number;
  externalBetId: string;
  amount: Decimal;
  status?: BetStatus;
}

export interface CreateTransactionData {
  userId: number;
  betId?: number;
  type: TransactionType;
  amount: Decimal;
  balanceBefore: Decimal;
  balanceAfter: Decimal;
  description?: string;
}

export interface CreateApiLogData {
  userId?: number;
  endpoint: string;
  method: string;
  requestBody?: unknown;
  responseBody?: unknown;
  statusCode: number;
  requestDurationMs?: number;
  ipAddress?: string;
}

export interface CreateUserBalanceData {
  userId: number;
  balance?: Decimal;
  externalBalance?: Decimal;
}

// Типы для обновления записей
export interface UpdateUserData {
  username?: string;
  email?: string;
  lastLogin?: Date;
}

export interface UpdateBetData {
  status?: BetStatus;
  winAmount?: Decimal;
  completedAt?: Date;
}

export interface UpdateUserBalanceData {
  balance?: Decimal;
  externalBalance?: Decimal;
  lastCheckedAt?: Date;
}

// Типы для включения связанных данных
export interface UserWithRelations extends User {
  externalApiAccounts?: ExternalApiAccount[];
  bets?: Bet[];
  transactions?: Transaction[];
  apiLogs?: ApiLog[];
  userBalance?: UserBalance;
}

export interface BetWithRelations extends Bet {
  user?: User;
  transactions?: Transaction[];
}

export interface TransactionWithRelations extends Transaction {
  user?: User;
  bet?: Bet;
}

// Типы для пагинации
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
} 