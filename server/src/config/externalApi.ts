import crypto from 'crypto';
import type { ExternalApiConfig } from '../types/config.js';

export const EXTERNAL_API_CONFIG: ExternalApiConfig = {
  baseUrl: process.env.EXTERNAL_API_URL || 'https://bets.tgapps.cloud/api',
  
  endpoints: {
    health: '/health',
    auth: '/auth',
    balance: '/balance',
    checkBalance: '/check-balance',
    bet: '/bet',
    win: '/win',
  },
  
  rateLimits: {
    global: '100 requests per 15 minutes',
    auth: '10 requests per 15 minutes',
    betting: '20 requests per minute',
  },
};

/**
 * Создает HMAC SHA-512 подпись для запроса к внешнему API
 * @param body - Тело запроса (может быть undefined для GET запросов)
 * @param secretKey - Секретный ключ для создания подписи
 * @returns Подпись в шестнадцатеричном формате
 */
export function createSignature(
  body: Record<string, unknown> | undefined,
  secretKey: string,
): string {
  if (!secretKey) {
    throw new Error('Secret key is required for signature creation');
  }

  const payload = JSON.stringify(body ?? {});
  return crypto.createHmac('sha512', secretKey).update(payload).digest('hex');
}

/**
 * Валидирует конфигурацию внешнего API
 * @throws Error если отсутствуют обязательные переменные окружения
 */
export function validateExternalApiConfig(): void {
  const requiredVars = [
    'EXTERNAL_API_URL'
  ] as const;

  const missing = requiredVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Проверяем корректность URL
  const apiUrl = process.env.EXTERNAL_API_URL;
  if (!apiUrl || !apiUrl.startsWith('http')) {
    throw new Error('EXTERNAL_API_URL must be a valid HTTP/HTTPS URL');
  }
}

/**
 * Валидирует пользовательские данные для внешнего API
 * @param externalUserId - ID пользователя во внешнем API
 * @param secretKey - Секретный ключ пользователя
 * @throws Error если данные некорректны
 */
export function validateUserCredentials(externalUserId: string, secretKey: string): void {
  if (!externalUserId || externalUserId.trim() === '') {
    throw new Error('External user ID is required');
  }

  const userId = Number(externalUserId);
  if (isNaN(userId) || userId <= 0 || userId > 30) {
    throw new Error('External user ID must be a number between 1 and 30');
  }

  if (!secretKey || secretKey.length < 16) {
    throw new Error('Secret key must be at least 16 characters long');
  }
}

/**
 * Создает заголовки для запроса к внешнему API
 * @param signature - HMAC подпись
 * @param userId - ID пользователя
 * @returns Объект заголовков
 */
export function createExternalApiHeaders(
  signature: string,
  userId: string
): Record<string, string> {
  return {
    'user-id': userId,
    'x-signature': signature,
    'Content-Type': 'application/json',
  };
}

/**
 * Получает полный URL для эндпоинта
 * @param endpoint - Название эндпоинта
 * @returns Полный URL
 */
export function getExternalApiUrl(
  endpoint: keyof ExternalApiConfig['endpoints']
): string {
  const baseUrl = EXTERNAL_API_CONFIG.baseUrl;
  const endpointPath = EXTERNAL_API_CONFIG.endpoints[endpoint];
  
  return `${baseUrl}${endpointPath}`;
}

/**
 * Создает таймаут для запроса в зависимости от типа операции
 * @param operation - Тип операции
 * @returns Таймаут в миллисекундах
 */
export function getOperationTimeout(
  operation: 'auth' | 'balance' | 'bet' | 'win' | 'health'
): number {
  const timeouts: Record<string, number> = {
    auth: 5000,     // 5 секунд
    balance: 3000,  // 3 секунды
    bet: 10000,     // 10 секунд
    win: 10000,     // 10 секунд
    health: 2000,   // 2 секунды
  };

  return timeouts[operation] || 5000;
}

/**
 * Проверяет, является ли код ответа успешным
 * @param statusCode - HTTP код ответа
 * @returns true если код успешный (2xx)
 */
export function isSuccessStatusCode(statusCode: number): boolean {
  return statusCode >= 200 && statusCode < 300;
}

/**
 * Создает уникальный идентификатор запроса для логирования
 * @returns Уникальный идентификатор
 */
export function createRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
