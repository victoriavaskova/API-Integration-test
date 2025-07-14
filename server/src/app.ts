import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { PrismaClient } from '@prisma/client';
import { specs } from './config/swagger.js';
import logger from './config/logger.js';
import { createControllers } from './controllers/index.js';
import { createServices } from './services/index.js';
import { createRepositories } from './repositories/index.js';
import { createApiRoutes } from './routes/index.js';
import { initializeGlobalAuthService } from './middleware/auth.middleware.js';
import { globalLimiter } from './middleware/rate-limiter.middleware.js';
import { idempotencyMiddleware } from './middleware/idempotency.middleware.js';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

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
    if (!origin) return callback(null, true);
    
    if (corsOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      logger.warn(`🚫 CORS blocked origin: ${origin}`);
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

app.use(globalLimiter);

// Admin Panel
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

async function initializeServices() {
  try {
    const prisma = new PrismaClient();
    await prisma.$connect();
    
    const repositories = createRepositories(prisma);
    
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
    
    const services = createServices(repositories, servicesConfig);
    
    initializeGlobalAuthService(services.auth);
    
    const controllers = createControllers(services);
    
    logger.info('✅ Services initialized successfully');
    
    return { repositories, services, controllers };
  } catch (error) {
    logger.error('❌ Failed to initialize services:', error);
    throw error;
  }
}


async function startServer() {
  try {
    const { controllers, repositories } = await initializeServices();
    
    app.use('/api', (req, _res, next) => {
      logger.debug(`🔍 API Request: ${req.method} ${req.url} -> ${req.path}`);
      next();
    });
    
    const apiRoutes = createApiRoutes(
      controllers,
      idempotencyMiddleware(repositories.idempotency)
    );
    logger.info('📋 API routes object created');
    app.use('/api', apiRoutes);
    logger.info('🔗 API routes connected successfully');
    
    app.get('/', (_req, res) => {
      res.json({
        message: 'Betting Integration API Server',
        documentation: '/api-docs',
        health: '/api/health'
      });
    });

    // Error handling middleware
    app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      logger.error(err.stack);
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
    
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📝 Health check: http://localhost:${PORT}/api/health`);
      logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      logger.info(`🔒 Admin Panel: http://localhost:${PORT}/admin`);
      logger.info(`🎯 External API: https://bets.tgapps.cloud/api`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  process.exit(1);
});

// Start server
startServer();