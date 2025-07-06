import { BetStatus, TransactionType } from './database.js';

// Типы для аутентификации
export interface LoginRequest {
  username: string;
}

export interface LoginResponse {
  token: string;
  expiresIn: number;
}

export interface JwtPayload {
  userId: number;
  username: string;
  iat: number;
  exp: number;
}

// Типы для ставок
export interface CreateBetRequest {
  amount: number;
}

export interface BetResponse {
  id: string;
  amount: number;
  status: BetStatus;
  win_amount?: number;
  created_at: string;
  completed_at?: string;
}

export interface GetBetsResponse {
  bets: BetResponse[];
}

export interface RecommendedBetResponse {
  recommended_amount: number;
}

// Типы для баланса
export interface BalanceResponse {
  balance: number;
  last_updated: string;
}

// Типы для транзакций
export interface TransactionResponse {
  id: string;
  type: TransactionType;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string | null;
  created_at: string;
}

export interface GetTransactionsResponse {
  transactions: TransactionResponse[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface GetTransactionsQuery {
  page?: string;
  limit?: string;
}

// Типы для health check
export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  services: {
    api: 'ok' | 'error';
    database: 'ok' | 'error';
    external_api: 'ok' | 'error';
  };
}

// Типы для обработки ошибок
export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}

export interface ValidationError extends ApiError {
  errors: Array<{
    field: string;
    message: string;
  }>;
}

// Типы для middleware
export interface AuthenticatedRequest extends Express.Request {
  user: {
    userId: number;
    username: string;
  };
}

export interface RequestWithUser extends Express.Request {
  user?: {
    userId: number;
    username: string;
  };
}

// Типы для валидации запросов
export interface CreateBetValidation {
  amount: number;
}

export interface LoginValidation {
  username: string;
}

export interface PaginationValidation {
  page?: number;
  limit?: number;
}

// Типы для сервисов
export interface BetService {
  createBet(userId: number, amount: number): Promise<BetResponse>;
  getBets(userId: number): Promise<GetBetsResponse>;
  getBet(userId: number, betId: string): Promise<BetResponse>;
  getRecommendedBet(userId: number): Promise<RecommendedBetResponse>;
}

export interface BalanceService {
  getBalance(userId: number): Promise<BalanceResponse>;
  updateBalance(userId: number, amount: number): Promise<BalanceResponse>;
}

export interface TransactionService {
  getTransactions(userId: number, options?: PaginationOptions): Promise<GetTransactionsResponse>;
  createTransaction(data: import('./database.js').CreateTransactionData): Promise<TransactionResponse>;
}

export interface AuthService {
  login(username: string): Promise<LoginResponse>;
  verifyToken(token: string): Promise<JwtPayload>;
  generateToken(userId: number, username: string): Promise<string>;
}

// Типы для репозиториев
export interface UserRepository {
  findById(id: number): Promise<import('./database.js').User | null>;
  findByUsername(username: string): Promise<import('./database.js').User | null>;
  create(data: import('./database.js').CreateUserData): Promise<import('./database.js').User>;
  update(id: number, data: import('./database.js').UpdateUserData): Promise<import('./database.js').User>;
}

export interface BetRepository {
  create(data: import('./database.js').CreateBetData): Promise<import('./database.js').Bet>;
  findById(id: number): Promise<import('./database.js').Bet | null>;
  findByUserId(userId: number): Promise<import('./database.js').Bet[]>;
  findByExternalBetId(externalBetId: string): Promise<import('./database.js').Bet | null>;
  update(id: number, data: import('./database.js').UpdateBetData): Promise<import('./database.js').Bet>;
}

export interface TransactionRepository {
  create(data: import('./database.js').CreateTransactionData): Promise<import('./database.js').Transaction>;
  findByUserId(userId: number, options?: PaginationOptions): Promise<PaginatedResult<import('./database.js').Transaction>>;
  findById(id: number): Promise<import('./database.js').Transaction | null>;
}

export interface UserBalanceRepository {
  findByUserId(userId: number): Promise<import('./database.js').UserBalance | null>;
  create(data: import('./database.js').CreateUserBalanceData): Promise<import('./database.js').UserBalance>;
  update(userId: number, data: import('./database.js').UpdateUserBalanceData): Promise<import('./database.js').UserBalance>;
}

// Типы для внутренних эндпоинтов
export interface InternalTestRequest {
  user_id: string;
  bet?: number;
  bet_id?: string;
  balance?: number;
  expected_balance?: number;
}

export interface InternalTestResponse<T = unknown> {
  success: boolean;
  external_response: T;
  error?: string;
}

// Типы для настройки пагинации
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

// Экспорт типов из других файлов для удобства
export type {
  User,
  Bet,
  Transaction,
  UserBalance,
  CreateUserData,
  CreateBetData,
  CreateTransactionData,
  UpdateUserData,
  UpdateBetData,
  UpdateUserBalanceData,
  UserWithRelations,
  BetWithRelations,
  TransactionWithRelations
} from './database.js';

// Глобальные типы для Express
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        username: string;
      };
    }
  }
} 