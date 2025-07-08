import type { Request, Response } from 'express';
import { asyncErrorHandler } from '../middleware/error-handler.middleware.js';
import { getUserFromRequest, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import type { AuthService } from '../services/auth.service.js';
import { sendSuccessResponse, sendErrorResponse, getErrorDetails } from '../utils/response.helper.js';

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
    let { username, email } = req.body;

    // Исправляем если клиент отправляет вложенный объект
    if (typeof username === 'object' && username?.username) {
      username = username.username;
    }
    if (typeof email === 'object' && email?.email) {
      email = email.email;
    }

    if (!username || typeof username !== 'string') {
      sendErrorResponse(res, 400, 'Bad Request', 'Username is required and must be a string');
      return;
    }

    const result = await this.authService.login(username, email);

    if (result.success) {
      // Формат ответа согласно README: { token, expiresIn }
      const loginData = {
        token: result.data!.token,
        expiresIn: result.data!.expiresIn
      };
      sendSuccessResponse(res, 200, loginData);
    } else {
      const { statusCode, error } = getErrorDetails(result.error!.code);
      const message = result.error!.code === 'USER_NOT_FOUND' ? 'User not found' : result.error!.message;
      sendErrorResponse(res, statusCode, error, message);
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
      sendErrorResponse(res, 400, 'Bad Request', 'Token is required');
      return;
    }

    const result = await this.authService.validateToken(token);

    if (result.success) {
      const validationData = {
        valid: true,
        payload: result.data
      };
      sendSuccessResponse(res, 200, validationData);
    } else {
      sendErrorResponse(res, 401, 'Unauthorized', 'Invalid token');
    }
  });

  /**
   * POST /api/internal/auth
   * Тестирование аутентификации в API ставок
   */
  testExternalAuth = asyncErrorHandler(async (req: Request, res: Response): Promise<void> => {
    const { user_id } = req.body;

    if (!user_id) {
      sendErrorResponse(res, 400, 'Bad Request', 'user_id is required');
      return;
    }

    // TODO: Реализовать тестирование внешней аутентификации
    // Для примера возвращаем успешный ответ
    const externalResponse = {
      message: "Successfully authenticated",
      user_id: user_id,
      username: `user${user_id}`
    };

    sendSuccessResponse(res, 200, {
      success: true,
      external_response: externalResponse
    });
  });
} 