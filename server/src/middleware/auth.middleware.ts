import type { Request, Response, NextFunction } from 'express';
import type { AuthService, TokenPayload } from '../services/auth.service.js';

/**
 * Расширение Request для добавления информации о пользователе
 */
export interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    username: string;
    isAdmin: boolean;
  };
  token: string;
}

/**
 * Опции для middleware аутентификации
 */
export interface AuthMiddlewareOptions {
  optional?: boolean; // Если true, middleware не будет возвращать ошибку при отсутствии токена
  adminOnly?: boolean; // Если true, разрешает доступ только администраторам
}

/**
 * Создает middleware для аутентификации JWT токенов
 */
export function createAuthMiddleware(
  authService: AuthService,
  options: AuthMiddlewareOptions = {}
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Извлекаем токен из заголовков
      const token = extractTokenFromRequest(req);

      // Если токен отсутствует
      if (!token) {
        if (options.optional) {
          return next();
        }
        
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Access token is required',
            details: {
              header_format: 'Authorization: Bearer <token>',
              query_format: '?token=<token>'
            }
          }
        });
        return;
      }

      // Валидируем токен
      const validationResult = await authService.validateToken(token);

      if (!validationResult.success) {
        res.status(401).json({
          success: false,
          error: {
            code: validationResult.error!.code,
            message: validationResult.error!.message,
            details: validationResult.error!.details
          }
        });
        return;
      }

      const tokenPayload = validationResult.data!;
      const isAdmin = tokenPayload.userId === 0; // Специальный ID для админа

      // Проверяем права администратора если требуется
      if (options.adminOnly && !isAdmin) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Administrator access required',
            details: {
              required_role: 'admin',
              current_role: 'user'
            }
          }
        });
        return;
      }

      // Добавляем информацию о пользователе в запрос
      (req as AuthenticatedRequest).user = {
        userId: tokenPayload.userId,
        username: tokenPayload.username,
        isAdmin
      };
      (req as AuthenticatedRequest).token = token;

      next();

    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Authentication failed due to server error'
        }
      });
    }
  };
}

/**
 * Middleware для проверки администраторских прав
 */
export function requireAdmin(authService: AuthService) {
  return createAuthMiddleware(authService, { adminOnly: true });
}

/**
 * Middleware для опциональной аутентификации
 */
export function optionalAuth(authService: AuthService) {
  return createAuthMiddleware(authService, { optional: true });
}

/**
 * Middleware для обязательной аутентификации пользователей
 */
export function requireAuth(authService: AuthService) {
  return createAuthMiddleware(authService);
}

/**
 * Извлекает токен из запроса (заголовок Authorization или query параметр)
 */
function extractTokenFromRequest(req: Request): string | null {
  // Проверяем заголовок Authorization
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Проверяем query параметр token
  const queryToken = req.query.token;
  if (typeof queryToken === 'string') {
    return queryToken;
  }

  // Проверяем заголовок X-Auth-Token
  const xAuthToken = req.headers['x-auth-token'];
  if (typeof xAuthToken === 'string') {
    return xAuthToken;
  }

  return null;
}

/**
 * Type guard для проверки, что запрос аутентифицирован
 */
export function isAuthenticatedRequest(req: Request): req is AuthenticatedRequest {
  return 'user' in req && typeof (req as any).user === 'object';
}

/**
 * Хелпер для получения пользователя из аутентифицированного запроса
 */
export function getUserFromRequest(req: Request): AuthenticatedRequest['user'] | null {
  if (isAuthenticatedRequest(req)) {
    return req.user;
  }
  return null;
}

/**
 * Хелпер для проверки, является ли пользователь администратором
 */
export function isAdminRequest(req: Request): boolean {
  const user = getUserFromRequest(req);
  return user?.isAdmin ?? false;
}

/**
 * Middleware для логирования аутентификации
 */
export function authLoggingMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = getUserFromRequest(req);
    
    if (user) {
      console.log(`[AUTH] ${req.method} ${req.path} - User: ${user.username} (ID: ${user.userId}) ${user.isAdmin ? '[ADMIN]' : '[USER]'}`);
    } else {
      console.log(`[AUTH] ${req.method} ${req.path} - Anonymous request`);
    }
    
    next();
  };
}

/**
 * Middleware для добавления CORS заголовков для аутентификации
 */
export function authCorsMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Разрешаем отправку заголовков аутентификации
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Auth-Token');
    
    // Для preflight запросов
    if (req.method === 'OPTIONS') {
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.status(200).json({});
      return;
    }
    
    next();
  };
}

/**
 * Создает middleware для проверки владельца ресурса
 * Проверяет, что пользователь имеет доступ к ресурсу (либо он владелец, либо админ)
 */
export function createResourceOwnerMiddleware(getUserIdFromParams: (req: Request) => number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const currentUser = getUserFromRequest(req);
      
      if (!currentUser) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
        return;
      }

      // Администратор имеет доступ ко всем ресурсам
      if (currentUser.isAdmin) {
        return next();
      }

      const resourceUserId = getUserIdFromParams(req);
      
      // Пользователь может получать доступ только к своим ресурсам
      if (currentUser.userId !== resourceUserId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to this resource',
            details: {
              resource_owner: resourceUserId,
              current_user: currentUser.userId
            }
          }
        });
        return;
      }

      next();

    } catch (error) {
      console.error('Resource owner middleware error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Authorization check failed'
        }
      });
    }
  };
}

/**
 * Middleware для проверки доступа к пользовательским ресурсам через URL параметр userId
 */
export function requireOwnershipByUserId() {
  return createResourceOwnerMiddleware((req: Request) => {
    const userId = parseInt(req.params.userId || req.params.id || '0', 10);
    if (isNaN(userId) || userId <= 0) {
      throw new Error('Invalid user ID in request parameters');
    }
    return userId;
  });
}

// Глобальные middleware для использования в маршрутах (будут инициализированы при старте приложения)
let _globalAuthService: AuthService | null = null;

/**
 * Инициализация глобального AuthService для middleware
 */
export function initializeGlobalAuthService(authService: AuthService): void {
  _globalAuthService = authService;
}

/**
 * Middleware для обязательной аутентификации пользователей (для маршрутов)
 */
export function authenticateUser(req: Request, res: Response, next: NextFunction): void {
  if (!_globalAuthService) {
    console.error('AuthService not initialized. Call initializeGlobalAuthService first.');
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication service not initialized'
      }
    });
    return;
  }

  return createAuthMiddleware(_globalAuthService)(req, res, next);
}

/**
 * Middleware для проверки администраторских прав (для маршрутов)
 */
export function authenticateAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!_globalAuthService) {
    console.error('AuthService not initialized. Call initializeGlobalAuthService first.');
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication service not initialized'
      }
    });
    return;
  }

  return createAuthMiddleware(_globalAuthService, { adminOnly: true })(req, res, next);
} 