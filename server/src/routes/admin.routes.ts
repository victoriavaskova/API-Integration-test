import { Router } from 'express';
import { authenticateUser } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/admin.middleware.js';
import { BettingController } from '../controllers/betting.controller.js';

export function createAdminRoutes(
  bettingController: BettingController
): Router {
  const router = Router();

  // All routes in this file are protected and require admin privileges
  router.use(authenticateUser, requireAdmin);

  /**
   * @swagger
   * tags:
   *   name: Admin
   *   description: Admin-only operations
   */

  /**
   * @swagger
   * /api/admin/stats:
   *   get:
   *     summary: Get application statistics
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Application statistics
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 totalUsers:
   *                   type: integer
   *                   example: 15
   *                 totalBets:
   *                   type: integer
   *                   example: 150
   *                 totalTransactions:
   *                   type: integer
   *                   example: 450
   */
  router.get('/stats', bettingController.getAppStatistics);

  return router;
} 