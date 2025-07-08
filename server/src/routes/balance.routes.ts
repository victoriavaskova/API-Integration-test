import { Router } from 'express';
import type { BalanceController } from '../controllers/balance.controller.js';
import { authenticateUser } from '../middleware/auth.middleware.js';
import { apiLimiter } from '../middleware/rate-limiter.middleware.js';

export function createBalanceRoutes(balanceController: BalanceController): Router {
  const router = Router();

  /**
   * @swagger
   * /api/balance:
   *   get:
   *     summary: Получение текущего баланса пользователя
   *     tags: [Balance]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Текущий баланс
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 balance:
   *                   type: number
   *                   example: 1150
   *                 last_updated:
   *                   type: string
   *                   format: date-time
   *                   example: "2023-06-15T12:30:00Z"
   */
  router.get('/', apiLimiter, authenticateUser, balanceController.getBalance);

  /**
   * @swagger
   * /api/transactions:
   *   get:
   *     summary: Получение истории транзакций
   *     tags: [Balance]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Номер страницы
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 50
   *           default: 10
   *         description: Количество записей на странице
   *     responses:
   *       200:
   *         description: История транзакций
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 transactions:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         example: "789"
   *                       type:
   *                         type: string
   *                         enum: [bet_win, bet_place, deposit, withdrawal]
   *                         example: "bet_win"
   *                       amount:
   *                         type: number
   *                         example: 6
   *                       balance_before:
   *                         type: number
   *                         example: 1000
   *                       balance_after:
   *                         type: number
   *                         example: 1006
   *                       description:
   *                         type: string
   *                         example: "Win amount for bet #123"
   *                       created_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2023-06-15T10:31:00Z"
   *                 pagination:
   *                   type: object
   *                   properties:
   *                     total:
   *                       type: number
   *                       example: 15
   *                     page:
   *                       type: number
   *                       example: 1
   *                     limit:
   *                       type: number
   *                       example: 10
   *                     pages:
   *                       type: number
   *                       example: 2
   */
  router.get('/transactions', apiLimiter, authenticateUser, balanceController.getTransactions);

  return router;
} 