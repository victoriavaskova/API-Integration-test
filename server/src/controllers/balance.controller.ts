import type { Request, Response } from 'express';
import { asyncErrorHandler } from '../middleware/error-handler.middleware.js';
import { getUserFromRequest, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import type { BalanceService } from '../services/balance.service.js';

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
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    const result = await this.balanceService.getCurrentBalance(user.userId);

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
   * GET /api/balance/history
   * Получение истории баланса
   */
  getBalanceHistory = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = getUserFromRequest(req);
    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    const result = await this.balanceService.getBalanceHistory(user.userId);

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
   * GET /api/balance/consistency
   * Проверка консистентности баланса
   */
  checkBalanceConsistency = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = getUserFromRequest(req);
    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    const result = await this.balanceService.checkBalanceConsistency(user.userId);

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
} 