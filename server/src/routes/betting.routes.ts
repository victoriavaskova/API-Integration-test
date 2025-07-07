import { Router } from 'express';
import type { BettingController } from '../controllers/betting.controller.js';
import { authenticateUser } from '../middleware/auth.middleware.js';

export function createBettingRoutes(bettingController: BettingController): Router {
  const router = Router();

  /**
   * @swagger
   * /api/bets:
   *   get:
   *     summary: Получение истории ставок пользователя
   *     tags: [Bets]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: История ставок
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 bets:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         example: "123"
   *                       amount:
   *                         type: number
   *                         example: 3
   *                       status:
   *                         type: string
   *                         enum: [pending, completed, cancelled]
   *                         example: "completed"
   *                       win_amount:
   *                         type: number
   *                         example: 6
   *                       created_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2023-06-15T10:30:00Z"
   *                       completed_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2023-06-15T10:31:00Z"
   */
  router.get('/', authenticateUser, bettingController.getUserBets);

  /**
   * @swagger
   * /api/bets/{id}:
   *   get:
   *     summary: Получение информации о конкретной ставке
   *     tags: [Bets]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID ставки
   *     responses:
   *       200:
   *         description: Информация о ставке
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                   example: "123"
   *                 amount:
   *                   type: number
   *                   example: 3
   *                 status:
   *                   type: string
   *                   example: "completed"
   *                 win_amount:
   *                   type: number
   *                   example: 6
   *                 created_at:
   *                   type: string
   *                   format: date-time
   *                 completed_at:
   *                   type: string
   *                   format: date-time
   *       404:
   *         description: Ставка не найдена
   */
  router.get('/:id', authenticateUser, bettingController.getBetById);

  /**
   * @swagger
   * /api/bets:
   *   post:
   *     summary: Размещение новой ставки
   *     tags: [Bets]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - amount
   *             properties:
   *               amount:
   *                 type: number
   *                 minimum: 1
   *                 maximum: 5
   *                 example: 3
   *                 description: "Сумма ставки (от 1 до 5)"
   *     responses:
   *       201:
   *         description: Ставка размещена
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                   example: "125"
   *                 amount:
   *                   type: number
   *                   example: 3
   *                 status:
   *                   type: string
   *                   example: "pending"
   *                 created_at:
   *                   type: string
   *                   format: date-time
   *       400:
   *         description: Неверная сумма ставки
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 statusCode:
   *                   type: number
   *                   example: 400
   *                 error:
   *                   type: string
   *                   example: "Bad Request"
   *                 message:
   *                   type: string
   *                   example: "Invalid bet amount. Must be between 1 and 5."
   */
  router.post('/', authenticateUser, bettingController.placeBet);

  /**
   * @swagger
   * /api/bets/recommended:
   *   get:
   *     summary: Получение рекомендуемой ставки
   *     tags: [Bets]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Рекомендуемая ставка
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 recommended_amount:
   *                   type: number
   *                   example: 3
   */
  router.get('/recommended', authenticateUser, bettingController.getRecommendedBet);

  return router;
} 