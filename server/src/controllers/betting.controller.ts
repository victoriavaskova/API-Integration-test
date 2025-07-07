import type { Request, Response } from 'express';
import { asyncErrorHandler } from '../middleware/error-handler.middleware.js';
import { getUserFromRequest, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import type { BettingService } from '../services/betting.service.js';

/**
 * Контроллер для ставок
 */
export class BettingController {
  constructor(private bettingService: BettingService) {}

  /**
   * GET /api/betting/recommended
   * Получение рекомендуемой ставки
   */
  getRecommendedBet = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = getUserFromRequest(req);
    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    const result = await this.bettingService.getRecommendedBet(user.userId);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data
      });
    } else {
      const statusCode = result.error!.code === 'NOT_FOUND' ? 404 : 502;
      res.status(statusCode).json({
        success: false,
        error: result.error
      });
    }
  });

  /**
   * POST /api/betting/place
   * Размещение ставки
   */
  placeBet = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = getUserFromRequest(req);
    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    const { amount } = req.body;

    if (!amount || !Number.isInteger(amount) || amount < 1 || amount > 5) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Amount must be an integer between 1 and 5',
          details: { field: 'amount', received: amount }
        }
      });
      return;
    }

    const result = await this.bettingService.placeBet(user.userId, amount);

    if (result.success) {
      res.status(201).json({
        success: true,
        data: result.data
      });
    } else {
      let statusCode = 500;
      if (result.error!.code === 'INSUFFICIENT_BALANCE') statusCode = 400;
      if (result.error!.code === 'NOT_FOUND') statusCode = 404;
      if (result.error!.code === 'EXTERNAL_API_ERROR') statusCode = 502;

      res.status(statusCode).json({
        success: false,
        error: result.error
      });
    }
  });

  /**
   * GET /api/betting/result/:betId
   * Получение результата ставки
   */
  getBetResult = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = getUserFromRequest(req);
    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    const betId = parseInt(req.params.betId, 10);
    if (isNaN(betId) || betId <= 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid bet ID',
          details: { field: 'betId', received: req.params.betId }
        }
      });
      return;
    }

    const result = await this.bettingService.getBetResult(user.userId, betId);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data
      });
    } else {
      const statusCode = result.error!.code === 'BET_NOT_FOUND' ? 404 : 502;
      res.status(statusCode).json({
        success: false,
        error: result.error
      });
    }
  });

  /**
   * GET /api/betting/bets
   * Получение списка ставок пользователя
   */
  getUserBets = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = getUserFromRequest(req);
    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;

    if (page < 1 || limit < 1 || limit > 100) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid pagination parameters',
          details: { page, limit, constraints: 'page >= 1, 1 <= limit <= 100' }
        }
      });
      return;
    }

    const result = await this.bettingService.getUserBets(user.userId, page, limit);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  });

  /**
   * GET /api/betting/bet/:betId
   * Получение информации о конкретной ставке
   */
  getBetById = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = getUserFromRequest(req);
    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    const betId = parseInt(req.params.betId, 10);
    if (isNaN(betId) || betId <= 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid bet ID',
          details: { field: 'betId', received: req.params.betId }
        }
      });
      return;
    }

    const result = await this.bettingService.getBetById(user.userId, betId);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data
      });
    } else {
      const statusCode = result.error!.code === 'BET_NOT_FOUND' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: result.error
      });
    }
  });

  /**
   * GET /api/betting/stats
   * Получение статистики ставок пользователя
   */
  getUserBetsStats = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = getUserFromRequest(req);
    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    const result = await this.bettingService.getUserBetsStats(user.userId);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  });

  /**
   * POST /api/betting/process-pending (Admin only)
   * Обработка всех ожидающих ставок
   */
  processAllPendingBets = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = getUserFromRequest(req);
    if (!user || !user.isAdmin) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Administrator access required'
        }
      });
      return;
    }

    const result = await this.bettingService.processAllPendingBets();

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  });
} 