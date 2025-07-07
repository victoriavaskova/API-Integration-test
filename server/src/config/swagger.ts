import swaggerJsdoc from 'swagger-jsdoc';
import { Options } from 'swagger-jsdoc';

const options: Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Betting Integration API',
      version: '1.0.0',
      description: `
        API для интеграции с системой ставок
        
        ## Внешний API
        Наш сервис интегрируется с внешним API ставок: https://bets.tgapps.cloud/api
        
        ## Аутентификация
        Все запросы к внешнему API требуют HMAC SHA-512 подписи.
        
        ### Конфигурация
        Все секретные данные хранятся в переменных окружения (.env файл).
        Для тестирования используйте один из доступных тестовых пользователей.
      `,
      contact: {
        name: 'API Support',
        url: 'https://bets.tgapps.cloud'
      }
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3003}/api`,
        description: 'Development server'
      },
      {
        url: process.env.EXTERNAL_API_URL || 'https://bets.tgapps.cloud/api',
        description: 'External betting API'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        signatureAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-signature',
          description: 'HMAC SHA-512 подпись запроса'
        },
        userIdAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'user-id',
          description: 'Идентификатор пользователя'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'ID пользователя' },
            username: { type: 'string', description: 'Имя пользователя' },
            email: { type: 'string', description: 'Email пользователя' },
            balance: { type: 'number', description: 'Баланс пользователя' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Bet: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'ID ставки' },
            userId: { type: 'number', description: 'ID пользователя' },
            amount: { type: 'number', description: 'Сумма ставки' },
            odds: { type: 'number', description: 'Коэффициент' },
            status: { 
              type: 'string', 
              enum: ['pending', 'completed', 'cancelled'],
              description: 'Статус ставки' 
            },
            winAmount: { type: 'number', description: 'Сумма выигрыша', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'ID транзакции' },
            userId: { type: 'number', description: 'ID пользователя' },
            type: { 
              type: 'string', 
              enum: ['deposit', 'withdrawal', 'bet', 'win'],
              description: 'Тип транзакции' 
            },
            amount: { type: 'number', description: 'Сумма транзакции' },
            description: { type: 'string', description: 'Описание транзакции' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'Сообщение об ошибке' },
            statusCode: { type: 'number', description: 'HTTP код ошибки' }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts', './src/app.ts']
};

export const specs = swaggerJsdoc(options);
