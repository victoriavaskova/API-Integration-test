import { Router, type NextFunction, type Request, type Response } from 'express';
import type { Controllers } from '../controllers/index.js';
import { createAuthRoutes } from './auth.routes.js';
import { createBettingRoutes } from './betting.routes.js';
import { createBalanceRoutes } from './balance.routes.js';
import { createInternalRoutes } from './internal.routes.js';
import { createAdminRoutes } from './admin.routes.js';

type IdempotencyMiddleware = (req: Request, res: Response, next: NextFunction) => Promise<any>;

/**
 * Создает и настраивает все маршруты API
 */
export function createApiRoutes(
  controllers: Controllers,
  idempotency: IdempotencyMiddleware
): Router {
  const router = Router();
  console.log('🔧 Creating API routes with controllers:', Object.keys(controllers));

  // Health check endpoint
  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        api: 'ok',
        database: 'ok', // TODO: implement actual DB check
        external_api: 'ok' // TODO: implement actual external API check
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
  
  console.log('🔧 Auth routes created:', typeof authRoutes);
  console.log('🔧 Betting routes created:', typeof bettingRoutes);
  console.log('🔧 Balance routes created:', typeof balanceRoutes);
  console.log('🔧 Admin routes created:', typeof adminRoutes);
  
  router.use('/auth', authRoutes);
  router.use('/bets', bettingRoutes);
  router.use('/balance', balanceRoutes);
  router.use('/', balanceRoutes); // для /api/transactions
  router.use('/admin', adminRoutes);

  // Внутренние маршруты для тестирования
  const internalRoutes = createInternalRoutes(
    controllers.auth,
    controllers.betting,
    controllers.balance
  );
  router.use('/internal', internalRoutes);

  console.log('🔧 All routes mounted on router');
  return router;
}

// Экспорт отдельных функций создания маршрутов
export {
  createAuthRoutes,
  createBettingRoutes,
  createBalanceRoutes,
  createAdminRoutes
}; 