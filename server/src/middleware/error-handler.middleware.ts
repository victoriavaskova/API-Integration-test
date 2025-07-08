import type { Request, Response, NextFunction } from 'express';
// import type { ServiceError } from '../services/base.service.js';

/**
 * Интерфейс для стандартизированного ответа с ошибкой
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    path: string;
    method: string;
    requestId?: string;
  };
}

/**
 * Расширенная информация об ошибке для логирования
 */
export interface ErrorLogInfo {
  error: Error;
  request: {
    method: string;
    path: string;
    query: any;
    body: any;
    user?: {
      userId: number;
      username: string;
    };
    ip: string;
    userAgent: string;
  };
  timestamp: Date;
  requestId?: string;
}

/**
 * Главный middleware для обработки ошибок
 */
export function errorHandlerMiddleware() {
  return (error: any, req: Request, res: Response, _next: NextFunction): void => {
    // Генерируем уникальный ID запроса для трекинга
    const requestId = generateRequestId();
    
    // Создаем объект для логирования
    const errorLogInfo: ErrorLogInfo = {
      error,
      request: {
        method: req.method,
        path: req.path,
        query: req.query,
        body: sanitizeRequestBody(req.body),
        user: (req as any).user,
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown'
      },
      timestamp: new Date(),
      requestId
    };

    // Логируем ошибку
    logError(errorLogInfo);

    // Определяем статус код и создаем ответ
    const statusCode = getStatusCodeFromError(error);
    const errorResponse = createErrorResponse(error, req, requestId);

    res.status(statusCode).json(errorResponse);
  };
}

/**
 * Middleware для перехвата необработанных ошибок
 */
export function asyncErrorHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Middleware для обработки 404 ошибок
 */
export function notFoundHandler() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const error = new Error(`Route not found: ${req.method} ${req.path}`);
    error.name = 'NotFoundError';
    next(error);
  };
}

/**
 * Middleware для валидации JSON
 */
export function jsonErrorHandler() {
  return (error: any, req: Request, res: Response, next: NextFunction): void => {
    if (error instanceof SyntaxError && 'body' in error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Invalid JSON in request body',
          details: {
            position: (error as any).body,
            received: typeof req.body
          },
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method
        }
      });
      return;
    }
    next(error);
  };
}

/**
 * Определяет HTTP статус код на основе типа ошибки
 */
function getStatusCodeFromError(error: any): number {
  // Service errors с кодами
  if (error.code) {
    switch (error.code) {
      case 'UNAUTHORIZED':
      case 'AUTHENTICATION_FAILED':
      case 'INVALID_CREDENTIALS':
        return 401;
      
      case 'FORBIDDEN':
        return 403;
      
      case 'NOT_FOUND':
      case 'USER_NOT_FOUND':
      case 'BET_NOT_FOUND':
      case 'BALANCE_NOT_FOUND':
        return 404;
      
      case 'VALIDATION_ERROR':
      case 'INVALID_BET_AMOUNT':
      case 'INSUFFICIENT_BALANCE':
        return 400;
      
      case 'USER_ALREADY_EXISTS':
        return 409;
      
      case 'EXTERNAL_API_ERROR':
      case 'EXTERNAL_API_UNAVAILABLE':
        return 502;
      
      default:
        return 500;
    }
  }

  // Стандартные ошибки по имени
  switch (error.name) {
    case 'ValidationError':
      return 400;
    case 'UnauthorizedError':
      return 401;
    case 'ForbiddenError':
      return 403;
    case 'NotFoundError':
      return 404;
    case 'ConflictError':
      return 409;
    case 'RateLimitError':
      return 429;
    default:
      return 500;
  }
}

/**
 * Создает стандартизированный ответ с ошибкой
 */
function createErrorResponse(error: any, req: Request, requestId: string): ErrorResponse {
  // Если это уже Service Error
  if (error.code && error.message) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
        requestId
      }
    };
  }

  // Обработка стандартных ошибок
  const code = error.code || error.name || 'INTERNAL_ERROR';
  const message = error.message || 'An unexpected error occurred';

  return {
    success: false,
    error: {
      code,
      message: process.env.NODE_ENV === 'production' ? getSafeErrorMessage(code) : message,
      details: process.env.NODE_ENV === 'production' ? undefined : {
        stack: error.stack,
        originalError: error.toString()
      },
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      requestId
    }
  };
}

/**
 * Возвращает безопасное сообщение об ошибке для продакшена
 */
function getSafeErrorMessage(code: string): string {
  const safeMessages: Record<string, string> = {
    'INTERNAL_ERROR': 'Internal server error occurred',
    'VALIDATION_ERROR': 'Invalid request data',
    'UNAUTHORIZED': 'Authentication required',
    'FORBIDDEN': 'Access denied',
    'NOT_FOUND': 'Resource not found',
    'EXTERNAL_API_ERROR': 'External service unavailable'
  };

  return safeMessages[code] || 'An error occurred';
}

/**
 * Логирует информацию об ошибке
 */
function logError(errorInfo: ErrorLogInfo): void {
  const { error, request, timestamp, requestId } = errorInfo;
  
  const logEntry = {
    level: 'error',
    timestamp: timestamp.toISOString(),
    requestId,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code
    },
    request: {
      method: request.method,
      path: request.path,
      query: request.query,
      user: request.user,
      ip: request.ip,
      userAgent: request.userAgent
    }
  };

  console.error('[ERROR]', JSON.stringify(logEntry, null, 2));

  // В продакшене можно интегрировать с внешними системами логирования
  if (process.env.NODE_ENV === 'production') {
    // Отправка в Sentry, LogRocket, etc.
  }
}

/**
 * Очищает тело запроса от чувствительных данных для логирования
 */
function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
  const sanitized = { ...body };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Генерирует уникальный ID запроса
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Middleware для логирования всех запросов
 */
export function requestLoggingMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const requestId = generateRequestId();
    
    // Добавляем requestId к запросу
    (req as any).requestId = requestId;

    // Логируем начало запроса
    console.log(`[REQUEST] ${requestId} ${req.method} ${req.path}`, {
      query: req.query,
      user: (req as any).user?.username || 'anonymous',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });

    // Перехватываем завершение ответа
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any): typeof res {
      const duration = Date.now() - startTime;
      console.log(`[RESPONSE] ${requestId} ${res.statusCode} ${duration}ms`);
      return originalEnd.call(this, chunk, encoding);
    };

    next();
  };
}

/**
 * Middleware для валидации типов данных
 */
export function validateContentType(allowedTypes: string[] = ['application/json']) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Пропускаем GET запросы и запросы без тела
    if (req.method === 'GET' || req.method === 'DELETE' || !req.body) {
      return next();
    }

    const contentType = req.get('Content-Type');
    
    if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
      res.status(415).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'Unsupported Content-Type',
          details: {
            received: contentType || 'none',
            supported: allowedTypes
          },
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method
        }
      });
      return;
    }

    next();
  };
}

/**
 * Middleware для ограничения размера тела запроса
 */
export function bodySizeValidator(maxSize: string = '10mb') {
  return (error: any, req: Request, res: Response, next: NextFunction): void => {
    if (error.code === 'LIMIT_FILE_SIZE' || error.type === 'entity.too.large') {
      res.status(413).json({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Request body too large',
          details: {
            maxSize,
            received: req.get('Content-Length')
          },
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method
        }
      });
      return;
    }
    next(error);
  };
} 