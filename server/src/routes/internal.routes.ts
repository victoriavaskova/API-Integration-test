import { Router } from 'express';
import type { AuthController } from '../controllers/auth.controller.js';
import type { BettingController } from '../controllers/betting.controller.js';
import type { BalanceController } from '../controllers/balance.controller.js';
import { authenticateAdmin } from '../middleware/auth.middleware.js';

export function createInternalRoutes(
  authController: AuthController,
  bettingController: BettingController,
  balanceController: BalanceController
): Router {
  const router = Router();

  /**
   * @swagger
   * /api/internal/auth:
   *   post:
   *     summary: Тестирование аутентификации в API ставок
   *     tags: [Internal]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - user_id
   *             properties:
   *               user_id:
   *                 type: string
   *                 example: "5"
   *     responses:
   *       200:
   *         description: Результат тестирования аутентификации
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 external_response:
   *                   type: object
   *                   properties:
   *                     message:
   *                       type: string
   *                       example: "Successfully authenticated"
   *                     user_id:
   *                       type: string
   *                       example: "5"
   *                     username:
   *                       type: string
   *                       example: "user5"
   */
  router.post('/auth', authenticateAdmin, authController.testExternalAuth);

  /**
   * @swagger
   * /api/internal/bet:
   *   get:
   *     summary: Тестирование получения рекомендуемой ставки от API
   *     tags: [Internal]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - user_id
   *             properties:
   *               user_id:
   *                 type: string
   *                 example: "5"
   *     responses:
   *       200:
   *         description: Результат получения рекомендуемой ставки
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 external_response:
   *                   type: object
   *                   properties:
   *                     bet:
   *                       type: number
   *                       example: 3
   */
  router.get('/bet', authenticateAdmin, bettingController.testExternalGetBet);

  /**
   * @swagger
   * /api/internal/bet:
   *   post:
   *     summary: Тестирование размещения ставки в API
   *     tags: [Internal]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - user_id
   *               - bet
   *             properties:
   *               user_id:
   *                 type: string
   *                 example: "5"
   *               bet:
   *                 type: number
   *                 example: 3
   *     responses:
   *       200:
   *         description: Результат размещения ставки
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 external_response:
   *                   type: object
   *                   properties:
   *                     message:
   *                       type: string
   *                       example: "Bet placed successfully"
   *                     bet_id:
   *                       type: string
   *                       example: "456"
   */
  router.post('/bet', authenticateAdmin, bettingController.testExternalPlaceBet);

  /**
   * @swagger
   * /api/internal/win:
   *   post:
   *     summary: Тестирование получения результата ставки от API
   *     tags: [Internal]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - user_id
   *               - bet_id
   *             properties:
   *               user_id:
   *                 type: string
   *                 example: "5"
   *               bet_id:
   *                 type: string
   *                 example: "456"
   *     responses:
   *       200:
   *         description: Результат обработки ставки
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 external_response:
   *                   type: object
   *                   properties:
   *                     win:
   *                       type: number
   *                       example: 6
   *                     message:
   *                       type: string
   *                       example: "Congratulations! You won!"
   */
  router.post('/win', authenticateAdmin, bettingController.testExternalWin);

  /**
   * @swagger
   * /api/internal/balance:
   *   post:
   *     summary: Тестирование установки/получения баланса от API
   *     tags: [Internal]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - user_id
   *             properties:
   *               user_id:
   *                 type: string
   *                 example: "5"
   *               balance:
   *                 type: number
   *                 example: 1000
   *                 description: "Баланс для установки (если не указан, то получение текущего)"
   *     responses:
   *       200:
   *         description: Результат операции с балансом
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 external_response:
   *                   type: object
   *                   properties:
   *                     message:
   *                       type: string
   *                       example: "Balance set successfully"
   *                     balance:
   *                       type: number
   *                       example: 1000
   */
  router.post('/balance', authenticateAdmin, balanceController.testExternalBalance);

  /**
   * @swagger
   * /api/internal/check-balance:
   *   post:
   *     summary: Тестирование проверки баланса в API
   *     tags: [Internal]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - user_id
   *             properties:
   *               user_id:
   *                 type: string
   *                 example: "5"
   *     responses:
   *       200:
   *         description: Результат проверки баланса
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 external_response:
   *                   type: object
   *                   properties:
   *                     balance:
   *                       type: number
   *                       example: 1006
   *                     status:
   *                       type: string
   *                       example: "ok"
   *                     timestamp:
   *                       type: string
   *                       format: date-time
   *                       example: "2023-06-15T12:30:00Z"
   */
  router.post('/check-balance', authenticateAdmin, balanceController.testExternalCheckBalance);

  return router;
} 