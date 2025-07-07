import type { Request, Response } from 'express';
import { asyncErrorHandler } from '../middleware/error-handler.middleware.js';
import { getUserFromRequest, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import type { AuthService, LoginResult } from '../services/auth.service.js';

/**
 * Контроллер для аутентификации
 */
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * POST /api/auth/login
   * Аутентификация пользователя по username
   */
  login = asyncErrorHandler(async (req: Request, res: Response): Promise<void> => {
    const { username } = req.body;

    if (!username) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Username is required',
          details: { field: 'username' }
        }
      });
      return;
    }

    const result = await this.authService.login(username);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data
      });
    } else {
      const statusCode = result.error!.code === 'USER_NOT_FOUND' ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        error: result.error
      });
    }
  });

  /**
   * POST /api/auth/refresh
   * Обновление JWT токена
   */
  refreshToken = asyncErrorHandler(async (req: Request, res: Response): Promise<void> => {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Token is required',
          details: { field: 'token' }
        }
      });
      return;
    }

    const result = await this.authService.refreshToken(token);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data
      });
    } else {
      const statusCode = result.error!.code === 'UNAUTHORIZED' ? 401 : 400;
      res.status(statusCode).json({
        success: false,
        error: result.error
      });
    }
  });

  /**
   * POST /api/auth/logout
   * Выход пользователя из системы
   */
  logout = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = getUserFromRequest(req);
    
    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    const result = await this.authService.logout(user.userId);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  });

  /**
   * GET /api/auth/me
   * Получение информации о текущем пользователе
   */
  getCurrentUser = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = getUserFromRequest(req);
    
    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    // Для админа возвращаем специальную информацию
    if (user.isAdmin) {
      res.status(200).json({
        success: true,
        data: {
          id: 0,
          username: 'admin',
          email: null,
          isAdmin: true,
          permissions: ['read', 'write', 'admin']
        }
      });
      return;
    }

    const result = await this.authService.getCurrentUser(user.userId);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: {
          ...result.data,
          isAdmin: false,
          permissions: ['read', 'write']
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }
  });

  /**
   * GET /api/auth/validate
   * Проверка валидности токена
   */
  validateToken = asyncErrorHandler(async (req: Request, res: Response): Promise<void> => {
    const token = req.query.token as string || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Token is required',
          details: { sources: ['query.token', 'headers.authorization'] }
        }
      });
      return;
    }

    const result = await this.authService.validateToken(token);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: {
          valid: true,
          payload: result.data
        }
      });
    } else {
      res.status(401).json({
        success: false,
        data: {
          valid: false
        },
        error: result.error
      });
    }
  });
} 