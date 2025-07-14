import type { Response } from 'express';

/**
 * Хелпер для создания стандартизированных ответов согласно спецификации README
 */

/**
 * Стандартный формат ошибки
 */
export interface ApiErrorResponse {
  statusCode: number;
  error: string;
  message: string;
}

/**
 * Отправляет успешный ответ с данными
 */
export function sendSuccessResponse(res: Response, statusCode: number, data: any): void {
  res.status(statusCode).json(data);
}

/**
 * Отправляет ответ об ошибке в формате README
 */
export function sendErrorResponse(res: Response, statusCode: number, error: string, message: string): void {
  const errorResponse: ApiErrorResponse = {
    statusCode,
    error,
    message
  };
  res.status(statusCode).json(errorResponse);
}

/**
 * Конвертирует внутренний код ошибки в стандартный HTTP статус и описание
 */
export function getErrorDetails(errorCode?: string): { statusCode: number; error: string } {
  switch (errorCode) {
    case 'UNAUTHORIZED':
    case 'AUTHENTICATION_FAILED':
    case 'INVALID_CREDENTIALS':
      return { statusCode: 401, error: 'Unauthorized' };
    
    case 'FORBIDDEN':
      return { statusCode: 403, error: 'Forbidden' };
    
    case 'NOT_FOUND':
    case 'USER_NOT_FOUND':
    case 'BET_NOT_FOUND':
    case 'BALANCE_NOT_FOUND':
      return { statusCode: 404, error: 'Not Found' };
    
    case 'VALIDATION_ERROR':
    case 'INVALID_BET_AMOUNT':
    case 'INSUFFICIENT_BALANCE':
      return { statusCode: 400, error: 'Bad Request' };
    
    case 'USER_ALREADY_EXISTS':
      return { statusCode: 409, error: 'Conflict' };
    
    case 'EXTERNAL_API_ERROR':
    case 'EXTERNAL_API_UNAVAILABLE':
      return { statusCode: 502, error: 'Bad Gateway' };
    
    default:
      return { statusCode: 500, error: 'Internal Server Error' };
  }
}

/**
 * Форматирует ID как строку согласно спецификации README
 */
export function formatId(id: number): string {
  return id.toString();
}

/**
 * Форматирует дату в ISO строку
 */
export function formatDate(date: Date): string {
  return date.toISOString();
} 