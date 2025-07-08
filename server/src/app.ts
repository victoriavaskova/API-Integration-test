import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { PrismaClient } from '@prisma/client';
import { specs } from './config/swagger.js';
import logger from './config/logger.js'; // Импортируем логгер
import { createControllers } from './controllers/index.js';
import { createServices } from './services/index.js';
import { createRepositories } from './repositories/index.js';
import { createApiRoutes } from './routes/index.js';
import { initializeGlobalAuthService } from './middleware/auth.middleware.js';
import { globalLimiter } from './middleware/rate-limiter.middleware.js';
import { idempotencyMiddleware } from './middleware/idempotency.middleware.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(helmet());

// CORS Configuration - Support both development ports
const corsOrigins = [
  process.env.CLIENT_URL || 'http://localhost:3001',
  'http://localhost:3001',  // Current client development port
  'http://localhost:3000',  // Backup port
  'http://localhost:5173',  // Vite default port (backup)
  'http://localhost:8080'   // Alternative port
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (corsOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      logger.warn(`🚫 CORS blocked origin: ${origin}`); // Заменяем console.warn
      return callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  exposedHeaders: ['Content-Length', 'X-Requested-With']
}));

app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply global rate limiting
app.use(globalLimiter);

// Serve Admin Panel
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/admin', express.static(path.join(__dirname, 'public/admin')));
app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin/index.html'));
});

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Betting Integration API Documentation'
}));

// Инициализация сервисов, репозиториев и контроллеров
async function initializeServices() {
  try {
    // Инициализируем Prisma Client
    const prisma = new PrismaClient();
    await prisma.$connect();
    
    // Создаем репозитории
    const repositories = createRepositories(prisma);
    
    // Создаем конфигурацию для сервисов
    const servicesConfig = {
      auth: {
        jwtSecret: process.env.JWT_SECRET || (() => {
          throw new Error('JWT_SECRET environment variable is required');
        })(),
        jwtExpiresIn: '24h',
        adminToken: process.env.ADMIN_TOKEN || (() => {
          throw new Error('ADMIN_TOKEN environment variable is required');
        })()
      },
      externalApi: {
        maxRetries: 3,
        retryDelay: 1000,
        timeout: 30000,
        enableLogging: true
      }
    };
    
    // Создаем сервисы
    const services = createServices(repositories, servicesConfig);
    
    // Инициализируем глобальный AuthService для middleware
    initializeGlobalAuthService(services.auth);
    
    // Создаем контроллеры
    const controllers = createControllers(services);
    
    logger.info('✅ Services initialized successfully'); // Заменяем console.log
    
    return { repositories, services, controllers };
  } catch (error) {
    logger.error('❌ Failed to initialize services:', error); // Заменяем console.error
    throw error;
  }
}

// Placeholder for API routes - will be connected after services init
// This ensures proper route order

// Запуск сервера
async function startServer() {
  try {
    // Инициализируем сервисы
    const { controllers, repositories } = await initializeServices();
    
    // Отладочный middleware для проверки всех запросов
    app.use('/api', (req, _res, next) => {
      logger.debug(`🔍 API Request: ${req.method} ${req.url} -> ${req.path}`); // Заменяем console.log
      next();
    });
    
    // Подключаем маршруты API после инициализации
    const apiRoutes = createApiRoutes(
      controllers, 
      idempotencyMiddleware(repositories.idempotency)
    );
    logger.info('📋 API routes object created'); // Заменяем console.log
    app.use('/api', apiRoutes);
    logger.info('🔗 API routes connected successfully'); // Заменяем console.log
    
    // Routes
    app.get('/', (_req, res) => {
      res.json({ 
        message: 'Betting Integration API Server',
        documentation: '/api-docs',
        health: '/api/health'
      });
    });

    // Error handling middleware
    app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      logger.error(err.stack); // Заменяем console.error
      res.status(500).json({ 
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Something went wrong!'
      });
    });

    // 404 handler
    app.use('*', (_req, res) => {
      res.status(404).json({
        statusCode: 404,
        error: 'Not Found',
        message: 'Route not found'
      });
    });
    
    // Запускаем сервер
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📝 Health check: http://localhost:${PORT}/api/health`);
      logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      logger.info(`🔒 Admin Panel: http://localhost:${PORT}/admin`);
      logger.info(`🎯 External API: https://bets.tgapps.cloud/api`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error); // Заменяем console.error
    process.exit(1);
  }
}

// Обработка необработанных исключений
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error); // Заменяем console.error
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason }); // Заменяем console.error
  process.exit(1);
});

// Запуск сервера
startServer();