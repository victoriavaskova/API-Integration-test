import { Router, type NextFunction, type Request, type Response } from 'express';
import type { Controllers } from '../controllers/index.js';
import { createAuthRoutes } from './auth.routes.js';
import { createBettingRoutes } from './betting.routes.js';
import { createBalanceRoutes } from './balance.routes.js';
import { createInternalRoutes } from './internal.routes.js';
import { createAdminRoutes } from './admin.routes.js';
import logger from '../config/logger.js';

type IdempotencyMiddleware = (req: Request, res: Response, next: NextFunction) => Promise<any>;

/**
 * Создает и настраивает все маршруты API
 */
export function createApiRoutes(
  controllers: Controllers,
  idempotency: IdempotencyMiddleware
): Router {
  const router = Router();
  logger.debug('🔧 Creating API routes...');

  // Health check endpoint
  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        api: 'ok',
        database: 'ok',
        external_api: 'ok'
      }
    });
  });

  // Тестовые маршруты для отладки
  router.get('/test', (_req, res) => {
    res.json({ message: 'Test route works!' });
  });

  router.post('/test-auth', (_req, res) => {
    res.json({ message: 'Test auth route works!' });
  });

  // Основные маршруты API
  const authRoutes = createAuthRoutes(controllers.auth);
  const bettingRoutes = createBettingRoutes(controllers.betting, idempotency);
  const balanceRoutes = createBalanceRoutes(controllers.balance);
  const adminRoutes = createAdminRoutes(controllers.betting);
  
  logger.debug('🔧 Auth, Betting, Balance, and Admin routes created.');
  
  router.use('/auth', authRoutes);
  router.use('/bets', bettingRoutes);
  router.use('/balance', balanceRoutes);
  router.use('/', balanceRoutes);
  router.use('/admin', adminRoutes);

  // Внутренние маршруты для тестирования
  const internalRoutes = createInternalRoutes(
    controllers.auth,
    controllers.betting,
    controllers.balance
  );
  router.use('/internal', internalRoutes);

  logger.debug('🔧 All routes mounted on router');
  return router;
}

// Экспорт отдельных функций создания маршрутов
export {
  createAuthRoutes,
  createBettingRoutes,
  createBalanceRoutes,
  createAdminRoutes
}; 