// Типы для заголовков запросов
export interface ExternalApiHeaders {
  'user-id': string;
  'x-signature': string;
  'Content-Type': 'application/json';
}

// Типы для запросов к внешнему API
export interface AuthRequest {
  // Тело может быть пустым для аутентификации
}

export interface BalanceRequest {
  balance?: number; // Опционально для установки баланса
}

export interface BetRequest {
  bet: number; // Сумма ставки от 1 до 5
}

export interface WinRequest {
  bet_id: string; // ID ставки для проверки результата
}

export interface CheckBalanceRequest {
  expected_balance: number; // Ожидаемый баланс для проверки
}

// Типы для ответов внешнего API
export interface AuthResponse {
  message: string;
  user_id: string;
  username: string;
}

export interface BalanceResponse {
  balance: number;
  message?: string; // Для случая установки баланса
}

export interface BetResponse {
  bet_id: string;
  message: string;
}

export interface RecommendedBetResponse {
  bet: number; // Рекомендуемая ставка
}

export interface WinResponse {
  win: number; // Сумма выигрыша (0 если проиграл)
  message: string;
}

export interface CheckBalanceResponse {
  is_correct: boolean;
  balance: number;
  message?: string; // Для случая неверного баланса
  correct_balance?: number; // Фактический баланс если неверный
}

// Общий тип для ошибок внешнего API
export interface ExternalApiError {
  error: string;
  message: string;
  statusCode: number;
}

// Типы для конфигурации внешнего API
export interface ExternalApiConfig {
  baseUrl: string;
  userId: number;
  secretKey: string | undefined;
  endpoints: {
    health: string;
    auth: string;
    balance: string;
    checkBalance: string;
    bet: string;
    win: string;
  };
  rateLimits: {
    global: string;
    auth: string;
    betting: string;
  };
}

// Типы для внутренних эндпоинтов тестирования
export interface InternalAuthRequest {
  user_id: string;
}

export interface InternalBalanceRequest {
  user_id: string;
  balance?: number;
}

export interface InternalBetRequest {
  user_id: string;
  bet?: number; // Опционально для получения рекомендуемой ставки
}

export interface InternalWinRequest {
  user_id: string;
  bet_id: string;
}

export interface InternalCheckBalanceRequest {
  user_id: string;
  expected_balance: number;
}

// Типы для ответов внутренних эндпоинтов
export interface InternalApiResponse<T = unknown> {
  success: boolean;
  external_response: T;
  error?: string;
}

// Типы для логирования API запросов
export interface ApiRequestLog {
  endpoint: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  userId?: number;
  timestamp: Date;
}

export interface ApiResponseLog {
  statusCode: number;
  body: unknown;
  duration: number;
  timestamp: Date;
}

// Типы для результатов запросов
export type ExternalApiResult<T> = {
  success: true;
  data: T;
  statusCode: number;
  duration: number;
} | {
  success: false;
  error: ExternalApiError;
  statusCode: number;
  duration: number;
};

// Константы для валидации
export const BET_AMOUNT_LIMITS = {
  MIN: 1,
  MAX: 5
} as const;

export const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE'
} as const;

export type HttpMethod = typeof HTTP_METHODS[keyof typeof HTTP_METHODS]; 