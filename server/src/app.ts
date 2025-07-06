import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { specs } from './config/swagger.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Betting Integration API Documentation'
}));

// Health check endpoint
/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Проверка статуса API
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API работает нормально
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 services:
 *                   type: object
 *                   properties:
 *                     api:
 *                       type: string
 *                       example: ok
 *                     database:
 *                       type: string
 *                       example: ok
 *                     external_api:
 *                       type: string
 *                       example: ok
 */
app.get('/api/health', (req, res) => {
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

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Betting Integration API Server',
    documentation: '/api-docs',
    health: '/api/health'
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ 
    statusCode: 500,
    error: 'Internal Server Error',
    message: 'Something went wrong!'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    statusCode: 404,
    error: 'Not Found',
    message: 'Route not found'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
  console.log(`🎯 External API: https://bets.tgapps.cloud/api`);
});
