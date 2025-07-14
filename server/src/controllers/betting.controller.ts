import type { Request, Response, NextFunction } from 'express';
import { asyncErrorHandler } from '../middleware/error-handler.middleware.js';
import { getUserFromRequest, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import type { BettingService } from '../services/betting.service.js';
import { sendSuccessResponse, sendErrorResponse, getErrorDetails, formatId, formatDate } from '../utils/response.helper.js';

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
      sendErrorResponse(res, 401, 'Unauthorized', 'Authentication required');
      return;
    }

    const result = await this.bettingService.getRecommendedBet(user.userId);

    if (result.success) {
      const recommendedBetData = {
        recommended_amount: result.data!.recommended_amount
      };
      sendSuccessResponse(res, 200, recommendedBetData);
    } else {
      const { statusCode, error } = getErrorDetails(result.error!.code);
      sendErrorResponse(res, statusCode, error, result.error!.message);
    }
  });

  /**
   * POST /api/betting/place
   * Размещение ставки
   */
  placeBet = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = getUserFromRequest(req);
    if (!user) {
      sendErrorResponse(res, 401, 'Unauthorized', 'Authentication required');
      return;
    }

    const { amount } = req.body;

    if (!amount || !Number.isInteger(amount) || amount < 1 || amount > 5) {
      sendErrorResponse(res, 400, 'Bad Request', 'Invalid bet amount. Must be between 1 and 5.');
      return;
    }

    const result = await this.bettingService.placeBet(user.userId, amount);

    if (result.success) {
      const betData = {
        id: formatId(result.data!.id),
        amount: result.data!.amount.toString(),
        status: result.data!.status.toLowerCase(),
        created_at: formatDate(new Date(result.data!.created_at))
      };
      sendSuccessResponse(res, 201, betData);
    } else {
      const { statusCode, error } = getErrorDetails(result.error!.code);
      let message = result.error!.message;
      
      if (result.error!.code === 'INSUFFICIENT_BALANCE') {
        message = 'Invalid bet amount. Must be between 1 and 5.';
      }
      
      sendErrorResponse(res, statusCode, error, message);
    }
  });

  /**
   * GET /api/bets/result/:id
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

    const betId = parseInt(req.params.id, 10);
    if (isNaN(betId) || betId <= 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid bet ID',
          details: { field: 'betId', received: req.params.id }
        }
      });
      return;
    }

    const result = await this.bettingService.getBetResult(user.userId, betId);

    if (result.success) {
      const betData = {
        id: formatId(result.data!.id),
        amount: result.data!.amount.toString(),
        status: result.data!.status.toLowerCase(),
        win_amount: result.data!.win_amount ? result.data!.win_amount.toString() : undefined,
        created_at: result.data!.created_at,
        completed_at: result.data!.completed_at || undefined
      };
      
      res.status(200).json(betData);
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
  getUserBets = async (req: Request, res: Response) => {
    const { userId } = (req as any).user;
    const { page, limit } = req.query;

    const result = await this.bettingService.getUserBets(
      userId,
      page ? parseInt(page as string) : undefined,
      limit ? parseInt(limit as string) : undefined
    );

    if (result.success) {
      res.status(200).json(result.data);
    } else {
      const errorDetails = getErrorDetails(result.error?.code);
      sendErrorResponse(res, errorDetails.statusCode, errorDetails.error, result.error!.message);
    }
  };

  /**
   * GET /api/betting/bet/:betId
   * Получение информации о конкретной ставке
   */
  getBetById = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = getUserFromRequest(req);
    if (!user) {
      sendErrorResponse(res, 401, 'Unauthorized', 'Authentication required');
      return;
    }

    const betId = parseInt(req.params.id, 10);
    if (isNaN(betId) || betId <= 0) {
      sendErrorResponse(res, 400, 'Bad Request', 'Invalid bet ID');
      return;
    }

    const result = await this.bettingService.getBetById(user.userId, betId);

    if (result.success) {
      const betData = {
        id: formatId(result.data!.id),
        amount: Number(result.data!.amount).toString(),
        status: result.data!.status.toLowerCase(),
        win_amount: result.data!.winAmount ? Number(result.data!.winAmount).toString() : undefined,
        created_at: formatDate(result.data!.createdAt),
        completed_at: result.data!.completedAt ? formatDate(result.data!.completedAt) : undefined
      };
      sendSuccessResponse(res, 200, betData);
    } else {
      const { statusCode, error } = getErrorDetails(result.error!.code);
      const message = result.error!.code === 'BET_NOT_FOUND' ? 'Bet not found' : result.error!.message;
      sendErrorResponse(res, statusCode, error, message);
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
      sendErrorResponse(res, 403, 'Forbidden', 'Administrator access required');
      return;
    }

    const result = await this.bettingService.processAllPendingBets();

    if (result.success) {
      sendSuccessResponse(res, 200, result.data);
    } else {
      sendErrorResponse(res, 500, 'Internal Server Error', result.error!.message);
    }
  });

  /**
   * GET /api/internal/bet
   * Тестирование получения рекомендуемой ставки от API
   */
  testExternalGetBet = asyncErrorHandler(async (req: Request, res: Response): Promise<void> => {
    const user_id = req.query.user_id || req.body.user_id;

    if (!user_id) {
      sendErrorResponse(res, 400, 'Bad Request', 'user_id is required');
      return;
    }

    const externalResponse = {
      bet: Math.floor(Math.random() * 5) + 1 // случайная ставка от 1 до 5
    };

    sendSuccessResponse(res, 200, {
      success: true,
      external_response: externalResponse
    });
  });

  /**
   * POST /api/internal/bet
   * Тестирование размещения ставки в API
   */
  testExternalPlaceBet = asyncErrorHandler(async (req: Request, res: Response): Promise<void> => {
    const { user_id, bet } = req.body;

    if (!user_id || !bet) {
      sendErrorResponse(res, 400, 'Bad Request', 'user_id and bet are required');
      return;
    }

    if (bet < 1 || bet > 5) {
      sendErrorResponse(res, 400, 'Bad Request', 'Bet must be between 1 and 5');
      return;
    }

    const externalResponse = {
      message: "Bet placed successfully",
      bet_id: Math.random().toString(36).substr(2, 9) // случайный ID
    };

    sendSuccessResponse(res, 200, {
      success: true,
      external_response: externalResponse
    });
  });

  /**
   * POST /api/internal/win
   * Тестирование получения результата ставки от API
   */
  testExternalWin = asyncErrorHandler(async (req: Request, res: Response): Promise<void> => {
    const { user_id, bet_id } = req.body;

    if (!user_id || !bet_id) {
      sendErrorResponse(res, 400, 'Bad Request', 'user_id and bet_id are required');
      return;
    }

    const isWin = Math.random() > 0.5; // 50% шанс выигрыша
    const externalResponse = isWin ? {
      win: 6,
      message: "Congratulations! You won!"
    } : {
      win: 0,
      message: "Better luck next time!"
    };

    sendSuccessResponse(res, 200, {
      success: true,
      external_response: externalResponse
    });
  });

  getAppStatistics = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.bettingService.getAppStatistics();
      res.status(200).json(stats);
    } catch (error) {
      next(error);
    }
  };
} 