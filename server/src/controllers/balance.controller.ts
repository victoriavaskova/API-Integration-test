import type { Request, Response } from 'express';
import { asyncErrorHandler } from '../middleware/error-handler.middleware.js';
import { getUserFromRequest, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import type { BalanceService } from '../services/balance.service.js';
import { sendSuccessResponse, sendErrorResponse, getErrorDetails } from '../utils/response.helper.js';

/**
 * Контроллер для управления балансом
 */
export class BalanceController {
  constructor(private balanceService: BalanceService) {}

  /**
   * GET /api/balance
   * Получение текущего баланса пользователя
   */
  getCurrentBalance = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = getUserFromRequest(req);
    if (!user) {
      sendErrorResponse(res, 401, 'Unauthorized', 'Authentication required');
      return;
    }

    const result = await this.balanceService.getCurrentBalance(user.userId);

    if (result.success) {
      // Формат ответа согласно README: { balance, last_updated }
      const balanceData = {
        balance: result.data!.balance,
        last_updated: result.data!.last_updated
      };
      sendSuccessResponse(res, 200, balanceData);
    } else {
      const { statusCode, error } = getErrorDetails(result.error!.code);
      sendErrorResponse(res, statusCode, error, result.error!.message);
    }
  });

  /**
   * POST /api/balance/initialize
   * Инициализация баланса для пользователя
   */
  initializeBalance = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = getUserFromRequest(req);
    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    const { initial_amount } = req.body;

    if (typeof initial_amount !== 'number' || initial_amount < 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Initial amount must be a non-negative number',
          details: { field: 'initial_amount', received: initial_amount }
        }
      });
      return;
    }

    const result = await this.balanceService.initializeBalance(user.userId, initial_amount);

    if (result.success) {
      res.status(201).json({
        success: true,
        data: result.data
      });
    } else {
      let statusCode = 500;
      if (result.error!.code === 'VALIDATION_ERROR') statusCode = 400;
      if (result.error!.code === 'USER_NOT_FOUND') statusCode = 404;

      res.status(statusCode).json({
        success: false,
        error: result.error
      });
    }
  });

  /**
   * POST /api/balance/sync
   * Синхронизация баланса с внешним API
   */
  syncWithExternalApi = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = getUserFromRequest(req);
    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    const result = await this.balanceService.syncWithExternalApi(user.userId);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data
      });
    } else {
      let statusCode = 500;
      if (result.error!.code === 'USER_NOT_FOUND') statusCode = 404;
      if (result.error!.code === 'EXTERNAL_API_ERROR') statusCode = 502;

      res.status(statusCode).json({
        success: false,
        error: result.error
      });
    }
  });

  /**
   * POST /api/balance/add-funds
   * Добавление средств к балансу
   */
  addFunds = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = getUserFromRequest(req);
    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    const { amount, description } = req.body;

    if (typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Amount must be a positive number',
          details: { field: 'amount', received: amount }
        }
      });
      return;
    }

    const result = await this.balanceService.addFunds(user.userId, amount, description);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data
      });
    } else {
      const statusCode = result.error!.code === 'BALANCE_NOT_FOUND' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: result.error
      });
    }
  });

  /**
   * POST /api/balance/withdraw-funds
   * Списание средств с баланса
   */
  withdrawFunds = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = getUserFromRequest(req);
    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    const { amount, description } = req.body;

    if (typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Amount must be a positive number',
          details: { field: 'amount', received: amount }
        }
      });
      return;
    }

    const result = await this.balanceService.withdrawFunds(user.userId, amount, description);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data
      });
    } else {
      let statusCode = 500;
      if (result.error!.code === 'BALANCE_NOT_FOUND') statusCode = 404;
      if (result.error!.code === 'INSUFFICIENT_BALANCE') statusCode = 400;

      res.status(statusCode).json({
        success: false,
        error: result.error
      });
    }
  });

  /**
   * GET /api/transactions
   * Получение истории транзакций
   */
  getTransactions = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = getUserFromRequest(req);
    if (!user) {
      sendErrorResponse(res, 401, 'Unauthorized', 'Authentication required');
      return;
    }

    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;

    if (page < 1 || limit < 1 || limit > 50) {
      sendErrorResponse(res, 400, 'Bad Request', 'Invalid pagination parameters');
      return;
    }

    const result = await this.balanceService.getTransactions(user.userId, page, limit);

    if (result.success) {
      // Формат ответа согласно README: { transactions: [...], pagination: {...} }
      sendSuccessResponse(res, 200, result.data);
    } else {
      const { statusCode, error } = getErrorDetails(result.error!.code);
      sendErrorResponse(res, statusCode, error, result.error!.message);
    }
  });

  /**
   * GET /api/balance/history
   * Получение истории баланса
   */
  getBalanceHistory = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = getUserFromRequest(req);
    if (!user) {
      sendErrorResponse(res, 401, 'Unauthorized', 'Authentication required');
      return;
    }

    const result = await this.balanceService.getBalanceHistory(user.userId);

    if (result.success) {
      sendSuccessResponse(res, 200, result.data);
    } else {
      const { statusCode, error } = getErrorDetails(result.error!.code);
      sendErrorResponse(res, statusCode, error, result.error!.message);
    }
  });

  /**
   * GET /api/balance/consistency
   * Проверка консистентности баланса
   */
  checkBalanceConsistency = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = getUserFromRequest(req);
    if (!user) {
      sendErrorResponse(res, 401, 'Unauthorized', 'Authentication required');
      return;
    }

    const result = await this.balanceService.checkBalanceConsistency(user.userId);

    if (result.success) {
      sendSuccessResponse(res, 200, result.data);
    } else {
      const { statusCode, error } = getErrorDetails(result.error!.code);
      sendErrorResponse(res, statusCode, error, result.error!.message);
    }
  });

  /**
   * POST /api/internal/balance
   * Тестирование установки/получения баланса от API
   */
  testExternalBalance = asyncErrorHandler(async (req: Request, res: Response): Promise<void> => {
    const { user_id, balance } = req.body;

    if (!user_id) {
      sendErrorResponse(res, 400, 'Bad Request', 'user_id is required');
      return;
    }

    if (balance !== undefined) {
      // Установка баланса
      if (typeof balance !== 'number' || balance < 0) {
        sendErrorResponse(res, 400, 'Bad Request', 'Balance must be a non-negative number');
        return;
      }

      const externalResponse = {
        message: "Balance set successfully",
        balance: balance
      };

      sendSuccessResponse(res, 200, {
        success: true,
        external_response: externalResponse
      });
    } else {
      // Получение баланса
      const externalResponse = {
        balance: Math.floor(Math.random() * 10000) // случайный баланс
      };

      sendSuccessResponse(res, 200, {
        success: true,
        external_response: externalResponse
      });
    }
  });

  /**
   * POST /api/internal/check-balance
   * Тестирование проверки баланса в API
   */
  testExternalCheckBalance = asyncErrorHandler(async (req: Request, res: Response): Promise<void> => {
    const { user_id } = req.body;

    if (!user_id) {
      sendErrorResponse(res, 400, 'Bad Request', 'user_id is required');
      return;
    }

    // TODO: Реализовать реальную проверку баланса через внешний API
    // Симулируем ответ от внешнего API check-balance endpoint (GET)
    const actualBalance = Math.floor(Math.random() * 10000);

    const externalResponse = {
      balance: actualBalance,
      status: 'ok',
      timestamp: new Date().toISOString()
    };

    sendSuccessResponse(res, 200, {
      success: true,
      external_response: externalResponse
    });
  });
} 