import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { PrismaClient } from '@prisma/client';
import { specs } from './config/swagger.js';
import { createControllers } from './controllers/index.js';
import { createServices } from './services/index.js';
import { createRepositories } from './repositories/index.js';
import { createApiRoutes } from './routes/index.js';
import { initializeGlobalAuthService } from './middleware/auth.middleware.js';
import { globalLimiter } from './middleware/rate-limiter.middleware.js';
import { idempotencyMiddleware } from './middleware/idempotency.middleware.js';

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
      console.warn(`🚫 CORS blocked origin: ${origin}`);
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
    
    console.log('✅ Services initialized successfully');
    
    return { repositories, services, controllers };
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
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
      console.log(`🔍 API Request: ${req.method} ${req.url} -> ${req.path}`);
      next();
    });
    
    // Подключаем маршруты API после инициализации
    const apiRoutes = createApiRoutes(
      controllers, 
      idempotencyMiddleware(repositories.idempotency)
    );
    console.log('📋 API routes object:', typeof apiRoutes, Object.keys(apiRoutes));
    app.use('/api', apiRoutes);
    console.log('🔗 API routes connected successfully');
    
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
      console.error(err.stack);
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
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📝 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`🎯 External API: https://bets.tgapps.cloud/api`);
      console.log(`🔗 Available endpoints:`);
      console.log(`  - POST /api/auth/login - User login`);
      console.log(`  - GET /api/bets - Get user bets`);
      console.log(`  - POST /api/bets - Place a bet`);
      console.log(`  - GET /api/balance - Get user balance`);
      console.log(`  - POST /api/internal/auth - Test external API auth`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Обработка необработанных исключений
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Запуск сервера
startServer();
