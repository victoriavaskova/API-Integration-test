import { Router } from 'express';
import type { AuthController } from '../controllers/auth.controller.js';
import { authenticateUser } from '../middleware/auth.middleware.js';
import { authLimiter } from '../middleware/rate-limiter.middleware.js';

export function createAuthRoutes(authController: AuthController): Router {
  const router = Router();

  /**
   * @swagger
   * /api/auth/login:
   *   post:
   *     summary: Аутентификация пользователя
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - username
   *             properties:
   *               username:
   *                 type: string
   *                 example: "user1"
   *     responses:
   *       200:
   *         description: Успешная аутентификация
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 token:
   *                   type: string
   *                   example: "eyJhbGciOiJIUzI..."
   *                 expiresIn:
   *                   type: number
   *                   example: 3600
   *       404:
   *         description: Пользователь не найден
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 statusCode:
   *                   type: number
   *                   example: 404
   *                 error:
   *                   type: string
   *                   example: "Not Found"
   *                 message:
   *                   type: string
   *                   example: "User not found"
   */
  router.post('/login', authLimiter, authController.login);

  /**
   * @swagger
   * /api/auth/refresh:
   *   post:
   *     summary: Обновление JWT токена
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - token
   *             properties:
   *               token:
   *                 type: string
   *     responses:
   *       200:
   *         description: Токен обновлен
   */
  router.post('/refresh', authLimiter, authController.refreshToken);

  /**
   * @swagger
   * /api/auth/logout:
   *   post:
   *     summary: Выход из системы
   *     tags: [Auth]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Успешный выход
   */
  router.post('/logout', authenticateUser, authController.logout);

  /**
   * @swagger
   * /api/auth/me:
   *   get:
   *     summary: Получение информации о текущем пользователе
   *     tags: [Auth]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Информация о пользователе
   */
  router.get('/me', authenticateUser, authController.getCurrentUser);

  /**
   * @swagger
   * /api/auth/validate:
   *   get:
   *     summary: Проверка валидности токена
   *     tags: [Auth]
   *     parameters:
   *       - in: query
   *         name: token
   *         schema:
   *           type: string
   *         description: JWT токен для проверки
   *     responses:
   *       200:
   *         description: Токен валиден
   *       401:
   *         description: Токен невалиден
   */
  router.get('/validate', authController.validateToken);

  return router;
} 